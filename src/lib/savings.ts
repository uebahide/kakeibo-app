import { DEFAULT_SETTINGS } from "./categories";
import { addMonths } from "./date";
import { currentPeriod } from "./period";
import type { SavingsGoal, Settings } from "./types";

/** Fill in fields missing from older saved data (which had a goal name and no monthly savings). */
export function normalizeGoal(goal: Partial<SavingsGoal> | null | undefined): SavingsGoal {
  return {
    target: goal?.target ?? DEFAULT_SETTINGS.goal.target,
    saved: goal?.saved ?? 0,
    monthly: goal?.monthly ?? {},
    fixedMonthly: goal?.fixedMonthly ?? { amount: 0, from: "" },
  };
}

/** Whether `month` takes the fixed monthly amount (no amount of its own, and on or after the fixed amount started). */
export function usesFixed(settings: Settings, month: string): boolean {
  const { amount, from } = settings.goal.fixedMonthly;
  return amount > 0 && !!from && month >= from && settings.goal.monthly[month] === undefined;
}

export const monthSavings = (settings: Settings, month: string) =>
  usesFixed(settings, month) ? settings.goal.fixedMonthly.amount : (settings.goal.monthly[month] ?? 0);

/** Every month's savings up to the current period: its own amount, or the fixed amount. */
export function monthlyTotal(settings: Settings): number {
  const now = currentPeriod(settings.monthStartDay);
  const months = new Set(Object.keys(settings.goal.monthly).filter((m) => m <= now));
  const { from } = settings.goal.fixedMonthly;
  if (settings.goal.fixedMonthly.amount > 0 && from) for (let m = from; m <= now; m = addMonths(m, 1)) months.add(m);
  let total = 0;
  for (const m of months) total += monthSavings(settings, m);
  return total;
}

/** Savings so far: what was saved before the app plus every month's savings. */
export function totalSaved(settings: Settings): number {
  return settings.goal.saved + monthlyTotal(settings);
}

/**
 * Change the fixed monthly amount from the current period on. Earlier months that were
 * taking the old fixed amount keep it, written out as their own amounts.
 */
export function withFixedMonthly(goal: SavingsGoal, settings: Settings, amount: number): SavingsGoal {
  const now = currentPeriod(settings.monthStartDay);
  const monthly = { ...goal.monthly };
  const old = goal.fixedMonthly;
  if (old.amount > 0 && old.from) {
    for (let m = old.from; m < now; m = addMonths(m, 1)) if (monthly[m] === undefined) monthly[m] = old.amount;
  }
  return { ...goal, monthly, fixedMonthly: { amount, from: amount > 0 ? now : "" } };
}

/** Average savings of `month` and the 2 months before it, over the months that have an amount. */
export function averageMonthlySavings(settings: Settings, month: string): number {
  const amounts = [0, 1, 2].map((k) => monthSavings(settings, addMonths(month, -k))).filter((v) => v);
  return amounts.length ? amounts.reduce((s, v) => s + v, 0) / amounts.length : 0;
}
