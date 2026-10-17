import type { NewTransaction, Transaction } from "./types";

/** A line in a list of records: one record, or the records one payment was split into. */
export type Entry = {
  /** the record that stands for the entry (the first part of a split payment) */
  tx: Transaction;
  /** every record of the payment, first part first; just `tx` for an ordinary record */
  parts: Transaction[];
  /** total of the parts */
  amount: number;
};

const byCreated = (a: Transaction, b: Transaction) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

/** The records of the payment a record belongs to, first part first (just the record when it isn't split). */
export function splitParts(transactions: Transaction[], tx: Transaction): Transaction[] {
  if (!tx.splitId) return [tx];
  const parts = transactions.filter((t) => t.splitId === tx.splitId).sort(byCreated);
  return parts.length ? parts : [tx];
}

/** Puts the parts of each split payment in a list together, where its first part appears. */
export function groupSplits(list: Transaction[]): Entry[] {
  const bySplit = new Map<string, Transaction[]>();
  for (const t of list) if (t.splitId) bySplit.set(t.splitId, [...(bySplit.get(t.splitId) ?? []), t]);
  const out: Entry[] = [];
  const seen = new Set<string>();
  for (const t of list) {
    if (!t.splitId) {
      out.push({ tx: t, parts: [t], amount: t.amount });
      continue;
    }
    if (seen.has(t.splitId)) continue;
    seen.add(t.splitId);
    const parts = bySplit.get(t.splitId)!.sort(byCreated);
    out.push({ tx: parts[0], parts, amount: parts.reduce((s, p) => s + p.amount, 0) });
  }
  return out;
}

/** A new id shared by the records of a split payment. */
export const newSplitId = () => crypto.randomUUID();

/** One part of a payment to save: its category, amount and note. */
export type PartInput = { category: string; amount: number; note: string };

/**
 * The writes that turn the records of a payment (`group`, first part first; empty for a new payment)
 * into `parts`: existing records are reused in order, missing ones added, and extra ones deleted.
 * `base` holds the fields every part shares (date, memo, receipt…). Several parts share a split id.
 */
export function splitWrites(group: Transaction[], parts: PartInput[], base: NewTransaction) {
  const splitId = parts.length > 1 ? (group.find((p) => p.splitId)?.splitId ?? newSplitId()) : undefined;
  const items = parts.map((p): NewTransaction => {
    const item: NewTransaction = { ...base, category: p.category, amount: p.amount };
    delete item.splitId;
    delete item.note;
    const note = p.note.trim() ? { note: p.note.trim().slice(0, 40) } : {};
    return splitId ? { ...item, splitId, ...note } : { ...item, ...note };
  });
  return {
    updates: items.slice(0, group.length).map((item, i) => ({ id: group[i].id, item })),
    adds: items.slice(group.length),
    deletes: group.slice(items.length).map((p) => p.id),
  };
}
