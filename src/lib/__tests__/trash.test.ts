import { describe, expect, it } from "vitest";
import { daysLeft, sortTrash, photosOf, type TrashEntry } from "@/lib/trash";
import { tx } from "./helpers";

const now = new Date("2026-10-17T12:00:00+09:00");
const entry = (id: string, deletedAt: string): TrashEntry => ({ id, deletedAt, records: [tx("2026-10-15", 800)] });

describe("recently deleted records", () => {
  it("count the days left out of 30, rounding up, and 0 once they are over", () => {
    expect(daysLeft(entry("a", "2026-10-17T03:00:00Z"), now)).toBe(30);
    expect(daysLeft(entry("a", "2026-09-17T04:00:00Z"), now)).toBe(1);
    expect(daysLeft(entry("a", "2026-09-17T03:00:00Z"), now)).toBe(0);
  });

  it("keep the ones under 30 days, newest first, and pick out the expired ones", () => {
    const old = entry("old", "2026-09-01T00:00:00Z");
    const recent = entry("recent", "2026-10-16T00:00:00Z");
    const newest = entry("newest", "2026-10-17T00:00:00Z");
    const { kept, expired } = sortTrash([recent, old, newest], now);
    expect(kept.map((e) => e.id)).toEqual(["newest", "recent"]);
    expect(expired.map((e) => e.id)).toEqual(["old"]);
  });

  it("list each receipt photo once", () => {
    expect(photosOf([tx("2026-10-15", 800, { receiptId: "r1" }), tx("2026-10-15", 200, { receiptId: "r1" }), tx("2026-10-15", 100)])).toEqual(["r1"]);
  });
});
