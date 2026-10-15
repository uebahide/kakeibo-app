import { parseDate, shiftDays } from "./date";
import { pick } from "./i18n";

/** Day a week starts on: 1 Monday, 0 Sunday (as in Date.getDay). */
export type WeekStart = 0 | 1;

export const normalizeWeekStart = (value: unknown): WeekStart => (value === 0 || value === "0" ? 0 : 1);

/** First day (YYYY-MM-DD) of the week a date is in. */
export function weekStartOf(date: string, weekStart: WeekStart): string {
  return shiftDays(date, -((parseDate(date).getDay() - weekStart + 7) % 7));
}

/** The 7 dates of the week starting on `start`. */
export const weekDates = (start: string) => Array.from({ length: 7 }, (_, i) => shiftDays(start, i));

/** "M/D" of a YYYY-MM-DD date. */
export const shortDate = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`;

/** "10/12〜10/18" (English: "10/12–10/18") */
export const weekRangeLabel = (start: string) => `${shortDate(start)}${pick({ ja: "〜", en: "–" })}${shortDate(shiftDays(start, 6))}`;
