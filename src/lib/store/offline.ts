import type { NewTransaction, Settings, Transaction } from "../types";
import type { KakeiboStore } from "./types";

/** A request that never reached the server (no signal, airplane mode, a dropped connection). */
export class OfflineError extends Error {}

/** Whether `e` means the device could not reach the server, rather than the server turning the request down. */
export function isOffline(e: unknown): boolean {
  return e instanceof OfflineError || (typeof navigator !== "undefined" && navigator.onLine === false);
}

/** Where the waiting records and the last loaded data are kept on this device. */
export interface DeviceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const QUEUE_KEY = "kakeibo-app.pending";
const SNAPSHOT_KEY = "kakeibo-app.snapshot";

function browserStorage(): DeviceStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function read<T>(storage: DeviceStorage | null, key: string): T | null {
  try {
    const raw = storage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(storage: DeviceStorage | null, key: string, value: unknown) {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked: carry on without it
  }
}

/** Forgets the data kept for opening the app offline (on sign out). Records still waiting to be sent stay. */
export function clearSnapshot(storage: DeviceStorage | null = browserStorage()) {
  try {
    storage?.removeItem(SNAPSHOT_KEY);
  } catch {
    // storage blocked: nothing was kept
  }
}

/**
 * Wraps the signed-in store so the app keeps working without a signal:
 * - a new record that can't be sent is kept on this device (marked `pending`) and sent by `sync()` later,
 *   with the id and creation time it was given here, so sending it twice can't make two records;
 * - a record still waiting can be edited or deleted on the device;
 * - opening the app offline shows what was loaded last time (`saveSnapshot`), with `fromDevice` set.
 * Changing a record already on the server still needs the connection.
 */
export function withOfflineQueue(inner: KakeiboStore, storage: DeviceStorage | null = browserStorage()): KakeiboStore {
  const queue = () => read<Transaction[]>(storage, QUEUE_KEY) ?? [];
  const setQueue = (items: Transaction[]) => {
    if (items.length) write(storage, QUEUE_KEY, items);
    else
      try {
        storage?.removeItem(QUEUE_KEY);
      } catch {
        // storage blocked
      }
  };
  const queued = (id: string) => queue().some((t) => t.id === id);
  const keep = (items: Transaction[]) => {
    const ids = new Set(items.map((t) => t.id));
    setQueue([...queue().filter((t) => !ids.has(t.id)), ...items]);
  };
  // true while showing the snapshot: the next sync loads everything from the server first
  let fromDevice = false;
  let syncing: ReturnType<NonNullable<KakeiboStore["sync"]>> | null = null;

  /** Adds the records still waiting to what the server sent (the ones it already has are left out). */
  const withQueue = (transactions: Transaction[]) => {
    const known = new Set(transactions.map((t) => t.id));
    return [...transactions, ...queue().filter((t) => !known.has(t.id))];
  };

  async function sync() {
    const loaded = fromDevice ? await inner.load() : undefined;
    fromDevice = false;
    const waiting = queue();
    const sent = waiting.length && inner.sendQueued ? await inner.sendQueued(waiting) : [];
    // only drop what was sent: a record kept while sending waits for the next sync
    const sentIds = new Set(sent.map((t) => t.id));
    setQueue(queue().filter((t) => !sentIds.has(t.id)));
    if (!loaded) return sent.length ? { sent } : null;
    const others = loaded.transactions.filter((t) => !sentIds.has(t.id));
    return { sent, loaded: { transactions: withQueue([...others, ...sent]), settings: loaded.settings } };
  }

  return {
    ...inner,
    async load() {
      try {
        const data = await inner.load();
        fromDevice = false;
        return { ...data, transactions: withQueue(data.transactions) };
      } catch (e) {
        const snapshot = isOffline(e) ? read<{ transactions: Transaction[]; settings: Settings }>(storage, SNAPSHOT_KEY) : null;
        if (!snapshot) throw e;
        fromDevice = true;
        return { transactions: withQueue(snapshot.transactions), settings: snapshot.settings, fromDevice: true };
      }
    },
    async addTransactions(items: NewTransaction[]) {
      try {
        return await inner.addTransactions(items);
      } catch (e) {
        if (!isOffline(e)) throw e;
        const now = new Date().toISOString();
        const created = items.map((item): Transaction => ({ ...item, id: crypto.randomUUID(), createdAt: now, pending: true }));
        keep(created);
        return created;
      }
    },
    async updateTransaction(id, item) {
      const waiting = queue().find((t) => t.id === id);
      if (!waiting) return inner.updateTransaction(id, item);
      const updated: Transaction = { ...item, id, createdAt: waiting.createdAt, pending: true };
      keep([updated]);
      return updated;
    },
    async deleteTransaction(id) {
      if (!queued(id)) return inner.deleteTransaction(id);
      setQueue(queue().filter((t) => t.id !== id));
    },
    async trashTransactions(items) {
      if (!items.every((t) => queued(t.id))) return inner.trashTransactions(items);
      // never sent, so there is nothing to keep in "Recently deleted"; Undo puts them back in the queue
      const ids = new Set(items.map((t) => t.id));
      setQueue(queue().filter((t) => !ids.has(t.id)));
      return null;
    },
    async restoreTransactions(items) {
      if (!items.every((t) => t.pending)) return inner.restoreTransactions(items);
      keep(items);
      return items;
    },
    async moveCategory(from, to) {
      await inner.moveCategory(from, to);
      setQueue(queue().map((t) => (t.category === from ? { ...t, category: to } : t)));
    },
    sync() {
      // one at a time: "online" and "back to the front" can fire together
      syncing ??= sync().finally(() => {
        syncing = null;
      });
      return syncing;
    },
    saveSnapshot(data) {
      write(storage, SNAPSHOT_KEY, { transactions: data.transactions.filter((t) => !t.pending), settings: data.settings });
    },
  };
}
