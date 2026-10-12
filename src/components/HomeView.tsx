"use client";

import { useState } from "react";
import { VARIABLE_CATEGORIES } from "@/lib/categories";
import { monthLabel, today } from "@/lib/date";
import { currentPeriod, periodDayIndex, periodDays } from "@/lib/period";
import { fixedCostsFor } from "@/lib/fixed";
import { parseAmount, yen } from "@/lib/format";
import { averageMonthlySavings, monthSavings, totalSaved } from "@/lib/savings";
import { makeSampleFixedCosts, makeSampleTransactions } from "@/lib/samples";
import { PACE_LABEL, elapsedFraction, monthStats, paceLevel, recordStreak, variableBudget } from "@/lib/stats";
import { AiShortcut } from "./AiShortcut";
import { FixedCostsCard } from "./FixedCostsCard";
import { useKakeibo } from "./KakeiboProvider";
import { Button, Card, CardTitle, EmptyState, Meter, Pill, Sheet, Stamp, TextButton, TxRow, cx } from "./ui";

export function useSeedSamples() {
  const { addTransactions, settings, updateSettings, toast } = useKakeibo();
  return async () => {
    toast("サンプルを入れています…");
    try {
      if (!Object.keys(settings.fixedCosts).length) {
        void updateSettings((s) => ({ ...s, fixedCosts: makeSampleFixedCosts() }));
      }
      const created = await addTransactions(makeSampleTransactions());
      toast(`サンプルを${created.length}件入れました`);
    } catch {
      toast("サンプルを保存できませんでした");
    }
  };
}

type Panel = "income" | "fixed" | "saving" | "extra";

