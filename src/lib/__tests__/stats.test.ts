import { describe, expect, it } from "vitest";
import {
  cumulativeDaily,
  elapsedFraction,
  monthStats,
  paceLevel,
  paceStep,
  quickPicks,
  recordStreak,
  todayBudget,
  variableBudget,
  weekBudget,
  weekdayAverages,
} from "@/lib/stats";
import { fixedCost, setToday, settingsWith, tx } from "./helpers";

describe("monthStats", () => {
  const settings = settingsWith({ fixedCosts: { "2026-09": [fixedCost("housing", 80000)] } });
  const txs = [
    tx("2026-10-02", 1000),
    tx("2026-10-03", 500, { category: "daily" }),
    tx("2026-10-04", 20000, { category: "fun", outsideBudget: true }),
    tx("2026-10-25", 300000, { type: "income", category: "salary" }),
    tx("2026-09-30", 999),
  ];

  it("splits a month into income, budgeted, fixed and outside-budget spending", () => {
    const s = monthStats(txs, "2026-10", settings);
    expect(s.list).toHaveLength(4);
    expect(s.income).toBe(300000);
    expect(s.variable).toBe(1500);
    expect(s.extra).toBe(20000);
    expect(s.extraList.map((t) => t.amount)).toEqual([20000]);
    // October inherits September's fixed costs
    expect(s.fixed).toBe(80000);
    expect(s.expense).toBe(1500 + 80000 + 20000);
    expect(s.byCategory).toEqual({ food: 1000, daily: 500, fun: 20000, housing: 80000 });
    expect(s.variableByCategory).toEqual({ food: 1000, daily: 500 });
  });

  it("leaves fixed costs out without settings", () => {
    const s = monthStats(txs, "2026-10");
    expect(s.fixed).toBe(0);
    expect(s.expense).toBe(21500);
  });

  it("uses the payday period", () => {
    const s = monthStats(txs, "2026-09", settingsWith({ monthStartDay: 3 }));
    // Sep 3 – Oct 2: Sep 30 and Oct 2
    expect(s.variable).toBe(1999);
  });
});

describe("variableBudget", () => {
  it("adds up only the variable categories", () => {
    expect(variableBudget(settingsWith({}, { food: 30000, fun: 5000, housing: 80000 }))).toBe(35000);
  });
});

describe("todayBudget", () => {
  // Thursday; the week is Oct 12–18 and 20 days of October were left on the 12th
  const settings = settingsWith({}, { food: 30000 });

  it("splits what is left of the week over its days left, leaving out today's own spending", () => {
    setToday("2026-10-15");
    const txs = [
      tx("2026-10-01", 10000), // before the week: (30000 - 10000) / 20 = 1000 a day, 7000 for the week
      tx("2026-10-13", 2200),
      tx("2026-10-15", 600),
      tx("2026-10-15", 3000, { outsideBudget: true }),
    ];
    const b = todayBudget(txs, settings);
    expect(b.limit).toBe(1200); // (7000 - 2200) / 4
    expect(b.spent).toBe(600);
    expect(b.extra).toBe(3000);
    expect(b.left).toBe(600);
    expect(b.list).toHaveLength(2);
    expect(b.perDayFromTomorrow).toBe(1400); // (4800 - 600) / 3
  });

  it("matches the week card's per-day share", () => {
    setToday("2026-10-15");
    const txs = [tx("2026-10-01", 10000), tx("2026-10-13", 2200), tx("2026-10-15", 600)];
    expect(todayBudget(txs, settings).limit).toBeCloseTo(weekBudget(txs, settings).perDayLeft);
  });

  it("holds back expenses already recorded for later days of the week only", () => {
    setToday("2026-10-15");
    expect(todayBudget([tx("2026-10-01", 10000), tx("2026-10-17", 2000)], settings).limit).toBe(1250); // (7000 - 2000) / 4
    expect(todayBudget([tx("2026-10-01", 10000), tx("2026-10-25", 2000)], settings).limit).toBe(1750);
  });

  it("never goes below zero", () => {
    setToday("2026-10-15");
    const b = todayBudget([tx("2026-10-01", 40000)], settings);
    expect(b.limit).toBe(0);
    expect(b.perDayFromTomorrow).toBe(0);
  });

  it("takes tomorrow's share from next week on the week's last day", () => {
    setToday("2026-10-18");
    const b = todayBudget([], settingsWith({}, { food: 26000 }));
    expect(b.limit).toBe(9100); // 1300 a day, all 7 days left for Sunday
    expect(b.perDayFromTomorrow).toBe(2000); // 26000 / 13 days left on the 19th
  });
});

