export const yen = (n: number) => "¥" + Math.round(n).toLocaleString("ja-JP");

/** Short axis label: 125000 -> "12.5万" */
export function shortYen(n: number): string {
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
