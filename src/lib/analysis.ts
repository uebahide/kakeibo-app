import { getCategory, isFixedCategory } from "./categories";
import { addMonths, shiftDays, today } from "./date";
import { currentPeriod, periodDayIndex, periodOf, periodStart } from "./period";
import { monthStats, variableBudget } from "./stats";
import type { Settings, Transaction } from "./types";

/**
 * Totals for the analysis screen over a range of periods ("months", which may start on payday).
 * Records of a category that no longer exists count under the one they are shown as ("other").
 * A split payment is several records, one per category, so category totals need nothing special;
 * only lists of payments (the places ranking) put its parts back together.
 */

/** The span the analysis screen shows: the month picked, the 3 months up to it, or its year. */
export type Range = "month" | "quarter" | "year";

export const RANGES: Range[] = ["month", "quarter", "year"];

/** Name of the "everything else" slice in top-N lists; not a category id. */
export const REST = "__rest";

/**
 * The periods (oldest first) a range covers, ending with `month`. A year is the periods named
 * after its months, January on, without the ones after the current period (nothing to show yet).
 */
export function rangeMonths(month: string, range: Range, startDay: number): string[] {
  if (range === "month") return [month];
  if (range === "quarter") return [addMonths(month, -2), addMonths(month, -1), month];
  const last = [month, currentPeriod(startDay)].sort()[1];
  const year = month.slice(0, 4);
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`).filter((m) => m <= last || m === month);
}

/** The same span one step back: the month before, the 3 months before, or the same months a year earlier. */
export function previousMonths(months: string[], range: Range): string[] {
  const back = range === "year" ? 12 : months.length;
  return months.map((m) => addMonths(m, -back));
}

export type RangeTotals = {
  months: string[];
  income: number;
  /** all spending: budgeted, fixed and outside the budget */
  expense: number;
  /** recorded spending counted against the budget */
  variable: number;
  fixed: number;
  /** all spending per category, fixed costs included */
  byCategory: Record<string, number>;
  /** budgeted spending per category */
  variableByCategory: Record<string, number>;
  /** the variable budget for every period of the range */
  budget: number;
  /** number of records */
  entries: number;
};

const add = (to: Record<string, number>, id: string, value: number) => {
  const key = getCategory(id).id;
  to[key] = (to[key] ?? 0) + value;
};

/** Totals over periods. With `until` (YYYY-MM-DD), records after that day are left out (fixed costs stay in). */
export function rangeTotals(txs: Transaction[], months: string[], settings: Settings, until?: string): RangeTotals {
  const list = until ? txs.filter((t) => t.date <= until) : txs;
  const out: RangeTotals = { months, income: 0, expense: 0, variable: 0, fixed: 0, byCategory: {}, variableByCategory: {}, budget: 0, entries: 0 };
  for (const m of months) {
    const s = monthStats(list, m, settings);
    out.income += s.income;
    out.expense += s.expense;
    out.variable += s.variable;
    out.fixed += s.fixed;
    out.entries += s.list.length;
    for (const [id, v] of Object.entries(s.byCategory)) add(out.byCategory, id, v);
    for (const [id, v] of Object.entries(s.variableByCategory)) add(out.variableByCategory, id, v);
  }
  out.budget = variableBudget(settings) * months.length;
  return out;
}

/** Share of the income that was not spent (negative when spending was bigger); null without income. */
export const savingsRate = (income: number, expense: number): number | null => (income > 0 ? (income - expense) / income : null);

export type RangeSummary = {
  current: RangeTotals;
  previous: RangeTotals;
  /**
   * Whether the range is still going. The previous span is then counted only up to the same day
   * of its last period, so a half-finished month is compared with half of the one before.
   */
  partial: boolean;
  /** spending compared with the previous span; null when that span has no spending */
  change: number | null;
  /** what is left of the variable budget (negative when over); null without a budget */
  budgetLeft: number | null;
  savingsRate: number | null;
};

export function rangeSummary(txs: Transaction[], month: string, range: Range, settings: Settings): RangeSummary {
  const startDay = settings.monthStartDay;
  const months = rangeMonths(month, range, startDay);
  const prevMonths = previousMonths(months, range);
  const last = months[months.length - 1];
  const partial = last === currentPeriod(startDay);
  let until: string | undefined;
  if (partial) {
    const day = periodDayIndex(today(), last, startDay);
    until = shiftDays(periodStart(prevMonths[prevMonths.length - 1], startDay), day - 1);
  }
  const current = rangeTotals(txs, months, settings);
  const previous = rangeTotals(txs, prevMonths, settings, until);
  return {
    current,
    previous,
    partial,
    change: previous.expense > 0 ? current.expense - previous.expense : null,
    budgetLeft: current.budget > 0 ? current.budget - current.variable : null,
    savingsRate: savingsRate(current.income, current.expense),
  };
}

export type CategoryRow = {
  id: string;
  /** all spending in the range */
  spent: number;
  /** spending counted against the budget */
  budgeted: number;
  /** the category's budget over the range; 0 for fixed costs and categories without one */
  budget: number;
  /** spending in the previous span */
  previous: number;
};

/**
 * One row per expense category with spending in the range or a budget, biggest spending first.
 * Categories with neither, hidden ones included, are left out.
 */
export function categoryRows(summary: Pick<RangeSummary, "current" | "previous">, settings: Settings): CategoryRow[] {
  const { current, previous } = summary;
  const n = current.months.length;
  const ids = new Set(Object.keys(current.byCategory).filter((id) => current.byCategory[id] > 0));
  for (const [id, amount] of Object.entries(settings.budgets)) {
    const c = getCategory(id);
    if (amount > 0 && c.id === id && c.type === "expense" && !c.fixed && !c.hidden) ids.add(id);
  }
  return [...ids]
    .map((id) => ({
      id,
      spent: current.byCategory[id] ?? 0,
      budgeted: current.variableByCategory[id] ?? 0,
      budget: isFixedCategory(id) ? 0 : (settings.budgets[id] ?? 0) * n,
      previous: previous.byCategory[id] ?? 0,
    }))
    .sort((a, b) => b.spent - a.spent || b.budget - a.budget);
}

/**
 * The `n` biggest entries, and the rest added up under REST (left out when it would be a single
 * entry, which can just as well be shown itself). Entries of 0 are dropped.
 */
export function topWithRest(values: Record<string, number>, n = 5): { id: string; value: number }[] {
  const items = Object.entries(values)
    .filter(([, v]) => v > 0)
    .map(([id, value]) => ({ id, value }))
    .sort((a, b) => b.value - a.value);
  if (items.length <= n + 1) return items;
  const rest = items.slice(n).reduce((s, x) => s + x.value, 0);
  return [...items.slice(0, n), { id: REST, value: rest }];
}

/** The `count` periods up to `month`, oldest first. */
export const lastMonths = (month: string, count: number) => Array.from({ length: count }, (_, i) => addMonths(month, i - count + 1));

export type CategoryTrend = {
  /** the categories with their own color, biggest first; REST at the end when there are more */
  ids: string[];
  /** per period: its spending per id in `ids` */
  rows: ({ month: string } & Record<string, number>)[];
};

/** Spending per period for the `n` biggest categories over `months`, the others added up as REST. */
export function categoryTrend(txs: Transaction[], months: string[], settings: Settings, n = 5): CategoryTrend {
  const per = months.map((m) => rangeTotals(txs, [m], settings).byCategory);
  const total: Record<string, number> = {};
  for (const by of per) for (const [id, v] of Object.entries(by)) total[id] = (total[id] ?? 0) + v;
  const ids = topWithRest(total, n).map((x) => x.id);
  const own = new Set(ids.filter((id) => id !== REST));
  const rows = months.map((month, i) => {
    const row: { month: string } & Record<string, number> = { month } as { month: string } & Record<string, number>;
    for (const id of ids) row[id] = 0;
    for (const [id, v] of Object.entries(per[i])) {
      const key = own.has(id) ? id : REST;
      if (key in row) row[key] += v;
    }
    return row;
  });
  return { ids, rows };
}

export type MonthFlow = { month: string; income: number; expense: number; savingsRate: number | null };

/** Income, spending and the share of income kept, per period. */
export function monthlyFlow(txs: Transaction[], months: string[], settings: Settings): MonthFlow[] {
  return months.map((month) => {
    const s = monthStats(txs, month, settings);
    return { month, income: s.income, expense: s.expense, savingsRate: savingsRate(s.income, s.expense) };
  });
}

export type Place = {
  /** the memo, as written in the newest record (lists come newest first) */
  name: string;
  /** number of payments (a split payment counts once) */
  count: number;
  total: number;
  /** the category most spent in there */
  category: string;
};

/**
 * Where the money went most: expenses in the periods grouped by memo (a shop name, as Wallet
 * writes it, or the user's own note), biggest total first. Memos that differ only in case or
 * spacing are one place. Records without a memo are left out.
 */
export function topPlaces(txs: Transaction[], months: string[], settings: Settings, limit = 8): Place[] {
  const inRange = new Set(months);
  const places = new Map<string, { name: string; payments: Set<string>; total: number; byCategory: Map<string, number> }>();
  for (const t of txs) {
    if (t.type === "income" || !inRange.has(periodOf(t.date, settings.monthStartDay))) continue;
    const name = t.memo.trim();
    if (!name) continue;
    const key = name.toLowerCase().replace(/\s+/g, " ");
    const p = places.get(key) ?? { name, payments: new Set<string>(), total: 0, byCategory: new Map<string, number>() };
    p.payments.add(t.splitId ?? t.id);
    p.total += t.amount;
    const cat = getCategory(t.category).id;
    p.byCategory.set(cat, (p.byCategory.get(cat) ?? 0) + t.amount);
    places.set(key, p);
  }
  return [...places.values()]
    .map((p) => ({
      name: p.name,
      count: p.payments.size,
      total: p.total,
      category: [...p.byCategory].sort((a, b) => b[1] - a[1])[0][0],
    }))
    .sort((a, b) => b.total - a.total || b.count - a.count)
    .slice(0, limit);
}
