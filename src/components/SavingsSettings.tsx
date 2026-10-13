"use client";

import { useState } from "react";
import { addMonths, monthLabel } from "@/lib/date";
import { parseAmount, yen } from "@/lib/format";
import { currentPeriod } from "@/lib/period";
import { averageMonthlySavings, monthSavings, monthlyTotal, totalSaved, usesFixed, withFixedMonthly } from "@/lib/savings";
import { useKakeibo } from "./KakeiboProvider";
import { SavingsEye } from "./SavingsPrivacy";
import { Button, Card, CardTitle } from "./ui";

const LIST_MONTHS = 12;

/** Ring showing how far savings are toward the goal. */
export function GoalRing({ progress, size = 84 }: { progress: number; size?: number }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  return (
    <svg width={size} height={size} viewBox="0 0 84 84" role="img" aria-label={`達成率 ${Math.round(progress * 100)}%`}>
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
  if (remaining === 0) return "目標達成！";
  if (perMonth > 0) return `毎月 ${yen(perMonth)} のペースなら あと約${Math.ceil(remaining / perMonth)}か月`;
  return "毎月の貯金額を入れると到達時期を予測します";
}

/** Settings card for savings: where the total comes from, the goal, and the amounts behind it. */
export function SavingsSettings() {
  const { settings, savingsHidden } = useKakeibo();
  return (
    <Card>
      <CardTitle action={<SavingsEye className="-my-1.5" />}>貯金と目標</CardTitle>
      {savingsHidden ? (
        <p className="text-sm text-muted">シークレットモード中です。解除すると、貯金の内訳や目標を見たり変えたりできます。</p>
      ) : (
        // Re-mount when the stored values change elsewhere (e.g. the home sheet) so the inputs follow.
        <Body key={`${settings.goal.target}-${settings.goal.saved}-${settings.goal.fixedMonthly.amount}`} />
      )}
    </Card>
  );
}

function Body() {
  const { settings, updateSettings, toast } = useKakeibo();
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
    ["target", "目標額（任意）", "ホームの達成率と、到達までの目安に使います。空欄なら目標なしです。"],
    ["saved", "アプリを使う前の貯金（スタート時の残高）", "これまでの貯金の合計に足されます。"],
    ["fixed", "毎月の定額貯金（任意）", "入れておくと、今月から毎月の「今月貯金する額」に自動で入ります。月ごとに変えた額が優先です。"],
  ] as const;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-[auto_1fr] items-center gap-3.5">
        {target > 0 && <GoalRing progress={progress} size={72} />}
        <div className={target > 0 ? "min-w-0" : "col-span-2 min-w-0"}>
          <div className="text-xs text-muted">これまでの貯金</div>
          <div className="num text-xl font-semibold text-accent">
            {yen(total)} {target > 0 && <span className="text-[13px] text-muted">/ 目標 {yen(target)}</span>}
          </div>
          <div className="num text-xs text-muted">
            アプリ前 {yen(goal.saved)} ＋ 毎月の合計 {yen(monthlyTotal(settings))}
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
          toast("保存しました");
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
          保存
        </Button>
      </form>

      <MonthlyList now={now} />
      <p className="text-xs text-muted">毎月の額はホームの「今月貯金する額」でも入れられます。</p>
    </div>
  );
}

function MonthlyList({ now }: { now: string }) {
  const { settings, updateSettings } = useKakeibo();
  const months = Array.from({ length: LIST_MONTHS }, (_, i) => addMonths(now, -i));
  return (
    <details className="group rounded-xl border border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-bold [&::-webkit-details-marker]:hidden">
        月ごとの貯金（直近{LIST_MONTHS}か月）
        <span className="text-muted transition group-open:rotate-180">▾</span>
      </summary>
      <ul className="border-t border-line px-3 py-1">
        {months.map((m) => {
          const amount = monthSavings(settings, m);
          return (
            <li key={`${m}-${amount}`} className="grid grid-cols-[1fr_auto_120px] items-center gap-2 py-1.5 text-sm">
              <span>{monthLabel(m)}</span>
              <span className="text-[11px] text-muted">{usesFixed(settings, m) ? "定額" : ""}</span>
              <input
                aria-label={`${monthLabel(m)}の貯金額`}
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
      <p className="border-t border-line px-3 py-2 text-[11px] text-muted">入力欄から離れると保存されます。</p>
    </details>
  );
}
