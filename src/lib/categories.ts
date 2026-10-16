import { getLanguage, inLanguage } from "./i18n";
import type { Settings, TxType } from "./types";

export type Category = {
  id: string;
  type: TxType;
  /** name in the display language */
  readonly name: string;
  /** one-character label shown in the round "stamp" */
  readonly mark: string;
  /** hue for the category color */
  hue: number;
  /** spending that is fixed every month (excluded from day-of-week habits and variable budgets) */
  fixed: boolean;
  /** hidden from pickers and budgets; old records still show it */
  hidden: boolean;
  /** one of the app's own categories (can be hidden but not deleted) */
  builtIn: boolean;
};

/** Changes to one of the app's own categories. Unset fields keep the app's value. */
export type CategoryEdit = { name?: string; mark?: string; hue?: number; fixed?: boolean; hidden?: boolean };

/** A category the user added. */
export type CustomCategory = { id: string; type: TxType; name: string; mark: string; hue: number; fixed: boolean; hidden: boolean };

/** The user's categories, stored as changes on top of the app's own ones. */
export type CategorySettings = {
  edits: Record<string, CategoryEdit>;
  custom: CustomCategory[];
  /** order of category ids per type; ids missing from it follow in their usual order */
  order: Partial<Record<TxType, string[]>>;
};

export const EMPTY_CATEGORY_SETTINGS: CategorySettings = { edits: {}, custom: [], order: {} };

type BuiltIn = { id: string; type: TxType; ja: string; mark: string; en: string; hue: number; fixed?: boolean };

const BUILT_IN: BuiltIn[] = [
  { id: "food", type: "expense", ja: "食費", mark: "食", en: "Food", hue: 12 },
  { id: "daily", type: "expense", ja: "日用品", mark: "日", en: "Household", hue: 190 },
  { id: "transport", type: "expense", ja: "交通", mark: "交", en: "Transport", hue: 210 },
  { id: "housing", type: "expense", ja: "住居", mark: "住", en: "Housing", hue: 28, fixed: true },
  { id: "utilities", type: "expense", ja: "水道光熱", mark: "光", en: "Utilities", hue: 45, fixed: true },
  { id: "phone", type: "expense", ja: "通信", mark: "通", en: "Phone", hue: 250, fixed: true },
  { id: "subscription", type: "expense", ja: "サブスク", mark: "サ", en: "Subscriptions", hue: 310, fixed: true },
  { id: "insurance", type: "expense", ja: "保険", mark: "保", en: "Insurance", hue: 100, fixed: true },
  { id: "fun", type: "expense", ja: "娯楽", mark: "娯", en: "Fun", hue: 290 },
  { id: "social", type: "expense", ja: "交際", mark: "際", en: "Social", hue: 330 },
  { id: "clothes", type: "expense", ja: "衣服", mark: "衣", en: "Clothes", hue: 170 },
  { id: "cosmetics", type: "expense", ja: "コスメ", mark: "コ", en: "Cosmetics", hue: 345 },
  { id: "medical", type: "expense", ja: "医療", mark: "医", en: "Medical", hue: 150 },
  { id: "learning", type: "expense", ja: "学び", mark: "学", en: "Learning", hue: 265 },
  { id: "other", type: "expense", ja: "その他", mark: "他", en: "Other", hue: 220 },
  { id: "salary", type: "income", ja: "給与", mark: "給", en: "Salary", hue: 145 },
  { id: "bonus", type: "income", ja: "賞与", mark: "賞", en: "Bonus", hue: 40 },
  { id: "side", type: "income", ja: "副収入", mark: "副", en: "Side income", hue: 180 },
  { id: "income_other", type: "income", ja: "その他", mark: "他", en: "Other", hue: 220 },
];

/** The catch-all categories: every unknown id falls back to them, so they can't be hidden. */
export const FALLBACK_CATEGORY: Record<TxType, string> = { expense: "other", income: "income_other" };
const isFallback = (id: string) => id === "other" || id === "income_other";

