import { FIXED_COST_CATEGORIES, VARIABLE_CATEGORIES, getCategory } from "./categories";
import { addMonths, parseDate, shiftDays, today, WEEKDAYS } from "./date";
import { currentPeriod, periodDayIndex, periodDays, periodOf, periodStart } from "./period";
import { fixedCostsFor, sumFixed } from "./fixed";
import { monthSavings, totalSaved } from "./savings";
import type { Settings, Transaction, TxType } from "./types";

export type MonthStats = {
  list: Transaction[];
  income: number;
  /** all spending: variable + fixed + outside the budget */
  expense: number;
  /** recorded expenses counted against the budget */
  variable: number;
  fixed: number;
  /** recorded expenses marked outside the budget (paid from the spare money) */
  extra: number;
  extraList: Transaction[];
  /** all spending per category, fixed costs included */
  byCategory: Record<string, number>;
  /** budgeted recorded expenses per category */
  variableByCategory: Record<string, number>;
};

/** Totals for a month. Pass `settings` to include that month's fixed costs. */
export function monthStats(txs: Transaction[], month: string, settings?: Settings): MonthStats {
  const startDay = settings?.monthStartDay ?? 1;
  const list = txs.filter((t) => periodOf(t.date, startDay) === month);
  const variableByCategory: Record<string, number> = {};
  let income = 0;
  let variable = 0;
  const extraList: Transaction[] = [];
  const byCategory: Record<string, number> = {};
  for (const t of list) {
    if (t.type === "income") {
      income += t.amount;
      continue;
    }
    byCategory[t.category] = (byCategory[t.category] ?? 0) + t.amount;
    if (t.outsideBudget) extraList.push(t);
    else {
      variable += t.amount;
      variableByCategory[t.category] = (variableByCategory[t.category] ?? 0) + t.amount;
    }
  }
  const extra = extraList.reduce((s, t) => s + t.amount, 0);
  const fixedItems = settings ? fixedCostsFor(settings.fixedCosts, month).items : [];
  for (const item of fixedItems) byCategory[item.category] = (byCategory[item.category] ?? 0) + item.amount;
  const fixed = sumFixed(fixedItems);
  return { list, income, expense: variable + fixed + extra, variable, fixed, extra, extraList, byCategory, variableByCategory };
}

/** Monthly budget for variable costs (fixed costs are set per month instead). */
export function variableBudget(settings: Settings): number {
  return VARIABLE_CATEGORIES.reduce((s, c) => s + (settings.budgets[c.id] ?? 0), 0);
}

export type PaceLevel = "good" | "warn" | "bad";

/** Fraction of the month (period) that has elapsed (1 for past months, 0 for future ones). */
export function elapsedFraction(month: string, startDay: number): number {
  const cur = currentPeriod(startDay);
  if (month < cur) return 1;
  if (month > cur) return 0;
  return periodDayIndex(today(), month, startDay) / periodDays(month);
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

/** Finer pace scale for the home badge, from plenty of room (0) to over budget (5). */
export const PACE_STEPS = ["ゆとりあり", "順調なペース", "少し早め", "使うペースが早め", "かなり早め", "予算オーバー"] as const;

export function paceStep(spent: number, budget: number, fraction: number): number {
  const ratio = spent / budget;
  if (ratio > 1) return 5;
  const ahead = ratio - fraction;
  if (ahead > 0.15) return 4;
  if (ahead > 0.08) return 3;
  if (ahead > 0.03) return 2;
  if (ahead > -0.1) return 1;
  return 0;
}

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
    if (t.type === "income" || t.outsideBudget || t.date < since || FIXED_COST_CATEGORIES.has(t.category)) continue;
    sums[parseDate(t.date).getDay()] += t.amount;
  }
  return sums.map((s, i) => (counts[i] ? s / counts[i] : 0));
}

/** Cumulative recorded (variable) expense per day of the period (day 1 = its first day), up to today. */
export function cumulativeDaily(txs: Transaction[], month: string, startDay: number): { day: number; total: number }[] {
  const cur = currentPeriod(startDay);
  const n = periodDays(month);
  const lastDay = month === cur ? periodDayIndex(today(), month, startDay) : month < cur ? n : 0;
  const daily = Array(n + 1).fill(0);
  for (const t of txs) {
    if (t.type === "income" || t.outsideBudget || periodOf(t.date, startDay) !== month) continue;
    daily[periodDayIndex(t.date, month, startDay)] += t.amount;
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
  const startDay = settings.monthStartDay;
  const now = currentPeriod(startDay);
  const months = [0, 1, 2].map((k) => addMonths(now, -k));
  const oldest = periodStart(months[2], startDay);
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
    if (!t.outsideBudget && !FIXED_COST_CATEGORIES.has(t.category)) wd[parseDate(t.date).getDay()] += t.amount;
  }

  return {
    today: today(),
    monthStartDay: startDay,
    dayOfMonth: periodDayIndex(today(), now, startDay),
    daysInMonth: periodDays(now),
    months: months.map((m) => {
      const s = monthStats(txs, m, settings);
      return {
        month: m,
        income: s.income,
        expense: s.expense,
        variableExpense: s.variable,
        fixedExpense: s.fixed,
        outsideBudgetExpense: s.extra,
        savings: monthSavings(settings, m),
        fixedCosts: fixedCostsFor(settings.fixedCosts, m).items.map((f) => ({
          name: f.name,
          category: getCategory(f.category).name,
          amount: f.amount,
          paid: f.paid,
        })),
        entries: s.list.length,
        byCategory: Object.fromEntries(
          Object.entries(s.byCategory).map(([k, v]) => [getCategory(k).name, v]),
        ),
      };
    }),
    variableBudgetByCategory: Object.fromEntries(
      VARIABLE_CATEGORIES.map((c) => [c.name, settings.budgets[c.id] ?? 0]),
    ),
    variableBudget: variableBudget(settings),
    savings: {
      total: totalSaved(settings),
      target: settings.goal.target || null,
    },
    topSpendingItems: [...items.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 15)
      .map(([item, v]) => ({ item, ...v })),
    variableSpendingByWeekday: Object.fromEntries(WEEKDAYS.map((w, i) => [w, wd[i]])),
  };
}

export type AiDigest = ReturnType<typeof buildAiDigest>;
