"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import { currentMonth, daysInMonth, monthLabel, today } from "@/lib/date";
import { parseAmount, yen } from "@/lib/format";
import { makeSampleTransactions } from "@/lib/samples";
import { PACE_LABEL, averageSurplus, elapsedFraction, monthStats, paceLevel, recordStreak, totalBudget } from "@/lib/stats";
import { useKakeibo } from "./KakeiboProvider";
import { Button, Card, CardTitle, EmptyState, Meter, Pill, Stamp, TextButton, TxRow, cx } from "./ui";

export function useSeedSamples() {
  const { addTransactions, toast } = useKakeibo();
  return async () => {
    toast("サンプルを入れています…");
    try {
      const created = await addTransactions(makeSampleTransactions());
      toast(`サンプルを${created.length}件入れました`);
    } catch {
      toast("サンプルを保存できませんでした");
    }
  };
}

export function HomeView() {
  const { transactions, settings, month, setView, openEntry } = useKakeibo();
  const seed = useSeedSamples();
  const stats = monthStats(transactions, month);
  const budget = totalBudget(settings);
  const fraction = elapsedFraction(month);
  const level = paceLevel(stats.expense, budget, fraction);
  const isCurrent = month === currentMonth();
  const left = budget - stats.expense;
  const daysLeft = isCurrent ? daysInMonth(month) - new Date().getDate() + 1 : 0;
  const perDay = isCurrent && left > 0 ? left / daysLeft : 0;
  const balance = stats.income - stats.expense;
  const recent = transactions.slice(0, 5);

  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-[1.15fr_1fr]">
      {transactions.length === 0 && (
        <Card className="lg:col-span-2">
          <EmptyState title="まだ記録がありません">
            「記入」から最初の支出をつけてみましょう。雰囲気を見たいときはサンプルデータも入れられます。
            <div className="mt-3 flex justify-center gap-2">
              <Button variant="primary" onClick={() => openEntry()}>
                記入する
              </Button>
              <Button onClick={seed}>サンプルを入れる</Button>
            </div>
          </EmptyState>
        </Card>
      )}

      <div className="grid gap-3.5">
        <section className="rounded-2xl bg-accent p-4 text-accent-ink shadow-[0_6px_20px_rgb(22_32_54/0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <span className="text-xs tracking-wider opacity-85">{monthLabel(month)}の支出</span>
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">{budget ? PACE_LABEL[level] : "予算未設定"}</span>
          </div>
          <div className="num mt-1 text-[34px] leading-tight font-bold min-[400px]:text-[40px]">
            {yen(stats.expense)}
            <small className="ml-1 text-base font-medium opacity-80">/ {yen(budget)}</small>
          </div>
          <div className="relative my-3 h-2 rounded-full bg-white/25">
            <div className="h-full rounded-full bg-accent-ink" style={{ width: `${budget ? Math.min(100, (stats.expense / budget) * 100) : 0}%` }} />
            {isCurrent && <div title="今日の目安" className="absolute -top-1 -bottom-1 w-0.5 bg-accent-ink/60" style={{ left: `${fraction * 100}%` }} />}
          </div>
          <div className="num flex flex-wrap justify-between gap-2 text-[13px]">
            <span>{left >= 0 ? `残り ${yen(left)}` : `${yen(-left)} オーバー`}</span>
            {isCurrent && <span>1日あたり {yen(perDay)} 使えます</span>}
          </div>
        </section>

        <Card>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["収入", yen(stats.income), ""],
              ["支出", yen(stats.expense), ""],
              ["収支", `${balance >= 0 ? "+" : "−"}${yen(Math.abs(balance))}`, balance >= 0 ? "text-good" : "text-bad"],
            ].map(([k, v, cls]) => (
              <div key={k} className="min-w-0">
                <div className="text-[11px] text-muted">{k}</div>
                <div className={cx("num truncate text-lg font-semibold", cls)}>{v}</div>
              </div>
            ))}
          </div>
        </Card>

        <SavingsGoalCard canMoveLeftover={isCurrent && left > 0 && balance > 0} leftover={left} />
        <StreakCard />
      </div>

      <div className="grid gap-3.5">
        <Card>
          <CardTitle action={<TextButton onClick={() => setView("settings")}>予算を編集</TextButton>}>カテゴリ別の予算</CardTitle>
          {CATEGORIES.expense.map((c) => {
            const b = settings.budgets[c.id] ?? 0;
            const s = stats.byCategory[c.id] ?? 0;
            if (!b && !s) return null;
            const ratio = b ? s / b : 1;
            return (
              <div key={c.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 border-t border-line py-2 first-of-type:border-t-0">
                <Stamp category={c.id} size="sm" />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{c.name}</div>
                  <Meter ratio={ratio} level={b ? paceLevel(s, b, fraction) : "bad"} className="mt-1" />
                </div>
                <div className="num text-right text-[13px] whitespace-nowrap">
                  <b className="text-[15px]">{yen(s)}</b>
                  <br />
                  <span className="text-muted">/ {yen(b)}</span>
                </div>
              </div>
            );
          })}
        </Card>

        <Card>
          <CardTitle action={<TextButton onClick={() => setView("history")}>すべて見る</TextButton>}>最近の記録</CardTitle>
          {recent.length ? recent.map((t) => <TxRow key={t.id} tx={t} onClick={() => openEntry(t)} />) : <EmptyState title="記録はまだありません" />}
        </Card>

        <Button className="justify-self-start lg:hidden" onClick={() => setView("settings")}>
          設定（予算・貯金目標・データ）
        </Button>
      </div>
    </div>
  );
}

