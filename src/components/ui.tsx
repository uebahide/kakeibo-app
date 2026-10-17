"use client";

import { useEffect, useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import { categoryColor, getCategory } from "@/lib/categories";
import { dayLabel } from "@/lib/date";
import { yen } from "@/lib/format";
import type { PaceLevel } from "@/lib/stats";
import type { Transaction } from "@/lib/types";
import { useT } from "./LanguageProvider";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/** Pace badge colors, from plenty of room (0) to over budget (5); see paceStep. */
export const PACE_BADGE = [
  "bg-linear-to-r from-teal-500 to-emerald-600 text-white",
  "bg-linear-to-r from-green-500 to-green-700 text-white",
  "bg-linear-to-r from-yellow-300 to-amber-400 text-amber-950",
  "bg-linear-to-r from-amber-400 to-orange-500 text-orange-950",
  "bg-linear-to-r from-orange-500 to-red-500 text-white",
  "bg-linear-to-r from-red-600 to-rose-700 text-white",
];

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx("min-w-0 rounded-2xl border border-line bg-surface p-4", className)}>{children}</section>;
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <h2 className="mb-2.5 flex items-center justify-between gap-2 text-[13px] font-bold tracking-wide text-muted">
      <span>{children}</span>
      {action}
    </h2>
  );
}

export function TextButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={cx("hit text-[13px] font-medium text-accent", props.className)} />;
}

type Variant = "primary" | "default" | "ghost" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "border-accent bg-accent text-accent-ink hover:brightness-110",
  default: "border-line bg-surface hover:bg-surface-2",
  ghost: "border-transparent bg-transparent text-accent hover:bg-surface-2",
  danger: "border-line bg-surface text-bad hover:bg-bad-soft",
};

/** Button look, also for links that should look like a button. */
export const buttonClass = (variant: Variant = "default") =>
  cx(
    "inline-block whitespace-nowrap rounded-xl border px-3.5 py-2.5 text-sm font-bold transition disabled:cursor-default disabled:opacity-50",
    VARIANTS[variant],
  );

export function Button({ variant = "default", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" {...props} className={cx(buttonClass(variant), className)} />;
}

/** Round category seal with the category's first character, like a hanko stamp. */
export function Stamp({ category, size = "md" }: { category: string; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={cx(
        "grid flex-none place-items-center rounded-full font-bold text-white shadow-[inset_0_0_0_2px_rgb(255_255_255/0.35)]",
        size === "sm" ? "size-7 text-[13px]" : "size-9 text-[15px]",
      )}
      style={{ background: categoryColor(category) }}
    >
      {getCategory(category).mark}
    </span>
  );
}

const PILL: Record<PaceLevel, string> = {
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
};

export function Pill({ level, children }: { level: PaceLevel; children: ReactNode }) {
  return <span className={cx("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold", PILL[level])}>{children}</span>;
}

const METER: Record<PaceLevel, string> = { good: "bg-good", warn: "bg-warn", bad: "bg-bad" };

export function Meter({ ratio, level, className }: { ratio: number; level: PaceLevel; className?: string }) {
  return (
    <div className={cx("h-1.5 overflow-hidden rounded-full bg-surface-2", className)}>
      <div className={cx("h-full rounded-full", METER[level])} style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%` }} />
    </div>
  );
}

/** One record, or with `parts` the records one payment was split into (shown as one line with their total). */
export function TxRow({ tx, parts = [tx], onClick, showDate = true }: { tx: Transaction; parts?: Transaction[]; onClick: () => void; showDate?: boolean }) {
  const t = useT();
  const cat = getCategory(tx.category);
  const income = tx.type === "income";
  const split = parts.length > 1;
  const amount = parts.reduce((s, p) => s + p.amount, 0);
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-2.5 border-t border-line px-1 py-2.5 text-left first:border-t-0 hover:bg-surface-2"
    >
      <Stamp category={tx.category} size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-sm">
          {tx.memo || cat.name}
          {tx.outsideBudget && <span className="ml-1.5 rounded bg-warn-soft px-1 align-[1px] text-[10px] font-bold text-warn">{t.common.outsideBudget}</span>}
          {parts.some((p) => p.needsReview) && <span className="ml-1.5 rounded bg-accent-soft px-1 align-[1px] text-[10px] font-bold text-accent">{t.common.needsReview}</span>}
          {(split || tx.splitId) && <span className="ml-1.5 rounded bg-surface-2 px-1 align-[1px] text-[10px] font-bold text-muted">{t.common.split}</span>}
          {tx.receiptId && <span className="ml-1.5 rounded bg-surface-2 px-1 align-[1px] text-[10px] font-bold text-muted">{t.common.receipt}</span>}
        </span>
        {/* a split payment lists its parts one per line, so none is cut off on a phone */}
        {split &&
          parts.map((p) => (
            <span key={p.id} className="flex justify-between gap-2 text-[11px] text-muted">
              <span className="truncate">
                {getCategory(p.category).name}
                {p.note && `（${p.note}）`}
              </span>
              <span className="num">{yen(p.amount)}</span>
            </span>
          ))}
        <span className="block truncate text-[11px] text-muted">
          {[!split && `${cat.name}${tx.note ? `（${tx.note}）` : ""}`, showDate && dayLabel(tx.date), tx.isSample && t.common.sample]
            .filter(Boolean)
            .join(t.common.sep)}
        </span>
      </span>
      <span className={cx("num whitespace-nowrap text-base font-semibold", income && "text-good")}>
        {income ? "+" : "−"}
        {yen(amount)}
      </span>
    </button>
  );
}

/** Bottom sheet on phones, centered dialog on wide screens. */
export function Sheet({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  const t = useT();
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-scrim lg:items-center" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90%] w-full max-w-[560px] animate-sheet-up overflow-auto rounded-t-[20px] bg-surface px-4 pt-3.5 pb-[calc(16px+env(safe-area-inset-bottom,0px))] motion-reduce:animate-none lg:max-w-[520px] lg:rounded-[20px]"
      >
        <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-line lg:hidden" />
        <div className="mb-1 flex items-center justify-between">
          <b id={titleId}>{title}</b>
          <Button variant="ghost" onClick={onClose}>
            {t.common.close}
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-3 py-7 text-center text-muted">
      <b className="mb-1 block text-base text-ink">{title}</b>
      {children}
    </div>
  );
}

const iconProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const Icons = {
  home: <svg {...iconProps}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>,
  list: <svg {...iconProps}><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1" /><circle cx="3.5" cy="12" r="1" /><circle cx="3.5" cy="18" r="1" /></svg>,
  chart: <svg {...iconProps}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>,
  ai: <svg {...iconProps}><path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z" /><path d="M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z" /></svg>,
  settings: <svg {...iconProps}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>,
  eye: <svg {...iconProps}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>,
  eyeOff: <svg {...iconProps}><path d="M10.7 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.2 3.1M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" /></svg>,
  trash: <svg {...iconProps}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3" /></svg>,
  plus: <svg {...iconProps} strokeWidth={2.4}><path d="M12 5v14M5 12h14" /></svg>,
};
