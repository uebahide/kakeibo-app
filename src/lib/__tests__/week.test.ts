import { describe, expect, it } from "vitest";
import { setLanguage } from "@/lib/i18n";
import { weekBudget } from "@/lib/stats";
import { normalizeWeekStart, weekDates, weekRangeLabel, weekStartOf } from "@/lib/week";
import { setToday, settingsWith, tx } from "./helpers";

describe("weeks", () => {
  it("start on Monday or Sunday", () => {
    // 2026-10-15 is a Thursday
    expect(weekStartOf("2026-10-15", 1)).toBe("2026-10-12");
    expect(weekStartOf("2026-10-15", 0)).toBe("2026-10-11");
    expect(weekStartOf("2026-10-12", 1)).toBe("2026-10-12");
    expect(weekStartOf("2026-10-11", 1)).toBe("2026-10-05");
    expect(weekStartOf("2026-10-11", 0)).toBe("2026-10-11");
  });

  it("run 7 days, across months too", () => {
    expect(weekDates("2026-10-26")).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
  });

  it("label their range in the display language", () => {
    expect(weekRangeLabel("2026-10-26")).toBe("10/26〜11/1");
    setLanguage("en");
    expect(weekRangeLabel("2026-10-26")).toBe("10/26–11/1");
  });

  it("default to Monday for anything unknown", () => {
    expect(normalizeWeekStart(0)).toBe(0);
    expect(normalizeWeekStart("0")).toBe(0);
    expect(normalizeWeekStart(undefined)).toBe(1);
    expect(normalizeWeekStart(3)).toBe(1);
  });
});

describe("weekBudget", () => {
  const settings = settingsWith({}, { food: 31000 });

  it("gives the week 7 days of the daily share as it stood when the week began", () => {
    setToday("2026-10-15"); // Thursday; the week is Oct 12–18, with 20 days of October left on the 12th
    const w = weekBudget([], settings);
    expect(w.start).toBe("2026-10-12");
    expect(w.end).toBe("2026-10-18");
    expect(w.allowance).toBeCloseTo(7 * 1550);
    expect(w.elapsed).toBe(4);
    expect(w.days.map((d) => d.allowance)).toEqual(Array(7).fill(1550));
  });

  it("leaves out what was spent before the week, and counts the week's own spending", () => {
    setToday("2026-10-15");
    const w = weekBudget(
      [
        tx("2026-10-01", 10000),
        tx("2026-10-13", 500),
        tx("2026-10-15", 300),
        tx("2026-10-14", 4000, { outsideBudget: true }),
        tx("2026-10-20", 999), // next week
        tx("2026-10-12", 50000, { type: "income", category: "salary" }),
      ],
      settings,
    );
    // (31000 - 10000) / 20 days = 1050 a day
    expect(w.allowance).toBeCloseTo(7350);
    expect(w.spent).toBe(800);
    expect(w.extra).toBe(4000);
    expect(w.left).toBeCloseTo(6550);
    // left over Thursday to Sunday, today's own spending aside
    expect(w.perDayLeft).toBeCloseTo((6550 + 300) / 4);
    expect(w.days.find((d) => d.date === "2026-10-13")?.spent).toBe(500);
  });

  it("starts on Sunday when set to", () => {
    setToday("2026-10-15");
    const w = weekBudget([], settingsWith({ weekStartDay: 0 }, { food: 31000 }));
    expect(w.start).toBe("2026-10-11");
    // 21 days left on the 11th
    expect(w.allowance).toBeCloseTo((31000 / 21) * 7);
    expect(w.elapsed).toBe(5);
  });

  it("takes the days after payday from the next period's budget", () => {
    setToday("2026-10-28");
    const w = weekBudget([tx("2026-10-02", 13000)], settings);
    expect(w.start).toBe("2026-10-26");
    // Oct 26–31: (31000 - 13000) / 6 days; Nov 1: 31000 / 30 days
    expect(w.days[0].allowance).toBeCloseTo(3000);
    expect(w.days[6].allowance).toBeCloseTo(31000 / 30);
    expect(w.allowance).toBeCloseTo(18000 + 31000 / 30);
  });

  it("works with a payday start day", () => {
    setToday("2026-10-28");
    // 25th start: the week of Oct 26 is in the period that began Oct 25 (31 days), 30 of them left
    const w = weekBudget([tx("2026-10-25", 1000)], settingsWith({ monthStartDay: 25 }, { food: 31000 }));
    expect(w.days[0].allowance).toBeCloseTo(1000);
  });

  it("has no allowance once the budget is used up, and is over by what was spent", () => {
    setToday("2026-10-15");
    const w = weekBudget([tx("2026-10-01", 40000), tx("2026-10-14", 2000)], settings);
    expect(w.allowance).toBe(0);
    expect(w.left).toBe(-2000);
    expect(w.perDayLeft).toBe(0);
  });

  it("covers past and future weeks", () => {
    setToday("2026-10-15");
    const past = weekBudget([], settings, "2026-10-05");
    expect(past.elapsed).toBe(7);
    expect(past.perDayLeft).toBe(0);
    const ahead = weekBudget([], settings, "2026-10-19");
    expect(ahead.elapsed).toBe(0);
  });
});