/** Hues offered when choosing a category's color. */
export const CATEGORY_HUES = [0, 12, 28, 45, 70, 100, 145, 170, 190, 210, 230, 250, 265, 290, 310, 330];

export const MAX_NAME = 12;

function builtIn(b: BuiltIn, edit: CategoryEdit = {}): Category {
  return {
    id: b.id,
    type: b.type,
    hue: edit.hue ?? b.hue,
    fixed: edit.fixed ?? Boolean(b.fixed),
    hidden: !isFallback(b.id) && Boolean(edit.hidden),
    builtIn: true,
    // A name the user wrote is shown as written; the app's own names follow the display language.
    get name() {
      return edit.name || (getLanguage() === "en" ? b.en : b.ja);
    },
    get mark() {
      return edit.mark || (edit.name ? [...edit.name][0] : getLanguage() === "en" ? b.en[0] : b.mark);
    },
  };
}

function custom(c: CustomCategory): Category {
  return { ...c, name: c.name, mark: c.mark || [...c.name][0] || "?", builtIn: false };
}

type Resolved = { list: Record<TxType, Category[]>; byId: Map<string, Category> };

function resolve(cs: CategorySettings): Resolved {
  const all = [...BUILT_IN.map((b) => builtIn(b, cs.edits[b.id])), ...cs.custom.map(custom)];
  const list = { expense: [] as Category[], income: [] as Category[] };
  for (const type of ["expense", "income"] as const) {
    const own = all.filter((c) => c.type === type);
    const rank = new Map((cs.order[type] ?? []).map((id, i) => [id, i]));
    // Listed ids first in the saved order; the rest keep their usual order after them.
    list[type] = own
      .map((c, i) => ({ c, key: rank.get(c.id) ?? rank.size + i }))
      .sort((a, b) => a.key - b.key)
      .map((x) => x.c);
  }
  return { list, byId: new Map(all.map((c) => [c.id, c])) };
}

// The categories in use. Like the language and currency, set by the app before any screen renders.
let current: Resolved = resolve(EMPTY_CATEGORY_SETTINGS);
let currentSettings: CategorySettings = EMPTY_CATEGORY_SETTINGS;

export function setCategories(cs: CategorySettings) {
  if (cs === currentSettings) return;
  currentSettings = cs;
  current = resolve(cs);
}

/**
 * Runs fn with the given user's categories. For the server, where requests from different
 * users share this module: fn must be synchronous, so no other request runs in between.
 */
export function inCategories<T>(cs: CategorySettings, fn: () => T): T {
  const previous = currentSettings;
  setCategories(cs);
  try {
    return fn();
  } finally {
    setCategories(previous);
  }
}

/** Categories of a type in the user's order. Hidden ones are left out unless asked for. */
export function categoriesOf(type: TxType, { withHidden = false } = {}): Category[] {
  return withHidden ? current.list[type] : current.list[type].filter((c) => !c.hidden);
}

export function getCategory(id: string): Category {
  return current.byId.get(id) ?? current.byId.get("other")!;
}

/** Whether a category id exists (an app category or one the user added). */
export const hasCategory = (id: string) => current.byId.has(id);

/** Whether spending in this category is a fixed cost (excluded from day-of-week habits and variable budgets). */
export const isFixedCategory = (id: string) => current.byId.get(id)?.fixed ?? false;

/** Shown expense categories that get a monthly variable-cost budget. */
export const variableCategories = () => categoriesOf("expense").filter((c) => !c.fixed);

/** Shown expense categories with the fixed-cost ones first, for choosing a fixed cost's category. */
export function fixedCategoryChoices(): Category[] {
  const shown = categoriesOf("expense");
  return [...shown.filter((c) => c.fixed), ...shown.filter((c) => !c.fixed)];
}

/** A list of choices plus the category already chosen, when it is hidden (so a select can still show it). */
export function withCurrent(list: Category[], id: string | undefined): Category[] {
  const current = id ? getCategory(id) : undefined;
  if (!current || list.some((c) => c.id === current.id)) return list;
  return [...list, current];
}