describe("elapsedFraction", () => {
  it("is 1 for past periods, 0 for future ones and the share of days for the current one", () => {
    setToday("2026-10-31");
    expect(elapsedFraction("2026-09", 1)).toBe(1);
    expect(elapsedFraction("2026-11", 1)).toBe(0);
    expect(elapsedFraction("2026-10", 1)).toBe(1);
    setToday("2026-10-05");
    expect(elapsedFraction("2026-10", 5)).toBeCloseTo(1 / 31);
  });
});

describe("pace", () => {
  it("paceLevel warns when spending runs ahead of the month", () => {
    expect(paceLevel(0, 0, 0.5)).toBe("good");
    expect(paceLevel(5000, 10000, 0.5)).toBe("good");
    expect(paceLevel(5900, 10000, 0.5)).toBe("warn");
    expect(paceLevel(10001, 10000, 1)).toBe("bad");
  });

  it("paceStep grades from plenty of room to over budget", () => {
    expect(paceStep(3000, 10000, 0.5)).toBe(0);
    expect(paceStep(5000, 10000, 0.5)).toBe(1);
    expect(paceStep(5500, 10000, 0.5)).toBe(2);
    expect(paceStep(6000, 10000, 0.5)).toBe(3);
    expect(paceStep(7000, 10000, 0.5)).toBe(4);
    expect(paceStep(10001, 10000, 0.5)).toBe(5);
  });
});

describe("recordStreak", () => {
  it("counts days in a row with a record or a no-spending mark", () => {
    setToday("2026-10-15");
    const r = recordStreak([tx("2026-10-15", 100), tx("2026-10-13", 100)], ["2026-10-14"]);
    expect(r.count).toBe(3);
    expect(r.recordedToday).toBe(true);
    expect(r.last7).toEqual([false, false, false, false, true, true, true]);
  });

  it("keeps yesterday's streak while today has no record yet", () => {
    setToday("2026-10-15");
    const r = recordStreak([tx("2026-10-14", 100)], []);
    expect(r.count).toBe(1);
    expect(r.recordedToday).toBe(false);
  });
});

describe("quickPicks", () => {
  it("ranks memos by use, with the latest amount", () => {
    const picks = quickPicks(
      [
        tx("2026-10-01", 500, { memo: "コーヒー" }),
        tx("2026-10-03", 550, { memo: "コーヒー" }),
        tx("2026-10-02", 1200, { memo: "ランチ" }),
        tx("2026-10-02", 900, { memo: "" }),
      ],
      "expense",
    );
    expect(picks).toEqual([
      { category: "food", memo: "コーヒー", amount: 550, count: 2 },
      { category: "food", memo: "ランチ", amount: 1200, count: 1 },
    ]);
  });
});

describe("weekdayAverages", () => {
  it("averages variable spending per weekday, leaving out fixed costs and outside-budget spending", () => {
    setToday("2026-10-18"); // a Sunday; the last 14 days have two of each weekday
    const avg = weekdayAverages(
      [
        tx("2026-10-12", 1000), // Monday
        tx("2026-10-05", 3000), // Monday
        tx("2026-10-13", 5000, { category: "housing" }),
        tx("2026-10-14", 5000, { outsideBudget: true }),
        tx("2026-09-01", 9999), // too old
      ],
      14,
    );
    expect(avg[1]).toBe(2000);
    expect(avg[2]).toBe(0);
    expect(avg[3]).toBe(0);
  });
});

describe("cumulativeDaily", () => {
  it("adds up budgeted spending day by day until today", () => {
    setToday("2026-10-03");
    const days = cumulativeDaily(
      [tx("2026-10-01", 100), tx("2026-10-03", 50), tx("2026-10-02", 999, { outsideBudget: true })],
      "2026-10",
      1,
    );
    expect(days).toEqual([
      { day: 1, total: 100 },
      { day: 2, total: 100 },
      { day: 3, total: 150 },
    ]);
  });

  it("covers the whole of a past period and none of a future one", () => {
    setToday("2026-10-03");
    expect(cumulativeDaily([], "2026-09", 1)).toHaveLength(30);
    expect(cumulativeDaily([], "2026-11", 1)).toHaveLength(0);
  });
});
