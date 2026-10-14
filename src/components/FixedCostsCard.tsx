"use client";

import { useState } from "react";
import { FIXED_CATEGORY_CHOICES } from "@/lib/categories";
import { monthLabel } from "@/lib/date";
import { changeFixedCosts, fixedCostsFor, sumFixed } from "@/lib/fixed";
import { parseAmount, yen } from "@/lib/format";
import type { FixedCost } from "@/lib/types";
import { useKakeibo } from "./KakeiboProvider";
import { useT } from "./LanguageProvider";
import { Button, Card, CardTitle, EmptyState, Meter, Stamp, TextButton, cx } from "./ui";

/** The month's fixed costs: counted as spending automatically, with a paid check per item. `bare` drops the card frame for use inside a sheet. */
export function FixedCostsCard({ bare = false }: { bare?: boolean }) {
  const { settings, month, updateSettings } = useKakeibo();
  const t = useT();
  const [editing, setEditing] = useState(false);
  const { items, inheritedFrom } = fixedCostsFor(settings.fixedCosts, month);
  const total = sumFixed(items);
  const paid = sumFixed(items.filter((f) => f.paid));
  const paidCount = items.filter((f) => f.paid).length;

  const change = (fn: (items: FixedCost[]) => FixedCost[]) => updateSettings((s) => changeFixedCosts(s, month, fn));
  const patch = (id: string, values: Partial<FixedCost>) =>
    change((list) => list.map((f) => (f.id === id ? { ...f, ...values } : f)));
  const add = () => {
    setEditing(true);
    void change((list) => [
      ...list,
      { id: crypto.randomUUID(), name: "", category: FIXED_CATEGORY_CHOICES[0].id, amount: 0, paid: false },
    ]);
  };

  return (
    <Card className={cx(bare && "border-0! p-0!")}>
      <CardTitle
        action={
          items.length > 0 && (
            <TextButton onClick={() => setEditing(!editing)}>{editing ? t.fixed.done : t.fixed.edit}</TextButton>
          )
        }
      >
        {!bare && t.fixed.title(monthLabel(month))}
      </CardTitle>

      {!items.length ? (
        <EmptyState title={t.fixed.emptyTitle}>
          {t.fixed.emptyBody}
          <div className="mt-3 flex justify-center">
            <Button variant="primary" onClick={add}>
              {t.fixed.add}
            </Button>
          </div>
        </EmptyState>
      ) : (
        <>
          <div className="num flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xl font-semibold">{yen(total)}</span>
            <span className="text-[13px] text-muted">
              {t.fixed.paidSummary(yen(paid), paidCount, items.length)}
            </span>
          </div>
          <Meter ratio={total ? paid / total : 0} level="good" className="mt-1.5 mb-1" />
          {inheritedFrom && (
            <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
              {t.fixed.inherited(monthLabel(inheritedFrom))}
            </p>
          )}

          <ul className="mt-1">
            {items.map((f) =>
              editing ? (
                <EditRow
                  key={`${month}-${f.id}`}
                  item={f}
                  onChange={(values) => patch(f.id, values)}
                  onDelete={() => change((list) => list.filter((x) => x.id !== f.id))}
                />
              ) : (
                <li key={f.id} className="border-t border-line first:border-t-0">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={f.paid}
                    onClick={() => patch(f.id, { paid: !f.paid })}
                    className="grid w-full grid-cols-[auto_auto_1fr_auto] items-center gap-2.5 py-2 text-left"
                  >
                    <span
                      aria-hidden
                      className={cx(
                        "grid size-6 place-items-center rounded-full border-2 text-xs font-bold",
                        f.paid ? "border-good bg-good text-white" : "border-line text-transparent",
                      )}
                    >
                      ✓
                    </span>
                    <Stamp category={f.category} size="sm" />
                    <span className={cx("min-w-0 truncate text-sm font-medium", f.paid && "text-muted")}>
                      {f.name || t.fixed.noName}
                      <span className="block text-[11px] font-normal text-muted">{f.paid ? t.fixed.paid : t.fixed.unpaid}</span>
                    </span>
                    <span className={cx("num text-[15px] font-semibold", f.paid && "text-muted")}>{yen(f.amount)}</span>
                  </button>
                </li>
              ),
            )}
          </ul>
          {editing && (
            <Button variant="ghost" className="mt-1 px-0" onClick={add}>
              {t.fixed.addItem}
            </Button>
          )}
        </>
      )}
    </Card>
  );
}

function EditRow({
  item,
  onChange,
  onDelete,
}: {
  item: FixedCost;
  onChange: (values: Partial<FixedCost>) => void;
  onDelete: () => void;
}) {
  const t = useT();
  const field = "min-w-0 rounded-xl border border-line bg-bg px-2.5 py-2";
  return (
    <li className="grid grid-cols-[1fr_auto] gap-2 border-t border-line py-2.5 first:border-t-0">
      <input
        aria-label={t.fixed.name}
        placeholder={t.fixed.namePlaceholder}
        defaultValue={item.name}
        autoFocus={!item.name}
        onBlur={(e) => {
          const name = e.target.value.trim();
          if (name !== item.name) onChange({ name });
        }}
        className={field}
      />
      <Button variant="danger" className="px-3" onClick={onDelete} aria-label={t.fixed.deleteLabel(item.name)}>
        {t.fixed.delete}
      </Button>
      <select
        aria-label={t.fixed.category}
        value={item.category}
        onChange={(e) => onChange({ category: e.target.value })}
        className={field}
      >
        {FIXED_CATEGORY_CHOICES.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <input
        aria-label={t.fixed.amount}
        inputMode="numeric"
        defaultValue={item.amount || ""}
        placeholder={t.fixed.amount}
        onBlur={(e) => {
          const amount = parseAmount(e.target.value);
          e.target.value = amount ? String(amount) : "";
          if (amount !== item.amount) onChange({ amount });
        }}
        className={cx(field, "num w-28 text-right")}
      />
    </li>
  );
}
