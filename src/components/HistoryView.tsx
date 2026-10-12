"use client";

import { useState } from "react";
import { getCategory } from "@/lib/categories";
import { dayLabel } from "@/lib/date";
import { periodOf } from "@/lib/period";
import { yen } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import { useKakeibo } from "./KakeiboProvider";
import { Card, EmptyState, TxRow, cx } from "./ui";

/** "all", "income", "outside", or a category id. */
type Filter = string;

const matches = (t: Transaction, filter: Filter) =>
  filter === "all" ||
  (filter === "income" ? t.type === "income" : filter === "outside" ? !!t.outsideBudget : t.type !== "income" && t.category === filter);

export function HistoryView() {
  const { transactions, settings, month, openEntry } = useKakeibo();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const q = query.trim();

  const inMonth = transactions.filter((t) => periodOf(t.date, settings.monthStartDay) === month);
  // Chips: the kinds and expense categories that actually appear this month, biggest spending first.
  const byCategory = new Map<string, number>();
  for (const t of inMonth) if (t.type !== "income") byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount);
  const chips: { id: Filter; label: string }[] = [
    { id: "all", label: "すべて" },
    ...(inMonth.some((t) => t.type === "income") ? [{ id: "income", label: "収入" }] : []),
    ...(inMonth.some((t) => t.outsideBudget) ? [{ id: "outside", label: "予算外" }] : []),
    ...[...byCategory].sort((a, b) => b[1] - a[1]).map(([id]) => ({ id, label: getCategory(id).name })),
  ];
  const active = chips.some((c) => c.id === filter) ? filter : "all";

  const list = inMonth.filter(
    (t) => matches(t, active) && (!q || t.memo.includes(q) || getCategory(t.category).name.includes(q)),
  );
  const groups = new Map<string, Transaction[]>();
  for (const t of list) groups.set(t.date, [...(groups.get(t.date) ?? []), t]);
  const filtered = active !== "all" || !!q;
  const total = list.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);

  return (
    <Card>
      <input
        id="history-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="メモやカテゴリで探す"
        className="w-full rounded-xl border border-line bg-bg px-3 py-2"
      />
      {chips.length > 1 && (
        <div className="no-scrollbar -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1" role="group" aria-label="絞り込み">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={active === c.id}
              onClick={() => setFilter(c.id)}
              className={cx(
                "flex-none whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold",
                active === c.id ? "border-accent bg-accent text-accent-ink" : "border-line text-muted hover:bg-surface-2",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      {filtered && list.length > 0 && (
        <p className="num mt-2 px-1 text-xs text-muted">
          {list.length}件・合計 {total >= 0 ? "+" : "−"}
          {yen(Math.abs(total))}
        </p>
      )}
      {groups.size === 0 ? (
        <EmptyState title={filtered ? "見つかりませんでした" : "この月の記録はありません"}>
          {filtered ? "別の言葉や絞り込みで探してみてください" : "「記入」から追加できます"}
        </EmptyState>
      ) : (
        [...groups].map(([date, items]) => {
          const spent = items.filter((t) => t.type !== "income").reduce((s, t) => s + t.amount, 0);
          return (
            <div key={date}>
              <div className="flex justify-between px-1 pt-3 pb-1 text-xs font-bold text-muted">
                <span>{dayLabel(date)}</span>
                {spent > 0 && <span className="num">支出 {yen(spent)}</span>}
              </div>
              {items.map((t) => (
                <TxRow key={t.id} tx={t} showDate={false} onClick={() => openEntry(t)} />
              ))}
            </div>
          );
        })
      )}
    </Card>
  );
}
