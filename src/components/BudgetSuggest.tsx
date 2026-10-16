"use client";

import { useState } from "react";
import { applySuggestion, suggestBudgets, type BudgetSuggestion, type CategorySuggestion } from "@/lib/budgetSuggest";
import { getCategory } from "@/lib/categories";
import { monthLabel, shortMonthLabel, today } from "@/lib/date";
import { yen } from "@/lib/format";
import { currentPeriod, periodDayIndex } from "@/lib/period";
import { useKakeibo } from "./KakeiboProvider";
import { useT } from "./LanguageProvider";
import { Button, Card, CardTitle, Sheet, Stamp, cx } from "./ui";

/** Days into a new period that Home offers its suggested budget. */
const OFFER_DAYS = 7;

/** Card on Home in the first days of a period, until the suggestion is used or turned down. */
export function BudgetSuggestCard() {
  const { transactions, settings, updateSettings, toast } = useKakeibo();
  const t = useT().suggest;
  const [open, setOpen] = useState(false);
  const month = currentPeriod(settings.monthStartDay);
  if (settings.budgetReviewed === month || periodDayIndex(today(), month, settings.monthStartDay) > OFFER_DAYS) return null;
  const suggestion = suggestBudgets(transactions, settings, month);
  if (!suggestion?.changed) return null;

  const dismiss = async () => {
    await updateSettings((s) => ({ ...s, budgetReviewed: month }));
    toast(t.dismissed);
  };

  return (
    <Card>
      <CardTitle>{t.cardTitle(monthLabel(month))}</CardTitle>
      <p className="mb-2.5 text-sm text-muted">{t.cardBody(suggestion.months.length)}</p>
      <p className="num mb-3 text-sm font-medium">{t.totals(yen(suggestion.currentTotal), yen(suggestion.total))}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => setOpen(true)}>
          {t.open}
        </Button>
        <Button variant="ghost" onClick={dismiss}>
          {t.later}
        </Button>
      </div>
      {open && <BudgetSuggestSheet suggestion={suggestion} onClose={() => setOpen(false)} />}
    </Card>
  );
}

/** Button under the budget in Settings that opens the suggestion at any time. */
export function BudgetSuggestButton() {
  const { transactions, settings } = useKakeibo();
  const t = useT().suggest;
  const [suggestion, setSuggestion] = useState<BudgetSuggestion | null | undefined>(undefined);
  return (
    <>
      <Button className="mt-2.5" onClick={() => setSuggestion(suggestBudgets(transactions, settings))}>
        {t.settingsButton}
      </Button>
      {suggestion !== undefined && <BudgetSuggestSheet suggestion={suggestion} onClose={() => setSuggestion(undefined)} />}
    </>
  );
}

function BudgetSuggestSheet({ suggestion, onClose }: { suggestion: BudgetSuggestion | null; onClose: () => void }) {
  const { settings, updateSettings, toast } = useKakeibo();
  const t = useT();
  const s = t.suggest;
  const month = suggestion?.month ?? currentPeriod(settings.monthStartDay);
  const changedIds = suggestion?.rows.filter((r) => r.suggested !== r.current).map((r) => r.id) ?? [];
  const [choosing, setChoosing] = useState(false);
  const [picked, setPicked] = useState<string[]>(changedIds);

  async function apply(ids?: string[]) {
    if (!suggestion) return;
    await updateSettings((x) => ({ ...x, budgets: applySuggestion(x.budgets, suggestion, ids), budgetReviewed: suggestion.month }));
    toast(s.applied);
    onClose();
  }

  return (
    <Sheet title={s.sheetTitle(monthLabel(month))} onClose={onClose}>
      {!suggestion ? (
        <p className="py-3 text-sm text-muted">{s.noData}</p>
      ) : (
        <>
          <p className="text-xs text-muted">
            {s.basedOn([...suggestion.months].reverse().map(shortMonthLabel).join(t.common.sep))}
          </p>
          <p className="num mt-1 text-sm font-medium">{s.totals(yen(suggestion.currentTotal), yen(suggestion.total))}</p>
          <p className="num mt-1 text-xs text-muted">
            {suggestion.available === null
              ? s.noIncome
              : suggestion.available > 0
                ? s.room(yen(suggestion.available))
                : s.noRoom(yen(suggestion.available))}
          </p>
          {suggestion.trimmed && <p className="mt-0.5 text-xs text-muted">{s.trimmedNote}</p>}
          <ul className="mt-2">
            {suggestion.rows.map((r) => (
              <SuggestionRow
                key={r.id}
                row={r}
                months={suggestion.months.length}
                choosing={choosing}
                checked={picked.includes(r.id)}
                onToggle={() => setPicked((p) => (p.includes(r.id) ? p.filter((id) => id !== r.id) : [...p, r.id]))}
              />
            ))}
          </ul>
          {!suggestion.changed ? (
            <p className="py-2 text-sm text-muted">{s.same}</p>
          ) : choosing ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" disabled={!picked.length} onClick={() => apply(picked)}>
                {s.applyChosen(picked.length)}
              </Button>
              <Button variant="ghost" onClick={() => setChoosing(false)}>
                {s.cancelChoose}
              </Button>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => apply()}>
                {s.useAll}
              </Button>
              <Button onClick={() => setChoosing(true)}>{s.choose}</Button>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}

function SuggestionRow(props: { row: CategorySuggestion; months: number; choosing: boolean; checked: boolean; onToggle: () => void }) {
  const { row: r, months } = props;
  const t = useT().suggest.reason;
  const changed = r.suggested !== r.current;
  const avg = yen(r.average);
  const reason = {
    new: () => t.new(avg),
    over: () => t.over(months, r.overMonths, avg),
    under: () => t.under(avg, yen(r.current - r.average)),
    keep: () => t.keep(avg),
    unused: () => t.unused(months),
  }[r.kind]();
  const sep = useT().common.sep;
  const body = (
    <>
      <Stamp category={r.id} size="sm" />
      <div className="min-w-0">
        <div className="text-sm font-medium">{getCategory(r.id).name}</div>
        <div className="text-xs text-muted">{r.trimmed ? `${reason}${sep}${t.trimmed}` : reason}</div>
      </div>
      <div className="num text-right text-[13px] whitespace-nowrap">
        {changed && <span className="text-muted line-through">{yen(r.current)}</span>}
        <b className={cx("block text-[15px]", !changed && "font-normal text-muted")}>{yen(r.suggested)}</b>
      </div>
    </>
  );
  const rowClass = "grid items-center gap-2.5 py-2";
  return (
    <li className="border-t border-line first:border-t-0">
      {props.choosing && changed ? (
        <label className={cx(rowClass, "cursor-pointer grid-cols-[auto_auto_1fr_auto]")}>
          <input type="checkbox" checked={props.checked} onChange={props.onToggle} className="size-5 accent-accent" />
          {body}
        </label>
      ) : (
        <div className={cx(rowClass, "grid-cols-[auto_1fr_auto]", props.choosing && "pl-[30px]")}>{body}</div>
      )}
    </li>
  );
}
