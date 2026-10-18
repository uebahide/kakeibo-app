"use client";

import { useEffect, useRef, useState } from "react";
import { getCategory } from "@/lib/categories";
import { parseDate, shortDayLabel, today, weekdays } from "@/lib/date";
import { yen } from "@/lib/format";
import { paceStep, paceSteps, weekBudget, type WeekDay } from "@/lib/stats";
import type { Transaction } from "@/lib/types";
import { weekRangeLabel } from "@/lib/week";
import { useKakeibo } from "./KakeiboProvider";
import { useT } from "./LanguageProvider";
import { Card, PACE_BADGE, cx } from "./ui";

/** Records listed in a day's popup before the rest are counted as "n more". */
const POPUP_ITEMS = 6;

/** Home card for the current week: what is left, the pace, and a bar per day that opens the day's details. */
export function WeekCard() {
  const { transactions, settings } = useKakeibo();
  const t = useT();
  const w = t.home.week;
  const week = weekBudget(transactions, settings);
  const fraction = week.elapsed / 7;
  const step = week.allowance > 0 ? paceStep(week.spent, week.allowance, fraction) : week.spent > 0 ? 5 : 0;
  const daysLeft = 7 - week.elapsed + 1;
  // Headroom above the tallest bar, so the dashed allowance line stays visible at the top.
  const peak = Math.max(...week.days.map((d) => Math.max(d.spent, d.allowance)), 1) * 1.15;
  const now = today();
  // The day whose details are open: hovered with a mouse, or tapped.
  const [open, setOpen] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // A tap or click outside the bars closes the details.
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !listRef.current?.contains(e.target as Node) && setOpen(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 text-xs font-bold tracking-wide text-muted">
            <span>{week.left >= 0 ? w.left : w.over}</span>
            <span className="num font-medium">{weekRangeLabel(week.start)}</span>
          </div>
          <div className={cx("num text-2xl leading-tight font-bold", week.left < 0 && "text-bad")}>
            {week.left >= 0 ? yen(week.left) : t.home.hero.over(yen(-week.left))}
          </div>
        </div>
        <span className={cx("rounded-full px-2.5 py-0.5 text-xs font-bold shadow-sm", PACE_BADGE[step])}>{paceSteps()[step]}</span>
      </div>
      <div className="num mt-0.5 text-[13px] text-muted">{w.spentOfAllowance(yen(week.spent), yen(week.allowance))}</div>
      <div className="relative my-2.5 h-2 rounded-full bg-surface-2">
        <div
          className={cx("h-full rounded-full", step >= 4 ? "bg-bad" : step >= 2 ? "bg-warn" : "bg-accent")}
          style={{ width: `${week.allowance ? Math.min(100, (week.spent / week.allowance) * 100) : 100}%` }}
        />
        <div title={w.paceMark} className="absolute -top-1 -bottom-1 w-0.5 bg-ink/50" style={{ left: `${fraction * 100}%` }} />
      </div>

      <ul ref={listRef} className="grid grid-cols-7 gap-1.5">
        {week.days.map((d, i) => {
          const name = weekdays()[parseDate(d.date).getDay()];
          const future = d.date > now;
          const isOpen = open === d.date;
          return (
            <li key={d.date} className="relative">
              <button
                type="button"
                aria-label={w.day(name, yen(d.spent), yen(d.allowance))}
                aria-expanded={isOpen}
                // A mouse already opened it on hover, so its click keeps it open; a tap or a key toggles it.
                onClick={(e) => setOpen(isOpen && (e.nativeEvent as PointerEvent).pointerType !== "mouse" ? null : d.date)}
                onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(d.date)}
                onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(null)}
                className="grid w-full gap-1 text-center"
              >
                <div className={cx("relative h-12 overflow-hidden rounded-md bg-surface-2", isOpen && "ring-2 ring-accent/60")}>
                  {!future && (
                    <div
                      className={cx("absolute inset-x-0 bottom-0 rounded-md", d.spent > d.allowance ? "bg-warn" : "bg-accent")}
                      style={{ height: `${(d.spent / peak) * 100}%` }}
                    />
                  )}
                  <div className="absolute inset-x-0 border-t border-dashed border-muted/60" style={{ bottom: `${(d.allowance / peak) * 100}%` }} />
                </div>
                <span className={cx("text-[11px]", d.date === now ? "font-bold text-accent" : "text-muted")}>{name}</span>
              </button>
              {isOpen && (
                <DayDetails
                  day={d}
                  future={future}
                  records={transactions.filter((tx) => tx.date === d.date && tx.type === "expense")}
                  // Below the bar, so the week's amount stays in view. The first days open to the right, the last ones to the left.
                  align={i < 2 ? "left-0" : i > 4 ? "right-0" : "left-1/2 -translate-x-1/2"}
                />
              )}
            </li>
          );
        })}
      </ul>

      {week.left > 0 && (
        <p className="num mt-2 text-[13px]">{daysLeft > 1 ? w.perDayLeft(daysLeft, yen(week.perDayLeft)) : w.lastDay(yen(week.left))}</p>
      )}
      {week.extra > 0 && <p className="num mt-0.5 text-xs text-muted">{w.extra(yen(week.extra))}</p>}
    </Card>
  );
}

/** Popup over a day's bar: the day's total against its share, and what was spent on. */
function DayDetails({ day, future, records, align }: { day: WeekDay; future: boolean; records: Transaction[]; align: string }) {
  const t = useT();
  const w = t.home.week;
  const extra = records.filter((r) => r.outsideBudget).reduce((s, r) => s + r.amount, 0);
  const diff = day.allowance - day.spent;
  return (
    <div role="dialog" aria-label={shortDayLabel(day.date)} className={cx("absolute top-full z-20 mt-2 w-60 rounded-xl border border-line bg-surface p-3 text-left shadow-lg", align)}>
      <div className="flex items-baseline justify-between gap-2">
        <b className="num text-[13px]">{shortDayLabel(day.date)}</b>
        <span className="num text-[11px] text-muted">{w.dayAllowance(yen(day.allowance))}</span>
      </div>
      {future ? (
        <p className="mt-1 text-xs text-muted">{w.dayFuture}</p>
      ) : (
        <>
          <div className="num mt-1 text-lg leading-tight font-bold">{w.daySpent(yen(day.spent))}</div>
          <div className={cx("num text-xs", diff < 0 ? "text-bad" : "text-muted")}>{diff < 0 ? w.dayOver(yen(-diff)) : w.dayUnder(yen(diff))}</div>
          {extra > 0 && <div className="num text-xs text-muted">{w.extra(yen(extra))}</div>}
          {records.length ? (
            // grid-cols-1 caps the column at the popup's width; an auto column would widen to a long description and push the amounts out.
            <ul className="mt-2 grid grid-cols-1 gap-1 border-t border-line pt-2 text-xs">
              {records.slice(0, POPUP_ITEMS).map((r) => (
                <li key={r.id} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {r.memo || getCategory(r.category).name}
                    <span className="text-muted">
                      {r.memo && `${t.common.sep}${getCategory(r.category).name}`}
                      {r.outsideBudget && `${t.common.sep}${t.common.outsideBudget}`}
                    </span>
                  </span>
                  <span className="num shrink-0">{yen(r.amount)}</span>
                </li>
              ))}
              {records.length > POPUP_ITEMS && <li className="text-muted">{w.dayMore(records.length - POPUP_ITEMS)}</li>}
            </ul>
          ) : (
            <p className="mt-2 border-t border-line pt-2 text-xs text-muted">{w.dayEmpty}</p>
          )}
        </>
      )}
    </div>
  );
}
