"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useState } from "react";
import {
  RANGES,
  REST,
  categoryRows,
  categoryTrend,
  lastMonths,
  monthlyFlow,
  rangeMonths,
  rangeSummary,
  topPlaces,
  topWithRest,
  type CategoryRow,
  type Range,
} from "@/lib/analysis";
import { categoryColor, getCategory, isFixedCategory } from "@/lib/categories";
import { monthLabel, shiftDays, shortMonthLabel, today, weekdays } from "@/lib/date";
import { periodDateLabel, periodDays, periodEnd, periodOf } from "@/lib/period";
import { shortYen, yen } from "@/lib/format";
import { cumulativeDaily, variableBudget, weekBudget, weekdayAverages } from "@/lib/stats";
import { shortDate, weekRangeLabel, weekStartOf } from "@/lib/week";
import { AiShortcut } from "./AiShortcut";
import { useKakeibo } from "./KakeiboProvider";
import { useLanguage, useT } from "./LanguageProvider";
import { Card, CardTitle, EmptyState, Meter, Stamp, cx } from "./ui";

const axisTick = { fill: "var(--muted)", fontSize: 11, fontFamily: "var(--font-num)" };
const tooltipStyle = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12 },
  labelStyle: { color: "var(--muted)" },
  itemStyle: { color: "var(--ink)" },
};

export function AnalysisView() {
  const { month } = useKakeibo();
  const [range, setRange] = useState<Range>("month");
  if (!month) return null;
  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-2">
      <AiShortcut className="lg:hidden" />
      <Summary range={range} setRange={setRange} />
      <CategoryBreakdown range={range} />
      {range === "month" && <BudgetPace />}
      <WeeklyTrend />
      <CategoryTrend range={range} />
      <MonthlyFlow range={range} />
      <TopPlaces range={range} />
      <WeekdayHabits />
    </div>
  );
}

/** Number of months the trend charts show for a range. */
const trendLength = (range: Range) => (range === "year" ? 12 : 6);

