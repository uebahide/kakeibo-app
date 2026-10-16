import { describe, expect, it } from "vitest";
import { joinNames, normalizeReading, receiptParts, type ReceiptReading } from "@/lib/receipt";

const reading = (items: ReceiptReading["items"], total: number, tax = 0): ReceiptReading => ({ store: "スーパー", date: "2026-10-15", total, tax, items });

describe("receipt readings", () => {
  it("become one part per category, largest first, with the item names as the note", () => {
    const parts = receiptParts(
      reading(
        [
          { name: "シャンプー", amount: 640, category: "daily" },
          { name: "牛乳", amount: 230, category: "food" },
          { name: "パン", amount: 180, category: "food" },
          { name: "卵", amount: 280, category: "food" },
        ],
        1330,
      ),
    );
    expect(parts).toEqual([
      { category: "food", amount: 690, note: "牛乳・パン・卵" },
      { category: "daily", amount: 640, note: "シャンプー" },
    ]);
  });

  it("take a discount off the item printed above it", () => {
    const parts = receiptParts(
      reading(
        [
          { name: "お肉", amount: 800, category: "food" },
          { name: "値引", amount: -200, category: "daily" },
          { name: "洗剤", amount: 300, category: "daily" },
        ],
        900,
      ),
    );
    expect(parts).toEqual([
      { category: "food", amount: 600, note: "お肉" },
      { category: "daily", amount: 300, note: "洗剤" },
    ]);
  });

  it("share tax added on top by amount, so the parts add up to the total exactly", () => {
    // ¥1,000 + ¥500 before 8% / 10% tax, ¥1,630 paid
    const parts = receiptParts(
      reading(
        [
          { name: "食品", amount: 1000, category: "food" },
          { name: "日用品", amount: 500, category: "daily" },
        ],
        1630,
        130,
      ),
    );
    expect(parts.map((p) => p.amount)).toEqual([1087, 543]);
    expect(parts.reduce((s, p) => s + p.amount, 0)).toBe(1630);
  });

  it("use the item total plus tax when the total couldn't be read", () => {
    const parts = receiptParts(reading([{ name: "パン", amount: 200, category: "food" }], 0, 16));
    expect(parts).toEqual([{ category: "food", amount: 216, note: "パン" }]);
  });

  it("give nothing when no item could be read", () => {
    expect(receiptParts(reading([], 1000))).toEqual([]);
    expect(receiptParts(reading([{ name: "値引", amount: -50, category: "food" }], 0))).toEqual([]);
  });

  it("keep notes within 40 characters and list each item name once", () => {
    expect(joinNames(["牛乳", "牛乳", "パン"])).toBe("牛乳・パン");
    const long = joinNames(Array.from({ length: 12 }, (_, i) => `品目${i + 1}`));
    expect(long.length).toBeLessThanOrEqual(40);
    expect(long.endsWith("…")).toBe(true);
    expect(joinNames(["あ".repeat(50)])).toBe(`${"あ".repeat(39)}…`);
  });

  it("checked from the server keep only the user's categories", () => {
    const checked = normalizeReading(
      { store: " ライフ ", date: "10/15", total: 500.4, tax: -3, items: [{ name: "牛乳", amount: 230, category: "food" }, { name: "?", amount: 270, category: "made_up" }, "x"] },
      ["food", "daily"],
      "other",
    );
    expect(checked).toEqual({
      store: "ライフ",
      date: "",
      total: 500,
      tax: 0,
      items: [
        { name: "牛乳", amount: 230, category: "food" },
        { name: "?", amount: 270, category: "other" },
      ],
    });
    expect(normalizeReading("text", ["food"], "other")).toBeNull();
  });
});
