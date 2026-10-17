import { getCategory, isFixedCategory } from "./categories";
import { parseDate, shiftDays, today, weekdays } from "./date";
import { getLanguage, pick } from "./i18n";
import { dict } from "./i18n/dict";
import { currentPeriod, periodDays, periodOf } from "./period";
import { monthStats, variableBudget, weekBudget } from "./stats";
import type { Settings, Transaction } from "./types";
import { weekDates, weekStartOf } from "./week";

/** A category Claude names as overspent, with the week's figures filled in from the digest. */
export type WeeklyReviewCategory = { category: string; spent: number; allowance: number; note: string };

/** What Claude writes about a week (save_weekly_review), in the digest's language. */
export type WeeklyReviewText = {
  headline: string;
  overspent: WeeklyReviewCategory[];
  good: string[];
  tips: string[];
  cheer: string;
};

/** A saved review: Claude's text plus the week's figures as they were when it was saved. */
export type WeeklyReview = {
  weekStart: string;
  at: string;
  source: "claude" | "app";
  text: WeeklyReviewText;
  totals: { allowance: number; spent: number; outsideBudget: number };
  /** the week after the reviewed one: its allowance and per-day share when the review was saved */
  nextWeek: { start: string; allowance: number; perDay: number };
};

/** How many reviews the app loads (newest weeks). */
export const WEEKLY_REVIEWS = 12;

/** Days after the reviewed week ends during which the home screen shows its review. */
export const REVIEW_HOME_DAYS = 3;

/** How many past weeks the digest compares the week with. */
const PAST_WEEKS = 4;

/** First day of the last week that is over (the week before the current one). */
export const lastWeekStart = (settings: Settings) => shiftDays(weekStartOf(today(), settings.weekStartDay), -7);

/** Whether the home screen shows this review today: it is about last week, and the current week is in its first days. */
export function showOnHome(review: WeeklyReview | undefined, settings: Settings): review is WeeklyReview {
  if (!review || review.weekStart !== lastWeekStart(settings)) return false;
  return today() < shiftDays(review.weekStart, 7 + REVIEW_HOME_DAYS);
}

/** Budgeted spending (outside-the-budget records left out) per category from `start` to `end`. */
function spentByCategory(txs: Transaction[], start: string, end: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of txs) {
    if (t.type === "income" || t.outsideBudget || t.date < start || t.date > end) continue;
    out.set(t.category, (out.get(t.category) ?? 0) + t.amount);
  }
  return out;
}

/** A category's share of its monthly budget for a week: each day takes 1/(days in its period) of it. */
function categoryAllowance(budget: number, start: string, startDay: number): number {
  return weekDates(start).reduce((s, d) => s + budget / periodDays(periodOf(d, startDay)), 0);
}

/**
 * Totals for one week (by default the last one that is over), for Claude's weekly review:
 * the week against its allowance, by category against each budget's share and the weeks before,
 * where the money went, and what the next week and the current month have. Only totals, no records.
 * Call inside inTimeZone / inLanguage / inCategories on the server, as buildAiDigest is.
 */
