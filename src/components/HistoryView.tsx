"use client";

import { useRef, useState } from "react";
import { getCategory } from "@/lib/categories";
import { dayLabel } from "@/lib/date";
import { periodOf } from "@/lib/period";
import { groupSplits } from "@/lib/split";
import { yen } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import { useKakeibo } from "./KakeiboProvider";
import { useT } from "./LanguageProvider";
import { RecentlyDeletedButton } from "./RecentlyDeleted";
import { Card, EmptyState, Icons, TxRow, cx } from "./ui";

/** "all", "income", "outside", or a category id. */
type Filter = string;

const matches = (t: Transaction, filter: Filter) =>
  filter === "all" ||
  (filter === "income" ? t.type === "income" : filter === "outside" ? !!t.outsideBudget : t.type !== "income" && t.category === filter);

export function HistoryView() {
  const { transactions, settings, month, openEntry, historyFilter, deleteRecords, toast } = useKakeibo();
  const t = useT();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>(historyFilter);
  // The row swiped open to show its delete button (one at a time).
  const [swiped, setSwiped] = useState<string | null>(null);
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
    (tx) => matches(tx, active) && (!q || tx.memo.toLowerCase().includes(q) || (tx.note ?? "").toLowerCase().includes(q) || getCategory(tx.category).name.toLowerCase().includes(q)),
  );
  const groups = new Map<string, Transaction[]>();
  for (const tx of list) groups.set(tx.date, [...(groups.get(tx.date) ?? []), tx]);
  const filtered = active !== "all" || !!q;
  const total = list.reduce((s, tx) => s + (tx.type === "income" ? tx.amount : -tx.amount), 0);

  return (
    <Card>
      <div className="flex gap-2">
        <input
          id="history-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.history.searchPlaceholder}
          className="w-full min-w-0 rounded-xl border border-line bg-bg px-3 py-2"
        />
        <RecentlyDeletedButton icon />
      </div>
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
              {groupSplits(items).map((e) => (
                <SwipeRow
                  key={e.tx.id}
                  open={swiped === e.tx.id}
                  onOpen={(open) => setSwiped(open ? e.tx.id : null)}
                  deleteLabel={t.history.deleteLabel(e.tx.memo || getCategory(e.tx.category).name)}
                  onDelete={async () => {
                    setSwiped(null);
                    try {
                      await deleteRecords(e.parts);
                    } catch {
                      toast(t.entry.deleteFailed);
                    }
                  }}
                >
                  <TxRow tx={e.tx} parts={e.parts} showDate={false} divider={false} onClick={() => openEntry(e.tx)} />
                </SwipeRow>
              ))}
            </div>
          );
        })
      )}
    </Card>
  );
}

/** Width of the delete button a swipe uncovers. */
const SWIPE_WIDTH = 80;

/** A row that slides left when swiped (or dragged with a mouse) to show a delete button behind it. */
function SwipeRow({
  open,
  onOpen,
  onDelete,
  deleteLabel,
  children,
}: {
  open: boolean;
  onOpen: (open: boolean) => void;
  onDelete: () => void;
  deleteLabel: string;
  children: React.ReactNode;
}) {
  const start = useRef<{ x: number; y: number; from: number } | null>(null);
  // null: not dragging sideways (yet); a number: the row's offset while it follows the finger
  const [drag, setDrag] = useState<number | null>(null);
  const dragged = useRef(false);
  const offset = drag ?? (open ? -SWIPE_WIDTH : 0);

  return (
    <div className="relative overflow-hidden border-t border-line first:border-t-0">
      <button
        type="button"
        aria-label={deleteLabel}
        // hidden until the row is swiped open (the record's own sheet can delete it too)
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        onClick={onDelete}
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-bad text-bg [&_svg]:size-6"
        style={{ width: SWIPE_WIDTH }}
      >
        {Icons.trash}
      </button>
      <div
        className={cx("relative touch-pan-y bg-surface select-none", drag === null && "transition-transform duration-200 motion-reduce:transition-none")}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={(e) => {
          start.current = { x: e.clientX, y: e.clientY, from: open ? -SWIPE_WIDTH : 0 };
          dragged.current = false;
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const dx = e.clientX - s.x;
          if (drag === null) {
            // a mostly vertical move is a scroll, not a swipe
            if (Math.abs(e.clientY - s.y) > Math.abs(dx)) {
              if (Math.abs(e.clientY - s.y) > 8) start.current = null;
              return;
            }
            if (Math.abs(dx) < 8) return;
            dragged.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          setDrag(Math.max(-SWIPE_WIDTH, Math.min(0, s.from + dx)));
        }}
        onPointerUp={() => {
          if (drag !== null) onOpen(drag < -SWIPE_WIDTH / 2);
          start.current = null;
          setDrag(null);
        }}
        onPointerCancel={() => {
          start.current = null;
          setDrag(null);
        }}
        onClickCapture={(e) => {
          // the click that ends a swipe, or a tap on a row swiped open, doesn't open the record
          if (dragged.current || open) {
            e.stopPropagation();
            e.preventDefault();
            if (!dragged.current) onOpen(false);
          }
          dragged.current = false;
        }}
      >
        {children}
      </div>
    </div>
  );
}
