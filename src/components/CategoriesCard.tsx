"use client";

import { useState } from "react";
import {
  CATEGORY_HUES,
  MAX_NAME,
  addCategory,
  builtInDefaults,
  categoriesOf,
  categoryNamed,
  editCategory,
  getCategory,
  inCategories,
  isFallbackCategory,
  reorderCategory,
  resetCategory,
  type Category,
  type CategoryDraft,
} from "@/lib/categories";
import type { TxType } from "@/lib/types";
import { useKakeibo } from "./KakeiboProvider";
import { useT } from "./LanguageProvider";
import { Button, Card, CardTitle, Stamp, cx } from "./ui";

const field = "w-full min-w-0 rounded-xl border border-line bg-bg px-3 py-2";

/** Settings card for renaming, recoloring, reordering, hiding, adding and deleting categories. */
export function CategoriesCard() {
  const { settings, updateSettings, toast } = useKakeibo();
  const t = useT();
  const [type, setType] = useState<TxType>("expense");
  const [open, setOpen] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const list = categoriesOf(type, { withHidden: true });
  // Closed at first: the list is long, and changed far less often than the rest of settings.
  const [expanded, setExpanded] = useState(false);

  const add = async () => {
    const name = newName.trim();
    if (!name) return toast(t.categories.enterName);
    const same = categoryNamed(settings.categories, type, name);
    if (same) return toast(t.categories.duplicate(same.name));
    await updateSettings((s) => ({ ...s, categories: addCategory(s.categories, type, name).categories }));
    setNewName("");
    toast(t.categories.added([...name].slice(0, MAX_NAME).join("")));
  };

  if (!expanded) {
    const shown = categoriesOf("expense");
    return (
      <Card>
        <CardTitle
          action={
            <button type="button" aria-expanded={false} onClick={() => setExpanded(true)} className="min-h-11 rounded-lg px-2 text-[13px] font-medium text-accent">
              {t.categories.manage}
            </button>
          }
        >
          {t.categories.title}
        </CardTitle>
        <div className="flex flex-wrap gap-1" aria-hidden>
          {shown.map((c) => (
            <Stamp key={c.id} category={c.id} size="sm" />
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">{t.categories.summary(shown.length, categoriesOf("income").length)}</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle
        action={
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1" role="radiogroup" aria-label={t.categories.title}>
            {(["expense", "income"] as const).map((x) => (
              <button
                key={x}
                type="button"
                role="radio"
                aria-checked={type === x}
                onClick={() => {
                  setType(x);
                  setOpen(null);
                }}
                className={cx("min-h-9 rounded-lg px-3 py-1 text-xs font-bold", type === x ? "bg-surface text-ink shadow-sm" : "text-muted")}
              >
                {t.categories[x]}
              </button>
            ))}
          </div>
        }
      >
        {t.categories.title}
      </CardTitle>

      <ul className="grid gap-0.5" aria-label={t.categories.title}>
        {list.map((c, i) => (
          <li key={c.id} aria-label={c.name}>
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 py-1">
              <span className={cx(c.hidden && "opacity-40")}>
                <Stamp category={c.id} size="sm" />
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className={cx("truncate", c.hidden && "text-muted line-through")}>{c.name}</span>
                {c.fixed && <Tag>{t.categories.fixed}</Tag>}
                {c.hidden && <Tag>{t.categories.hidden}</Tag>}
                {!c.builtIn && <Tag>{t.categories.mine}</Tag>}
              </span>
              <span className="flex items-center gap-1">
                <IconButton
                  label={t.categories.up(c.name)}
                  disabled={i === 0}
                  onClick={() => void updateSettings((s) => ({ ...s, categories: reorderCategory(s.categories, c.id, -1) }))}
                >
                  ↑
                </IconButton>
                <IconButton
                  label={t.categories.down(c.name)}
                  disabled={i === list.length - 1}
                  onClick={() => void updateSettings((s) => ({ ...s, categories: reorderCategory(s.categories, c.id, 1) }))}
                >
                  ↓
                </IconButton>
                <button
                  type="button"
                  aria-expanded={open === c.id}
                  aria-label={t.categories.editLabel(c.name)}
                  onClick={() => setOpen(open === c.id ? null : c.id)}
                  className="min-h-11 rounded-lg px-2 text-[13px] font-medium text-accent"
                >
                  {t.categories.edit}
                </button>
              </span>
            </div>
            {open === c.id && <CategoryEditor key={c.id} category={c} onClose={() => setOpen(null)} />}
          </li>
        ))}
      </ul>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <input
          aria-label={t.categories.addTitle}
          value={newName}
          maxLength={MAX_NAME * 2}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t.categories.addPlaceholder}
          className={field}
        />
        <Button type="submit" variant="primary">
          {t.categories.add}
        </Button>
      </form>
      <p className="mt-2 text-xs text-muted">{t.categories.hint}</p>
      <Button
        className="mt-3 w-full"
        aria-expanded
        onClick={() => {
          setExpanded(false);
          setOpen(null);
        }}
      >
        {t.categories.done}
      </Button>
    </Card>
  );
}

function Tag({ children }: { children: string }) {
  return <span className="rounded-full bg-surface-2 px-1.5 py-px text-[10px] font-bold text-muted">{children}</span>;
}

function IconButton({ label, children, ...props }: { label: string; children: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      {...props}
      className="grid size-11 place-items-center rounded-lg text-muted hover:bg-surface-2 disabled:opacity-25"
    >
      {children}
    </button>
  );
}

function CategoryEditor({ category: c, onClose }: { category: Category; onClose: () => void }) {
  const { settings, transactions, updateSettings, deleteCategory, toast } = useKakeibo();
  const t = useT();
  const defaults = builtInDefaults(c.id);
  const edit = settings.categories.edits[c.id];
  const [draft, setDraft] = useState<CategoryDraft>({
    // An app category's name stays empty until the user writes one, so it keeps following the language.
    name: defaults ? (edit?.name ?? "") : c.name,
    mark: defaults ? (edit?.mark ?? "") : c.mark,
    hue: c.hue,
    fixed: c.fixed,
    hidden: c.hidden,
  });
  const [deleting, setDeleting] = useState(false);
  const count = transactions.filter((x) => x.category === c.id).length;
  const targets = categoriesOf(c.type).filter((x) => x.id !== c.id);
  const [moveTo, setMoveTo] = useState(targets[0]?.id ?? "");
  const set = (values: Partial<CategoryDraft>) => setDraft((d) => ({ ...d, ...values }));

  const save = async () => {
    const name = draft.name.trim();
    if (!defaults && !name) return toast(t.categories.enterName);
    const same = name && categoryNamed(settings.categories, c.type, name);
    if (same && same.id !== c.id) return toast(t.categories.duplicate(same.name));
    const next = editCategory(settings.categories, c.id, draft);
    await updateSettings((s) => ({ ...s, categories: next }));
    onClose();
    toast(t.categories.saved(inCategories(next, () => getCategory(c.id).name)));
  };

  const remove = async () => {
    try {
      await deleteCategory(c.id, moveTo);
      toast(t.categories.deleted(c.name));
    } catch {
      toast(t.categories.deleteFailed);
    }
  };

  return (
    <div className="mb-2 grid gap-3 rounded-xl bg-surface-2 p-3 text-sm">
      <div className="grid grid-cols-[1fr_88px] gap-2">
        <label className="grid gap-1">
          <span className="text-xs text-muted">{t.categories.name}</span>
          <input
            value={draft.name}
            maxLength={MAX_NAME * 2}
            placeholder={defaults?.name}
            onChange={(e) => set({ name: e.target.value })}
            className={field}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-muted">{t.categories.mark}</span>
          <input
            value={draft.mark}
            maxLength={2}
            placeholder={[...(draft.name.trim() || defaults?.mark || "")][0]}
            onChange={(e) => set({ mark: [...e.target.value].slice(-1).join("") })}
            className={cx(field, "text-center")}
          />
        </label>
      </div>

      <div>
        <span className="text-xs text-muted">{t.categories.color}</span>
        <div className="mt-1 flex flex-wrap gap-1.5" role="radiogroup" aria-label={t.categories.color}>
          {CATEGORY_HUES.map((hue, i) => (
            <button
              key={hue}
              type="button"
              role="radio"
              aria-checked={draft.hue === hue}
              aria-label={t.categories.colorOption(i + 1)}
              onClick={() => set({ hue })}
              className={cx("size-8 rounded-full", draft.hue === hue && "ring-2 ring-ink ring-offset-2 ring-offset-surface-2")}
              style={{ background: `hsl(${hue} 55% 48%)` }}
            />
          ))}
        </div>
      </div>

      {c.type === "expense" && (
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={draft.fixed} onChange={(e) => set({ fixed: e.target.checked })} className="mt-1 size-4 accent-accent" />
          <span>
            {t.categories.fixedOption}
            <span className="block text-xs text-muted">{t.categories.fixedHint}</span>
          </span>
        </label>
      )}

      {!isFallbackCategory(c.id) && (
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={draft.hidden} onChange={(e) => set({ hidden: e.target.checked })} className="mt-1 size-4 accent-accent" />
          <span>
            {t.categories.hideOption}
            <span className="block text-xs text-muted">{t.categories.hideHint}</span>
          </span>
        </label>
      )}

      {deleting ? (
        <div className="grid gap-2 rounded-xl border border-line bg-surface p-3">
          {count > 0 && (
            <label className="grid gap-1">
              <span className="text-xs text-muted">{t.categories.moveTo(count)}</span>
              <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className={field}>
                {targets.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" onClick={() => void remove()}>
              {t.categories.confirmDelete}
            </Button>
            <Button onClick={() => setDeleting(false)}>{t.categories.cancel}</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => void save()}>
            {t.categories.save}
          </Button>
          <Button onClick={onClose}>{t.categories.cancel}</Button>
          <span className="flex-1" />
          {defaults ? (
            edit && (
              <Button
                variant="ghost"
                onClick={async () => {
                  const next = resetCategory(settings.categories, c.id);
                  await updateSettings((s) => ({ ...s, categories: next }));
                  onClose();
                  toast(t.categories.resetDone(inCategories(next, () => getCategory(c.id).name)));
                }}
              >
                {t.categories.reset}
              </Button>
            )
          ) : (
            <Button variant="danger" aria-label={t.categories.deleteLabel(c.name)} onClick={() => setDeleting(true)}>
              {t.categories.delete}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