export function HomeView() {
  const { transactions, settings, month, setView, openEntry } = useKakeibo();
  const seed = useSeedSamples();
  const [panel, setPanel] = useState<Panel | null>(null);
  const stats = monthStats(transactions, month, settings);
  const budget = variableBudget(settings);
  const startDay = settings.monthStartDay;
  const fraction = elapsedFraction(month, startDay);
  const level = paceLevel(stats.variable, budget, fraction);
  const isCurrent = month === currentPeriod(startDay);
  const left = budget - stats.variable;
  const daysLeft = isCurrent ? periodDays(month) - periodDayIndex(today(), month, startDay) + 1 : 0;
  const perDay = isCurrent && left > 0 ? left / daysLeft : 0;
  const saving = monthSavings(settings, month);
  const balance = stats.income - stats.expense - saving;
  // Money left over this month if variable spending ends exactly at the budget (or at what was spent, if over).
  const plannedVariable = Math.max(budget, stats.variable);
  const spare = stats.income - stats.fixed - saving - plannedVariable - stats.extra;
  const fixed = fixedCostsFor(settings.fixedCosts, month).items;
  const incomeList = stats.list.filter((t) => t.type === "income");
  const unused = VARIABLE_CATEGORIES.filter((c) => settings.budgets[c.id] && !stats.variableByCategory[c.id]);
  const recent = transactions.slice(0, 5);
  const target = settings.goal.target;
  const saved = totalSaved(settings);

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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs tracking-wider opacity-85">{monthLabel(month)}の変動費の残り</span>
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">{budget ? PACE_LABEL[level] : "予算未設定"}</span>
          </div>
          <div className="num mt-1 text-[34px] leading-tight font-bold min-[400px]:text-[40px]">
            {left >= 0 ? yen(left) : `${yen(-left)} オーバー`}
          </div>
          <div className="num text-[13px] opacity-85">
            使った {yen(stats.variable)} / 予算 {yen(budget)}
          </div>
          <div className="relative my-3 h-2 rounded-full bg-white/25">
            <div className="h-full rounded-full bg-accent-ink" style={{ width: `${budget ? Math.min(100, (stats.variable / budget) * 100) : 0}%` }} />
            {isCurrent && <div title="今日の目安" className="absolute -top-1 -bottom-1 w-0.5 bg-accent-ink/60" style={{ left: `${fraction * 100}%` }} />}
          </div>
          {isCurrent && left > 0 && <div className="num text-[13px]">1日あたり {yen(perDay)} 使えます</div>}

          <div className="mt-3 border-t border-white/20 pt-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-[13px] font-bold">予算どおりなら浮くお金</span>
              {stats.income ? (
                <span className="num text-2xl font-bold">
                  {spare >= 0 ? "" : "−"}
                  {yen(Math.abs(spare))}
                </span>
              ) : (
                <span className="text-xs opacity-85">収入を記録すると出ます</span>
              )}
            </div>
            <details className="group mt-1 text-[13px]">
              <summary className="cursor-pointer list-none text-xs opacity-85 [&::-webkit-details-marker]:hidden">
                内訳 <span className="inline-block transition group-open:rotate-180">▾</span>
              </summary>
              <dl className="num mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
                <dt>収入</dt>
                <dd className="text-right">{yen(stats.income)}</dd>
                <dt>固定費</dt>
                <dd className="text-right">−{yen(stats.fixed)}</dd>
                <dt>貯金</dt>
                <dd className="text-right">−{yen(saving)}</dd>
                <dt>{stats.variable > budget ? "変動費（予算超え）" : "変動費の予算"}</dt>
                <dd className="text-right">−{yen(plannedVariable)}</dd>
                {stats.extra > 0 && (
                  <>
                    <dt>予算外の支出</dt>
                    <dd className="text-right">−{yen(stats.extra)}</dd>
                  </>
                )}
                <div className="col-span-2 my-1 border-t border-white/20" />
                <dt className="opacity-85">今日までの収支（貯金後）</dt>
                <dd className="text-right opacity-85">
                  {balance >= 0 ? "+" : "−"}
                  {yen(Math.abs(balance))}
                </dd>
              </dl>
            </details>
          </div>
        </section>

        <StreakLine />

        <Card>
          <CardTitle>{monthLabel(month)}のお金</CardTitle>
          <MoneyRow
            label="収入"
            sub={incomeList.length ? `${incomeList.length}件` : "給料などを記録する"}
            amount={stats.income || null}
            onClick={() => setPanel("income")}
          />
          <MoneyRow
            label="固定費"
            sub={fixed.length ? `支払い済み ${fixed.filter((f) => f.paid).length}/${fixed.length}件` : "家賃や通信費を登録する"}
            amount={stats.fixed}
            onClick={() => setPanel("fixed")}
          />
          <MoneyRow
            label="貯金"
            sub={`これまで ${yen(saved)}${target ? `・目標の${Math.min(100, Math.round((saved / target) * 100))}%` : ""}`}
            amount={saving || null}
            onClick={() => setPanel("saving")}
          />
          {stats.extra > 0 && (
            <MoneyRow
              label="予算外の支出"
              sub={`${stats.extraList.length}件・浮くお金から引いています`}
              amount={stats.extra}
              onClick={() => setPanel("extra")}
            />
          )}
        </Card>
      </div>

      <div className="grid gap-3.5">
        <Card>
          <CardTitle action={<TextButton onClick={() => setView("settings")}>予算を編集</TextButton>}>変動費の予算</CardTitle>
          {VARIABLE_CATEGORIES.map((c) => {
            const b = settings.budgets[c.id] ?? 0;
            const s = stats.variableByCategory[c.id] ?? 0;
            if (!s) return null;
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
          {unused.length > 0 && (
            <p className="num border-t border-line px-1 pt-2.5 text-xs text-muted first:border-t-0">
              まだ使っていない：{unused.map((c) => `${c.name} ${yen(settings.budgets[c.id] ?? 0)}`).join("・")}
            </p>
          )}
        </Card>

        <Card>
          <CardTitle action={<TextButton onClick={() => setView("history")}>すべて見る</TextButton>}>最近の記録</CardTitle>
          {recent.length ? recent.map((t) => <TxRow key={t.id} tx={t} onClick={() => openEntry(t)} />) : <EmptyState title="記録はまだありません" />}
        </Card>

        <AiShortcut className="lg:hidden" />
      </div>

      {panel === "income" && (
        <Sheet title={`${monthLabel(month)}の収入`} onClose={() => setPanel(null)}>
          {incomeList.map((t) => (
            <TxRow
              key={t.id}
              tx={t}
              onClick={() => {
                setPanel(null);
                openEntry(t);
              }}
            />
          ))}
          {incomeList.length > 0 ? (
            <p className="num mt-2 text-xs text-muted">合計 {yen(stats.income)}</p>
          ) : (
            <p className="text-sm text-muted">この月の収入はまだありません。「記入」で「収入」を選ぶと記録できます。</p>
          )}
          <Button
            variant="primary"
            className="mt-3 w-full"
            onClick={() => {
              setPanel(null);
              openEntry();
            }}
          >
            記入する
          </Button>
        </Sheet>
      )}
      {panel === "fixed" && (
        <Sheet title={`${monthLabel(month)}の固定費`} onClose={() => setPanel(null)}>
          <FixedCostsCard bare />
        </Sheet>
      )}
      {panel === "saving" && (
        <Sheet title={`${monthLabel(month)}の貯金`} onClose={() => setPanel(null)}>
          <SavingsCard canMoveLeftover={isCurrent && left > 0 && balance > 0} leftover={Math.min(left, balance)} />
        </Sheet>
      )}
      {panel === "extra" && (
        <Sheet title={`${monthLabel(month)}の予算外の支出`} onClose={() => setPanel(null)}>
          {stats.extraList.map((t) => (
            <TxRow
              key={t.id}
              tx={t}
              onClick={() => {
                setPanel(null);
                openEntry(t);
              }}
            />
          ))}
          <p className="mt-2 text-xs text-muted">
            合計 {yen(stats.extra)}。予算ではなく浮くお金から引いています。
            {stats.income > 0 && `浮くお金の残りは ${spare >= 0 ? yen(spare) : `−${yen(-spare)}`} です。`}
          </p>
        </Sheet>
      )}
    </div>
  );
}

function MoneyRow({ label, sub, amount, onClick }: { label: string; sub: string; amount: number | null; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-2.5 border-t border-line px-1 py-2.5 text-left first-of-type:border-t-0 hover:bg-surface-2"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block truncate text-[11px] text-muted">{sub}</span>
      </span>
      {amount === null ? <span className="text-sm text-muted">未入力</span> : <span className="num text-base font-semibold">{yen(amount)}</span>}
      <span aria-hidden className="text-lg text-muted">
        ›
      </span>
    </button>
  );
}

function SavingsCard({ canMoveLeftover, leftover }: { canMoveLeftover: boolean; leftover: number }) {
  const { settings, month, updateSettings, setView, toast } = useKakeibo();
  const current = monthSavings(settings, month);
  const [input, setInput] = useState<{ month: string; value: string } | null>(null);
  const value = input?.month === month ? input.value : current ? String(current) : "";
  const total = totalSaved(settings);
  const target = settings.goal.target;
  const progress = target ? Math.min(1, total / target) : 0;
  const remaining = Math.max(0, target - total);
  const perMonth = averageMonthlySavings(settings, month);
  const eta =
    remaining === 0
      ? "目標達成！"
      : perMonth > 0
        ? `毎月 ${yen(perMonth)} のペースなら あと約${Math.ceil(remaining / perMonth)}か月`
        : "毎月の貯金額を入れると到達時期を予測します";
  const R = 34;
  const C = 2 * Math.PI * R;

  const save = async (amount: number) => {
    await updateSettings((s) => ({ ...s, goal: { ...s.goal, monthly: { ...s.goal.monthly, [month]: amount } } }));
    setInput(null);
    const nextTotal = total - current + amount;
    toast(
      target && nextTotal >= target
        ? "目標達成です！おめでとうございます"
        : `${monthLabel(month)}の貯金を ${yen(amount)} にしました`,
    );
  };

  return (
    <div>
      <div className={cx("grid items-center gap-3.5", target > 0 && "grid-cols-[auto_1fr]")}>
        {target > 0 && (
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
        )}
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2 text-xs text-muted">
            これまでの貯金
            <TextButton onClick={() => setView("settings")}>{target ? "目標を変更" : "目標額を設定"}</TextButton>
          </div>
          <div className="num text-xl font-semibold">
            {yen(total)} {target > 0 && <span className="text-[13px] text-muted">/ 目標 {yen(target)}</span>}
          </div>
          {target > 0 && <div className="text-xs text-muted">{eta}</div>}
        </div>
      </div>
      <form
        className="mt-3 grid gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void save(parseAmount(value));
        }}
      >
        <label htmlFor="month-saving" className="text-[11px] tracking-wide text-muted">
          {monthLabel(month)}の貯金額（収支から差し引きます）
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="month-saving"
            value={value}
            onChange={(e) => setInput({ month, value: e.target.value })}
            inputMode="numeric"
            placeholder="0"
            className="num min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2"
          />
          <Button type="submit" variant="primary" disabled={parseAmount(value) === current}>
            {current ? "変更" : "保存"}
          </Button>
          {canMoveLeftover && (
            <Button onClick={() => save(current + leftover)} title="今月の変動費の予算の残りを貯金に足す">
              残り予算を回す
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function StreakLine() {
  const { transactions, settings, updateSettings, toast } = useKakeibo();
  const streak = recordStreak(transactions, settings.noSpendDays);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
      <div className="flex items-center gap-2.5 text-sm">
        <span className="font-bold">
          記録 <span className="num">{streak.count}</span> 日連続
        </span>
        <span className="flex gap-1" aria-label="直近7日の記録">
          {streak.last7.map((on, i) => (
            <i key={i} className={cx("size-2.5 rounded-[3px]", on ? "bg-accent" : "bg-line")} />
          ))}
        </span>
      </div>
      {streak.recordedToday ? (
        <Pill level="good">今日は記録済み</Pill>
      ) : (
        <Button
          className="px-3 py-1.5 text-xs"
          onClick={async () => {
            await updateSettings((s) => ({ ...s, noSpendDays: [...new Set([...s.noSpendDays, today()])].slice(-400) }));
            toast("支出なしの日として記録しました");
          }}
        >
          今日は支出なし
        </Button>
      )}
    </div>
  );
}
