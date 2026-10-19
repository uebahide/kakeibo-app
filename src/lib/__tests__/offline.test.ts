import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/categories";
import { OfflineError, withOfflineQueue, type DeviceStorage } from "@/lib/store/offline";
import type { KakeiboStore } from "@/lib/store/types";
import type { NewTransaction, Transaction } from "@/lib/types";
import { tx } from "./helpers";

// The signed-in store, standing in for Supabase: `online` decides whether a request gets through.
let online = true;
let server: Transaction[] = [];
let seq = 0;
const reach = () => {
  if (!online) throw new OfflineError("TypeError: Failed to fetch");
};
const inner = {
  kind: "supabase",
  load: async () => (reach(), { transactions: [...server], settings: structuredClone(DEFAULT_SETTINGS) }),
  addTransactions: async (items: NewTransaction[]) => {
    reach();
    const created = items.map((i) => ({ ...i, id: `s${++seq}`, createdAt: "2026-10-19T00:00:00Z" }));
    server.push(...created);
    return created;
  },
  updateTransaction: async (id: string, item: NewTransaction) => {
    reach();
    const i = server.findIndex((t) => t.id === id);
    server[i] = { ...item, id, createdAt: server[i].createdAt };
    return server[i];
  },
  deleteTransaction: async (id: string) => {
    reach();
    server = server.filter((t) => t.id !== id);
  },
  restoreTransactions: async (items: Transaction[]) => (reach(), server.push(...items), items),
  trashTransactions: async () => (reach(), null),
  moveCategory: async () => reach(),
  sendQueued: async (items: Transaction[]) => {
    reach();
    const known = new Set(server.map((t) => t.id));
    const sent = items.map((t) => ({ ...t, pending: undefined }));
    server.push(...sent.filter((t) => !known.has(t.id)));
    return sent;
  },
} as unknown as KakeiboStore;

function memoryStorage(): DeviceStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

const lunch: NewTransaction = { date: "2026-10-19", amount: 900, type: "expense", category: "food", memo: "ランチ", isSample: false };

let storage: ReturnType<typeof memoryStorage>;
beforeEach(() => {
  online = true;
  server = [tx("2026-10-18", 500, { id: "old" })];
  storage = memoryStorage();
});

describe("recording without a signal", () => {
  it("keeps a new record on the device, then sends it with the same id once back online", async () => {
    const store = withOfflineQueue(inner, storage);
    await store.load();
    online = false;
    const [kept] = await store.addTransactions([lunch]);
    expect(kept).toMatchObject({ memo: "ランチ", pending: true });
    expect(server).toHaveLength(1);

    // still offline: nothing goes, nothing is lost
    await expect(store.sync!()).rejects.toThrow(OfflineError);
    online = true;
    const result = await store.sync!();
    expect(result?.sent.map((t) => [t.id, t.pending])).toEqual([[kept.id, undefined]]);
    expect(server.map((t) => t.id)).toEqual(["old", kept.id]);
    expect(await store.sync!()).toBeNull();
  });

  it("sends a record only once, even if an earlier send got through without an answer", async () => {
    const store = withOfflineQueue(inner, storage);
    online = false;
    const [kept] = await store.addTransactions([lunch]);
    online = true;
    server.push({ ...kept, pending: undefined });
    await store.sync!();
    expect(server.filter((t) => t.id === kept.id)).toHaveLength(1);
  });

  it("lets a waiting record be edited or deleted on the device", async () => {
    const store = withOfflineQueue(inner, storage);
    online = false;
    const [a, b] = [(await store.addTransactions([lunch]))[0], (await store.addTransactions([{ ...lunch, memo: "コーヒー", amount: 300 }]))[0]];
    const edited = await store.updateTransaction(a.id, { ...lunch, amount: 950 });
    expect(edited).toMatchObject({ id: a.id, amount: 950, pending: true, createdAt: a.createdAt });
    expect(await store.trashTransactions([b])).toBeNull();
    online = true;
    const result = await store.sync!();
    expect(result?.sent.map((t) => [t.id, t.amount])).toEqual([[a.id, 950]]);
  });

  it("puts a waiting record back when its delete is undone", async () => {
    const store = withOfflineQueue(inner, storage);
    online = false;
    const [kept] = await store.addTransactions([lunch]);
    await store.trashTransactions([kept]);
    expect(await store.restoreTransactions([kept])).toEqual([kept]);
    online = true;
    expect((await store.sync!())?.sent.map((t) => t.id)).toEqual([kept.id]);
  });

  it("still needs the connection to change a record already sent", async () => {
    const store = withOfflineQueue(inner, storage);
    online = false;
    await expect(store.updateTransaction("old", lunch)).rejects.toThrow(OfflineError);
  });

  it("does not keep a record the server turned down", async () => {
    const store = withOfflineQueue({ ...inner, addTransactions: async () => Promise.reject(new Error("permission denied")) }, storage);
    await expect(store.addTransactions([lunch])).rejects.toThrow("permission denied");
    expect(storage.data.size).toBe(0);
  });
});

describe("opening the app without a signal", () => {
  it("shows what was loaded last time, with the records still waiting", async () => {
    let store = withOfflineQueue(inner, storage);
    const first = await store.load();
    store.saveSnapshot!(first);
    online = false;
    await store.addTransactions([lunch]);

    store = withOfflineQueue(inner, storage);
    const opened = await store.load();
    expect(opened.fromDevice).toBe(true);
    expect(opened.transactions.map((t) => [t.memo || t.id, Boolean(t.pending)])).toEqual([["old", false], ["ランチ", true]]);

    // back online: everything is loaded again, with the record sent
    server.push(tx("2026-10-19", 1200, { id: "from-iphone" }));
    online = true;
    const result = await store.sync!();
    expect(result?.loaded?.transactions.map((t) => [t.memo || t.id, Boolean(t.pending)])).toEqual([
      ["old", false],
      ["from-iphone", false],
      ["ランチ", false],
    ]);
  });

  it("keeps only sent records in the saved copy", async () => {
    const store = withOfflineQueue(inner, storage);
    store.saveSnapshot!({ transactions: [tx("2026-10-18", 500, { id: "a" }), tx("2026-10-19", 900, { id: "b", pending: true })], settings: DEFAULT_SETTINGS });
    const saved = JSON.parse(storage.data.get("kakeibo-app.snapshot")!);
    expect(saved.transactions.map((t: Transaction) => t.id)).toEqual(["a"]);
  });

  it("shows the error when nothing was saved on this device", async () => {
    online = false;
    await expect(withOfflineQueue(inner, storage).load()).rejects.toThrow(OfflineError);
  });
});
