"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FALLBACK_CATEGORY, categoriesOf, getCategory, withCurrent } from "@/lib/categories";
import { today } from "@/lib/date";
import { currentPeriod, periodOf, periodStart } from "@/lib/period";
import { currencySymbol, formatAmountInput, parseAmount, yen } from "@/lib/format";
import { NOTE_MAX, newSplitId, splitParts } from "@/lib/split";
import { shrinkPhoto } from "@/lib/photo";
import { receiptParts, type ReceiptReading } from "@/lib/receipt";
import { quickPicks } from "@/lib/stats";
import type { NewTransaction, Transaction, TxType } from "@/lib/types";
import { useKakeibo } from "./KakeiboProvider";
import { useLanguage, useT } from "./LanguageProvider";
import { EntryDetail } from "./EntryDetail";
import { ReceiptPhoto } from "./ReceiptPhoto";
import { Button, Stamp, cx } from "./ui";

export function EntrySheet() {
  const { entry, closeEntry, editEntry } = useKakeibo();
  if (!entry.open) return null;
  if (entry.editing && entry.viewing) return <EntryDetail key={entry.editing.id} id={entry.editing.id} onClose={closeEntry} onEdit={editEntry} />;
  // Re-mount per opening so the form starts from the right values.
  return <EntryForm key={entry.editing?.id ?? "new"} onClose={closeEntry} />;
}

