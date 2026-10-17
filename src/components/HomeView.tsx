"use client";

import { useState } from "react";
import { variableCategories } from "@/lib/categories";
import { groupSplits } from "@/lib/split";
import { TIME_ZONE_TAG, dayLabel, monthLabel, shortDayLabel, today } from "@/lib/date";
import { currentPeriod } from "@/lib/period";
import { fixedCostsFor } from "@/lib/fixed";
import { parseAmount, yen } from "@/lib/format";
import { averageMonthlySavings, monthSavings, totalSaved } from "@/lib/savings";
import { makeSampleFixedCosts, makeSampleTransactions } from "@/lib/samples";
import { elapsedFraction, monthStats, paceLevel, paceStep, paceSteps, recordStreak, todayBudget, variableBudget } from "@/lib/stats";
import { AiShortcut } from "./AiShortcut";
import { BudgetSuggestCard } from "./BudgetSuggest";
import { FixedCostsCard } from "./FixedCostsCard";
import { RevealSheet, SAVINGS_MASK, SavingsEye } from "./SavingsPrivacy";
import { GoalRing, goalEta } from "./SavingsSettings";
import { useKakeibo } from "./KakeiboProvider";
import { SwipeTxRow } from "./SwipeTxRow";
import { useT } from "./LanguageProvider";
import { WalletReviewCard } from "./WalletImport";
import { WeekCard } from "./WeekCard";
import { Button, Card, CardTitle, EmptyState, Icons, Meter, PACE_BADGE, Pill, Sheet, Stamp, TextButton, TxRow, cx } from "./ui";

export function useSeedSamples() {
  const { addTransactions, settings, updateSettings, toast } = useKakeibo();
  const t = useT();
  return async () => {
    toast(t.home.seeding);
    try {
      if (!Object.keys(settings.fixedCosts).length) {
        void updateSettings((s) => ({ ...s, fixedCosts: makeSampleFixedCosts() }));
      }
      const created = await addTransactions(makeSampleTransactions());
      toast(t.home.samplesAdded(created.length));
    } catch {
      toast(t.home.samplesFailed);
    }
  };
}

/** Badge colors along the pace scale: calm teal and green, through yellow and orange, to red. */
type Panel = "today" | "income" | "fixed" | "saving" | "extra";