export function categoryColor(id: string): string {
  const c = getCategory(id);
  const muted = isFallback(c.id) && c.hue === BUILT_IN.find((b) => b.id === c.id)!.hue;
  return `hsl(${c.hue} ${muted ? 10 : 55}% 48%)`;
}

const isType = (v: unknown): v is TxType => v === "expense" || v === "income";
const text = (v: unknown, max: number) => (typeof v === "string" ? [...v.trim()].slice(0, max).join("") : "");
const hueOf = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(((v % 360) + 360) % 360) : undefined);

/** Category settings read from storage; anything malformed is dropped. */
export function normalizeCategories(value: unknown): CategorySettings {
  if (!value || typeof value !== "object") return EMPTY_CATEGORY_SETTINGS;
  const v = value as Record<string, unknown>;
  const edits: Record<string, CategoryEdit> = {};
  if (v.edits && typeof v.edits === "object") {
    for (const [id, raw] of Object.entries(v.edits as Record<string, unknown>)) {
      if (!BUILT_IN.some((b) => b.id === id) || !raw || typeof raw !== "object") continue;
      const e = raw as Record<string, unknown>;
      const edit: CategoryEdit = {};
      if (text(e.name, MAX_NAME)) edit.name = text(e.name, MAX_NAME);
      if (text(e.mark, 1)) edit.mark = text(e.mark, 1);
      if (hueOf(e.hue) !== undefined) edit.hue = hueOf(e.hue);
      if (typeof e.fixed === "boolean") edit.fixed = e.fixed;
      if (e.hidden === true) edit.hidden = true;
      if (Object.keys(edit).length) edits[id] = edit;
    }
  }
  const customs: CustomCategory[] = [];
  if (Array.isArray(v.custom)) {
    for (const raw of v.custom as Record<string, unknown>[]) {
      const id = text(raw?.id, 40);
      const name = text(raw?.name, MAX_NAME);
      if (!id || !name || !isType(raw.type) || BUILT_IN.some((b) => b.id === id) || customs.some((c) => c.id === id)) continue;
      customs.push({
        id,
        type: raw.type,
        name,
        mark: text(raw.mark, 1) || [...name][0],
        hue: hueOf(raw.hue) ?? 200,
        fixed: raw.type === "expense" && raw.fixed === true,
        hidden: raw.hidden === true,
      });
    }
  }
  const order: CategorySettings["order"] = {};
  if (v.order && typeof v.order === "object") {
    for (const type of ["expense", "income"] as const) {
      const ids = (v.order as Record<string, unknown>)[type];
      if (Array.isArray(ids)) order[type] = [...new Set(ids.filter((id): id is string => typeof id === "string"))];
    }
  }
  return { edits, custom: customs, order };
}

/** Whether the user changed nothing about the categories. */
export const isDefaultCategories = (cs: CategorySettings) =>
  !Object.keys(cs.edits).length && !cs.custom.length && !Object.values(cs.order).some((ids) => ids?.length);

