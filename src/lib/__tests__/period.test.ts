import { describe, expect, it } from "vitest";
import { setLanguage } from "@/lib/i18n";
import {
  clampStartDay,
  currentPeriod,
  periodDateLabel,
  periodDayIndex,
  periodDays,
  periodEnd,
  periodOf,
  periodRangeLabel,
  periodStart,
} from "@/lib/period";
import { setToday } from "./helpers";

describe("clampStartDay", () => {
  it("keeps the day between 1 and 28", () => {
    expect(clampStartDay(0)).toBe(1);
    expect(clampStartDay(31)).toBe(28);
    expect(clampStartDay("5")).toBe(5);
    expect(clampStartDay("x")).toBe(1);
  });
});

describe("periods starting on the 1st", () => {
  it("are calendar months", () => {
    expect(periodOf("2026-10-01", 1)).toBe("2026-10");
    expect(periodOf("2026-10-31", 1)).toBe("2026-10");
    expect(periodStart("2026-02", 1)).toBe("2026-02-01");
    expect(periodEnd("2026-02", 1)).toBe("2026-02-28");
    expect(periodEnd("2028-02", 1)).toBe("2028-02-29");
    expect(periodRangeLabel("2026-10", 1)).toBe("");
  });
});

describe("periods starting on payday", () => {
  it("are named after the month they start in", () => {
    expect(periodOf("2026-10-04", 5)).toBe("2026-09");
    expect(periodOf("2026-10-05", 5)).toBe("2026-10");
    expect(periodOf("2026-11-04", 5)).toBe("2026-10");
    expect(periodOf("2026-01-04", 25)).toBe("2025-12");
  });

  it("run from the start day to the day before it next month", () => {
    expect(periodStart("2026-10", 5)).toBe("2026-10-05");
    expect(periodEnd("2026-10", 5)).toBe("2026-11-04");
    expect(periodEnd("2026-12", 25)).toBe("2027-01-24");
  });

  it("are as long as the month they start in", () => {
    expect(periodDays("2026-10")).toBe(31);
    expect(periodDays("2026-02")).toBe(28);
    // Feb 25 – Mar 24 is 28 days
    expect(periodDayIndex("2026-03-24", "2026-02", 25)).toBe(28);
  });

  it("count days from the start", () => {
    expect(periodDayIndex("2026-10-05", "2026-10", 5)).toBe(1);
    expect(periodDayIndex("2026-11-04", "2026-10", 5)).toBe(31);
    expect(periodDateLabel("2026-10", 5, 28)).toBe("11/1");
  });

  it("label their range in the display language", () => {
    expect(periodRangeLabel("2026-10", 5)).toBe("10/5〜11/4");
    setLanguage("en");
    expect(periodRangeLabel("2026-10", 5)).toBe("10/5–11/4");
  });
});

describe("currentPeriod", () => {
  it("follows today and the start day", () => {
    setToday("2026-10-03");
    expect(currentPeriod(1)).toBe("2026-10");
    expect(currentPeriod(5)).toBe("2026-09");
  });
});
