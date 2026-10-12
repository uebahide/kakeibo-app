export type Currency = "JPY" | "HUF";

export const CURRENCIES: { id: Currency; name: string; symbol: string }[] = [
  { id: "JPY", name: "日本円", symbol: "¥" },
  { id: "HUF", name: "フォリント", symbol: "Ft" },
];

export function normalizeCurrency(value: unknown): Currency {
  return value === "HUF" ? "HUF" : "JPY";
}

// The display currency is a user setting; KakeiboProvider sets it as settings load or change.
// Amounts are stored as plain numbers and never converted.
let currency: Currency = "JPY";

export function setCurrency(c: Currency) {
  currency = c;
}

export const currencySymbol = () => (currency === "HUF" ? "Ft" : "¥");

/** Money label in the display currency: "¥12,300" or "12 300 Ft". (Named before HUF existed.) */
export const yen = (n: number) =>
  currency === "HUF" ? Math.round(n).toLocaleString("hu-HU", { useGrouping: "always" }) + " Ft" : "¥" + Math.round(n).toLocaleString("ja-JP");

/** Short axis label: 125000 -> "12.5万" (yen) or "125k" (forint) */
export function shortYen(n: number): string {
  if (currency === "HUF") {
    if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toLocaleString("ja-JP", { maximumFractionDigits: 1 }) + "M";
    if (Math.abs(n) >= 1000) return (n / 1000).toLocaleString("ja-JP", { maximumFractionDigits: 0 }) + "k";
    return Math.round(n).toLocaleString("ja-JP");
  }
  if (Math.abs(n) >= 10000) {
    return (n / 10000).toLocaleString("ja-JP", { maximumFractionDigits: 1 }) + "万";
  }
  return Math.round(n).toLocaleString("ja-JP");
}

/** Keep digits only and parse ("12,300" -> 12300). Empty -> 0. */
export function parseAmount(text: string): number {
  const digits = text.replace(/[^\d]/g, "").slice(0, 9);
  return digits ? Number(digits) : 0;
}

export function formatAmountInput(text: string): string {
  const n = parseAmount(text);
  return n ? n.toLocaleString("ja-JP") : "";
}
