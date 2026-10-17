"use client";

import { useState } from "react";
import { getCategory } from "@/lib/categories";
import { dayLabel } from "@/lib/date";
import { yen } from "@/lib/format";
import { daysLeft, TRASH_DAYS, type TrashEntry } from "@/lib/trash";
import { useKakeibo } from "./KakeiboProvider";
import { useT } from "./LanguageProvider";
import { Button, EmptyState, Icons, Sheet, Stamp, cx } from "./ui";

/** Opens "Recently deleted": a labelled button (in settings), or with `icon` a trash icon with the count (next to the history's search). */
export function RecentlyDeletedButton({ icon = false }: { icon?: boolean }) {
  const { trash } = useKakeibo();
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      {icon ? (
        <button
          type="button"
          aria-label={t.history.recentlyDeletedCount(trash.length)}
          title={t.history.recentlyDeleted}
          onClick={() => setOpen(true)}
          className="relative flex min-h-11 flex-none items-center justify-center rounded-xl border border-line bg-bg px-3 text-muted hover:bg-surface-2 [&_svg]:size-5"
        >
          {Icons.trash}
          {trash.length > 0 && (
            <span className="num absolute -top-1.5 -right-1.5 min-w-5 rounded-full bg-accent px-1 text-center text-[11px] leading-5 font-bold text-accent-ink">{trash.length}</span>
          )}
        </button>
      ) : (
        <Button onClick={() => setOpen(true)}>{t.history.recentlyDeletedCount(trash.length)}</Button>
      )}
      {open && <RecentlyDeletedSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function RecentlyDeletedSheet({ onClose }: { onClose: () => void }) {
  const { trash } = useKakeibo();
  const t = useT();
  return (
    <Sheet title={t.history.recentlyDeleted} onClose={onClose}>
      {trash.length ? (
        <>
          <p className="mb-1 text-xs text-muted">{t.history.trashHint(TRASH_DAYS)}</p>
          {trash.map((e) => (
            <TrashRow key={e.id} entry={e} />
          ))}
        </>
      ) : (
        <EmptyState title={t.history.trashEmpty} />
      )}
    </Sheet>
  );
}

function TrashRow({ entry }: { entry: TrashEntry }) {
  const { restoreTrash, toast } = useKakeibo();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [first] = entry.records;
  if (!first) return null;
  const income = first.type === "income";
  const amount = entry.records.reduce((s, p) => s + p.amount, 0);
  const name = first.memo || getCategory(first.category).name;
  const categories = [...new Set(entry.records.map((p) => getCategory(p.category).name))].join("・");
  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2.5 border-t border-line px-1 py-2.5 first:border-t-0">
      <Stamp category={first.category} size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-sm">{name}</span>
        <span className="block truncate text-[11px] text-muted">
          {[categories, dayLabel(first.date), t.history.daysLeft(daysLeft(entry))].join(t.common.sep)}
        </span>
      </span>
      <span className={cx("num whitespace-nowrap text-base font-semibold", income && "text-good")}>
        {income ? "+" : "−"}
        {yen(amount)}
      </span>
      <Button
        className="px-3"
        disabled={busy}
        aria-label={t.history.restoreLabel(name)}
        onClick={async () => {
          setBusy(true);
          try {
            await restoreTrash(entry);
            toast(t.entry.restored);
          } catch {
            toast(t.entry.restoreFailed);
            setBusy(false);
          }
        }}
      >
        {t.history.restore}
      </Button>
    </div>
  );
}
