"use client";

import { useState } from "react";
import { getCategory } from "@/lib/categories";
import { dayLabel } from "@/lib/date";
import { periodOf } from "@/lib/period";
import { yen } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import { useKakeibo } from "./KakeiboProvider";
import { useT } from "./LanguageProvider";
import { Card, EmptyState, TxRow, cx } from "./ui";

/** "all", "income", "outside", or a category id. */
type Filter = string;

const matches = (t: Transaction, filter: Filter) =>
  filter === "all" ||
  (filter === "income" ? t.type === "income" : filter === "outside" ? !!t.outsideBudget : t.type !== "income" && t.category === filter);

export function HistoryView() {
  const { transactions, settings, month, openEntry } = useKakeibo();
  const t = useT();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const q = query.trim().toLowerCase();

  const inMonth = transactions.filter((t) => periodOf(t.date, settings.monthStartDay) === month);
  // Chips: the kinds and expense categories that actually appear this month, biggest spending first.
  const byCategory = new Map<string, number>();
  for (const tx of inMonth) if (tx.type !== "income") byCategory.set(tx.category, (byCategory.get(tx.category) ?? 0) + tx.amount);
  const chips: { id: Filter; label: string }[] = [
    { id: "all", label: t.history.all },
    ...(inMonth.some((tx) => tx.type === "income") ? [{ id: "income", label: t.history.income }] : []),
    ...(inMonth.some((tx) => tx.outsideBudget) ? [{ id: "outside", label: t.common.outsideBudget }] : []),
    ...[...byCategory].sort((a, b) => b[1] - a[1]).map(([id]) => ({ id, label: getCategory(id).name })),
  ];
  const active = chips.some((c) => c.id === filter) ? filter : "all";

  const list = inMonth.filter(
    (tx) => matches(tx, active) && (!q || tx.memo.toLowerCase().includes(q) || getCategory(tx.category).name.toLowerCase().includes(q)),
  );
  const groups = new Map<string, Transaction[]>();
  for (const tx of list) groups.set(tx.date, [...(groups.get(tx.date) ?? []), tx]);
  const filtered = active !== "all" || !!q;
  const total = list.reduce((s, tx) => s + (tx.type === "income" ? tx.amount : -tx.amount), 0);

  return (
    <Card>
      <input
        id="history-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.history.searchPlaceholder}
        className="w-full rounded-xl border border-line bg-bg px-3 py-2"
      />
      {chips.length > 1 && (
        <div className="no-scrollbar -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1" role="group" aria-label={t.history.filters}>
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
          {t.history.summary(list.length, t.common.sep, `${total >= 0 ? "+" : "−"}${yen(Math.abs(total))}`)}
        </p>
      )}
      {groups.size === 0 ? (
        <EmptyState title={filtered ? t.history.noMatchTitle : t.history.emptyTitle}>
          {filtered ? t.history.noMatchBody : t.history.emptyBody}
        </EmptyState>
      ) : (
        [...groups].map(([date, items]) => {
          const spent = items.filter((tx) => tx.type !== "income").reduce((s, tx) => s + tx.amount, 0);
          return (
            <div key={date}>
              <div className="flex justify-between px-1 pt-3 pb-1 text-xs font-bold text-muted">
                <span>{dayLabel(date)}</span>
                {spent > 0 && <span className="num">{t.history.daySpent(yen(spent))}</span>}
              </div>
              {items.map((tx) => (
                <TxRow key={tx.id} tx={tx} showDate={false} onClick={() => openEntry(tx)} />
              ))}
            </div>
          );
        })
      )}
    </Card>
  );
}
