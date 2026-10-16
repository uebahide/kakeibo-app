import { afterEach, describe, expect, it, vi } from "vitest";
import {
  REST,
  categoryRows,
  categoryTrend,
  lastMonths,
  monthlyFlow,
  previousMonths,
  rangeMonths,
  rangeSummary,
  rangeTotals,
  savingsRate,
  topPlaces,
  topWithRest,
} from "@/lib/analysis";
import { setCategories } from "@/lib/categories";
import { fixedCost, setToday, settingsWith, tx } from "./helpers";

afterEach(() => vi.useRealTimers());

describe("rangeMonths", () => {
  it("covers the month, the 3 months up to it, or its year so far", () => {
    setToday("2026-10-15");
    expect(rangeMonths("2026-10", "month", 1)).toEqual(["2026-10"]);
    expect(rangeMonths("2026-02", "quarter", 1)).toEqual(["2025-12", "2026-01", "2026-02"]);
    expect(rangeMonths("2026-10", "year", 1)).toHaveLength(10);
    expect(rangeMonths("2026-03", "year", 1)).toHaveLength(10);
    expect(rangeMonths("2025-06", "year", 1)).toHaveLength(12);
  });

  it("keeps a future month that was picked", () => {
    setToday("2026-10-15");
    expect(rangeMonths("2026-12", "year", 1).at(-1)).toBe("2026-12");
  });

  it("steps back a span, or a year for a year", () => {
    expect(previousMonths(["2026-08", "2026-09", "2026-10"], "quarter")).toEqual(["2026-05", "2026-06", "2026-07"]);
    expect(previousMonths(["2026-01", "2026-02"], "year")).toEqual(["2025-01", "2025-02"]);
  });
});

describe("rangeTotals", () => {
  it("adds up the periods and multiplies the budget by them", () => {
    const settings = settingsWith({ fixedCosts: { "2026-09": [fixedCost("housing", 80000)] } }, { food: 30000 });
    const txs = [
      tx("2026-09-10", 1000),
      tx("2026-10-02", 2000, { category: "daily" }),
      tx("2026-10-05", 500, { outsideBudget: true }),
      tx("2026-10-25", 300000, { type: "income", category: "salary" }),
    ];
    const r = rangeTotals(txs, ["2026-09", "2026-10"], settings);
    expect(r.income).toBe(300000);
    expect(r.variable).toBe(3000);
    expect(r.fixed).toBe(160000);
    expect(r.expense).toBe(3500 + 160000);
    expect(r.byCategory).toEqual({ food: 1500, daily: 2000, housing: 160000 });
    expect(r.variableByCategory).toEqual({ food: 1000, daily: 2000 });
    expect(r.budget).toBe(60000);
    expect(r.entries).toBe(4);
  });

  it("counts a category that no longer exists as other", () => {
    const r = rangeTotals([tx("2026-10-02", 700, { category: "c_gone" }), tx("2026-10-03", 300, { category: "other" })], ["2026-10"], settingsWith());
    expect(r.byCategory).toEqual({ other: 1000 });
  });
});

describe("rangeSummary", () => {
  it("compares a month in progress with the month before up to the same day", () => {
    setToday("2026-10-15");
    const txs = [tx("2026-09-10", 4000), tx("2026-09-20", 9000), tx("2026-10-03", 5000), tx("2026-10-25", 200000, { type: "income", category: "salary" })];
    const s = rangeSummary(txs, "2026-10", "month", settingsWith({}, { food: 31000 }));
    expect(s.partial).toBe(true);
    // September only up to the 15th
    expect(s.previous.expense).toBe(4000);
    expect(s.change).toBe(1000);
    expect(s.budgetLeft).toBe(26000);
    expect(s.savingsRate).toBeCloseTo(195000 / 200000);
  });

  it("compares a past month with the whole month before", () => {
    setToday("2026-10-15");
    const txs = [tx("2026-08-20", 4000), tx("2026-09-20", 9000)];
    const s = rangeSummary(txs, "2026-09", "month", settingsWith());
    expect(s.partial).toBe(false);
    expect(s.change).toBe(5000);
  });

  it("follows the payday period", () => {
    setToday("2026-10-30");
    // period 2026-10 is Oct 25 – Nov 24, day 6; the one before runs from Sep 25, so up to Sep 30
    const txs = [tx("2026-09-29", 100), tx("2026-10-01", 200), tx("2026-10-26", 50)];
    const s = rangeSummary(txs, "2026-10", "month", settingsWith({ monthStartDay: 25 }));
    expect(s.previous.expense).toBe(100);
    expect(s.current.expense).toBe(50);
  });

  it("has no change or budget to show without them", () => {
    setToday("2026-10-15");
    const s = rangeSummary([tx("2026-10-03", 5000)], "2026-10", "month", settingsWith({}, {}));
    expect(s.change).toBeNull();
    expect(s.budgetLeft).toBeNull();
    expect(s.savingsRate).toBeNull();
  });
});

