import type { TrashEntry } from "../trash";
import type { NewTransaction, Settings, Transaction } from "../types";
import type { WeeklyReview } from "../weeklyReview";

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
  /** `fromDevice`: offline, so this is what was loaded last time (see saveSnapshot). */
  load(): Promise<{ transactions: Transaction[]; settings: Settings; fromDevice?: boolean }>;
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
  /** Claude's weekly reviews, newest week first (empty before migration 0016). */
  loadWeeklyReviews?(): Promise<WeeklyReview[]>;
  /** The signed-in account's id, read without the network; records kept on the device belong to it. */
  accountId?(): Promise<string | null>;
  /** Sends records kept on the device while offline, with their own ids; returns them as saved (skipping none already there). */
  sendQueued?(items: Transaction[]): Promise<Transaction[]>;
  /**
   * Once the connection is back: loads everything again if the app opened offline (`loaded`), and sends the
   * records kept on the device (`sent`). Resolves null when there was nothing to do.
   */
  sync?(): Promise<{ sent: Transaction[]; loaded?: { transactions: Transaction[]; settings: Settings } } | null>;
  /** Keeps what is shown on this device, so the app can open without a signal. */
  saveSnapshot?(data: { transactions: Transaction[]; settings: Settings }): void;
  /** Receipt photos; missing in demo mode. */
  receipts?: ReceiptStore;
}
