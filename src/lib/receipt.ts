/** Supabase storage bucket holding the photos (migration 0012). */
export const RECEIPT_BUCKET = "receipts";

/** What Claude read from a receipt photo (see /api/ai/receipt). Amounts are whole numbers in the user's currency. */
export type ReceiptReading = {
  /** shop name as printed, or "" */
  store: string;
  /** YYYY-MM-DD, or "" when not printed */
  date: string;
  /** amount paid (tax included); 0 when it couldn't be read */
  total: number;
  /** tax added on top of the item prices (外税); 0 when prices already include tax */
  tax: number;
  /** lines in printed order; a discount is its own line with a negative amount */
  items: { name: string; amount: number; category: string }[];
};

/** One part of the split payment proposed from a receipt. */
export type ReceiptPart = { category: string; amount: number; note: string };

/** Longest note one part may carry (as in the entry sheet). */
export const NOTE_MAX = 40;

/**
 * Turns a reading into the parts of a split payment: one per category, largest first, with the item
 * names as the note. Discounts come off the item above them, and tax added on top (or any rounding
 * gap) is shared out by amount so the parts add up to the receipt's total exactly.
 */
export function receiptParts(reading: ReceiptReading): ReceiptPart[] {
  // Discount lines come off the item printed just before them.
  const lines: { name: string; amount: number; category: string }[] = [];
  for (const item of reading.items) {
    const amount = Math.round(item.amount);
    if (amount < 0 && lines.length) lines[lines.length - 1].amount += amount;
    else if (amount > 0) lines.push({ name: item.name.trim(), amount, category: item.category });
  }

  const groups = new Map<string, { amount: number; names: string[] }>();
  for (const line of lines) {
    if (line.amount <= 0) continue;
    const g = groups.get(line.category) ?? { amount: 0, names: [] };
    g.amount += line.amount;
    if (line.name) g.names.push(line.name);
    groups.set(line.category, g);
  }
  const parts = [...groups].map(([category, g]) => ({ category, amount: g.amount, note: joinNames(g.names) }));
  if (!parts.length) return [];

  const sum = parts.reduce((s, p) => s + p.amount, 0);
  const total = reading.total > 0 ? Math.round(reading.total) : sum + Math.max(0, Math.round(reading.tax));
  if (total <= 0) return [];
  if (total !== sum) {
    // Share the gap by amount; the rounding left over goes to the largest part.
    let given = 0;
    for (const p of parts) {
      const share = Math.trunc(((total - sum) * p.amount) / sum);
      p.amount += share;
      given += share;
    }
    largest(parts).amount += total - sum - given;
  }
  return parts.filter((p) => p.amount > 0).sort((a, b) => b.amount - a.amount);
}

const largest = (parts: ReceiptPart[]) => parts.reduce((a, b) => (b.amount > a.amount ? b : a));

/** Item names joined into a note of at most NOTE_MAX characters ("牛乳・パン・卵…"). */
export function joinNames(names: string[]): string {
  const unique = [...new Set(names.filter(Boolean))];
  let note = "";
  for (const name of unique) {
    const next = note ? `${note}・${name}` : name;
    if (next.length > NOTE_MAX) return note ? `${note.slice(0, NOTE_MAX - 1)}…` : `${name.slice(0, NOTE_MAX - 1)}…`;
    note = next;
  }
  return note;
}

/**
 * Checks a reading that came back from the server (or was saved earlier) and keeps only expense
 * categories the user has; anything else becomes `fallback`. Returns null when it isn't a reading.
 */
export function normalizeReading(value: unknown, categories: string[], fallback: string): ReceiptReading | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.items)) return null;
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.round(x) : 0);
  const known = new Set(categories);
  return {
    store: typeof v.store === "string" ? v.store.trim().slice(0, 60) : "",
    date: typeof v.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.date) ? v.date : "",
    total: Math.max(0, num(v.total)),
    tax: Math.max(0, num(v.tax)),
    items: v.items.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const i = item as Record<string, unknown>;
      const category = typeof i.category === "string" && known.has(i.category) ? i.category : fallback;
      return [{ name: typeof i.name === "string" ? i.name : "", amount: num(i.amount), category }];
    }),
  };
}
