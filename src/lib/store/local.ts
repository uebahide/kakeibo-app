import { DEFAULT_SETTINGS, normalizeCategories } from "../categories";
import { normalizeTimeZone } from "../date";
import { normalizeCurrency } from "../format";
import { normalizeLanguage } from "../i18n";
import { dict } from "../i18n/dict";
import { clampStartDay } from "../period";
import { normalizeGoal } from "../savings";
import { normalizeWeekStart } from "../week";
import type { TrashEntry } from "../trash";
import type { NewTransaction, Settings, Transaction } from "../types";
import type { KakeiboStore } from "./types";

const KEY = "kakeibo-app.v1";

type Saved = { transactions: Transaction[]; settings: Settings; trash?: TrashEntry[] };

function read(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Saved>;
      return {
        transactions: saved.transactions ?? [],
        trash: saved.trash ?? [],
        settings: {
          ...DEFAULT_SETTINGS,
          ...saved.settings,
          goal: normalizeGoal(saved.settings?.goal),
          monthStartDay: clampStartDay(saved.settings?.monthStartDay),
          currency: normalizeCurrency(saved.settings?.currency),
          timeZone: normalizeTimeZone(saved.settings?.timeZone, saved.settings?.currency),
          weekStartDay: normalizeWeekStart(saved.settings?.weekStartDay),
          language: normalizeLanguage(saved.settings?.language),
          categories: normalizeCategories(saved.settings?.categories),
        },
      };
    }
  } catch {
    // storage blocked or corrupted: start empty
  }
  return { transactions: [], settings: structuredClone(DEFAULT_SETTINGS) };
}

function write(data: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage full or blocked: keep working in memory
  }
}

/** Demo store used when Supabase is not configured. Data stays in this browser. */
export function createLocalStore(): KakeiboStore {
  let data: Saved | null = null;
  const get = () => (data ??= read());
  const commit = () => write(get());
  // Creation times always move forward, so records saved together (a split payment's parts) keep their order.
  let lastCreated = "";
  const createdNow = () => {
    let at = new Date().toISOString();
    if (at <= lastCreated) at = new Date(Date.parse(lastCreated) + 1).toISOString();
    return (lastCreated = at);
  };

  return {
    kind: "local",
    async load() {
      const { transactions, settings } = get();
      return structuredClone({ transactions, settings });
    },
    async addTransactions(items: NewTransaction[]) {
      const created = items.map((item) => ({
        ...item,
        id: crypto.randomUUID(),
        createdAt: createdNow(),
      }));
      get().transactions.push(...created);
      commit();
      return created;
    },
    async updateTransaction(id, item) {
      const list = get().transactions;
      const i = list.findIndex((t) => t.id === id);
      if (i < 0) throw new Error(dict().common.recordNotFound);
      list[i] = { ...list[i], ...item };
      // a record taken out of a split payment loses the mark
      if (!item.splitId) delete list[i].splitId;
      if (!item.note) delete list[i].note;
      commit();
      return list[i];
    },
    async deleteTransaction(id) {
      get().transactions = get().transactions.filter((t) => t.id !== id);
      commit();
    },
    async restoreTransactions(items) {
      const restored = structuredClone(items);
      get().transactions.push(...restored);
      commit();
      return structuredClone(restored);
    },
    async trashTransactions(items) {
      const ids = new Set(items.map((t) => t.id));
      const entry: TrashEntry = { id: crypto.randomUUID(), deletedAt: new Date().toISOString(), records: structuredClone(items) };
      const data = get();
      data.transactions = data.transactions.filter((t) => !ids.has(t.id));
      data.trash = [entry, ...(data.trash ?? [])];
      commit();
      return structuredClone(entry);
    },
    async loadTrash() {
      return structuredClone(get().trash ?? []);
    },
    async restoreTrash(entry) {
      const data = get();
      const known = new Set(data.transactions.map((t) => t.id));
      const restored = structuredClone(entry.records.filter((t) => !known.has(t.id)));
      data.transactions.push(...restored);
      data.trash = (data.trash ?? []).filter((e) => e.id !== entry.id);
      commit();
      return structuredClone(restored);
    },
    async dropTrash(id) {
      get().trash = (get().trash ?? []).filter((e) => e.id !== id);
      commit();
    },
    async deleteSamples() {
      get().transactions = get().transactions.filter((t) => !t.isSample);
      commit();
    },
    async moveCategory(from, to) {
      for (const t of get().transactions) if (t.category === from) t.category = to;
      commit();
    },
    async saveSettings(settings) {
      get().settings = structuredClone(settings);
      commit();
    },
  };
}
