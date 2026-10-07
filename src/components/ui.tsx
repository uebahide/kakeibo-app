"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { categoryColor, getCategory } from "@/lib/categories";
import { dayLabel } from "@/lib/date";
import { yen } from "@/lib/format";
import type { PaceLevel } from "@/lib/stats";
import type { Transaction } from "@/lib/types";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

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
  return <button type="button" {...props} className={cx("text-[13px] font-medium text-accent", props.className)} />;
}

type Variant = "primary" | "default" | "ghost" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "border-accent bg-accent text-accent-ink hover:brightness-110",
  default: "border-line bg-surface hover:bg-surface-2",
  ghost: "border-transparent bg-transparent text-accent hover:bg-surface-2",
  danger: "border-line bg-surface text-bad hover:bg-bad-soft",
};

export function Button({ variant = "default", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "whitespace-nowrap rounded-xl border px-3.5 py-2.5 text-sm font-bold transition disabled:cursor-default disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
    />
  );
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

export function TxRow({ tx, onClick }: { tx: Transaction; onClick: () => void }) {
  const cat = getCategory(tx.category);
  const income = tx.type === "income";
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
          {tx.isSample && <span className="ml-1.5 rounded border border-line px-1 align-[1px] text-[10px] text-muted">サンプル</span>}
        </span>
        <span className="block text-[11px] text-muted">
          {cat.name}・{dayLabel(tx.date)}
        </span>
      </span>
      <span className={cx("num whitespace-nowrap text-base font-semibold", income && "text-good")}>
        {income ? "+" : "−"}
        {yen(tx.amount)}
      </span>
    </button>
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
  settings: <svg {...iconProps}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" /></svg>,
  plus: <svg {...iconProps} strokeWidth={2.4}><path d="M12 5v14M5 12h14" /></svg>,
};