/** "2026年10月", "2026年8月〜10月" or "2026年" for the range ending with `month`. */
function useRangeLabel(range: Range) {
  const { month, settings } = useKakeibo();
  const t = useT();
  const months = rangeMonths(month, range, settings.monthStartDay);
  if (range === "month") return monthLabel(month);
  if (range === "year") return t.analysis.yearLabel(month.slice(0, 4));
  return t.analysis.quarterLabel(monthLabel(months[0]), months[0].slice(0, 4) === month.slice(0, 4) ? shortMonthLabel(month) : monthLabel(month));
}

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${yen(Math.abs(n))}`;
const percent = (r: number) => `${Math.round(r * 100)}%`;

function Summary({ range, setRange }: { range: Range; setRange: (r: Range) => void }) {
  const { transactions, settings, month } = useKakeibo();
  const t = useT();
  const label = useRangeLabel(range);
  const s = rangeSummary(transactions, month, range, settings);
  const changeRatio = s.change !== null && s.previous.expense ? s.change / s.previous.expense : null;
  return (
    <Card className="lg:col-span-2">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-bold tracking-wide text-muted">{t.analysis.summaryTitle(label)}</h2>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1" role="radiogroup" aria-label={t.analysis.rangeLabel}>
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={range === r}
              onClick={() => setRange(r)}
              className={cx("min-h-9 rounded-lg px-3 text-[13px] font-bold", range === r ? "bg-surface text-ink shadow-sm" : "text-muted")}
            >
              {t.analysis.ranges[r]}
            </button>
          ))}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Tile label={t.analysis.spending} value={yen(s.current.expense)} note={`${t.analysis.income} ${yen(s.current.income)}`} />
        <Tile
          label={(s.partial ? t.analysis.vsPreviousSoFar : t.analysis.vsPrevious)[range]}
          value={s.change === null ? "—" : signed(s.change)}
          tone={s.change === null || s.change === 0 ? undefined : s.change > 0 ? "bad" : "good"}
          note={changeRatio === null ? t.analysis.noPrevious : `${changeRatio > 0 ? "+" : ""}${percent(changeRatio)}`}
        />
        <Tile
          label={s.budgetLeft !== null && s.budgetLeft < 0 ? t.analysis.budgetOver : t.analysis.budgetLeft}
          value={s.budgetLeft === null ? "—" : yen(Math.abs(s.budgetLeft))}
          tone={s.budgetLeft !== null && s.budgetLeft < 0 ? "bad" : undefined}
          note={s.budgetLeft === null ? t.analysis.noBudget : t.analysis.ofBudget(yen(s.current.budget))}
        />
        <Tile
          label={t.analysis.savingsRate}
          value={s.savingsRate === null ? "—" : percent(s.savingsRate)}
          tone={s.savingsRate !== null && s.savingsRate < 0 ? "bad" : undefined}
          note={s.savingsRate === null ? t.analysis.noIncome : t.analysis.savingsRateNote}
        />
      </dl>
    </Card>
  );
}

function Tile({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "good" | "bad" }) {
  return (
    <div className="min-w-0 rounded-xl bg-surface-2 px-3 py-2.5">
      <dt className="truncate text-xs text-muted">{label}</dt>
      <dd className={cx("num mt-0.5 truncate text-lg font-bold", tone === "good" && "text-good", tone === "bad" && "text-bad")}>{value}</dd>
      <dd className="num truncate text-[11px] text-muted">{note}</dd>
    </div>
  );
}

/** Color of a slice or bar: the category's own, or a plain one for "the rest". */
const sliceColor = (id: string) => (id === REST ? "var(--muted)" : categoryColor(id));

function CategoryBreakdown({ range }: { range: Range }) {
  const { transactions, settings, month, openHistory } = useKakeibo();
  const t = useT();
  const label = useRangeLabel(range);
  const s = rangeSummary(transactions, month, range, settings);
  const rows = categoryRows(s, settings);
  const [fixedOpen, setFixedOpen] = useState(false);
  // Budgeted categories with nothing spent go on one line at the end, and fixed costs (the same
  // every month) fold into one row, so the list stays short on a phone.
  const unused = rows.filter((row) => row.spent === 0);
  const used = rows.filter((row) => row.spent > 0);
  const fixed = used.filter((row) => isFixedCategory(row.id));
  const groupFixed = fixed.length > 1;
  type Line = { kind: "row"; row: CategoryRow; spent: number } | { kind: "fixed"; rows: CategoryRow[]; spent: number };
  const lines: Line[] = used
    .filter((row) => !groupFixed || !isFixedCategory(row.id))
    .map((row): Line => ({ kind: "row", row, spent: row.spent }));
  if (groupFixed) lines.push({ kind: "fixed", rows: fixed, spent: fixed.reduce((sum, row) => sum + row.spent, 0) });
  lines.sort((a, b) => b.spent - a.spent);
  const slices = topWithRest(s.current.byCategory).map((x) => ({ ...x, name: x.id === REST ? t.analysis.rest : getCategory(x.id).name }));
  const total = slices.reduce((sum, x) => sum + x.value, 0);
  // Categories with records in the month picked: their rows open the history filtered to them.
  const recorded = new Set(
    transactions.filter((tx) => tx.type !== "income" && periodOf(tx.date, settings.monthStartDay) === month).map((tx) => tx.category),
  );

  return (
    <Card className="lg:col-span-2">
      <CardTitle>{t.analysis.byCategoryTitle(label)}</CardTitle>
      {!rows.length ? (
        <EmptyState title={t.analysis.noExpenses} />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[220px_1fr]">
          {total > 0 && (
            <div>
              <div className="relative mx-auto aspect-square w-full max-w-[200px]">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={slices} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="100%" paddingAngle={slices.length > 1 ? 1 : 0} stroke="none" isAnimationActive={false}>
                      {slices.map((x) => (
                        <Cell key={x.id} fill={sliceColor(x.id)} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => yen(Number(v))} {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
                  <span className="text-[11px] text-muted">{t.analysis.totalSpent}</span>
                  <span className="num text-base font-bold">{yen(total)}</span>
                </div>
              </div>
              <ul className="mx-auto mt-3 grid max-w-[260px] gap-1 text-xs">
                {slices.map((x) => (
                  <li key={x.id} className="grid grid-cols-[10px_1fr_auto] items-center gap-2">
                    <i className="size-2.5 rounded-[3px]" style={{ background: sliceColor(x.id) }} />
                    <span className="truncate">{x.name}</span>
                    <span className="num text-muted">{percent(x.value / total)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="min-w-0">
            <h3 className="sr-only">{t.analysis.categoryTableTitle}</h3>
            <ul className="grid">
              {lines.map((line) =>
                line.kind === "fixed" ? (
                  <li key="fixed" className="border-t border-line first:border-t-0">
                    <FixedGroup rows={line.rows} open={fixedOpen} onToggle={() => setFixedOpen(!fixedOpen)} />
                    {fixedOpen && (
                      <ul className="ml-4 grid border-l border-line pl-2">
                        {line.rows.map((row) => (
                          <li key={row.id} className="border-t border-line first:border-t-0">
                            <CategoryLine row={row} grouped onOpen={recorded.has(row.id) ? () => openHistory(row.id) : undefined} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ) : (
                  <li key={line.row.id} className="border-t border-line first:border-t-0">
                    <CategoryLine row={line.row} onOpen={recorded.has(line.row.id) ? () => openHistory(line.row.id) : undefined} />
                  </li>
                ),
              )}
            </ul>
            {unused.length > 0 && (
              <p className="num border-t border-line px-1 pt-2 text-xs text-muted">
                {t.analysis.unused}
                {unused.map((row) => `${getCategory(row.id).name} ${yen(row.budget)}`).join(t.common.sep)}
              </p>
            )}
            <p className="mt-2 text-xs text-muted">{t.analysis.categoryTableNote}</p>
          </div>
        </div>
      )}
    </Card>
  );
}

/** The fixed-cost categories as one row; opens to show each of them. */
function FixedGroup({ rows, open, onToggle }: { rows: CategoryRow[]; open: boolean; onToggle: () => void }) {
  const t = useT();
  const spent = rows.reduce((sum, row) => sum + row.spent, 0);
  const diff = spent - rows.reduce((sum, row) => sum + row.previous, 0);
  return (
    <button type="button" aria-expanded={open} onClick={onToggle} className="grid min-h-11 w-full grid-cols-[auto_1fr] items-center gap-2.5 px-1 py-2 text-left hover:bg-surface-2">
      <span aria-hidden className="grid size-7 flex-none place-items-center rounded-full bg-surface-2 text-[13px] font-bold text-muted">
        {t.analysis.fixedCost.slice(0, 1)}
      </span>
      <span className="min-w-0">
        <span className="flex items-baseline justify-between gap-2 text-sm">
          <span className="truncate">
            {t.analysis.fixedGroup(rows.length)}
            <span className={cx("ml-1 inline-block text-xs text-muted transition-transform", open && "rotate-180")}>▾</span>
          </span>
          <span className="num flex-none font-bold">{yen(spent)}</span>
        </span>
        <span className="block truncate text-[11px] text-muted">{rows.map((row) => getCategory(row.id).name).join(t.common.sep)}</span>
        {diff !== 0 && <span className={cx("num block text-[11px]", diff > 0 ? "text-bad" : "text-good")}>{t.analysis.diffPrevious(signed(diff))}</span>}
      </span>
    </button>
  );
}

function CategoryLine({ row, onOpen, grouped = false }: { row: CategoryRow; onOpen?: () => void; grouped?: boolean }) {
  const t = useT();
  const diff = row.spent - row.previous;
  const ratio = row.budget ? row.budgeted / row.budget : 0;
  const content = (
    <>
      <Stamp category={row.id} size="sm" />
      <span className="min-w-0">
        <span className="flex items-baseline justify-between gap-2 text-sm">
          <span className="truncate">{getCategory(row.id).name}</span>
          <span className="num flex-none font-bold">
            {yen(row.spent)}
            {row.budget > 0 && <span className="ml-1 text-xs font-normal text-muted">{t.analysis.ofBudget(yen(row.budget))}</span>}
          </span>
        </span>
        {row.budget > 0 ? (
          <Meter ratio={ratio} level={ratio > 1 ? "bad" : ratio > 0.85 ? "warn" : "good"} className="my-1" />
        ) : (
          !grouped && isFixedCategory(row.id) && <span className="block text-[11px] text-muted">{t.analysis.fixedCost}</span>
        )}
        {diff !== 0 && <span className={cx("num block text-[11px]", diff > 0 ? "text-bad" : "text-good")}>{t.analysis.diffPrevious(signed(diff))}</span>}
      </span>
    </>
  );
  const className = "grid min-h-11 w-full grid-cols-[auto_1fr] items-center gap-2.5 px-1 py-2 text-left";
  return onOpen ? (
    <button type="button" onClick={onOpen} className={cx(className, "hover:bg-surface-2")}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}

function BudgetPace() {
  const { transactions, settings, month } = useKakeibo();
  const t = useT();
  const budget = variableBudget(settings);
  const startDay = settings.monthStartDay;
  const n = periodDays(month);
  const cumulative = cumulativeDaily(transactions, month, startDay);
  const dayName = (d: number) => (startDay === 1 ? t.analysis.dayTick(d) : periodDateLabel(month, startDay, d));
  const dayFull = (d: number) => (startDay === 1 ? t.analysis.dayFull(shortMonthLabel(month), d) : periodDateLabel(month, startDay, d));
  const data = Array.from({ length: n }, (_, i) => ({
    day: i + 1,
    actual: cumulative[i]?.total,
    pace: budget ? Math.round((budget * (i + 1)) / n) : undefined,
  }));

  return (
    <Card>
      <CardTitle>{t.analysis.paceTitle}</CardTitle>
      <div className="h-56">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="day" ticks={[1, 10, 20, n]} tickFormatter={dayName} tick={axisTick} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={shortYen} tick={axisTick} axisLine={false} tickLine={false} width={44} />
            <Tooltip formatter={(v, name) => [yen(Number(v)), name === "actual" ? t.analysis.cumulative : t.analysis.onBudget]} labelFormatter={(d) => dayFull(Number(d))} {...tooltipStyle} />
            <Area dataKey="actual" stroke="var(--accent)" strokeWidth={2.5} fill="var(--accent)" fillOpacity={0.12} isAnimationActive={false} dot={false} />
            {budget > 0 && <Line dataKey="pace" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="5 5" dot={false} isAnimationActive={false} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <Legend items={[["var(--accent)", t.analysis.cumulative], ...(budget ? ([["var(--muted)", t.analysis.onBudgetPace]] as const) : [])]} />
    </Card>
  );
}

/** The 8 weeks up to today, or up to the end of the month being looked at. */
function WeeklyTrend() {
  const { transactions, settings, month } = useKakeibo();
  const t = useT();
  const budget = variableBudget(settings);
  const end = periodEnd(month, settings.monthStartDay);
  const last = weekStartOf(end < today() ? end : today(), settings.weekStartDay);
  const data = Array.from({ length: 8 }, (_, i) => {
    const w = weekBudget(transactions, settings, shiftDays(last, (i - 7) * 7));
    return { start: w.start, label: t.analysis.weekTick(shortDate(w.start)), spent: w.spent, allowance: Math.round(w.allowance), over: w.spent > w.allowance };
  });
  const byLabel = new Map(data.map((d) => [d.label, d]));

  return (
    <Card>
      <CardTitle>{t.analysis.weeklyTitle}</CardTitle>
      <div className="h-52">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval={0} />
            <YAxis tickFormatter={shortYen} tick={axisTick} axisLine={false} tickLine={false} width={44} />
            <Tooltip
              formatter={(v, name) => [yen(Number(v)), name === "spent" ? t.analysis.weeklySpent : t.analysis.weeklyAllowance]}
              labelFormatter={(label) => weekRangeLabel(byLabel.get(String(label))?.start ?? "")}
              cursor={{ fill: "var(--surface-2)" }}
              {...tooltipStyle}
            />
            <Bar dataKey="spent" radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.start} fill={d.over ? "var(--warn)" : "var(--accent)"} />
              ))}
            </Bar>
            {budget > 0 && <Line dataKey="allowance" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="5 5" dot={false} isAnimationActive={false} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <Legend
        items={[
          ["var(--accent)", t.analysis.weeklySpent],
          ["var(--warn)", t.analysis.weeklyOver],
          ...(budget ? ([["var(--muted)", t.analysis.weeklyAllowance]] as const) : []),
        ]}
      />
    </Card>
  );
}

function CategoryTrend({ range }: { range: Range }) {
  const { transactions, settings, month } = useKakeibo();
  const t = useT();
  const n = trendLength(range);
  const trend = categoryTrend(transactions, lastMonths(month, n), settings);
  const data = trend.rows.map((r) => ({ ...r, label: shortMonthLabel(r.month) }));
  const name = (id: string) => (id === REST ? t.analysis.rest : getCategory(id).name);
  return (
    <Card>
      <CardTitle>{t.analysis.categoryTrendTitle(n)}</CardTitle>
      {!trend.ids.length ? (
        <EmptyState title={t.analysis.noExpenses} />
      ) : (
        <>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={shortYen} tick={axisTick} axisLine={false} tickLine={false} width={44} />
                <Tooltip formatter={(v, id) => [yen(Number(v)), name(String(id))]} cursor={{ fill: "var(--surface-2)" }} {...tooltipStyle} />
                {trend.ids.map((id, i) => (
                  <Bar key={id} dataKey={id} stackId="all" fill={sliceColor(id)} maxBarSize={28} isAnimationActive={false} radius={i === trend.ids.length - 1 ? [3, 3, 0, 0] : 0} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Legend items={trend.ids.map((id) => [sliceColor(id), name(id)] as const)} />
        </>
      )}
    </Card>
  );
}

function MonthlyFlow({ range }: { range: Range }) {
  const { transactions, settings, month } = useKakeibo();
  const t = useT();
  const n = trendLength(range);
  const data = monthlyFlow(transactions, lastMonths(month, n), settings).map((f) => ({
    ...f,
    label: shortMonthLabel(f.month),
    rate: f.savingsRate === null ? undefined : Math.round(f.savingsRate * 100),
  }));
  return (
    <Card>
      <CardTitle>{t.analysis.flowTitle(n)}</CardTitle>
      <div className="h-56">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
            <YAxis yAxisId="money" tickFormatter={shortYen} tick={axisTick} axisLine={false} tickLine={false} width={44} />
            <YAxis yAxisId="rate" orientation="right" tickFormatter={(v) => `${v}%`} tick={axisTick} axisLine={false} tickLine={false} width={40} />
            <Tooltip
              formatter={(v, name) =>
                name === "rate" ? [`${v}%`, t.analysis.savingsRate] : [yen(Number(v)), name === "income" ? t.analysis.income : t.analysis.expense]
              }
              cursor={{ fill: "var(--surface-2)" }}
              {...tooltipStyle}
            />
            <Bar yAxisId="money" dataKey="income" fill="var(--good)" radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            <Bar yAxisId="money" dataKey="expense" fill="var(--accent)" radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            <Line yAxisId="rate" dataKey="rate" stroke="var(--warn)" strokeWidth={2} dot={{ r: 3, fill: "var(--warn)", strokeWidth: 0 }} connectNulls isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <Legend
        items={[
          ["var(--good)", t.analysis.income],
          ["var(--accent)", t.analysis.expense],
          ["var(--warn)", t.analysis.savingsRate],
        ]}
      />
    </Card>
  );
}

function TopPlaces({ range }: { range: Range }) {
  const { transactions, settings, month } = useKakeibo();
  const t = useT();
  const places = topPlaces(transactions, rangeMonths(month, range, settings.monthStartDay), settings);
  const max = places[0]?.total ?? 0;
  return (
    <Card>
      <CardTitle>{t.analysis.placesTitle}</CardTitle>
      {!places.length ? (
        <EmptyState title={t.analysis.placesEmpty} />
      ) : (
        <ol className="grid gap-2">
          {places.map((p, i) => (
            <li key={p.name} className="grid grid-cols-[16px_auto_1fr_auto] items-center gap-2 text-[13px]">
              <span className="num text-right text-xs text-muted">{i + 1}</span>
              <Stamp category={p.category} size="sm" />
              <span className="min-w-0">
                <span className="block truncate">{p.name}</span>
                <span className="mt-0.5 block h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${(p.total / max) * 100}%` }} />
                </span>
              </span>
              <span className="num text-right">
                {yen(p.total)}
                <span className="block text-[11px] text-muted">{t.analysis.placeCount(p.count)}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function WeekdayHabits() {
  const { transactions } = useKakeibo();
  const t = useT();
  const english = useLanguage() === "en";
  const avg = weekdayAverages(transactions);
  const max = Math.max(...avg);
  return (
    <Card>
      <CardTitle>{t.analysis.weekdayTitle}</CardTitle>
      {!max ? (
        <EmptyState title={t.analysis.weekdayEmpty} />
      ) : (
        <>
          <div className="grid gap-1.5">
            {[1, 2, 3, 4, 5, 6, 0].map((i) => (
              <div key={i} className={cx("grid items-center gap-2 text-[13px]", english ? "grid-cols-[32px_1fr_72px]" : "grid-cols-[20px_1fr_72px]")}>
                <span>{weekdays()[i]}</span>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                  <div className={cx("h-full rounded-full", avg[i] === max ? "bg-warn" : "bg-accent")} style={{ width: `${(avg[i] / max) * 100}%` }} />
                </div>
                <span className="num text-right">{yen(avg[i])}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">{t.analysis.weekdayNote}</p>
        </>
      )}
    </Card>
  );
}

function Legend({ items }: { items: readonly (readonly [string, string])[] }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-3.5 text-xs text-muted">
      {items.map(([color, label]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <i className="inline-block h-[3px] w-3.5 rounded-sm" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}