/** A new id for a category the user adds. */
export const newCategoryId = () => `c_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;

/** A color not used yet by the categories of a type, if any is left. */
export function unusedHue(type: TxType): number {
  const used = new Set(categoriesOf(type, { withHidden: true }).map((c) => c.hue));
  return CATEGORY_HUES.find((h) => !used.has(h)) ?? CATEGORY_HUES[(used.size * 5) % CATEGORY_HUES.length];
}

/** The app's own name, mark and color of one of its categories (shown as placeholders and restored by "reset"). */
export function builtInDefaults(id: string) {
  const b = BUILT_IN.find((x) => x.id === id);
  if (!b) return null;
  const en = getLanguage() === "en";
  return { name: en ? b.en : b.ja, mark: en ? b.en[0] : b.mark, hue: b.hue, fixed: Boolean(b.fixed) };
}

/** Whether a category is a catch-all that every unknown id falls back to (it can't be hidden). */
export const isFallbackCategory = isFallback;

/** What can be changed about a category in Settings. */
export type CategoryDraft = { name: string; mark: string; hue: number; fixed: boolean; hidden: boolean };

/** Moves a category one place up (-1) or down (+1) among the categories of its type. */
export function reorderCategory(cs: CategorySettings, id: string, delta: -1 | 1): CategorySettings {
  return inCategories(cs, () => {
    const type = getCategory(id).type;
    const ids = categoriesOf(type, { withHidden: true }).map((c) => c.id);
    const i = ids.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return cs;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    return { ...cs, order: { ...cs.order, [type]: ids } };
  });
}

/** Saves a category's new name, mark, color, fixed flag and hidden flag. */
export function editCategory(cs: CategorySettings, id: string, draft: CategoryDraft): CategorySettings {
  const name = [...draft.name.trim()].slice(0, MAX_NAME).join("");
  const mark = [...draft.mark.trim()].slice(0, 1).join("");
  const b = BUILT_IN.find((x) => x.id === id);
  if (b) {
    // Only what differs from the app's own values is kept, so names the user left alone still follow the language.
    const edit: CategoryEdit = {};
    if (name && name !== b.ja && name !== b.en) edit.name = name;
    if (mark && mark !== b.mark && mark !== b.en[0] && mark !== [...(edit.name ?? "")][0]) edit.mark = mark;
    if (draft.hue !== b.hue) edit.hue = draft.hue;
    if (draft.fixed !== Boolean(b.fixed)) edit.fixed = draft.fixed;
    if (draft.hidden && !isFallback(id)) edit.hidden = true;
    const edits = { ...cs.edits };
    if (Object.keys(edit).length) edits[id] = edit;
    else delete edits[id];
    return { ...cs, edits };
  }
  return {
    ...cs,
    custom: cs.custom.map((c) =>
      c.id === id
        ? { ...c, name: name || c.name, mark: mark || [...(name || c.name)][0], hue: draft.hue, fixed: c.type === "expense" && draft.fixed, hidden: draft.hidden }
        : c,
    ),
  };
}

/** Puts one of the app's categories back to how the app ships it (its place in the order is kept). */
export function resetCategory(cs: CategorySettings, id: string): CategorySettings {
  const edits = { ...cs.edits };
  delete edits[id];
  return { ...cs, edits };
}

/** Adds a category at the end of its type's list. */
export function addCategory(cs: CategorySettings, type: TxType, name: string): { categories: CategorySettings; id: string } {
  const clean = [...name.trim()].slice(0, MAX_NAME).join("");
  const id = newCategoryId();
  return inCategories(cs, () => {
    const added: CustomCategory = { id, type, name: clean, mark: [...clean][0], hue: unusedHue(type), fixed: false, hidden: false };
    const ids = [...categoriesOf(type, { withHidden: true }).map((c) => c.id), id];
    return { id, categories: { ...cs, custom: [...cs.custom, added], order: { ...cs.order, [type]: ids } } };
  });
}

/** The category of a type already shown as `name` (in either language), if any. */
export function categoryNamed(cs: CategorySettings, type: TxType, name: string): Category | undefined {
  const wanted = name.trim().toLowerCase();
  return inCategories(cs, () =>
    categoriesOf(type, { withHidden: true }).find((c) =>
      [inLanguage("ja", () => c.name), inLanguage("en", () => c.name)].some((n) => n.toLowerCase() === wanted),
    ),
  );
}

export const DEFAULT_SETTINGS: Settings = {
  budgets: {
    food: 40000,
    daily: 8000,
    transport: 10000,
    fun: 15000,
    social: 10000,
    clothes: 8000,
    medical: 5000,
    learning: 5000,
    other: 5000,
  },
  fixedCosts: {},
  monthStartDay: 1,
  weekStartDay: 1,
  currency: "JPY",
  timeZone: "Asia/Tokyo",
  language: null,
  categories: EMPTY_CATEGORY_SETTINGS,
  goal: { target: 0, saved: 0, monthly: {}, fixedMonthly: { amount: 0, from: "" } },
  autoReadReceipts: false,
  budgetReviewed: "",
  noSpendDays: [],
  lastAi: null,
};
