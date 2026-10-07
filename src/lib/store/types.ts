import type { NewTransaction, Settings, Transaction } from "../types";

/** Where the household data lives. Implemented by the browser (demo) and Supabase stores. */
export interface KakeiboStore {
  readonly kind: "local" | "supabase";
  load(): Promise<{ transactions: Transaction[]; settings: Settings }>;
  addTransactions(items: NewTransaction[]): Promise<Transaction[]>;
  updateTransaction(id: string, item: NewTransaction): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;
  deleteSamples(): Promise<void>;
  saveSettings(settings: Settings): Promise<void>;
}