export function HomeView() {
  const { transactions, settings, month, setView, openEntry, savingsHidden } = useKakeibo();
  // The recent record swiped open to show its delete button.
  const [swiped, setSwiped] = useState<string | null>(null);
  const seed = useSeedSamples();
  const t = useT();
  const h = t.home.hero;
  const [panel, setPanel] = useState<Panel | null>(null);
  // The breakdown shows the savings amount, so it stays shut while savings are hidden.
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [askReveal, setAskReveal] = useState(false);
  const stats = monthStats(transactions, month, settings);
  const budget = variableBudget(settings);
  const startDay = settings.monthStartDay;
  const fraction = elapsedFraction(month, startDay);
  const step = budget ? paceStep(stats.variable, budget, fraction) : -1;
  const isCurrent = month === currentPeriod(startDay);
  const left = budget - stats.variable;
  const todayData = todayBudget(transactions, month, settings);
  // Today's share leads the card while there is budget left to split; otherwise the month's figure does.
  const showToday = isCurrent && budget > 0 && left > 0;
  const saving = monthSavings(settings, month);
  const balance = stats.income - stats.expense - saving;
  // Money left over this month if variable spending ends exactly at the budget (or at what was spent, if over).
  const plannedVariable = Math.max(budget, stats.variable);
  const spare = stats.income - stats.fixed - saving - plannedVariable - stats.extra;
  const fixed = fixedCostsFor(settings.fixedCosts, month).items;
  const incomeList = stats.list.filter((t) => t.type === "income");
  const unused = variableCategories().filter((c) => settings.budgets[c.id] && !stats.variableByCategory[c.id]);
  const recent = groupSplits(transactions).slice(0, 5);
  const target = settings.goal.target;
  const saved = totalSaved(settings);

  function openTimeZone() {
    setView("settings");
    // Wait for the settings view to render, then bring the time zone switch into view.
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById("time-zone")?.scrollIntoView({ block: "start" })));
  }

  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-[1.15fr_1fr]">
      {transactions.length === 0 && (
        <Card className="lg:col-span-2">
          <EmptyState title={t.home.emptyTitle}>
            {t.home.emptyBody}
            <div className="mt-3 flex justify-center gap-2">
              <Button variant="primary" onClick={() => openEntry()}>
                {t.common.write}
              </Button>
              <Button onClick={seed}>{t.home.addSamples}</Button>
            </div>
          </EmptyState>
        </Card>
      )}

      <div className="grid gap-3.5">
        <WalletReviewCard />
        <BudgetSuggestCard />
        <section className="rounded-2xl bg-accent p-4 text-accent-ink shadow-[0_6px_20px_rgb(22_32_54/0.08)]">
          {showToday && (
            <div className="mb-3 border-b border-white/20 pb-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {todayData.left >= 0 ? (
                  <span className="text-xs tracking-wider opacity-85">{h.todayLeft}</span>
                ) : (
                  <span className={cx("rounded-full px-2.5 py-0.5 text-xs font-bold shadow-sm", PACE_BADGE[5])}>{h.todayOver}</span>
                )}
                <span className="num text-xs opacity-85">{shortDayLabel(today())}</span>
                <button
                  type="button"
                  onClick={openTimeZone}
                  aria-label={h.openTimeZone}
                  className="rounded-full bg-white/15 px-2 py-px text-[10px] font-bold tracking-wide hover:bg-white/25"
                >
                  {TIME_ZONE_TAG[settings.timeZone]}
                </button>
              </div>
              <div className="num mt-1 text-[34px] leading-tight font-bold min-[400px]:text-[40px]">
                {todayData.left >= 0 ? yen(todayData.left) : h.over(yen(-todayData.left))}
              </div>
              <div className="num flex flex-wrap items-center gap-x-1 text-[13px]">
                <button type="button" onClick={() => setPanel("today")} className="font-bold underline decoration-white/40 underline-offset-4">
                  {h.spentToday(yen(todayData.spent))} ›
                </button>
                <span className="opacity-85">{h.todayLimit(yen(todayData.limit))}</span>
              </div>
              <div className="my-2.5 h-2 rounded-full bg-white/25">
                <div
                  className="h-full rounded-full bg-accent-ink"
                  style={{ width: `${todayData.limit ? Math.min(100, (todayData.spent / todayData.limit) * 100) : 100}%` }}
                />
              </div>
              {todayData.left < 0 && <div className="num text-[13px]">{h.perDayFromTomorrow(yen(todayData.perDayFromTomorrow))}</div>}
              {todayData.extra > 0 && <div className="num text-xs opacity-85">{h.extraToday(yen(todayData.extra))}</div>}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs tracking-wider opacity-85">{h.monthLeft(monthLabel(month))}</span>
            <span
              className={cx("rounded-full px-2.5 py-0.5 text-xs font-bold shadow-sm", step < 0 ? "bg-white/20" : PACE_BADGE[step])}
            >
              {step < 0 ? h.noBudget : paceSteps()[step]}
            </span>
          </div>
          <div className={cx("num mt-1 leading-tight font-bold", showToday ? "text-2xl" : "text-[34px] min-[400px]:text-[40px]")}>
            {left >= 0 ? yen(left) : h.over(yen(-left))}
          </div>
          <div className="num text-[13px] opacity-85">
            {h.spentOfBudget(yen(stats.variable), yen(budget))}
          </div>
          <div className="relative my-3 h-2 rounded-full bg-white/25">
            <div className="h-full rounded-full bg-accent-ink" style={{ width: `${budget ? Math.min(100, (stats.variable / budget) * 100) : 0}%` }} />
            {isCurrent && <div title={h.paceMark} className="absolute -top-1 -bottom-1 w-0.5 bg-accent-ink/60" style={{ left: `${fraction * 100}%` }} />}
          </div>
          {isCurrent && !showToday && (
            <button type="button" onClick={() => setPanel("today")} className="num text-[13px] underline decoration-white/40 underline-offset-4">
              {h.spentToday(yen(todayData.spent + todayData.extra))} ›
            </button>
          )}

          <div className="mt-3 border-t border-white/20 pt-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-[13px] font-bold">{h.spare}</span>
              {stats.income ? (
                <span className="num text-2xl font-bold">
                  {savingsHidden ? SAVINGS_MASK : `${spare >= 0 ? "" : "−"}${yen(Math.abs(spare))}`}
                </span>
              ) : (
                <span className="text-xs opacity-85">{h.spareNeedsIncome}</span>
              )}
            </div>
            <details open={breakdownOpen && !savingsHidden} className="group mt-1 text-[13px]">
              <summary
                onClick={(e) => {
                  e.preventDefault();
                  if (savingsHidden) setAskReveal(true);
                  else setBreakdownOpen((o) => !o);
                }}
                className="cursor-pointer list-none text-xs opacity-85 [&::-webkit-details-marker]:hidden"
              >
                {h.breakdown}{" "}
                {savingsHidden ? (
                  <span className="inline-block align-[-2px] [&_svg]:size-3.5" aria-label={h.revealWithPassword}>
                    {Icons.eyeOff}
                  </span>
                ) : (
                  <span className="inline-block transition group-open:rotate-180">▾</span>
                )}
              </summary>
              <dl className="num mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
                <dt>{h.income}</dt>
                <dd className="text-right">{yen(stats.income)}</dd>
                <dt>{h.fixed}</dt>
                <dd className="text-right">−{yen(stats.fixed)}</dd>
                <dt>{h.savingThisMonth}</dt>
                <dd className="text-right">{savingsHidden ? SAVINGS_MASK : `−${yen(saving)}`}</dd>
                <dt>{stats.variable > budget ? h.variableOver : h.variableBudget}</dt>
                <dd className="text-right">−{yen(plannedVariable)}</dd>
                {stats.extra > 0 && (
                  <>
                    <dt>{h.extra}</dt>
                    <dd className="text-right">−{yen(stats.extra)}</dd>
                  </>
                )}
                <div className="col-span-2 my-1 border-t border-white/20" />
                <dt className="opacity-85">{h.balanceSoFar}</dt>
                <dd className="text-right opacity-85">
                  {balance >= 0 ? "+" : "−"}
                  {yen(Math.abs(balance))}
                </dd>
              </dl>
            </details>
            {askReveal && <RevealSheet onClose={() => setAskReveal(false)} onRevealed={() => setBreakdownOpen(true)} />}
          </div>
        </section>

        {isCurrent && budget > 0 && <WeekCard />}

        <StreakLine />

        <Card>
          <CardTitle action={<SavingsEye className="-my-1.5" />}>{t.home.money.title(monthLabel(month))}</CardTitle>
          <MoneyRow
            label={t.home.money.income}
            sub={incomeList.length ? t.home.money.incomeCount(incomeList.length) : t.home.money.incomeEmpty}
            amount={stats.income || null}
            tone="income"
            onClick={() => setPanel("income")}
          />
          <MoneyRow
            label={t.home.money.fixed}
            sub={fixed.length ? t.home.money.fixedPaid(fixed.filter((f) => f.paid).length, fixed.length) : t.home.money.fixedEmpty}
            amount={stats.fixed}
            onClick={() => setPanel("fixed")}
          />
          <MoneyRow
            label={t.home.money.saving}
            sub={
              savingsHidden
                ? t.home.money.savedSoFar(SAVINGS_MASK)
                : `${t.home.money.savedSoFar(yen(saved))}${target ? `${t.common.sep}${t.home.money.ofGoal(Math.min(100, Math.round((saved / target) * 100)))}` : ""}`
            }
            amount={savingsHidden ? SAVINGS_MASK : saving || null}
            tone="saving"
            onClick={() => setPanel("saving")}
          />
          {stats.extra > 0 && (
            <MoneyRow
              label={t.home.money.extra}
              sub={`${t.home.money.extraSub(stats.extraList.length)}${t.common.sep}${t.home.money.extraNote}`}
              amount={stats.extra}
              onClick={() => setPanel("extra")}
            />
          )}
        </Card>
      </div>

      <div className="grid gap-3.5">
        <Card>
          <CardTitle action={<TextButton onClick={() => setView("settings")}>{t.home.budgets.edit}</TextButton>}>{t.home.budgets.title}</CardTitle>
          {variableCategories().map((c) => {
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
              {t.home.budgets.unused}
              {unused.map((c) => `${c.name} ${yen(settings.budgets[c.id] ?? 0)}`).join(t.common.sep)}
            </p>
          )}
        </Card>

        <Card>
          <CardTitle action={<TextButton onClick={() => setView("history")}>{t.home.recent.seeAll}</TextButton>}>{t.home.recent.title}</CardTitle>
          {recent.length ? (
            recent.map((e) => <SwipeTxRow key={e.tx.id} entry={e} open={swiped === e.tx.id} onOpen={(open) => setSwiped(open ? e.tx.id : null)} />)
          ) : (
            <EmptyState title={t.home.recent.empty} />
          )}
        </Card>

        <AiShortcut className="lg:hidden" />
      </div>

      {panel === "today" && (
        <Sheet title={`${t.home.sheets.today}${t.common.sep}${dayLabel(today())}`} onClose={() => setPanel(null)}>
          {todayData.list.map((t) => (
            <TxRow
              key={t.id}
              tx={t}
              showDate={false}
              onClick={() => {
                setPanel(null);
                openEntry(t);
              }}
            />
          ))}
          {todayData.list.length > 0 ? (
            <p className="num mt-2 text-xs text-muted">
              {t.home.sheets.total(yen(todayData.spent + todayData.extra))}
              {todayData.extra > 0 && t.home.sheets.totalExtra(yen(todayData.extra))}
            </p>
          ) : (
            <p className="text-sm text-muted">{t.home.sheets.todayEmpty}</p>
          )}
          <Button
            variant="primary"
            className="mt-3 w-full"
            onClick={() => {
              setPanel(null);
              openEntry();
            }}
          >
            {t.common.write}
          </Button>
        </Sheet>
      )}
      {panel === "income" && (
        <Sheet title={t.home.sheets.income(monthLabel(month))} onClose={() => setPanel(null)}>
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
            <p className="num mt-2 text-xs text-muted">{t.home.sheets.total(yen(stats.income))}</p>
          ) : (
            <p className="text-sm text-muted">{t.home.sheets.incomeEmpty}</p>
          )}
          <Button
            variant="primary"
            className="mt-3 w-full"
            onClick={() => {
              setPanel(null);
              openEntry(undefined, "income");
            }}
          >
            {t.home.sheets.addIncome}
          </Button>
        </Sheet>
      )}
      {panel === "fixed" && (
        <Sheet title={t.home.sheets.fixed(monthLabel(month))} onClose={() => setPanel(null)}>
          <FixedCostsCard bare />
        </Sheet>
      )}
      {panel === "saving" && (
        <Sheet title={t.home.sheets.saving(monthLabel(month))} onClose={() => setPanel(null)}>
          <SavingsCard canMoveLeftover={isCurrent && left > 0 && balance > 0} leftover={Math.min(left, balance)} />
        </Sheet>
      )}
      {panel === "extra" && (
        <Sheet title={t.home.sheets.extra(monthLabel(month))} onClose={() => setPanel(null)}>
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
            {t.home.sheets.extraNote(yen(stats.extra))}
            {stats.income > 0 && t.home.sheets.spareLeft(savingsHidden ? SAVINGS_MASK : spare >= 0 ? yen(spare) : `−${yen(-spare)}`)}
          </p>
        </Sheet>
      )}
    </div>
  );
}

