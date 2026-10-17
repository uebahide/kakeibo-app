import type { TrashEntry } from "../trash";
import type { NewTransaction, Settings, Transaction } from "../types";

/** Receipt photos, kept only when signed in. */
export interface ReceiptStore {
  /** Saves a photo (a JPEG) and returns the new receipt's id. */
  upload(photo: Blob): Promise<string>;
  /** A short-lived address to show the photo. */
  photoUrl(id: string): Promise<string>;
  /** Deletes the photo and its receipt (the records that pointed at it keep no photo). */
  remove(id: string): Promise<void>;
}

/** Where the household data lives. Implemented by the browser (demo) and Supabase stores. */
export interface KakeiboStore {
  readonly kind: "local" | "supabase";
  load(): Promise<{ transactions: Transaction[]; settings: Settings }>;
  addTransactions(items: NewTransaction[]): Promise<Transaction[]>;
  updateTransaction(id: string, item: NewTransaction): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;
  /** Puts deleted records back as they were (same id and creation time), when a delete is undone. */
  restoreTransactions(items: Transaction[]): Promise<Transaction[]>;
  /**
   * Deletes records the user chose to delete and keeps them in "Recently deleted". Resolves null when
   * there is no place to keep them (before migration 0015): the records are then deleted for good.
   */
  trashTransactions(items: Transaction[]): Promise<TrashEntry | null>;
  /** Everything in "Recently deleted", expired entries included. */
  loadTrash(): Promise<TrashEntry[]>;
  /** Puts an entry's records back and takes it out of "Recently deleted". */
  restoreTrash(entry: TrashEntry): Promise<Transaction[]>;
  /** Takes an entry out of "Recently deleted" for good. */
  dropTrash(id: string): Promise<void>;
  /** Records created after `since` (an ISO time), such as payments recorded from the iPhone while the app was open. */
  loadNewTransactions?(since: string): Promise<Transaction[]>;
  deleteSamples(): Promise<void>;
  /** Moves every record in category `from` to category `to` (before a category is deleted). */
  moveCategory(from: string, to: string): Promise<void>;
  saveSettings(settings: Settings): Promise<void>;
  /** Latest saved analysis, which Claude may have written over MCP while the app was open. */
  loadLastAi?(): Promise<Settings["lastAi"]>;
  /** Receipt photos; missing in demo mode. */
  receipts?: ReceiptStore;
}
