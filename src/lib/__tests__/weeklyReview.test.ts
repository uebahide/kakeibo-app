import { describe, expect, it } from "vitest";
import { getCategory } from "@/lib/categories";
import { setLanguage } from "@/lib/i18n";
import { buildWeeklyDigest, lastWeekStart, reviewFrom, sampleReview, showOnHome, withFigures } from "@/lib/weeklyReview";
import { setToday, settingsWith, tx } from "./helpers";

const settings = settingsWith({}, { food: 31000, daily: 6200 });
const food = () => getCategory("food").name;

const text = { headline: "h", good: ["g"], tips: ["t"], cheer: "c" };

describe("lastWeekStart", () => {
  it("is the week before the current one", () => {
    setToday("2026-10-15"); // Thursday
    expect(lastWeekStart(settings)).toBe("2026-10-05");
    expect(lastWeekStart(settingsWith({ weekStartDay: 0 }))).toBe("2026-10-04");
  });

  it("is the week just over on the new week's first day", () => {
    setToday("2026-10-12"); // Monday
    expect(lastWeekStart(settings)).toBe("2026-10-05");
  });
});

describe("buildWeeklyDigest", () => {
  const txs = [
    tx("2026-10-06", 2000, { memo: "スーパー" }),
    tx("2026-10-07", 6000, { memo: "スーパー" }),
    tx("2026-10-08", 5000, { category: "fun", outsideBudget: true, memo: "旅行" }),
    tx("2026-09-30", 1000), // the week before
    tx("2026-10-13", 999), // the current week
    tx("2026-10-09", 300000, { type: "income", category: "salary" }),
  ];

  it("totals last week against its allowance", () => {
    setToday("2026-10-15");
    const d = buildWeeklyDigest(txs, settings);
    expect(d.week.start).toBe("2026-10-05");
    expect(d.week.end).toBe("2026-10-11");
    expect(d.week.spent).toBe(8000);
    expect(d.week.outsideBudget).toBe(5000);
    // nothing spent in October before the 5th: 37200 over the 27 days left, for 7 days
    expect(d.week.allowance).toBe(Math.round((37200 / 27) * 7));
    expect(d.week.days).toHaveLength(7);
    expect(d.week.days[1]).toMatchObject({ date: "2026-10-06", spent: 2000, weekday: "火" });
  });

  it("compares each category with its budget's share and the weeks before", () => {
    setToday("2026-10-15");
    const d = buildWeeklyDigest(txs, settings);
    expect(d.byCategory[0]).toEqual({ category: food(), spent: 8000, allowance: 7000, averageOfPastWeeks: 250, over: true });
    // a budget with no spending is still listed; spending outside the budget is not
    expect(d.byCategory.map((c) => c.category)).toEqual([food(), getCategory("daily").name]);
    expect(d.byCategory[1]).toMatchObject({ spent: 0, allowance: 1400, over: false });
  });

  it("counts a category without a budget as over when it is well above its usual week", () => {
    setToday("2026-10-15");
    // 4 weeks before of 1000 each: an average of 1000
    const before = ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"].map((d) => tx(d, 1000, { category: "fun" }));
    const over = buildWeeklyDigest([...before, tx("2026-10-06", 1300, { category: "fun" })], settings).byCategory.find((c) => c.category === getCategory("fun").name);
    expect(over).toEqual({ category: getCategory("fun").name, spent: 1300, allowance: null, averageOfPastWeeks: 1000, over: true });
    const usual = buildWeeklyDigest([...before, tx("2026-10-06", 1200, { category: "fun" })], settings).byCategory.find((c) => c.category === getCategory("fun").name);
    expect(usual?.over).toBe(false);
    // nothing to compare with
    expect(buildWeeklyDigest([tx("2026-10-06", 5000, { category: "fun" })], settings).byCategory[0].over).toBe(false);
  });

  it("lists where the money went, outside the budget included", () => {
    setToday("2026-10-15");
    const d = buildWeeklyDigest(txs, settings);
    expect(d.topItems[0]).toEqual({ item: `スーパー／${food()}`, count: 2, total: 8000 });
    expect(d.topItems[1].item).toContain("旅行");
  });

  it("gives the next week and the current month", () => {
    setToday("2026-10-15");
    const d = buildWeeklyDigest(txs, settings);
    expect(d.nextWeek.start).toBe("2026-10-12");
    expect(d.pastWeeks.map((w) => w.start)).toEqual(["2026-09-28", "2026-09-21", "2026-09-14", "2026-09-07"]);
    expect(d.pastWeeks[0].spent).toBe(1000);
    expect(d.month).toEqual({ period: "2026-10", budget: 37200, spent: 8999, left: 37200 - 8999 });
  });

  it("reviews a week given by its first day", () => {
    setToday("2026-10-15");
    expect(buildWeeklyDigest(txs, settings, "2026-09-28").week.spent).toBe(1000);
  });

  it("names categories and weekdays in the display language", () => {
    setToday("2026-10-15");
    setLanguage("en");
    const d = buildWeeklyDigest(txs, settings);
    expect(d.language).toBe("en");
    expect(d.week.days[1].weekday).toBe("Tue");
    expect(d.byCategory[0].category).toBe(food());
  });
});