const MONEY_TONE = { income: "text-good", saving: "text-accent" } as const;

function MoneyRow({
  label,
  sub,
  amount,
  tone,
  onClick,
}: {
  label: string;
  sub: string;
  amount: number | string | null;
  tone?: keyof typeof MONEY_TONE;
  onClick: () => void;
}) {
  const t = useT();
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
      {amount === null ? <span className="text-sm text-muted">{t.home.money.notEntered}</span> : <span className={cx("num text-base font-semibold", tone && MONEY_TONE[tone])}>{typeof amount === "string" ? amount : `${tone === "income" ? "+" : ""}${yen(amount)}`}</span>}
      <span aria-hidden className="text-lg text-muted">
        ›
      </span>
    </button>
  );
}

function SavingsCard({ canMoveLeftover, leftover }: { canMoveLeftover: boolean; leftover: number }) {
  const { settings, month, updateSettings, setView, toast, savingsHidden: hidden } = useKakeibo();
  const t = useT();
  const m = t.home.savings;
  const current = monthSavings(settings, month);
  const [input, setInput] = useState<{ month: string; value: string } | null>(null);
  const value = input?.month === month ? input.value : current ? String(current) : "";
  const total = totalSaved(settings);
  const target = settings.goal.target;
  const progress = target ? Math.min(1, total / target) : 0;
  const remaining = Math.max(0, target - total);
  const perMonth = averageMonthlySavings(settings, month);
  const eta = goalEta(remaining, perMonth);

  const save = async (amount: number) => {
    await updateSettings((s) => ({ ...s, goal: { ...s.goal, monthly: { ...s.goal.monthly, [month]: amount } } }));
    setInput(null);
    const nextTotal = total - current + amount;
    toast(
      target && nextTotal >= target
        ? m.goalReached
        : m.saved(monthLabel(month), yen(amount)),
    );
  };

  return (
    <div>
      <div className={cx("grid items-center gap-3.5", target > 0 && !hidden && "grid-cols-[auto_1fr]")}>
        {target > 0 && !hidden && (
          <GoalRing progress={progress} />
        )}
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2 text-xs text-muted">
            <span className="flex items-center gap-1">
              {m.total}
              <SavingsEye className="size-7 [&_svg]:size-4" />
            </span>
            {!hidden && <TextButton onClick={() => setView("settings")}>{target ? m.changeGoal : m.setGoal}</TextButton>}
          </div>
          <div className="num text-xl font-semibold text-accent">
            {hidden ? SAVINGS_MASK : yen(total)}{" "}
            {target > 0 && !hidden && <span className="text-[13px] text-muted">{m.goal(yen(target))}</span>}
          </div>
          {target > 0 && !hidden && <div className="text-xs text-muted">{eta}</div>}
        </div>
      </div>
      {hidden ? (
        <p className="mt-3 text-xs text-muted">{m.secret}</p>
      ) : (
        <form
          className="mt-3 grid gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            void save(parseAmount(value));
          }}
        >
          <label htmlFor="month-saving" className="text-[11px] tracking-wide text-muted">
            {m.label(monthLabel(month))}
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
              {current ? m.change : m.save}
            </Button>
            {canMoveLeftover && (
              <Button onClick={() => save(current + leftover)} title={m.moveLeftoverTitle}>
                {m.moveLeftover}
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function StreakLine() {
  const { transactions, settings, updateSettings, toast } = useKakeibo();
  const streak = recordStreak(transactions, settings.noSpendDays);
  const t = useT();
  const [before, after] = t.home.streak.days(streak.count);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
      <div className="flex items-center gap-2.5 text-sm">
        <span className="font-bold">
          {before}
          <span className="num">{streak.count}</span>
          {after}
        </span>
        <span className="flex gap-1" aria-label={t.home.streak.last7}>
          {streak.last7.map((on, i) => (
            <i key={i} className={cx("size-2.5 rounded-[3px]", on ? "bg-accent" : "bg-line")} />
          ))}
        </span>
      </div>
      {streak.recordedToday ? (
        <Pill level="good">{t.home.streak.recordedToday}</Pill>
      ) : (
        <Button
          className="px-3 py-1.5 text-xs"
          onClick={async () => {
            await updateSettings((s) => ({ ...s, noSpendDays: [...new Set([...s.noSpendDays, today()])].slice(-400) }));
            toast(t.home.streak.noSpendSaved);
          }}
        >
          {t.home.streak.noSpend}
        </Button>
      )}
    </div>
  );
}
