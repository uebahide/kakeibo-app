"use client";

import { useState } from "react";
import { addMonths, monthLabel } from "@/lib/date";
import { parseAmount, yen } from "@/lib/format";
import { dict } from "@/lib/i18n/dict";
import { currentPeriod } from "@/lib/period";
import { averageMonthlySavings, monthSavings, monthlyTotal, totalSaved, usesFixed, withFixedMonthly } from "@/lib/savings";
import { useKakeibo } from "./KakeiboProvider";
import { useT } from "./LanguageProvider";
import { SavingsEye } from "./SavingsPrivacy";
import { Button, Card, CardTitle } from "./ui";

const LIST_MONTHS = 12;

/** Ring showing how far savings are toward the goal. */
export function GoalRing({ progress, size = 84 }: { progress: number; size?: number }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const t = useT();
  return (
    <svg width={size} height={size} viewBox="0 0 84 84" role="img" aria-label={t.savings.goalRingLabel(Math.round(progress * 100))}>
      <circle cx="42" cy="42" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="9" />
      <circle
        cx="42"
        cy="42"
        r={R}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${C * progress} ${C}`}
        transform="rotate(-90 42 42)"
      />
      <text x="42" y="47" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--ink)" className="num">
        {Math.round(progress * 100)}%
      </text>
    </svg>
  );
}

/** When the goal will be reached at the recent pace. */
export function goalEta(remaining: number, perMonth: number): string {
  const t = dict().savings;
  if (remaining === 0) return t.goalReached;
  if (perMonth > 0) return t.goalEta(yen(perMonth), Math.ceil(remaining / perMonth));
  return t.goalEtaNeedsAmount;
}

/** Settings card for savings: where the total comes from, the goal, and the amounts behind it. */
export function SavingsSettings() {
  const { settings, savingsHidden } = useKakeibo();
  const t = useT();
  return (
    <Card>
      <CardTitle action={<SavingsEye className="-my-1.5" />}>{t.savings.title}</CardTitle>
      {savingsHidden ? (
        <p className="text-sm text-muted">{t.savings.hiddenNote}</p>
      ) : (
        // Re-mount when the stored values change elsewhere (e.g. the home sheet) so the inputs follow.
        <Body key={`${settings.goal.target}-${settings.goal.saved}-${settings.goal.fixedMonthly.amount}`} />
      )}
    </Card>
  );
}

function Body() {
  const { settings, updateSettings, toast } = useKakeibo();
  const t = useT();
  const goal = settings.goal;
  const now = currentPeriod(settings.monthStartDay);
  const total = totalSaved(settings);
  const target = goal.target;
  const progress = target ? Math.min(1, total / target) : 0;
  const perMonth = averageMonthlySavings(settings, now);
  const [form, setForm] = useState({
    target: target ? String(target) : "",
    saved: goal.saved ? String(goal.saved) : "",
    fixed: goal.fixedMonthly.amount ? String(goal.fixedMonthly.amount) : "",
  });
  const changed =
    parseAmount(form.target) !== target || parseAmount(form.saved) !== goal.saved || parseAmount(form.fixed) !== goal.fixedMonthly.amount;

  const fields = [
    ["target", t.savings.targetLabel, t.savings.targetHelp],
    ["saved", t.savings.startLabel, t.savings.startHelp],
    ["fixed", t.savings.fixedLabel, t.savings.fixedHelp],
  ] as const;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-[auto_1fr] items-center gap-3.5">
        {target > 0 && <GoalRing progress={progress} size={72} />}
        <div className={target > 0 ? "min-w-0" : "col-span-2 min-w-0"}>
          <div className="text-xs text-muted">{t.savings.savedSoFar}</div>
          <div className="num text-xl font-semibold text-accent">
            {yen(total)} {target > 0 && <span className="text-[13px] text-muted">{t.savings.ofGoal(yen(target))}</span>}
          </div>
          <div className="num text-xs text-muted">
            {t.savings.breakdown(yen(goal.saved), yen(monthlyTotal(settings)))}
          </div>
          {target > 0 && <div className="text-xs text-muted">{goalEta(Math.max(0, target - total), perMonth)}</div>}
        </div>
      </div>

      <form
        className="grid gap-1"
        onSubmit={async (e) => {
          e.preventDefault();
          const fixed = parseAmount(form.fixed);
          await updateSettings((s) => {
            const next = { ...s.goal, target: parseAmount(form.target), saved: parseAmount(form.saved) };
            return { ...s, goal: fixed === s.goal.fixedMonthly.amount ? next : withFixedMonthly(next, s, fixed) };
          });
          toast(t.savings.saved);
        }}
      >
        {fields.map(([key, label, help]) => (
          <label key={key} className="block">
            <span className="mt-2 mb-1 block text-[11px] tracking-wide text-muted">{label}</span>
            <input
              id={`goal-${key}`}
              value={form[key]}
              inputMode="numeric"
              placeholder="0"
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="num w-full rounded-xl border border-line bg-bg px-3 py-2"
            />
            <span className="mt-1 block text-[11px] text-muted">{help}</span>
          </label>
        ))}
        <Button type="submit" variant="primary" className="mt-3 justify-self-start" disabled={!changed}>
          {t.savings.save}
        </Button>
      </form>

      <MonthlyList now={now} />
      <p className="text-xs text-muted">{t.savings.homeNote}</p>
    </div>
  );
}

function MonthlyList({ now }: { now: string }) {
  const { settings, updateSettings } = useKakeibo();
  const t = useT();
  const months = Array.from({ length: LIST_MONTHS }, (_, i) => addMonths(now, -i));
  return (
    <details className="group rounded-xl border border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-bold [&::-webkit-details-marker]:hidden">
        {t.savings.monthlyTitle(LIST_MONTHS)}
        <span className="text-muted transition group-open:rotate-180">▾</span>
      </summary>
      <ul className="border-t border-line px-3 py-1">
        {months.map((m) => {
          const amount = monthSavings(settings, m);
          return (
            <li key={`${m}-${amount}`} className="grid grid-cols-[1fr_auto_120px] items-center gap-2 py-1.5 text-sm">
              <span>{monthLabel(m)}</span>
              <span className="text-[11px] text-muted">{usesFixed(settings, m) ? t.savings.fixedTag : ""}</span>
              <input
                aria-label={t.savings.monthAmountLabel(monthLabel(m))}
                inputMode="numeric"
                placeholder="0"
                defaultValue={amount || ""}
                onBlur={(e) => {
                  const value = parseAmount(e.target.value);
                  if (value === amount) return;
                  void updateSettings((s) => ({ ...s, goal: { ...s.goal, monthly: { ...s.goal.monthly, [m]: value } } }));
                }}
                className="num w-full rounded-lg border border-line bg-bg px-2.5 py-1.5 text-right"
              />
            </li>
          );
        })}
      </ul>
      <p className="border-t border-line px-3 py-2 text-[11px] text-muted">{t.savings.savedOnBlur}</p>
    </details>
  );
}
