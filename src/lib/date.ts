const pad = (n: number) => String(n).padStart(2, "0");

export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** Local date as YYYY-MM-DD. */
export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const today = () => toDateString(new Date());

/** YYYY-MM of a YYYY-MM-DD string. */
export const monthOf = (date: string) => date.slice(0, 7);

export const currentMonth = () => monthOf(today());

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function parseDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y}年${Number(m)}月`;
}

export function dayLabel(date: string): string {
  const d = parseDate(date);
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`;
}

export function shiftDays(date: string, delta: number): string {
  const d = parseDate(date);
  d.setDate(d.getDate() + delta);
  return toDateString(d);
}