function EntryForm({ onClose }: { onClose: () => void }) {
  const { entry, transactions, settings, month, setMonth, addTransactions, updateTransaction, deleteTransaction, deleteRecords, toast, receipts, canReadReceipts } = useKakeibo();
  // A split payment is edited as a whole: its first part is the one shown, the others are its extra parts.
  const [group] = useState(() => (entry.editing ? splitParts(transactions, entry.editing) : []));
  const editing = group[0] ?? null;
  const t = useT();
  const language = useLanguage();
  const [type, setType] = useState<TxType>(editing?.type ?? entry.type ?? "expense");
  const [category, setCategory] = useState(editing?.category ?? categoriesOf(type)[0].id);
  const [amount, setAmount] = useState(editing ? group.reduce((s, p) => s + p.amount, 0).toLocaleString("ja-JP") : "");
  const [parts, setParts] = useState<Part[]>(() =>
    group.slice(1).map((p) => ({ id: p.id, category: p.category, amount: p.amount.toLocaleString("ja-JP"), note: p.note ?? "" })),
  );
  // The note on the record in the category picked above (what was bought; split or not).
  const [mainNote, setMainNote] = useState(editing?.note ?? "");
  const startDay = settings.monthStartDay;
  const [date, setDate] = useState(editing?.date ?? (month === currentPeriod(startDay) ? today() : periodStart(month, startDay)));
  const [memo, setMemo] = useState(editing?.memo ?? "");
  const [outsideBudget, setOutsideBudget] = useState(editing?.outsideBudget ?? false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  // The receipt photo. A photo is saved as soon as it is picked; one picked here and never saved with
  // the record (the sheet was closed, or the photo was replaced) is deleted again.
  const savedReceipt = editing?.receiptId;
  const [receiptId, setReceiptId] = useState(savedReceipt);
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [reading, setReading] = useState(false);
  const [readDone, setReadDone] = useState(false);
  // Set once the payment is split by hand: a reading started by adding a photo leaves the split alone.
  const edited = useRef(group.length > 1);
  // What a reading finds when it comes back (the sheet may have changed while it ran).
  const latest = useRef({ amount, memo, receiptId });
  useEffect(() => {
    latest.current = { amount, memo, receiptId };
  });
  // "Sort it out later": save the record as one to check (only offered for an unsplit record with a photo).
  const [later, setLater] = useState(false);
  const unsaved = useRef(new Set<string>());
  const dropReceipt = useCallback((id: string) => void receipts?.remove(id).catch(() => {}), [receipts]);
  const dropUnsaved = useCallback(
    (keep?: string) => {
      for (const id of unsaved.current) if (id !== keep) dropReceipt(id);
      unsaved.current.clear();
    },
    [dropReceipt],
  );
  const cancel = useCallback(() => {
    dropUnsaved();
    onClose();
  }, [dropUnsaved, onClose]);

  useEffect(() => {
    if (!receiptId || !receipts || unsaved.current.has(receiptId)) return;
    let stale = false;
    receipts
      .photoUrl(receiptId)
      .then((url) => !stale && setPhotoSrc(url))
      .catch(() => !stale && toast(t.receipt.photoFailed));
    return () => {
      stale = true;
    };
  }, [receiptId, receipts, toast, t]);

  useEffect(() => {
    const timer = setTimeout(() => amountRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cancel();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [cancel]);

  async function pickPhoto(file: File) {
    if (!receipts) return;
    setUploading(true);
    try {
      const photo = await shrinkPhoto(file);
      const id = await receipts.upload(photo);
      if (receiptId && unsaved.current.delete(receiptId)) dropReceipt(receiptId);
      unsaved.current.add(id);
      setReceiptId(id);
      latest.current.receiptId = id;
      setPhotoSrc(URL.createObjectURL(photo));
      setReadDone(false);
      if (!editing) setLater(true);
      if (settings.autoReadReceipts && canReadReceipts) void readReceipt(id, true);
    } catch {
      toast(t.receipt.uploadFailed);
    } finally {
      setUploading(false);
    }
  }

  function removePhoto() {
    if (receiptId && unsaved.current.delete(receiptId)) dropReceipt(receiptId);
    setReceiptId(undefined);
    latest.current.receiptId = undefined;
    setPhotoSrc(null);
    setReadDone(false);
    setLater(false);
  }

  /** Reads the photo with Claude and fills the sheet. `auto`: started by adding the photo, so what was picked by hand stays. */
  async function readReceipt(id = receiptId, auto = false) {
    if (!id) return;
    setReading(true);
    try {
      const res = await fetch("/api/ai/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiptId: id,
          categories: categoriesOf("expense").map((c) => ({ id: c.id, name: c.name })),
          fallback: FALLBACK_CATEGORY.expense,
          language,
          again: !auto && readDone,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { result?: ReceiptReading; error?: string };
      // The photo was replaced or removed while it was being read.
      if (latest.current.receiptId !== id) return;
      if (!res.ok || !body.result || !receiptParts(body.result).length) throw new Error(body.error ?? t.receipt.readFailed);
      fill(body.result, auto);
      setLater(false);
      setReadDone(true);
    } catch (e) {
      toast(e instanceof Error ? e.message : t.receipt.readFailed);
    } finally {
      setReading(false);
    }
  }

  /**
   * Fills the sheet from a reading: the amount becomes the receipt's total, the memo the shop's name
   * when empty, and the parts one per category. `keepPicked`: leave the category and parts alone when
   * the payment was split by hand (the reading was started by adding the photo, not by the button).
   */
  function fill(reading: ReceiptReading, keepPicked: boolean) {
    const proposed = receiptParts(reading);
    const sum = proposed.reduce((s, p) => s + p.amount, 0);
    const entered = parseAmount(latest.current.amount);
    setAmount(sum.toLocaleString("ja-JP"));
    if (!(keepPicked && edited.current)) {
      // The largest part is the category picked above, the others are its extra parts
      // (reusing the records an edited split payment already has).
      setType("expense");
      setCategory(proposed[0].category);
      setMainNote(proposed[0].note);
      setParts((before) => proposed.slice(1).map((p, i) => ({ id: before[i]?.id, category: p.category, amount: p.amount.toLocaleString("ja-JP"), note: p.note })));
    }
    if (!latest.current.memo.trim() && reading.store) setMemo(reading.store.slice(0, 60));
    toast(entered && entered !== sum ? t.receipt.totalChanged(yen(entered), yen(sum)) : t.receipt.applied(proposed.length));
  }

  const picks = useMemo(() => quickPicks(transactions, type), [transactions, type]);
  const memoOptions = useMemo(
    () => [...new Set(transactions.filter((tx) => tx.memo && tx.category === category).map((tx) => tx.memo))].slice(0, 20),
    [transactions, category],
  );

  const switchType = (next: TxType) => {
    setType(next);
    setCategory(categoriesOf(next)[0].id);
    setParts([]);
  };

  const total = parseAmount(amount);
  const rest = total - parts.reduce((s, p) => s + parseAmount(p.amount), 0);
  const addPart = () => {
    edited.current = true;
    const used = new Set([category, ...parts.map((p) => p.category)]);
    const choices = categoriesOf(type);
    setParts([...parts, { category: (choices.find((c) => !used.has(c.id)) ?? choices[0]).id, amount: "", note: "" }]);
  };
  const changePart = (i: number, values: Partial<Part>) => {
    edited.current = true;
    setParts(parts.map((p, j) => (j === i ? { ...p, ...values } : p)));
  };

  async function save(keepOpen: boolean) {
    const value = parseAmount(amount);
    if (!value) {
      toast(t.entry.enterAmount);
      amountRef.current?.focus();
      return;
    }
    if (parts.some((p) => !parseAmount(p.amount))) return toast(t.entry.splitEnterAmounts);
    if (rest <= 0) return toast(t.entry.splitTooMuch);
    const splitId = parts.length ? (editing?.splitId ?? newSplitId()) : undefined;
    const base: NewTransaction = {
      date: date || today(),
      amount: rest,
      type,
      category,
      memo: memo.trim().slice(0, 60),
      outsideBudget: type === "expense" && outsideBudget,
      ...(splitId ? { splitId } : {}),
      isSample: editing?.isSample ?? false,
      ...(receiptId ? { receiptId } : {}),
      // saving an automatic record confirms it; a record with its receipt can be kept to sort out later
      ...(later && receiptId && !parts.length ? { needsReview: true } : group.some((p) => p.needsReview) ? { needsReview: false } : {}),
    };
    // Each record with the id it already has (none for a new one).
    const withNote = (item: NewTransaction, note: string): NewTransaction =>
      note.trim() ? { ...item, note: note.trim() } : item;
    const items: [string | undefined, NewTransaction][] = [
      [editing?.id, withNote(base, mainNote)],
      ...parts.map((p): [string | undefined, NewTransaction] => [p.id, withNote({ ...base, category: p.category, amount: parseAmount(p.amount) }, p.note)]),
    ];
    setBusy(true);
    try {
      if (editing) {
        const kept = new Set(items.map(([id]) => id));
        for (const [id, item] of items) if (id) await updateTransaction(id, item);
        // One at a time, so each part gets a later creation time and the parts keep their order.
        let offline = false;
        for (const [id, item] of items) if (!id) offline = (await addTransactions([item])).some((c) => c.pending) || offline;
        for (const p of group) if (!kept.has(p.id)) await deleteTransaction(p.id);
        receiptSaved();
        toast(offline ? t.entry.savedOffline : t.entry.updated);
        onClose();
      } else {
        let offline = false;
        for (const [, item] of items) offline = (await addTransactions([item])).some((c) => c.pending) || offline;
        receiptSaved();
        if (offline) toast(t.entry.savedOffline);
        else toast(parts.length ? t.entry.recordedSplit(items.length, yen(value)) : t.entry.recorded(getCategory(category).name, yen(value)));
        if (keepOpen) {
          setAmount("");
          setMemo("");
          setParts([]);
          setMainNote("");
          setReceiptId(undefined);
          setPhotoSrc(null);
          setReadDone(false);
          setLater(false);
          edited.current = false;
          amountRef.current?.focus();
        } else onClose();
      }
      if (!keepOpen && periodOf(base.date, startDay) !== month) setMonth(periodOf(base.date, startDay));
    } catch {
      toast(t.entry.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  /** After saving: the photo now on the record is kept; any other picked here, or the one it replaced, is deleted. */
  function receiptSaved() {
    dropUnsaved(receiptId);
    if (savedReceipt && savedReceipt !== receiptId) dropReceipt(savedReceipt);
  }

  async function remove() {
    if (!editing) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    try {
      // the saved photo goes with the records, and only once "Undo" is gone
      await deleteRecords(group);
      dropUnsaved();
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
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-scrim lg:items-center" onClick={(e) => e.target === e.currentTarget && cancel()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-title"
        className="max-h-[94%] w-full max-w-[560px] animate-sheet-up overflow-auto rounded-t-[20px] bg-surface px-4 pt-3.5 pb-[calc(16px+env(safe-area-inset-bottom,0px))] motion-reduce:animate-none lg:max-w-[520px] lg:rounded-[20px]"
      >
        <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-line lg:hidden" />
        <div className="mb-2.5 flex items-center justify-between">
          <b id="entry-title">{editing ? t.entry.editTitle : t.common.write}</b>
          <Button variant="ghost" onClick={cancel}>
            {t.common.close}
          </Button>
        </div>

        {editing?.needsReview && (
          <p className="mb-2.5 rounded-xl bg-accent-soft px-3 py-2 text-xs">{editing.source === "wallet" ? t.wallet.sheetNote : t.receipt.laterNote}</p>
        )}

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

        {parts.length ? (
          <SplitParts
            type={type}
            main={category}
            rest={rest}
            total={total}
            parts={parts}
            mainNote={mainNote}
            onMainNote={setMainNote}
            current={group.slice(1)}
            onChange={changePart}
            onRemove={(i) => {
              edited.current = true;
              setParts(parts.filter((_, j) => j !== i));
            }}
            onAdd={addPart}
          />
        ) : (
          <button type="button" onClick={addPart} className="mt-2 px-1 py-1.5 text-[13px] font-medium text-accent">
            {t.entry.split}
          </button>
        )}

        {receipts && type === "expense" && (
          <ReceiptPhoto
            src={photoSrc}
            hasPhoto={Boolean(receiptId)}
            uploading={uploading}
            reading={reading}
            read={readDone}
            onPick={pickPhoto}
            onRemove={removePhoto}
            onRead={canReadReceipts ? () => readReceipt() : null}
            later={parts.length ? null : later}
            onLater={setLater}
          />
        )}

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
        {/* a split payment has this note on its first part, in the split section */}
        {!parts.length && (
          <label className="block">
            <span className="mt-2.5 mb-1 block text-[11px] tracking-wide text-muted">{t.entry.note}</span>
            <input
              id="entry-note"
              value={mainNote}
              maxLength={NOTE_MAX}
              onChange={(e) => setMainNote(e.target.value)}
              onKeyDown={onEnter}
              autoComplete="off"
              placeholder={t.entry.notePlaceholder}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2"
            />
          </label>
        )}

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

type Part = { id?: string; category: string; amount: string; note: string };

/** The other parts of a split payment; the category picked above takes the rest of the total. */
function SplitParts(props: {
  type: TxType;
  main: string;
  rest: number;
  total: number;
  parts: Part[];
  mainNote: string;
  onMainNote: (note: string) => void;
  current: Transaction[];
  onChange: (i: number, values: Partial<Part>) => void;
  onRemove: (i: number) => void;
  onAdd: () => void;
}) {
  const t = useT();
  const field = "min-w-0 rounded-xl border border-line bg-bg px-2.5 py-2";
  const noteField = "mb-2.5 w-full min-w-0 rounded-xl border border-line bg-bg px-2.5 py-1.5 text-sm";
  return (
    <section className="mt-2.5 rounded-xl bg-surface-2 p-2.5" aria-label={t.entry.splitTitle}>
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-1 pb-2 text-sm">
        <Stamp category={props.main} size="sm" />
        <span className="truncate">{getCategory(props.main).name}</span>
        <span className={cx("num font-semibold", props.total > 0 && props.rest <= 0 && "text-bad")}>
          <span className="mr-1.5 text-[11px] font-normal text-muted">{t.entry.splitRest}</span>
          {yen(props.rest)}
        </span>
      </div>
      <input
        aria-label={t.entry.splitNote(1)}
        value={props.mainNote}
        maxLength={NOTE_MAX}
        onChange={(e) => props.onMainNote(e.target.value)}
        placeholder={t.entry.splitNotePlaceholder}
        className={noteField}
      />
      {props.parts.map((p, i) => (
        <div key={i}>
          <div className="grid grid-cols-[1fr_7.5rem_auto] items-center gap-1.5 pb-1.5">
            <select
              aria-label={t.entry.splitCategory(i + 2)}
              value={p.category}
              onChange={(e) => props.onChange(i, { category: e.target.value })}
              className={field}
            >
              {withCurrent(categoriesOf(props.type), props.current.find((c) => c.id === p.id)?.category).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              aria-label={t.entry.splitAmount(i + 2)}
              value={p.amount}
              onChange={(e) => props.onChange(i, { amount: formatAmountInput(e.target.value) })}
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              className={cx(field, "num text-right")}
            />
            <button
              type="button"
              aria-label={t.entry.splitRemove(i + 2)}
              onClick={() => props.onRemove(i)}
              className="hit grid size-9 place-items-center rounded-lg text-lg text-muted hover:bg-surface"
            >
              ×
            </button>
          </div>
          <input
            aria-label={t.entry.splitNote(i + 2)}
            value={p.note}
            maxLength={NOTE_MAX}
            onChange={(e) => props.onChange(i, { note: e.target.value })}
            placeholder={t.entry.splitNotePlaceholder}
            className={noteField}
          />
        </div>
      ))}
      <button type="button" onClick={props.onAdd} className="px-1 py-1 text-[13px] font-medium text-accent">
        {t.entry.splitAdd}
      </button>
      <p className="px-1 pt-1 text-[11px] text-muted">{t.entry.splitHint}</p>
    </section>
  );
}
