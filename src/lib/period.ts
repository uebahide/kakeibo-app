import { addMonths, daysInMonth, monthOf, parseDate, today } from "./date";

/**
 * A "month" in the app can start on any day from 1 to 28 (e.g. payday). A period is named
 * after the calendar month it starts in: with start day 5, "2026-10" is Oct 5 – Nov 4.
 */

export const clampStartDay = (day: unknown) => Math.min(28, Math.max(1, Math.round(Number(day) || 1)));

const pad = (n: number) => String(n).padStart(2, "0");

/** The period (YYYY-MM) a YYYY-MM-DD date belongs to. */
export function periodOf(date: string, startDay: number): string {
  return Number(date.slice(8)) >= startDay ? monthOf(date) : addMonths(monthOf(date), -1);
}

export const currentPeriod = (startDay: number) => periodOf(today(), startDay);

/** First day of the period (YYYY-MM-DD). */
export const periodStart = (month: string, startDay: number) => `${month}-${pad(startDay)}`;

/** Last day of the period (YYYY-MM-DD, inclusive). */
export function periodEnd(month: string, startDay: number): string {
  if (startDay === 1) return `${month}-${pad(daysInMonth(month))}`;
  return `${addMonths(month, 1)}-${pad(startDay - 1)}`;
}

/** Number of days in the period. Day s of one month to day s−1 of the next is as long as the first month. */
export const periodDays = (month: string) => daysInMonth(month);

/** 1-based position of a date inside its period. */
export function periodDayIndex(date: string, month: string, startDay: number): number {
  const ms = parseDate(date).getTime() - parseDate(periodStart(month, startDay)).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

/** "M/D" of the n-th day (1-based) of the period. */
export function periodDateLabel(month: string, startDay: number, n: number): string {
  const d = parseDate(periodStart(month, startDay));
  d.setDate(d.getDate() + n - 1);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** "10/5〜11/4", or "" when the period is the calendar month. */
export function periodRangeLabel(month: string, startDay: number): string {
  if (startDay === 1) return "";
  const [s, e] = [periodStart(month, startDay), periodEnd(month, startDay)];
  return `${Number(s.slice(5, 7))}/${Number(s.slice(8))}〜${Number(e.slice(5, 7))}/${Number(e.slice(8))}`;
}
