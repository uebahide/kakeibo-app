"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, getCategory } from "@/lib/categories";
import { currentMonth, monthOf, today } from "@/lib/date";
import { formatAmountInput, parseAmount, yen } from "@/lib/format";
import { quickPicks } from "@/lib/stats";
import type { NewTransaction, TxType } from "@/lib/types";
import { useKakeibo } from "./KakeiboProvider";
import { Button, Stamp, cx } from "./ui";

export function EntrySheet() {
  const { entry, closeEntry } = useKakeibo();
  if (!entry.open) return null;
  // Re-mount per opening so the form starts from the right values.
  return <EntryForm key={entry.editing?.id ?? "new"} onClose={closeEntry} />;
}

function EntryForm({ onClose }: { onClose: () => void }) {
  const { entry, transactions, month, setMonth, addTransactions, updateTransaction, deleteTransaction, toast } = useKakeibo();
  const editing = entry.editing;
  const [type, setType] = useState<TxType>(editing?.type ?? "expense");
  const [category, setCategory] = useState(editing?.category ?? "food");
  const [amount, setAmount] = useState(editing ? editing.amount.toLocaleString("ja-JP") : "");
  const [date, setDate] = useState(editing?.date ?? (month === currentMonth() ? today() : `${month}-01`));
  const [memo, setMemo] = useState(editing?.memo ?? "");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => amountRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const picks = useMemo(() => quickPicks(transactions, type), [transactions, type]);
  const memoOptions = useMemo(
    () => [...new Set(transactions.filter((t) => t.memo && t.category === category).map((t) => t.memo))].slice(0, 20),
    [transactions, category],
  );

  const switchType = (t: TxType) => {
    setType(t);
    setCategory(CATEGORIES[t][0].id);
  };

  async function save(keepOpen: boolean) {
    const value = parseAmount(amount);
    if (!value) {
      toast("金額を入れてください");
      amountRef.current?.focus();
      return;
    }
    const item: NewTransaction = {
      date: date || today(),
      amount: value,
      type,
      category,
      memo: memo.trim().slice(0, 60),
      isSample: editing?.isSample ?? false,
    };
    setBusy(true);
    try {
      if (editing) {
        await updateTransaction(editing.id, item);
        toast("更新しました");
        onClose();
      } else {
        await addTransactions([item]);
        toast(`${getCategory(category).name} ${yen(value)} を記録しました`);
        if (keepOpen) {
          setAmount("");
          setMemo("");
          amountRef.current?.focus();
        } else onClose();
      }
      if (!keepOpen && monthOf(item.date) !== month) setMonth(monthOf(item.date));
    } catch {
      toast("保存できませんでした。もう一度お試しください");
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
      toast("削除しました");
      onClose();
    } catch {
      toast("削除できませんでした");
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
          <b id="entry-title">{editing ? "記録を編集" : "記入する"}</b>
          <Button variant="ghost" onClick={onClose}>
            閉じる
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => switchType(t)}
              className={cx("rounded-lg py-2 text-sm font-bold", type === t ? "bg-surface text-ink shadow-sm" : "text-muted")}
            >
              {t === "expense" ? "支出" : "収入"}
            </button>
          ))}
        </div>

        <label className="my-3.5 flex items-baseline gap-1.5 border-b-2 border-accent pb-1">
          <span className="num text-2xl text-muted">¥</span>
          <input
            id="entry-amount"
            ref={amountRef}
            value={amount}
            onChange={(e) => setAmount(formatAmountInput(e.target.value))}
            onKeyDown={onEnter}
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            aria-label="金額"
            className="num w-full min-w-0 bg-transparent text-[40px] font-bold outline-none"
          />
        </label>

        <div className="grid grid-cols-3 gap-1.5 min-[400px]:grid-cols-4">
          {CATEGORIES[type].map((c) => (
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

        {picks.length > 0 && (
          <div className="no-scrollbar mt-2.5 flex gap-1.5 overflow-x-auto pb-1" aria-label="よく使う記録">
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
            <span className="mt-2.5 mb-1 block text-[11px] tracking-wide text-muted">日付</span>
            <input id="entry-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border border-line bg-bg px-3 py-2" />
          </label>
          <label className="block">
            <span className="mt-2.5 mb-1 block text-[11px] tracking-wide text-muted">メモ</span>
            <input
              id="entry-memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              onKeyDown={onEnter}
              list="memo-options"
              autoComplete="off"
              placeholder="例：スーパー"
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
                {confirmDelete ? "本当に削除" : "削除"}
              </Button>
              <Button variant="primary" onClick={() => save(false)} disabled={busy}>
                更新する
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => save(true)} disabled={busy}>
                保存して続ける
              </Button>
              <Button variant="primary" onClick={() => save(false)} disabled={busy}>
                保存
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