describe("saving a review", () => {
  it("fills in the overspent categories' figures and names the unknown ones", () => {
    setToday("2026-10-15");
    const d = buildWeeklyDigest([tx("2026-10-06", 9000)], settings);
    const ok = withFigures({ ...text, overspent: [{ category: ` ${food()} `, note: "n" }] }, d);
    expect(ok.unknown).toEqual([]);
    expect(ok.text.overspent).toEqual([{ category: food(), spent: 9000, allowance: 7000, note: "n", basis: "budget" }]);
    expect(withFigures({ ...text, overspent: [{ category: "旅行", note: "n" }] }, d).unknown).toEqual(["旅行"]);
  });

  it("measures a category without a budget against its usual week", () => {
    setToday("2026-10-15");
    const d = buildWeeklyDigest([tx("2026-09-30", 4000, { category: "fun" }), tx("2026-10-06", 3000, { category: "fun" })], settings);
    const fun = getCategory("fun").name;
    expect(withFigures({ ...text, overspent: [{ category: fun, note: "n" }] }, d).text.overspent).toEqual([{ category: fun, spent: 3000, allowance: 1000, note: "n", basis: "average" }]);
  });

  it("keeps the week's totals and the next week's allowance", () => {
    setToday("2026-10-15");
    const d = buildWeeklyDigest([tx("2026-10-06", 9000), tx("2026-10-07", 100, { outsideBudget: true })], settings);
    const r = reviewFrom(d, { ...text, overspent: [] }, "claude");
    expect(r.weekStart).toBe("2026-10-05");
    expect(r.totals).toEqual({ allowance: d.week.allowance, spent: 9000, outsideBudget: 100 });
    expect(r.nextWeek).toEqual({ start: "2026-10-12", allowance: d.nextWeek.allowance, perDay: d.nextWeek.perDay });
  });
});

describe("showOnHome", () => {
  const review = (weekStart: string) => ({ ...reviewFrom(buildWeeklyDigest([], settings, weekStart), { ...text, overspent: [] }, "claude"), weekStart });

  it("shows last week's review for the first 3 days of the new week", () => {
    setToday("2026-10-12");
    expect(showOnHome(review("2026-10-05"), settings)).toBe(true);
    setToday("2026-10-14");
    expect(showOnHome(review("2026-10-05"), settings)).toBe(true);
    setToday("2026-10-15");
    expect(showOnHome(review("2026-10-05"), settings)).toBe(false);
  });

  it("leaves out older weeks and no review", () => {
    setToday("2026-10-12");
    expect(showOnHome(review("2026-09-28"), settings)).toBe(false);
    expect(showOnHome(undefined, settings)).toBe(false);
  });
});

describe("sampleReview", () => {
  it("names the sample week's overspent categories with their figures", () => {
    setToday("2026-10-15");
    const r = sampleReview([tx("2026-10-06", 9000, { isSample: true })], settings);
    expect(r.text.headline).toContain(food());
    expect(r.text.overspent).toMatchObject([{ category: food(), spent: 9000, allowance: 7000 }]);
  });
});