export function buildWeeklyDigest(txs: Transaction[], settings: Settings, start = lastWeekStart(settings)) {
  const startDay = settings.monthStartDay;
  const end = shiftDays(start, 6);
  const week = weekBudget(txs, settings, start);
  const past = Array.from({ length: PAST_WEEKS }, (_, i) => shiftDays(start, -7 * (i + 1)));

  const spent = spentByCategory(txs, start, end);
  const pastSpent = past.map((s) => spentByCategory(txs, s, shiftDays(s, 6)));
  const ids = new Set([...spent.keys(), ...Object.keys(settings.budgets).filter((id) => (settings.budgets[id] ?? 0) > 0 && !isFixedCategory(id))]);
  const byCategory = [...ids]
    .map((id) => {
      const budget = isFixedCategory(id) ? 0 : (settings.budgets[id] ?? 0);
      return {
        category: getCategory(id).name,
        spent: spent.get(id) ?? 0,
        /** null when the category has no budget (or is a fixed cost) */
        allowance: budget > 0 ? Math.round(categoryAllowance(budget, start, startDay)) : null,
        averageOfPastWeeks: Math.round(pastSpent.reduce((s, m) => s + (m.get(id) ?? 0), 0) / PAST_WEEKS),
      };
    })
    .filter((c) => c.spent > 0 || c.allowance)
    .sort((a, b) => b.spent - a.spent);

  const items = new Map<string, { count: number; total: number }>();
  for (const t of txs) {
    if (t.type === "income" || t.date < start || t.date > end) continue;
    const key = `${t.memo || pick({ ja: "(メモなし)", en: "(no memo)" })}／${getCategory(t.category).name}`;
    const cur = items.get(key) ?? { count: 0, total: 0 };
    cur.count++;
    cur.total += t.amount;
    items.set(key, cur);
  }

  const next = weekBudget(txs, settings, shiftDays(start, 7));
  const period = currentPeriod(startDay);
  const budget = variableBudget(settings);
  const monthSpent = monthStats(txs, period, settings).variable;

  return {
    /** language the user reads the app in; the review should be written in it */
    language: getLanguage(),
    currency: settings.currency,
    today: today(),
    weekStartsOn: settings.weekStartDay === 0 ? "sunday" : "monday",
    week: {
      start,
      end,
      allowance: Math.round(week.allowance),
      spent: week.spent,
      outsideBudget: week.extra,
      left: Math.round(week.left),
      days: week.days.map((d) => ({
        date: d.date,
        weekday: weekdays()[parseDate(d.date).getDay()],
        spent: d.spent,
        allowance: Math.round(d.allowance),
      })),
    },
    byCategory,
    topItems: [...items.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([item, v]) => ({ item, ...v })),
    pastWeeks: past.map((s) => {
      const w = weekBudget(txs, settings, s);
      return { start: s, spent: w.spent, allowance: Math.round(w.allowance) };
    }),
    /** the week after this one (the current week, for last week's review) */
    nextWeek: { start: next.start, end: next.end, allowance: Math.round(next.allowance), perDay: Math.round(next.allowance / 7) },
    month: { period, budget, spent: monthSpent, left: budget - monthSpent },
  };
}

export type WeeklyDigest = ReturnType<typeof buildWeeklyDigest>;

/** Fills in each overspent category's figures from the digest; returns the names it doesn't know. */
export function withFigures(text: Omit<WeeklyReviewText, "overspent"> & { overspent: { category: string; note: string }[] }, digest: WeeklyDigest) {
  const unknown: string[] = [];
  const overspent: WeeklyReviewCategory[] = [];
  for (const o of text.overspent) {
    const c = digest.byCategory.find((b) => b.category === o.category.trim());
    if (!c) unknown.push(o.category);
    else overspent.push({ category: c.category, spent: c.spent, allowance: c.allowance ?? 0, note: o.note });
  }
  return { text: { ...text, overspent }, unknown };
}

/** The review to save for a week, with the week's figures taken from its digest. */
export function reviewFrom(digest: WeeklyDigest, text: WeeklyReviewText, source: WeeklyReview["source"]): WeeklyReview {
  return {
    weekStart: digest.week.start,
    at: new Date().toISOString(),
    source,
    text,
    totals: { allowance: digest.week.allowance, spent: digest.week.spent, outsideBudget: digest.week.outsideBudget },
    nextWeek: { start: digest.nextWeek.start, allowance: digest.nextWeek.allowance, perDay: digest.nextWeek.perDay },
  };
}

/** A review of last week for demo mode, made from the sample records with fixed texts. */
export function sampleReview(txs: Transaction[], settings: Settings): WeeklyReview {
  const digest = buildWeeklyDigest(txs, settings);
  const s = dict().weekly.sample;
  const over = digest.byCategory.filter((c) => c.allowance !== null && c.spent > c.allowance).slice(0, 2);
  return reviewFrom(
    digest,
    {
      headline: over.length ? s.headlineOver(over[0].category) : s.headline,
      overspent: over.map((c, i) => ({ category: c.category, spent: c.spent, allowance: c.allowance ?? 0, note: s.notes[i] })),
      good: [s.good],
      tips: [s.tip],
      cheer: s.cheer,
    },
    "claude",
  );
}
