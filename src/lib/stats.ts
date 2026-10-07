import { CATEGORIES, FIXED_COST_CATEGORIES, getCategory } from "./categories";
import { addMonths, currentMonth, daysInMonth, monthOf, parseDate, shiftDays, today, WEEKDAYS } from "./date";
import type { Settings, Transaction, TxType } from "./types";

export type MonthStats = {
  list: Transaction[];
  income: number;
  expense: number;
  byCategory: Record<string, number>;
};

export function monthStats(txs: Transaction[], month: string): MonthStats {
  const list = txs.filter((t) => monthOf(t.date) === month);
  const byCategory: Record<string, number> = {};
  let income = 0;
  let expense = 0;
  for (const t of list) {
    if (t.type === "income") income += t.amount;
    else {
      expense += t.amount;
      byCategory[t.category] = (byCategory[t.category] ?? 0) + t.amount;
    }
  }
  return { list, income, expense, byCategory };
}

export function totalBudget(settings: Settings): number {
  return CATEGORIES.expense.reduce((s, c) => s + (settings.budgets[c.id] ?? 0), 0);
}

export type PaceLevel = "good" | "warn" | "bad";

/** Fraction of the month that has elapsed (1 for past months, 0 for future ones). */
export function elapsedFraction(month: string, now = new Date()): number {
  const cur = currentMonth();
  if (month < cur) return 1;
  if (month > cur) return 0;
  return now.getDate() / daysInMonth(month);
}

/** Compare spending against how far into the month we are. */
export function paceLevel(spent: number, budget: number, fraction: number): PaceLevel {
  if (!budget) return "good";
  const ratio = spent / budget;
  if (ratio > 1) return "bad";
  if (ratio > fraction + 0.08) return "warn";
  return "good";
}

export const PACE_LABEL: Record<PaceLevel, string> = {
  good: "順調なペース",
  warn: "使うペースが早め",
  bad: "予算オーバー",
};

export function recordStreak(txs: Transaction[], noSpendDays: string[]) {
  const days = new Set([...txs.map((t) => t.date), ...noSpendDays]);
  const t = today();
  let cursor = days.has(t) ? t : shiftDays(t, -1);
  let count = 0;
  while (days.has(cursor)) {
    count++;
    cursor = shiftDays(cursor, -1);
  }
  const last7 = Array.from({ length: 7 }, (_, i) => days.has(shiftDays(t, i - 6)));
  return { count, last7, recordedToday: days.has(t) };
}

/** Average monthly surplus over the last 3 months that have records. */
export function averageSurplus(txs: Transaction[]): number {
  let sum = 0;
  let n = 0;
  for (let k = 1; k <= 3; k++) {
    const s = monthStats(txs, addMonths(currentMonth(), -k));
    if (s.list.length) {
      sum += s.income - s.expense;
      n++;
    }
  }
  return n ? sum / n : 0;
}

export type QuickPick = { category: string; memo: string; amount: number; count: number };

/** Most frequent (category, memo) pairs, with the latest amount used. */
export function quickPicks(txs: Transaction[], type: TxType, limit = 8): QuickPick[] {
  const map = new Map<string, QuickPick & { date: string }>();
  for (const t of txs) {
    if (!t.memo || t.type !== type) continue;
    const key = `${t.category}|${t.memo}`;
    const cur = map.get(key) ?? { category: t.category, memo: t.memo, amount: t.amount, count: 0, date: "" };
    cur.count++;
    if (t.date >= cur.date) {
      cur.date = t.date;
      cur.amount = t.amount;
    }
    map.set(key, cur);
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(({ category, memo, amount, count }) => ({ category, memo, amount, count }));
}

/** Average variable spending per weekday over the last `days` days (Sun..Sat). */
export function weekdayAverages(txs: Transaction[], days = 90): number[] {
  const since = shiftDays(today(), -(days - 1));
  const sums = Array(7).fill(0);
  const counts = Array(7).fill(0);
  for (let i = 0; i < days; i++) counts[parseDate(shiftDays(today(), -i)).getDay()]++;
  for (const t of txs) {
    if (t.type === "income" || t.date < since || FIXED_COST_CATEGORIES.has(t.category)) continue;
    sums[parseDate(t.date).getDay()] += t.amount;
  }
  return sums.map((s, i) => (counts[i] ? s / counts[i] : 0));
}

/** Cumulative expense per day of the month, up to today (or month end for past months). */
export function cumulativeDaily(txs: Transaction[], month: string): { day: number; total: number }[] {
  const cur = currentMonth();
  const lastDay = month === cur ? new Date().getDate() : month < cur ? daysInMonth(month) : 0;
  const daily = Array(daysInMonth(month) + 1).fill(0);
  for (const t of txs) {
    if (t.type === "income" || monthOf(t.date) !== month) continue;
    daily[Number(t.date.slice(8))] += t.amount;
  }
  const out: { day: number; total: number }[] = [];
  let sum = 0;
  for (let d = 1; d <= lastDay; d++) {
    sum += daily[d];
    out.push({ day: d, total: sum });
  }
  return out;
}

/** Compact summary of the household data sent to the AI. Totals, not raw rows. */
export function buildAiDigest(txs: Transaction[], settings: Settings) {
  const now = currentMonth();
  const months = [0, 1, 2].map((k) => addMonths(now, -k));
  const oldest = `${months[2]}-01`;
  const recent = txs.filter((t) => t.type !== "income" && t.date >= oldest);

  const items = new Map<string, { count: number; total: number }>();
  for (const t of recent) {
    const key = `${t.memo || "(メモなし)"}／${getCategory(t.category).name}`;
    const cur = items.get(key) ?? { count: 0, total: 0 };
    cur.count++;
    cur.total += t.amount;
    items.set(key, cur);
  }
  const wd = Array(7).fill(0);
  for (const t of recent) {
    if (!FIXED_COST_CATEGORIES.has(t.category)) wd[parseDate(t.date).getDay()] += t.amount;
  }

  return {
    today: today(),
    dayOfMonth: new Date().getDate(),
    daysInMonth: daysInMonth(now),
    months: months.map((m) => {
      const s = monthStats(txs, m);
      return {
        month: m,
        income: s.income,
        expense: s.expense,
        entries: s.list.length,
        byCategory: Object.fromEntries(
          Object.entries(s.byCategory).map(([k, v]) => [getCategory(k).name, v]),
        ),
      };
    }),
    monthlyBudgetByCategory: Object.fromEntries(
      CATEGORIES.expense.map((c) => [c.name, settings.budgets[c.id] ?? 0]),
    ),
    totalBudget: totalBudget(settings),
    savingsGoal: settings.goal,
    topSpendingItems: [...items.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 15)
      .map(([item, v]) => ({ item, ...v })),
    variableSpendingByWeekday: Object.fromEntries(WEEKDAYS.map((w, i) => [w, wd[i]])),
  };
}

export type AiDigest = ReturnType<typeof buildAiDigest>;
