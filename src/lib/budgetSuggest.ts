import { variableCategories } from "./categories";
import { addMonths } from "./date";
import { fixedCostsFor, sumFixed } from "./fixed";
import type { Currency } from "./format";
import { currentPeriod, periodOf } from "./period";
import { monthSavings } from "./savings";
import { monthStats } from "./stats";
import type { Settings, Transaction } from "./types";

/**
 * Why a category's budget is suggested as it is:
 * - new: it had no budget but money was spent in it
 * - over: spending went over the budget in most months
 * - under: every month ended well under the budget
 * - keep: spending was about on budget
 * - unused: nothing was spent in it in any of the months
 */
export type SuggestionKind = "new" | "over" | "under" | "keep" | "unused";

export type CategorySuggestion = {
  id: string;
  current: number;
  suggested: number;
  /** average budgeted spending per month over the months looked at */
  average: number;
  /** months (of those looked at) that went over the current budget */
  overMonths: number;
  kind: SuggestionKind;
  /** lowered with the others so the total fits what income leaves */
  trimmed: boolean;
};

export type BudgetSuggestion = {
  /** the period the budget is suggested for */
  month: string;
  /** the earlier periods it is based on, newest first (1 to 3) */
  months: string[];
  rows: CategorySuggestion[];
  currentTotal: number;
  total: number;
  /** average income minus the month's fixed costs and savings; null when no income was recorded */
  available: number | null;
  /** whether the suggestions were lowered to fit `available` */
  trimmed: boolean;
  /** whether any category's budget would change */
  changed: boolean;
};

/** Rounding step that gives tidy amounts: ¥500 / ¥1,000, or 1,000 / 5,000 Ft. */
function step(amount: number, currency: Currency): number {
  if (currency === "HUF") return amount < 100_000 ? 1000 : 5000;
  return amount < 10_000 ? 500 : 1000;
}

const roundUp = (n: number, c: Currency) => (n > 0 ? Math.ceil(n / step(n, c)) * step(n, c) : 0);
const roundDown = (n: number, c: Currency) => (n > 0 ? Math.floor(n / step(n, c)) * step(n, c) : 0);

/** A month counts as "over" in most months: 1 of 1, 2 of 2, 2 of 3. */
const mostly = (count: number, n: number) => count * 3 >= n * 2;

/**
 * Suggests each variable category's budget for `month` (by default the current period) from
 * the budgeted spending of the up-to-3 periods before it that have records. Returns null when
 * none of them has any record. Nothing is changed; the caller applies what the user picks.
 */
export function suggestBudgets(
  txs: Transaction[],
  settings: Settings,
  month = currentPeriod(settings.monthStartDay),
): BudgetSuggestion | null {
  const startDay = settings.monthStartDay;
  const recorded = new Set(txs.map((t) => periodOf(t.date, startDay)));
  const months = [1, 2, 3].map((k) => addMonths(month, -k)).filter((m) => recorded.has(m));
  if (!months.length) return null;
  const stats = months.map((m) => monthStats(txs, m, settings));
  const n = months.length;
  const c = settings.currency;

  const rows: CategorySuggestion[] = [];
  for (const cat of variableCategories()) {
    const current = settings.budgets[cat.id] ?? 0;
    const spent = stats.map((s) => s.variableByCategory[cat.id] ?? 0);
    const average = spent.reduce((a, b) => a + b, 0) / n;
    if (!average && !current) continue;
    const overMonths = current ? spent.filter((v) => v > current).length : 0;
    const typical = roundUp(average, c);
    let kind: SuggestionKind = "keep";
    let suggested = current;
    if (!average) [kind, suggested] = ["unused", 0];
    else if (!current) [kind, suggested] = ["new", typical];
    else if (mostly(overMonths, n) && typical > current) [kind, suggested] = ["over", typical];
    else if (spent.every((v) => v < current * 0.85) && typical < current) [kind, suggested] = ["under", typical];
    rows.push({ id: cat.id, current, suggested, average, overMonths, kind, trimmed: false });
  }

  const incomes = stats.map((s) => s.income).filter((v) => v > 0);
  let available: number | null = null;
  let trimmed = false;
  if (incomes.length) {
    const income = incomes.reduce((a, b) => a + b, 0) / incomes.length;
    available = income - sumFixed(fixedCostsFor(settings.fixedCosts, month).items) - monthSavings(settings, month);
    const total = rows.reduce((s, r) => s + r.suggested, 0);
    // Lower every category by the same share; with no room left at all, leave the amounts as they are.
    if (available > 0 && total > available) {
      const scale = available / total;
      for (const r of rows) {
        if (!r.suggested) continue;
        r.suggested = roundDown(r.suggested * scale, c);
        r.trimmed = true;
      }
      trimmed = true;
    }
  }

  return {
    month,
    months,
    rows,
    currentTotal: rows.reduce((s, r) => s + r.current, 0),
    total: rows.reduce((s, r) => s + r.suggested, 0),
    available,
    trimmed,
    changed: rows.some((r) => r.suggested !== r.current),
  };
}

/** Budgets with the picked categories set to their suggested amounts. */
export function applySuggestion(budgets: Settings["budgets"], suggestion: BudgetSuggestion, ids?: string[]): Settings["budgets"] {
  const next = { ...budgets };
  for (const r of suggestion.rows) if (!ids || ids.includes(r.id)) next[r.id] = r.suggested;
  return next;
}
