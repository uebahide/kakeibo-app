"use client";

import { useState } from "react";
import { yen } from "@/lib/format";
import { DICTS } from "@/lib/i18n/dict";
import type { Language } from "@/lib/i18n";
import { weekRangeLabel } from "@/lib/week";
import { showOnHome, type WeeklyReview } from "@/lib/weeklyReview";
import { claudeUrl, useAccount } from "./claudeLink";
import { useKakeibo } from "./KakeiboProvider";
import { useLanguage, useT } from "./LanguageProvider";
import { Card, CardTitle, EmptyState, TextButton, buttonClass, cx } from "./ui";

/** The week whose home card was closed, so it stays closed on this device. */
const DISMISSED_KEY = "kakeibo-app.reviewDismissed";

function readDismissed(): string {
  try {
    return localStorage.getItem(DISMISSED_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Opens a new claude.ai chat that writes last week's review through the kakeibo connector (MCP). */
const claudeReviewUrl = (lang: Language, account: string | null) => claudeUrl(DICTS[lang].weekly.claudePrompt, DICTS[lang].common.claudeAccount(account));

/** Home card with last week's review, for the first days of the new week until it is closed. */
export function WeeklyReviewHome() {
  const { weeklyReviews, settings, setView } = useKakeibo();
  const t = useT().weekly;
  const latest = weeklyReviews[0];
  // Reviews load after mount, so this never renders with them while prerendering, where localStorage is missing.
  const [dismissed, setDismissed] = useState(readDismissed);
  if (!showOnHome(latest, settings) || dismissed === latest.weekStart) return null;

  const close = () => {
    setDismissed(latest.weekStart);
    try {
      localStorage.setItem(DISMISSED_KEY, latest.weekStart);
    } catch {
      // storage blocked: closed until reload
    }
  };

  return (
    <Card>
      <CardTitle
        action={
          <button type="button" aria-label={t.close} onClick={close} className="hit -my-1.5 text-lg leading-none text-muted">
            ×
          </button>
        }
      >
        {t.title}
        <span className="num ml-2 font-medium">{weekRangeLabel(latest.weekStart)}</span>
      </CardTitle>
      <ReviewBody review={latest} compact />
      <TextButton className="mt-2" onClick={() => setView("ai")}>
        {t.readMore}
      </TextButton>
    </Card>
  );
}

/** The AI screen's card: the latest review in full, a way to write one in Claude, and earlier weeks. */
export function WeeklyReviewSection() {
  const { weeklyReviews, storeKind } = useKakeibo();
  const t = useT().weekly;
  const language = useLanguage();
  const account = useAccount(storeKind === "supabase");
  const [latest, ...earlier] = weeklyReviews;
  return (
    <Card>
      <CardTitle>{t.sectionTitle}</CardTitle>
      <p className="mb-3 text-sm">{t.sectionLead}</p>
      {latest ? (
        <div className="rounded-xl bg-surface-2 px-3.5 py-3">
          <div className="mb-1 text-xs font-bold text-muted">{t.titleOf(weekRangeLabel(latest.weekStart))}</div>
          <ReviewBody review={latest} />
        </div>
      ) : (
        <EmptyState title={t.empty}>{null}</EmptyState>
      )}
      {storeKind === "supabase" && (
        <div className="mt-3">
          <a href={claudeReviewUrl(language, account)} target="_blank" rel="noopener noreferrer" className={buttonClass("default")}>
            {t.claudeButton}
          </a>
          <p className="mt-2 text-xs text-muted">{t.claudeNote}</p>
        </div>
      )}
      {earlier.length > 0 && (
        <div className="mt-3 border-t border-line pt-2.5">
          <div className="mb-1 text-xs font-bold text-muted">{t.pastTitle}</div>
          {earlier.map((r) => (
            <details key={r.weekStart} className="border-t border-line py-2 first:border-t-0">
              <summary className="hit cursor-pointer text-sm">
                <span className="num font-bold">{weekRangeLabel(r.weekStart)}</span>
                <span className="ml-2">{r.text.headline}</span>
              </summary>
              <div className="pt-2">
                <ReviewBody review={r} />
              </div>
            </details>
          ))}
        </div>
      )}
    </Card>
  );
}

/** A review's contents; `compact` (home) leaves out what went well and the closing line. */
function ReviewBody({ review, compact = false }: { review: WeeklyReview; compact?: boolean }) {
  const t = useT().weekly;
  const language = useLanguage();
  const { text, totals, nextWeek } = review;
  const over = totals.allowance > 0 && totals.spent > totals.allowance;
  return (
    <div className="grid gap-2.5">
      <div>
        <div className="text-base font-bold">{text.headline}</div>
        <div className={cx("num text-[13px]", over ? "text-bad" : "text-muted")}>
          {t.spentOfAllowance(yen(totals.spent), yen(totals.allowance))}
          {totals.outsideBudget > 0 && <span className="text-muted">{` · ${t.outsideBudget(yen(totals.outsideBudget))}`}</span>}
        </div>
      </div>
      {text.overspent.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-bold text-muted">{t.overspentTitle}</div>
          <ul className="grid gap-1.5">
            {text.overspent.map((o) => (
              <li key={o.category} className="rounded-xl bg-warn-soft px-3 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <b>{o.category}</b>
                  <span className="num text-xs">{(o.basis === "average" ? t.categoryAboveUsual : t.categoryOver)(yen(o.spent), yen(o.allowance))}</span>
                </div>
                {!compact && <p className="text-sm">{o.note}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!compact && (
        <div>
          <div className="mb-1 text-xs font-bold text-muted">{t.goodTitle}</div>
          <ul className="grid gap-1.5">
            {text.good.map((g, i) => (
              <li key={i} className="rounded-xl bg-good-soft px-3 py-2 text-sm">
                {g}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <div className="mb-1 text-xs font-bold text-muted">{t.tipsTitle}</div>
        <p className="num text-sm font-bold">{t.nextWeek(yen(nextWeek.allowance), yen(nextWeek.perDay))}</p>
        <ul className="mt-1 grid list-disc gap-1 pl-5 text-sm">
          {(compact ? text.tips.slice(0, 1) : text.tips).map((tip, i) => (
            <li key={i}>{tip}</li>
          ))}
        </ul>
      </div>
      {!compact && (
        <>
          <p className="text-sm text-muted">{text.cheer}</p>
          <p className="text-xs text-muted">{t.madeAt(new Date(review.at).toLocaleString(language === "en" ? "en-US" : "ja-JP"))}</p>
        </>
      )}
    </div>
  );
}
