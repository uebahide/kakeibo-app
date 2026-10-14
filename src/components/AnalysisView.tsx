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
import { CATEGORIES, categoryColor } from "@/lib/categories";
import { addMonths, monthLabel, shortMonthLabel, weekdays } from "@/lib/date";
import { periodDateLabel, periodDays } from "@/lib/period";
import { shortYen, yen } from "@/lib/format";
import { cumulativeDaily, monthStats, variableBudget, weekdayAverages } from "@/lib/stats";
import { AiShortcut } from "./AiShortcut";
import { useKakeibo } from "./KakeiboProvider";
import { useLanguage, useT } from "./LanguageProvider";
import { Card, CardTitle, EmptyState, cx } from "./ui";

const axisTick = { fill: "var(--muted)", fontSize: 11, fontFamily: "var(--font-num)" };
const tooltipStyle = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12 },
  labelStyle: { color: "var(--muted)" },
  itemStyle: { color: "var(--ink)" },
};

export function AnalysisView() {
  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-2">
      <AiShortcut className="lg:hidden" />
      <CategoryBreakdown />
      <BudgetPace />
      <MonthlyTrend />
      <WeekdayHabits />
    </div>
  );
}

function CategoryBreakdown() {
  const { transactions, settings, month } = useKakeibo();
  const t = useT();
  const stats = monthStats(transactions, month, settings);
  const items = CATEGORIES.expense
    .map((c) => ({ id: c.id, name: c.name, value: stats.byCategory[c.id] ?? 0 }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = items.reduce((s, x) => s + x.value, 0);

  return (
    <Card>
      <CardTitle>{t.analysis.byCategoryTitle(monthLabel(month))}</CardTitle>
      {!items.length ? (
        <EmptyState title={t.analysis.noExpenses} />
      ) : (
        <div className="grid items-center gap-4 sm:grid-cols-[180px_1fr]">
          <div className="relative mx-auto aspect-square w-full max-w-[200px]">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={items} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="100%" paddingAngle={items.length > 1 ? 1 : 0} stroke="none" isAnimationActive={false}>
                  {items.map((x) => (
                    <Cell key={x.id} fill={categoryColor(x.id)} />
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
          <ul className="grid min-w-0 gap-1.5 text-[13px]">
            {items.map((x) => (
              <li key={x.id} className="grid grid-cols-[12px_1fr_auto_40px] items-center gap-2">
                <i className="size-3 rounded-[3px]" style={{ background: categoryColor(x.id) }} />
                <span className="truncate">{x.name}</span>
                <span className="num">{yen(x.value)}</span>
                <span className="num text-right text-xs text-muted">{Math.round((x.value / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
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

function MonthlyTrend() {
  const { transactions, settings, month } = useKakeibo();
  const t = useT();
  const data = Array.from({ length: 6 }, (_, i) => {
    const m = addMonths(month, i - 5);
    const s = monthStats(transactions, m, settings);
    return { label: shortMonthLabel(m), income: s.income, expense: s.expense };
  });
  return (
    <Card>
      <CardTitle>{t.analysis.trendTitle}</CardTitle>
      <div className="h-52">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={shortYen} tick={axisTick} axisLine={false} tickLine={false} width={44} />
            <Tooltip formatter={(v, name) => [yen(Number(v)), name === "income" ? t.analysis.income : t.analysis.expense]} cursor={{ fill: "var(--surface-2)" }} {...tooltipStyle} />
            <Bar dataKey="income" fill="var(--good)" radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            <Bar dataKey="expense" fill="var(--accent)" radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Legend items={[["var(--good)", t.analysis.income], ["var(--accent)", t.analysis.expense]]} />
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
