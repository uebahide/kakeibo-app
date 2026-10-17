import type { Transaction } from "./types";

/** Days a deleted record stays in "Recently deleted" before it is gone for good. */
export const TRASH_DAYS = 30;

const DAY = 24 * 60 * 60 * 1000;

/** Records deleted together (one payment and its parts), kept so they can be put back. */
export type TrashEntry = {
  id: string;
  /** ISO time of the delete */
  deletedAt: string;
  /** the records as they were, first part first */
  records: Transaction[];
};

/** Whole days left before an entry is gone for good (0 once it has expired). */
export function daysLeft(entry: TrashEntry, now = new Date()): number {
  const left = Date.parse(entry.deletedAt) + TRASH_DAYS * DAY - now.getTime();
  return Math.max(0, Math.ceil(left / DAY));
}

/** Splits entries into the ones still kept (newest first) and the ones past TRASH_DAYS. */
export function sortTrash(entries: TrashEntry[], now = new Date()): { kept: TrashEntry[]; expired: TrashEntry[] } {
  const kept: TrashEntry[] = [];
  const expired: TrashEntry[] = [];
  for (const e of entries) (daysLeft(e, now) > 0 ? kept : expired).push(e);
  kept.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  return { kept, expired };
}

/** Receipt photos of the records (each once; the parts of a split payment share one). */
export function photosOf(records: Transaction[]): string[] {
  return [...new Set(records.flatMap((r) => (r.receiptId ? [r.receiptId] : [])))];
}
