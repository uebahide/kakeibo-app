import { DEFAULT_SETTINGS } from "../categories";
import type { NewTransaction, Settings, Transaction } from "../types";
import type { KakeiboStore } from "./types";

const KEY = "kakeibo-app.v1";

type Saved = { transactions: Transaction[]; settings: Settings };

function read(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Saved>;
      return {
        transactions: saved.transactions ?? [],
        settings: { ...DEFAULT_SETTINGS, ...saved.settings },
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

  return {
    kind: "local",
    async load() {
      return structuredClone(get());
    },
    async addTransactions(items: NewTransaction[]) {
      const created = items.map((item) => ({
        ...item,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      }));
      get().transactions.push(...created);
      commit();
      return created;
    },
    async updateTransaction(id, item) {
      const list = get().transactions;
      const i = list.findIndex((t) => t.id === id);
      if (i < 0) throw new Error("記録が見つかりません");
      list[i] = { ...list[i], ...item };
      commit();
      return list[i];
    },
    async deleteTransaction(id) {
      get().transactions = get().transactions.filter((t) => t.id !== id);
      commit();
    },
    async deleteSamples() {
      get().transactions = get().transactions.filter((t) => !t.isSample);
      commit();
    },
    async saveSettings(settings) {
      get().settings = structuredClone(settings);
      commit();
    },
  };
}
