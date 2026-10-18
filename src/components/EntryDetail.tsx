"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getCategory } from "@/lib/categories";
import { dayLabel, today } from "@/lib/date";
import { yen } from "@/lib/format";
import { splitParts } from "@/lib/split";
import { useKakeibo } from "./KakeiboProvider";
import { useLanguage, useT } from "./LanguageProvider";
import { PhotoViewer } from "./ReceiptPhoto";
import { Button, Sheet, Stamp, cx } from "./ui";

/**
 * What a record (or a split payment) holds, shown before it is edited: tapping a record opens this,
 * and "Edit" opens the entry form.
 */
export function EntryDetail({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: () => void }) {
  const { transactions, deleteRecords, toast, receipts } = useKakeibo();
  const t = useT();
  const language = useLanguage();
  // The record as it is now (it may change or go away while this is open).
  const tx = transactions.find((x) => x.id === id);
  const parts = tx ? splitParts(transactions, tx) : [];
  const main = parts[0];
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const [large, setLarge] = useState(false);
  const receiptId = main?.receiptId;

  useEffect(() => {
    if (!main) onClose();
  }, [main, onClose]);

  useEffect(() => {
    if (!receiptId || !receipts) return;
    let stale = false;
    receipts
      .photoUrl(receiptId)
      .then((url) => !stale && setPhotoSrc(url))
      .catch(() => !stale && toast(t.receipt.photoFailed));
    return () => {
      stale = true;
    };
  }, [receiptId, receipts, toast, t]);

  if (!main) return null;
  const income = main.type === "income";
  const split = parts.length > 1;
  const total = parts.reduce((s, p) => s + p.amount, 0);
  const cat = getCategory(main.category);
  const categories = [...new Set(parts.map((p) => getCategory(p.category).name))].join(t.common.sep);
  const year = main.date.slice(0, 4);
  const date = year === today().slice(0, 4) ? dayLabel(main.date) : language === "en" ? `${dayLabel(main.date)}, ${year}` : `${year}年${dayLabel(main.date)}`;

  async function remove() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    try {
      await deleteRecords(parts);
      onClose();
    } catch {
      toast(t.entry.deleteFailed);
      setBusy(false);
    }
  }

  return (
    <Sheet title={t.entry.detailTitle} onClose={onClose}>
      <div className="flex items-center gap-3 pt-2 pb-3">
        <Stamp category={main.category} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold">{main.memo || cat.name}</p>
          <p className="truncate text-xs text-muted">{income ? `${t.entry.income}${t.common.sep}${cat.name}` : categories}</p>
        </div>
      </div>
      <p className={cx("num border-b-2 border-accent pb-1 text-[40px] leading-tight font-bold", income && "text-good")}>
        {income ? "+" : "−"}
        {yen(total)}
      </p>

      {(main.outsideBudget || main.isSample || main.source === "wallet" || parts.some((p) => p.needsReview)) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] font-bold">
          {parts.some((p) => p.needsReview) && <span className="rounded bg-accent-soft px-1.5 py-0.5 text-accent">{t.common.needsReview}</span>}
          {main.outsideBudget && <span className="rounded bg-warn-soft px-1.5 py-0.5 text-warn">{t.common.outsideBudget}</span>}
          {main.source === "wallet" && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-muted">{t.entry.fromWallet}</span>}
          {main.isSample && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-muted">{t.common.sample}</span>}
        </div>
      )}
      {parts.some((p) => p.needsReview) && <p className="mt-2.5 rounded-xl bg-accent-soft px-3 py-2 text-xs">{t.entry.reviewNote}</p>}

      <dl className="mt-3 rounded-xl bg-surface-2 px-3 text-sm">
        <Row label={t.entry.date}>{date}</Row>
        <Row label={t.entry.categoryGroup}>{split ? categories : cat.name}</Row>
        {!split && main.note && <Row label={t.entry.note}>{main.note}</Row>}
        {!income && <Row label={t.entry.budget}>{main.outsideBudget ? t.common.outsideBudget : t.entry.inBudget}</Row>}
      </dl>

      {split && (
        <section className="mt-2.5 rounded-xl bg-surface-2 px-3 py-1" aria-label={t.entry.splitTitle}>
          <p className="pt-1.5 text-[11px] tracking-wide text-muted">{t.entry.splitTitle}</p>
          {parts.map((p) => (
            <div key={p.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 border-t border-line py-2 text-sm first-of-type:border-t-0">
              <Stamp category={p.category} size="sm" />
              <span className="min-w-0">
                <span className="block truncate">{getCategory(p.category).name}</span>
                {p.note && <span className="block truncate text-[11px] text-muted">{p.note}</span>}
              </span>
              <span className="num font-semibold">{yen(p.amount)}</span>
            </div>
          ))}
        </section>
      )}

      {receiptId && (
        <button
          type="button"
          onClick={() => photoSrc && setLarge(true)}
          aria-label={t.receipt.open}
          className="mt-2.5 block h-40 w-full overflow-hidden rounded-xl border border-line bg-bg"
        >
          {photoSrc && (
            // A signed or local address: next/image can't optimize it.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoSrc} alt={t.receipt.photoAlt} className="size-full object-cover" />
          )}
        </button>
      )}
      {large && photoSrc && <PhotoViewer src={photoSrc} onClose={() => setLarge(false)} />}

      <div className="mt-3.5 flex gap-2 [&>button]:flex-1 [&>button]:py-3">
        <Button variant="danger" onClick={remove} disabled={busy}>
          {confirmDelete ? t.entry.confirmDelete : t.entry.delete}
        </Button>
        <Button variant="primary" onClick={onEdit} disabled={busy} autoFocus>
          {t.entry.edit}
        </Button>
      </div>
    </Sheet>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-2 border-t border-line py-2.5 first:border-t-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}