describe("savingsRate", () => {
  it("is the share of income not spent", () => {
    expect(savingsRate(200000, 150000)).toBe(0.25);
    expect(savingsRate(100000, 120000)).toBe(-0.2);
    expect(savingsRate(0, 1000)).toBeNull();
  });
});

describe("categoryRows", () => {
  it("lists spending and budgets, biggest first, with the span before", () => {
    const settings = settingsWith({}, { food: 30000, fun: 10000, transport: 0 });
    const current = rangeTotals([tx("2026-10-02", 12000), tx("2026-10-03", 3000, { category: "daily" }), tx("2026-10-04", 2000, { outsideBudget: true })], ["2026-10"], settings);
    const previous = rangeTotals([tx("2026-09-02", 9000)], ["2026-09"], settings);
    expect(categoryRows({ current, previous }, settings)).toEqual([
      { id: "food", spent: 14000, budgeted: 12000, budget: 30000, previous: 9000 },
      { id: "daily", spent: 3000, budgeted: 3000, budget: 0, previous: 0 },
      { id: "fun", spent: 0, budgeted: 0, budget: 10000, previous: 0 },
    ]);
  });

  it("gives fixed costs no budget", () => {
    const settings = settingsWith({ fixedCosts: { "2026-10": [fixedCost("housing", 80000)] } }, { housing: 5 });
    const current = rangeTotals([], ["2026-10"], settings);
    expect(categoryRows({ current, previous: rangeTotals([], ["2026-09"], settings) }, settings)).toEqual([
      { id: "housing", spent: 80000, budgeted: 0, budget: 0, previous: 0 },
    ]);
  });

  it("leaves out a hidden category without spending", () => {
    setCategories({ edits: { fun: { hidden: true } }, custom: [], order: {} });
    try {
      const settings = settingsWith({}, { fun: 10000 });
      const r = rangeTotals([], ["2026-10"], settings);
      expect(categoryRows({ current: r, previous: r }, settings)).toEqual([]);
    } finally {
      setCategories({ edits: {}, custom: [], order: {} });
    }
  });
});

describe("topWithRest", () => {
  it("keeps the biggest and adds up the rest", () => {
    expect(topWithRest({ a: 1, b: 5, c: 3, d: 2, e: 0 }, 2)).toEqual([
      { id: "b", value: 5 },
      { id: "c", value: 3 },
      { id: REST, value: 3 },
    ]);
  });

  it("shows a single leftover itself", () => {
    expect(topWithRest({ a: 1, b: 5, c: 3 }, 2).map((x) => x.id)).toEqual(["b", "c", "a"]);
  });
});

describe("categoryTrend", () => {
  it("stacks the biggest categories per month and the rest", () => {
    const txs = [
      tx("2026-09-02", 5000),
      tx("2026-10-02", 6000),
      tx("2026-10-03", 4000, { category: "daily" }),
      tx("2026-10-04", 300, { category: "transport" }),
      tx("2026-09-04", 200, { category: "fun" }),
    ];
    const t = categoryTrend(txs, ["2026-09", "2026-10"], settingsWith(), 2);
    expect(t.ids).toEqual(["food", "daily", REST]);
    expect(t.rows).toEqual([
      { month: "2026-09", food: 5000, daily: 0, [REST]: 200 },
      { month: "2026-10", food: 6000, daily: 4000, [REST]: 300 },
    ]);
  });
});

describe("monthlyFlow", () => {
  it("gives income, spending and the share kept per month", () => {
    const txs = [tx("2026-10-02", 50000), tx("2026-10-25", 200000, { type: "income", category: "salary" })];
    expect(monthlyFlow(txs, lastMonths("2026-10", 2), settingsWith())).toEqual([
      { month: "2026-09", income: 0, expense: 0, savingsRate: null },
      { month: "2026-10", income: 200000, expense: 50000, savingsRate: 0.75 },
    ]);
  });
});

describe("topPlaces", () => {
  it("ranks memos by total, counting a split payment once", () => {
    const txs = [
      tx("2026-10-03", 1200, { memo: "スーパー", splitId: "s1" }),
      tx("2026-10-03", 800, { memo: "スーパー", splitId: "s1", category: "daily" }),
      tx("2026-10-05", 1500, { memo: " スーパー " }),
      tx("2026-10-06", 4000, { memo: "AMAZON", category: "daily" }),
      tx("2026-10-07", 600, { memo: "amazon", category: "daily" }),
      tx("2026-10-08", 900),
      tx("2026-09-08", 99999, { memo: "スーパー" }),
      tx("2026-10-25", 300000, { type: "income", category: "salary", memo: "給与" }),
    ];
    expect(topPlaces(txs, ["2026-10"], settingsWith())).toEqual([
      { name: "AMAZON", count: 2, total: 4600, category: "daily" },
      { name: "スーパー", count: 2, total: 3500, category: "food" },
    ]);
  });
});
