import { describe, expect, it } from "vitest";
import { formatAmountInput, formatMoney, parseAmount, setCurrency, shortYen } from "@/lib/format";
import { setLanguage } from "@/lib/i18n";
import { categoryHint, currencyOf, numberOf, readWalletPayment } from "@/lib/import/wallet";

describe("amounts", () => {
  it("parses what is typed", () => {
    expect(parseAmount("12,300")).toBe(12300);
    expect(parseAmount("")).toBe(0);
    expect(parseAmount("1234567890123")).toBe(123456789);
    expect(formatAmountInput("12300")).toBe("12,300");
    expect(formatAmountInput("")).toBe("");
  });

  it("formats yen and forint", () => {
    expect(formatMoney(12300, "JPY")).toBe("¥12,300");
    expect(formatMoney(12300, "HUF")).toBe("12\u00a0300 Ft") // grouped with a no-break space;
  });

  it("shortens axis labels", () => {
    expect(shortYen(125000)).toBe("12.5万");
    expect(shortYen(800)).toBe("800");
    setLanguage("en");
    expect(shortYen(125000)).toBe("125k");
    setLanguage("ja");
    setCurrency("HUF");
    expect(shortYen(2_500_000)).toBe("2.5M");
  });
});

describe("Wallet amounts", () => {
  it.each([
    ["Ft2,500.00", 2500, "HUF"],
    ["2 500,00 Ft", 2500, "HUF"],
    ["¥1,200", 1200, "JPY"],
    ["€12.50", 12.5, "EUR"],
    ["1.234,56 EUR", 1234.56, "EUR"],
    ["2,50", 2.5, null],
    ["1,200", 1200, null],
  ])("reads %s", (text, amount, currency) => {
    expect(numberOf(text)).toBe(amount);
    expect(currencyOf(text)).toBe(currency);
  });

  it("reads a request body", () => {
    expect(readWalletPayment({ amount: "2 500 Ft", merchant: "  LIDL   Budapest " })).toEqual({ amount: 2500, currency: "HUF", merchant: "LIDL Budapest" });
    expect(readWalletPayment({ amount: 1200, merchant: "Lawson", currency: "jpy" })).toEqual({ amount: 1200, currency: "JPY", merchant: "Lawson" });
    expect(readWalletPayment({ amount: "0", merchant: "x" })).toBeNull();
    expect(readWalletPayment({ merchant: "x" })).toBeNull();
    expect(readWalletPayment(null)).toBeNull();
  });

  it("guesses a category from the merchant", () => {
    expect(categoryHint("LIDL Budapest")).toBe("food");
    expect(categoryHint("NETFLIX.COM")).toBe("subscription");
    expect(categoryHint("SEPHORA Arena")).toBe("cosmetics");
    expect(categoryHint("dm drogerie")).toBe("daily");
    expect(categoryHint("BKK automata")).toBe("transport");
    expect(categoryHint("Unknown shop")).toBeNull();
  });
});
