import { getLanguage, pick } from "./i18n";

const pad = (n: number) => String(n).padStart(2, "0");

/** Short weekday names, Sunday first, in the display language. */
export const weekdays = () =>
  pick({ ja: ["日", "月", "火", "水", "木", "金", "土"], en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] });

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_EN_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Local date as YYYY-MM-DD. */
export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type TimeZone = "Asia/Tokyo" | "Europe/Budapest";

export const timeZones = (): { id: TimeZone; name: string }[] => [
  { id: "Asia/Tokyo", name: pick({ ja: "日本時間", en: "Japan time" }) },
  { id: "Europe/Budapest", name: pick({ ja: "ハンガリー時間", en: "Hungary time" }) },
];

/** Short tag shown next to today's date. */
export const TIME_ZONE_TAG: Record<TimeZone, string> = { "Asia/Tokyo": "JP time", "Europe/Budapest": "HU time" };

/** A saved time zone, or for users who never picked one, the one that goes with their currency. */
export function normalizeTimeZone(value: unknown, currency?: string | null): TimeZone {
  if (value === "Asia/Tokyo" || value === "Europe/Budapest") return value;
  return currency === "HUF" ? "Europe/Budapest" : "Asia/Tokyo";
}

// The time zone "today" is read in is a user setting; KakeiboProvider sets it as settings load or change.
// Unset (e.g. on the server outside inTimeZone), the machine's own clock is used.
let timeZone: TimeZone | undefined;

export function setTimeZone(tz: TimeZone) {
  timeZone = tz;
}

/**
 * Runs fn with "today" read in the given time zone. For the server, where requests from
 * different users share this module: fn must be synchronous, so no other request runs in between.
 */
export function inTimeZone<T>(tz: TimeZone, fn: () => T): T {
  const previous = timeZone;
  timeZone = tz;
  try {
    return fn();
  } finally {
    timeZone = previous;
  }
}

/** Today as YYYY-MM-DD in the user's time zone. */
export function today(): string {
  // sv-SE formats dates as YYYY-MM-DD
  if (timeZone) return new Date().toLocaleDateString("sv-SE", { timeZone });
  return toDateString(new Date());
}

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

/** 2026年10月 / October 2026 */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return getLanguage() === "en" ? `${MONTHS_EN_LONG[Number(m) - 1]} ${y}` : `${y}年${Number(m)}月`;
}

/** 10月 / Oct */
export function shortMonthLabel(month: string): string {
  const m = Number(month.slice(5, 7));
  return getLanguage() === "en" ? MONTHS_EN[m - 1] : `${m}月`;
}

/** 10月14日（火） / Tue, Oct 14 */
export function dayLabel(date: string): string {
  const d = parseDate(date);
  const wd = weekdays()[d.getDay()];
  return getLanguage() === "en" ? `${wd}, ${MONTHS_EN[d.getMonth()]} ${d.getDate()}` : `${d.getMonth() + 1}月${d.getDate()}日（${wd}）`;
}

/** 10/14（火） / Tue 10/14 */
export function shortDayLabel(date: string): string {
  const d = parseDate(date);
  const wd = weekdays()[d.getDay()];
  return getLanguage() === "en" ? `${wd} ${d.getMonth() + 1}/${d.getDate()}` : `${d.getMonth() + 1}/${d.getDate()}（${wd}）`;
}

export function shiftDays(date: string, delta: number): string {
  const d = parseDate(date);
  d.setDate(d.getDate() + delta);
  return toDateString(d);
}
