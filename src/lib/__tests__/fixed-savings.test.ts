import { describe, expect, it } from "vitest";
import { changeFixedCosts, fixedCostsFor, sumFixed } from "@/lib/fixed";
import { averageMonthlySavings, monthSavings, normalizeGoal, totalSaved, withFixedMonthly } from "@/lib/savings";
import { fixedCost, setToday, settingsWith } from "./helpers";

describe("fixed costs", () => {
  const rent = fixedCost("housing", 80000, { paid: true });
  const phone = fixedCost("phone", 3000, { paid: true });
  const fixedCosts = { "2026-08": [rent], "2026-10": [rent, phone] };

  it("a month without its own list copies the latest earlier one, unpaid", () => {
    expect(fixedCostsFor(fixedCosts, "2026-10")).toEqual({ items: [rent, phone], inheritedFrom: null });
    const sep = fixedCostsFor(fixedCosts, "2026-09");
    expect(sep.inheritedFrom).toBe("2026-08");
    expect(sep.items).toEqual([{ ...rent, paid: false }]);
    expect(fixedCostsFor(fixedCosts, "2026-07")).toEqual({ items: [], inheritedFrom: null });
  });

  it("changing a month starts from what it inherits", () => {
    const s = changeFixedCosts(settingsWith({ fixedCosts }), "2026-09", (items) => [...items, phone]);
    expect(sumFixed(s.fixedCosts["2026-09"])).toBe(83000);
    expect(s.fixedCosts["2026-08"]).toEqual([rent]);
  });
});

describe("savings", () => {
  it("fills in goals saved by older versions", () => {
    expect(normalizeGoal({ target: 100 })).toEqual({ target: 100, saved: 0, monthly: {}, fixedMonthly: { amount: 0, from: "" } });
    expect(normalizeGoal(null).target).toBe(0);
  });

  it("a month's own amount wins over the fixed amount", () => {
    const s = settingsWith({ goal: { target: 0, saved: 0, monthly: { "2026-09": 5000 }, fixedMonthly: { amount: 20000, from: "2026-08" } } });
    expect(monthSavings(s, "2026-07")).toBe(0);
    expect(monthSavings(s, "2026-08")).toBe(20000);
    expect(monthSavings(s, "2026-09")).toBe(5000);
    expect(monthSavings(s, "2026-10")).toBe(20000);
  });

  it("totals savings up to the current period", () => {
    setToday("2026-10-15");
    const s = settingsWith({
      goal: { target: 0, saved: 100000, monthly: { "2026-09": 5000, "2026-12": 9999 }, fixedMonthly: { amount: 20000, from: "2026-08" } },
    });
    // before the app + Aug 20000 + Sep 5000 + Oct 20000; December is still ahead
    expect(totalSaved(s)).toBe(145000);
  });

  it("changing the fixed amount keeps what earlier months took", () => {
    setToday("2026-10-15");
    const s = settingsWith({ goal: { target: 0, saved: 0, monthly: {}, fixedMonthly: { amount: 20000, from: "2026-08" } } });
    const goal = withFixedMonthly(s.goal, s, 30000);
    expect(goal.monthly).toEqual({ "2026-08": 20000, "2026-09": 20000 });
    expect(goal.fixedMonthly).toEqual({ amount: 30000, from: "2026-10" });
    expect(withFixedMonthly(s.goal, s, 0).fixedMonthly).toEqual({ amount: 0, from: "" });
  });

  it("averages the months that have an amount", () => {
    const s = settingsWith({ goal: { target: 0, saved: 0, monthly: { "2026-10": 30000, "2026-08": 10000 }, fixedMonthly: { amount: 0, from: "" } } });
    expect(averageMonthlySavings(s, "2026-10")).toBe(20000);
  });
});
