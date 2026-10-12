import type { FixedCost, Settings } from "./types";

export type MonthFixedCosts = {
  items: FixedCost[];
  /** The earlier month these items were copied from, or null when the month has its own list. */
  inheritedFrom: string | null;
};

/**
 * Fixed costs for a month. A month that was never edited uses the latest earlier month's
 * list as its default, with every item marked unpaid.
 */
export function fixedCostsFor(fixedCosts: Settings["fixedCosts"], month: string): MonthFixedCosts {
  const own = fixedCosts[month];
  if (own) return { items: own, inheritedFrom: null };
  const base = Object.keys(fixedCosts)
    .filter((m) => m < month)
    .sort()
    .at(-1);
  if (!base) return { items: [], inheritedFrom: null };
  return { items: fixedCosts[base].map((item) => ({ ...item, paid: false })), inheritedFrom: base };
}

/** Change one month's fixed costs, starting from its inherited default when it has no list yet. */
export function changeFixedCosts(settings: Settings, month: string, change: (items: FixedCost[]) => FixedCost[]): Settings {
  const { items } = fixedCostsFor(settings.fixedCosts, month);
  return { ...settings, fixedCosts: { ...settings.fixedCosts, [month]: change(items) } };
}

export const sumFixed = (items: FixedCost[]) => items.reduce((s, item) => s + item.amount, 0);
