import { describe, expect, it } from "vitest";
import { groupSplits, splitParts } from "@/lib/split";
import { monthStats, variableBudget, weekdayAverages } from "@/lib/stats";
import { setToday, settingsWith, tx } from "./helpers";

// A ¥5,000 supermarket bill: ¥3,800 of food and ¥1,200 of household goods, recorded in that order.
const food = tx("2026-10-12", 3800, { id: "a", memo: "スーパー", splitId: "s1", createdAt: "2026-10-12T09:00:00Z" });
const daily = tx("2026-10-12", 1200, { id: "b", memo: "スーパー", category: "daily", splitId: "s1", createdAt: "2026-10-12T09:00:00Z" });
const lunch = tx("2026-10-12", 900, { id: "c", memo: "ランチ" });

describe("split payments", () => {
  it("find all the parts of a payment from any one of them, first part first", () => {
    expect(splitParts([daily, lunch, food], daily).map((t) => t.id)).toEqual(["a", "b"]);
    expect(splitParts([daily, lunch, food], lunch)).toEqual([lunch]);
  });

  it("show as one line with their total, where their first part appears in the list", () => {
    const entries = groupSplits([lunch, daily, food]);
    expect(entries.map((e) => [e.tx.id, e.parts.map((p) => p.id), e.amount])).toEqual([
      ["c", ["c"], 900],
      ["a", ["a", "b"], 5000],
    ]);
  });

  it("show one part alone when the list only has that part (a category filter)", () => {
    expect(groupSplits([daily]).map((e) => [e.tx.id, e.amount])).toEqual([["b", 1200]]);
  });

  it("count each part in its own category, and the whole payment in the month's spending", () => {
    setToday("2026-10-15");
    const s = monthStats([food, daily, lunch], "2026-10", settingsWith({}, { food: 30000, daily: 8000 }));
    expect(s.byCategory).toEqual({ food: 4700, daily: 1200 });
    expect(s.variable).toBe(5900);
    expect(variableBudget(settingsWith({}, { food: 30000, daily: 8000 }))).toBe(38000);
  });

  it("count the payment once per day in the day-of-week habits", () => {
    setToday("2026-10-15");
    // 2026-10-12 is a Monday; Mondays in the 90 days up to 10/15: 13 of them
    expect(weekdayAverages([food, daily])[1] * 13).toBeCloseTo(5000);
  });
});

describe("notes on the parts", () => {
  it("stay with their own part when the payment is grouped", () => {
    const withNote = { ...daily, note: "シャンプー" };
    const [entry] = groupSplits([food, withNote]);
    expect(entry.parts.map((p) => p.note ?? "")).toEqual(["", "シャンプー"]);
  });
});
