"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { categoriesOf, getCategory, withCurrent } from "@/lib/categories";
import { today } from "@/lib/date";
import { currentPeriod, periodOf, periodStart } from "@/lib/period";
import { currencySymbol, formatAmountInput, parseAmount, yen } from "@/lib/format";
import { quickPicks } from "@/lib/stats";
import type { NewTransaction, TxType } from "@/lib/types";
import { useKakeibo } from "./KakeiboProvider";
import { useT } from "./LanguageProvider";
import { Button, Stamp, cx } from "./ui";

export function EntrySheet() {
  const { entry, closeEntry } = useKakeibo();
  if (!entry.open) return null;
  // Re-mount per opening so the form starts from the right values.
  return <EntryForm key={entry.editing?.id ?? "new"} onClose={closeEntry} />;
}

function EntryForm({ onClose }: { onClose: () => void }) {
  const { entry, transactions, settings, month, setMonth, addTransactions, updateTransaction, deleteTransaction, toast } = useKakeibo();
  const editing = entry.editing;
  const t = useT();
  const [type, setType] = useState<TxType>(editing?.type ?? entry.type ?? "expense");
  const [category, setCategory] = useState(editing?.category ?? categoriesOf(type)[0].id);
  const [amount, setAmount] = useState(editing ? editing.amount.toLocaleString("ja-JP") : "");
  const startDay = settings.monthStartDay;
  const [date, setDate] = useState(editing?.date ?? (month === currentPeriod(startDay) ? today() : periodStart(month, startDay)));
  const [memo, setMemo] = useState(editing?.memo ?? "");
  const [outsideBudget, setOutsideBudget] = useState(editing?.outsideBudget ?? false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => amountRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const picks = useMemo(() => quickPicks(transactions, type), [transactions, type]);
  const memoOptions = useMemo(
    () => [...new Set(transactions.filter((tx) => tx.memo && tx.category === category).map((tx) => tx.memo))].slice(0, 20),
    [transactions, category],
  );

  const switchType = (next: TxType) => {
    setType(next);
    setCategory(categoriesOf(next)[0].id);
  };

  async function save(keepOpen: boolean) {
    const value = parseAmount(amount);
    if (!value) {
      toast(t.entry.enterAmount);
      amountRef.current?.focus();
      return;
    }
    const item: NewTransaction = {
      date: date || today(),
      amount: value,
      type,
      category,
      memo: memo.trim().slice(0, 60),
      outsideBudget: type === "expense" && outsideBudget,
      isSample: editing?.isSample ?? false,
      // saving an automatic record confirms it
      ...(editing?.needsReview ? { needsReview: false } : {}),
    };
    setBusy(true);
    try {
      if (editing) {
        await updateTransaction(editing.id, item);
        toast(t.entry.updated);
        onClose();
      } else {
        await addTransactions([item]);
        toast(t.entry.recorded(getCategory(category).name, yen(value)));
        if (keepOpen) {
          setAmount("");
          setMemo("");
          amountRef.current?.focus();
        } else onClose();
      }
      if (!keepOpen && periodOf(item.date, startDay) !== month) setMonth(periodOf(item.date, startDay));
    } catch {
      toast(t.entry.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!editing) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    try {
      await deleteTransaction(editing.id);
      toast(t.entry.deleted);
      onClose();
    } catch {
      toast(t.entry.deleteFailed);
      setBusy(false);
    }
  }

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void save(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-scrim lg:items-center" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-title"
        className="max-h-[94%] w-full max-w-[560px] animate-sheet-up overflow-auto rounded-t-[20px] bg-surface px-4 pt-3.5 pb-[calc(16px+env(safe-area-inset-bottom,0px))] motion-reduce:animate-none lg:max-w-[520px] lg:rounded-[20px]"
      >
        <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-line lg:hidden" />
        <div className="mb-2.5 flex items-center justify-between">
          <b id="entry-title">{editing ? t.entry.editTitle : t.common.write}</b>
          <Button variant="ghost" onClick={onClose}>
            {t.common.close}
          </Button>
        </div>

        {editing?.needsReview && <p className="mb-2.5 rounded-xl bg-accent-soft px-3 py-2 text-xs">{t.wallet.sheetNote}</p>}

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
          {(["expense", "income"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => switchType(k)}
              className={cx("rounded-lg py-2 text-sm font-bold", type === k ? "bg-surface text-ink shadow-sm" : "text-muted")}
            >
              {t.entry[k]}
            </button>
          ))}
        </div>

        <label className="my-3.5 flex items-baseline gap-1.5 border-b-2 border-accent pb-1">
          {currencySymbol() === "¥" && <span className="num text-2xl text-muted">¥</span>}
          <input
            id="entry-amount"
            ref={amountRef}
            value={amount}
            onChange={(e) => setAmount(formatAmountInput(e.target.value))}
            onKeyDown={onEnter}
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            aria-label={t.entry.amount}
            className="num w-full min-w-0 bg-transparent text-[40px] font-bold outline-none"
          />
          {currencySymbol() === "Ft" && <span className="num text-2xl text-muted">Ft</span>}
        </label>

        <div className="grid grid-cols-3 gap-1.5 min-[400px]:grid-cols-4" role="group" aria-label={t.entry.categoryGroup}>
          {withCurrent(categoriesOf(type), editing?.type === type ? editing.category : undefined).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setCategory(c.id);
                if (!amount) amountRef.current?.focus();
              }}
              className={cx(
                "flex flex-col items-center gap-1 rounded-xl border px-0.5 pt-2 pb-1.5 text-[11px]",
                category === c.id ? "border-accent bg-accent-soft font-bold" : "border-line bg-bg",
              )}
            >
              <Stamp category={c.id} size="sm" />
              {c.name}
            </button>
          ))}
        </div>

        {type === "expense" && (
          <div className="mt-2.5 grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1" role="radiogroup" aria-label={t.entry.budgetGroup}>
            {(
              [
                [false, t.entry.inBudget, t.entry.inBudgetHint],
                [true, t.common.outsideBudget, t.entry.outsideBudgetHint],
              ] as const
            ).map(([value, label, hint]) => (
              <button
                key={String(value)}
                type="button"
                role="radio"
                aria-checked={outsideBudget === value}
                onClick={() => setOutsideBudget(value)}
                className={cx("rounded-lg py-1.5 text-sm font-bold", outsideBudget === value ? "bg-surface text-ink shadow-sm" : "text-muted")}
              >
                {label}
                <span className="block text-[10px] font-normal text-muted">{hint}</span>
              </button>
            ))}
          </div>
        )}

        {picks.length > 0 && (
          <div className="no-scrollbar mt-2.5 flex gap-1.5 overflow-x-auto pb-1" aria-label={t.entry.quickPicks}>
            {picks.map((p) => (
              <button
                key={`${p.category}|${p.memo}`}
                type="button"
                onClick={() => {
                  setCategory(p.category);
                  setMemo(p.memo);
                  setAmount(p.amount.toLocaleString("ja-JP"));
                  amountRef.current?.select();
                }}
                className="flex-none whitespace-nowrap rounded-full border border-dashed border-line px-3 py-1 text-xs hover:border-accent"
              >
                {p.memo} <span className="num">{yen(p.amount)}</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-1 grid grid-cols-[1fr_1.4fr] gap-2">
          <label className="block">
            <span className="mt-2.5 mb-1 block text-[11px] tracking-wide text-muted">{t.entry.date}</span>
            <input id="entry-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border border-line bg-bg px-3 py-2" />
          </label>
          <label className="block">
            <span className="mt-2.5 mb-1 block text-[11px] tracking-wide text-muted">{t.entry.memo}</span>
            <input
              id="entry-memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              onKeyDown={onEnter}
              list="memo-options"
              autoComplete="off"
              placeholder={t.entry.memoPlaceholder}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2"
            />
            <datalist id="memo-options">
              {memoOptions.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
        </div>

        <div className="mt-3.5 flex gap-2 [&>button]:flex-1 [&>button]:py-3">
          {editing ? (
            <>
              <Button variant="danger" onClick={remove} disabled={busy}>
                {confirmDelete ? t.entry.confirmDelete : t.entry.delete}
              </Button>
              <Button variant="primary" onClick={() => save(false)} disabled={busy}>
                {t.entry.update}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => save(true)} disabled={busy}>
                {t.entry.saveAndContinue}
              </Button>
              <Button variant="primary" onClick={() => save(false)} disabled={busy}>
                {t.entry.save}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
