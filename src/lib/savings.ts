import { DEFAULT_SETTINGS } from "./categories";
import { addMonths } from "./date";
import type { SavingsGoal, Settings } from "./types";

/** Fill in fields missing from older saved data (which had a goal name and no monthly savings). */
export function normalizeGoal(goal: Partial<SavingsGoal> | null | undefined): SavingsGoal {
  return {
    target: goal?.target ?? DEFAULT_SETTINGS.goal.target,
    saved: goal?.saved ?? 0,
    monthly: goal?.monthly ?? {},
  };
}

export const monthSavings = (settings: Settings, month: string) => settings.goal.monthly[month] ?? 0;

/** Savings so far: what was saved before the app plus every month's savings. */
export function totalSaved(settings: Settings): number {
  return Object.values(settings.goal.monthly).reduce((s, v) => s + v, settings.goal.saved);
}

/** Average savings of `month` and the 2 months before it, over the months that have an amount. */
export function averageMonthlySavings(settings: Settings, month: string): number {
  const amounts = [0, 1, 2].map((k) => settings.goal.monthly[addMonths(month, -k)]).filter((v) => v);
  return amounts.length ? amounts.reduce((s, v) => s + v, 0) / amounts.length : 0;
}