function SavingsGoalCard({ canMoveLeftover, leftover }: { canMoveLeftover: boolean; leftover: number }) {
  const { settings, transactions, updateSettings, setView, toast } = useKakeibo();
  const [input, setInput] = useState("");
  const goal = settings.goal;
  const progress = goal.target ? Math.min(1, goal.saved / goal.target) : 0;
  const remaining = Math.max(0, goal.target - goal.saved);
  const surplus = averageSurplus(transactions);
  const eta =
    remaining === 0
      ? "目標達成！"
      : surplus > 0
        ? `今の黒字ペースなら あと約${Math.ceil(remaining / surplus)}か月`
        : "黒字の月が増えると到達時期を予測します";
  const R = 34;
  const C = 2 * Math.PI * R;

  const deposit = async (amount: number) => {
    if (!amount) {
      toast("金額を入れてください");
      return;
    }
    const saved = goal.saved + amount;
    await updateSettings((s) => ({ ...s, goal: { ...s.goal, saved } }));
    setInput("");
    toast(saved >= goal.target ? "目標達成です！おめでとうございます" : `${yen(amount)} 貯金しました。あと ${yen(goal.target - saved)}`);
  };

  return (
    <Card>
      <CardTitle action={<TextButton onClick={() => setView("settings")}>変更</TextButton>}>貯金目標</CardTitle>
      <div className="grid grid-cols-[auto_1fr] items-center gap-3.5">
        <svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label={`達成率 ${Math.round(progress * 100)}%`}>
          <circle cx="42" cy="42" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="9" />
          <circle
            cx="42"
            cy="42"
            r={R}
            fill="none"
            stroke="var(--good)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${C * progress} ${C}`}
            transform="rotate(-90 42 42)"
          />
          <text x="42" y="47" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--ink)" className="num">
            {Math.round(progress * 100)}%
          </text>
        </svg>
        <div className="min-w-0">
          <div className="text-base font-bold">{goal.name}</div>
          <div className="num text-xl font-semibold">
            {yen(goal.saved)} <span className="text-[13px] text-muted">/ {yen(goal.target)}</span>
          </div>
          <div className="text-xs text-muted">{eta}</div>
        </div>
      </div>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void deposit(parseAmount(input));
        }}
      >
        <input
          id="deposit-amount"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          inputMode="numeric"
          placeholder="貯金した金額"
          className="num min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2"
        />
        <Button type="submit" variant="primary">
          貯金に追加
        </Button>
        {canMoveLeftover && (
          <Button onClick={() => deposit(leftover)} title="今月の予算の残りを貯金に回す">
            残り予算を回す
          </Button>
        )}
      </form>
    </Card>
  );
}

function StreakCard() {
  const { transactions, settings, updateSettings, toast } = useKakeibo();
  const streak = recordStreak(transactions, settings.noSpendDays);
  return (
    <Card className="flex flex-wrap items-center justify-between gap-2.5">
      <div>
        <div className="font-bold">
          記録 <span className="num text-[22px]">{streak.count}</span> 日連続
        </div>
        <div className="flex gap-1" aria-label="直近7日の記録">
          {streak.last7.map((on, i) => (
            <i key={i} className={cx("size-3 rounded-[3px]", on ? "bg-accent" : "bg-surface-2")} />
          ))}
        </div>
      </div>
      {streak.recordedToday ? (
        <Pill level="good">今日は記録済み</Pill>
      ) : (
        <Button
          onClick={async () => {
            await updateSettings((s) => ({ ...s, noSpendDays: [...new Set([...s.noSpendDays, today()])].slice(-400) }));
            toast("支出なしの日として記録しました");
          }}
        >
          今日は支出なし
        </Button>
      )}
    </Card>
  );
}
