import { vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/categories";
import { setTimeZone } from "@/lib/date";
import type { FixedCost, Settings, Transaction } from "@/lib/types";

/** Pins "today" to a date (noon, Japan time). */
export function setToday(date: string) {
  setTimeZone("Asia/Tokyo");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${date}T12:00:00+09:00`));
}

let seq = 0;

/** An expense (or, with type "income", an income) on a date. */
export function tx(date: string, amount: number, extra: Partial<Transaction> = {}): Transaction {
  seq++;
  return {
    id: `t${seq}`,
    date,
    amount,
    type: "expense",
    category: "food",
    memo: "",
    isSample: false,
    createdAt: `${date}T00:00:00Z`,
    ...extra,
  };
}

export function fixedCost(category: string, amount: number, extra: Partial<FixedCost> = {}): FixedCost {
  seq++;
  return { id: `f${seq}`, name: category, category, amount, paid: false, ...extra };
}

/** Default settings with a budget of `budget` for food only (or the given budgets), plus overrides. */
export function settingsWith(overrides: Partial<Settings> = {}, budgets: Record<string, number> = { food: 31000 }): Settings {
  return { ...DEFAULT_SETTINGS, budgets, goal: { ...DEFAULT_SETTINGS.goal }, ...overrides };
}
