"use client";

import { useState } from "react";
import { getCategory } from "@/lib/categories";
import { dayLabel, monthOf } from "@/lib/date";
import { yen } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import { useKakeibo } from "./KakeiboProvider";
import { Card, EmptyState, TxRow } from "./ui";

export function HistoryView() {
  const { transactions, month, openEntry } = useKakeibo();
  const [query, setQuery] = useState("");
  const q = query.trim();

  const list = transactions.filter(
    (t) => monthOf(t.date) === month && (!q || t.memo.includes(q) || getCategory(t.category).name.includes(q)),
  );
  const groups = new Map<string, Transaction[]>();
  for (const t of list) groups.set(t.date, [...(groups.get(t.date) ?? []), t]);

  return (
    <Card>
      <input
        id="history-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="メモやカテゴリで探す"
        className="mb-2 w-full rounded-xl border border-line bg-bg px-3 py-2"
      />
      {groups.size === 0 ? (
        <EmptyState title={q ? "見つかりませんでした" : "この月の記録はありません"}>
          {q ? "別の言葉で探してみてください" : "「記入」から追加できます"}
        </EmptyState>
      ) : (
        [...groups].map(([date, items]) => (
          <div key={date}>
            <div className="flex justify-between px-1 pt-3 pb-1 text-xs font-bold text-muted">
              <span>{dayLabel(date)}</span>
              <span className="num">支出 {yen(items.filter((t) => t.type !== "income").reduce((s, t) => s + t.amount, 0))}</span>
            </div>
            {items.map((t) => (
              <TxRow key={t.id} tx={t} onClick={() => openEntry(t)} />
            ))}
          </div>
        ))
      )}
    </Card>
  );
}
