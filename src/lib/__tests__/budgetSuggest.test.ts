import { describe, expect, it } from "vitest";
import { applySuggestion, suggestBudgets } from "@/lib/budgetSuggest";
import { setCurrency } from "@/lib/format";
import { fixedCost, setToday, settingsWith, tx } from "./helpers";

const row = (s: ReturnType<typeof suggestBudgets>, id: string) => s?.rows.find((r) => r.id === id);

describe("suggestBudgets", () => {
  it("is null with no records in the 3 months before", () => {
    setToday("2026-10-02");
    expect(suggestBudgets([tx("2026-10-01", 1000), tx("2026-06-15", 1000)], settingsWith())).toBeNull();
  });

  it("raises a budget that went over in most months to the average, rounded up", () => {
    setToday("2026-10-02");
    const txs = [tx("2026-07-10", 33000), tx("2026-08-10", 36000), tx("2026-09-10", 29500)];
    const s = suggestBudgets(txs, settingsWith({}, { food: 31000 }));
    expect(s?.month).toBe("2026-10");
    expect(s?.months).toEqual(["2026-09", "2026-08", "2026-07"]);
    // average 32,833 -> 33,000; over in July and August
    expect(row(s, "food")).toMatchObject({ kind: "over", overMonths: 2, current: 31000, suggested: 33000 });
    expect(s?.changed).toBe(true);
  });

  it("lowers a budget that was well under every month", () => {
    setToday("2026-10-02");
    const txs = [tx("2026-08-10", 20000), tx("2026-09-10", 22000)];
    expect(row(suggestBudgets(txs, settingsWith({}, { food: 31000 })), "food")).toMatchObject({ kind: "under", suggested: 21000 });
  });

  it("keeps a budget that was about right", () => {
    setToday("2026-10-02");
    const txs = [tx("2026-08-10", 32000), tx("2026-09-10", 28000)];
    const s = suggestBudgets(txs, settingsWith({}, { food: 31000 }));
    expect(row(s, "food")).toMatchObject({ kind: "keep", suggested: 31000 });
    expect(s?.changed).toBe(false);
  });

  it("suggests a budget for spending without one, and 0 for a budget never used", () => {
    setToday("2026-10-02");
    const txs = [tx("2026-09-10", 4200, { category: "daily" })];
    const s = suggestBudgets(txs, settingsWith({}, { food: 31000 }));
    expect(row(s, "daily")).toMatchObject({ kind: "new", suggested: 4500 });
    expect(row(s, "food")).toMatchObject({ kind: "unused", suggested: 0 });
    // categories with neither a budget nor spending are left out
    expect(row(s, "fun")).toBeUndefined();
  });

  it("leaves out spending outside the budget and fixed-cost categories", () => {
    setToday("2026-10-02");
    const txs = [tx("2026-09-10", 30000), tx("2026-09-11", 50000, { outsideBudget: true }), tx("2026-09-12", 9000, { category: "housing" })];
    const s = suggestBudgets(txs, settingsWith({}, { food: 31000 }));
    expect(row(s, "food")).toMatchObject({ average: 30000, kind: "keep" });
    expect(row(s, "housing")).toBeUndefined();
  });

  it("lowers everything by the same share to fit income minus fixed costs and savings", () => {
    setToday("2026-10-02");
    const txs = [
      tx("2026-09-01", 200000, { type: "income", category: "salary" }),
      tx("2026-09-10", 80000),
      tx("2026-09-10", 40000, { category: "fun" }),
    ];
    const settings = settingsWith(
      { fixedCosts: { "2026-09": [fixedCost("housing", 80000)] }, goal: { target: 0, saved: 0, monthly: { "2026-10": 30000 }, fixedMonthly: { amount: 0, from: "" } } },
      {},
    );
    const s = suggestBudgets(txs, settings);
    // 200,000 − 80,000 − 30,000 = 90,000 for 120,000 of suggestions: three quarters each
    expect(s?.available).toBe(90000);
    expect(s?.trimmed).toBe(true);
    expect(row(s, "food")).toMatchObject({ suggested: 60000, trimmed: true });
    expect(row(s, "fun")).toMatchObject({ suggested: 30000, trimmed: true });
    expect(s?.total).toBeLessThanOrEqual(90000);
  });

  it("skips the income check when no income was recorded", () => {
    setToday("2026-10-02");
    const s = suggestBudgets([tx("2026-09-10", 80000)], settingsWith({}, {}));
    expect(s?.available).toBeNull();
    expect(row(s, "food")?.suggested).toBe(80000);
  });

  it("follows the payday period", () => {
    setToday("2026-10-26");
    // with the 25th as the start, Sep 26 belongs to the period named September
    const s = suggestBudgets([tx("2026-09-26", 5000)], settingsWith({ monthStartDay: 25 }, {}));
    expect(s?.month).toBe("2026-10");
    expect(s?.months).toEqual(["2026-09"]);
  });

  it("rounds forint amounts to tidier steps", () => {
    setToday("2026-10-02");
    setCurrency("HUF");
    const s = suggestBudgets([tx("2026-09-10", 123400)], settingsWith({ currency: "HUF" }, {}));
    expect(row(s, "food")?.suggested).toBe(125000);
  });
});

describe("applySuggestion", () => {
  it("sets all, or only the picked, categories", () => {
    setToday("2026-10-02");
    const txs = [tx("2026-09-10", 40000), tx("2026-09-10", 4200, { category: "daily" })];
    const budgets = { food: 31000, fun: 15000 };
    const s = suggestBudgets(txs, settingsWith({}, budgets))!;
    expect(applySuggestion(budgets, s)).toEqual({ food: 40000, daily: 4500, fun: 0 });
    expect(applySuggestion(budgets, s, ["daily"])).toEqual({ food: 31000, daily: 4500, fun: 15000 });
  });
});
