import { describe, expect, it } from "vitest";
import {
  EMPTY_CATEGORY_SETTINGS,
  addCategory,
  categoriesOf,
  categoryColor,
  categoryNamed,
  editCategory,
  fixedCategoryChoices,
  getCategory,
  inCategories,
  isFixedCategory,
  normalizeCategories,
  reorderCategory,
  resetCategory,
  setCategories,
  variableCategories,
  withCurrent,
  type CategoryDraft,
  type CategorySettings,
} from "@/lib/categories";
import { setLanguage } from "@/lib/i18n";
import { buildAiDigest, monthStats, variableBudget, weekdayAverages } from "@/lib/stats";
import { setToday, settingsWith, tx } from "./helpers";

const ids = (list: { id: string }[]) => list.map((c) => c.id);
const draftOf = (id: string, change: Partial<CategoryDraft> = {}): CategoryDraft => {
  const c = getCategory(id);
  return { name: "", mark: "", hue: c.hue, fixed: c.fixed, hidden: c.hidden, ...change };
};

describe("the app's own categories", () => {
  it("list 16 expense and 4 income categories, with names in the display language", () => {
    expect(categoriesOf("expense")).toHaveLength(16);
    expect(getCategory("cosmetics").name).toBe("コスメ");
    expect(getCategory("treats").name).toBe("嗜好品");
    expect(ids(categoriesOf("expense")).slice(0, 2)).toEqual(["food", "treats"]);
    expect(ids(categoriesOf("income"))).toEqual(["salary", "bonus", "side", "income_other"]);
    expect(getCategory("food").name).toBe("食費");
    expect(getCategory("food").mark).toBe("食");
    setLanguage("en");
    expect(getCategory("food").name).toBe("Food");
    expect(getCategory("food").mark).toBe("F");
  });

  it("count housing, utilities, phone, subscriptions and insurance as fixed costs", () => {
    expect(categoriesOf("expense").filter((c) => c.fixed).map((c) => c.id)).toEqual(["housing", "utilities", "phone", "subscription", "insurance"]);
    expect(ids(variableCategories())).not.toContain("housing");
    expect(ids(fixedCategoryChoices()).slice(0, 5)).toEqual(["housing", "utilities", "phone", "subscription", "insurance"]);
  });

  it("show an unknown id as “other”", () => {
    expect(getCategory("no-such-id").id).toBe("other");
  });
});

describe("changing a category", () => {
  it("renames it, shown as written in both languages, with the new name's first character as its mark", () => {
    setCategories(editCategory(EMPTY_CATEGORY_SETTINGS, "food", draftOf("food", { name: "外食" })));
    expect(getCategory("food").name).toBe("外食");
    expect(getCategory("food").mark).toBe("外");
    setLanguage("en");
    expect(getCategory("food").name).toBe("外食");
  });

  it("keeps only what differs from the app's own values", () => {
    const cs = editCategory(EMPTY_CATEGORY_SETTINGS, "food", draftOf("food", { name: "食費", mark: "食" }));
    expect(cs.edits).toEqual({});
    const recolored = editCategory(EMPTY_CATEGORY_SETTINGS, "food", draftOf("food", { hue: 100 }));
    expect(recolored.edits).toEqual({ food: { hue: 100 } });
  });

  it("changes its color and mark", () => {
    setCategories(editCategory(EMPTY_CATEGORY_SETTINGS, "food", draftOf("food", { mark: "飯", hue: 100 })));
    expect(getCategory("food").mark).toBe("飯");
    expect(categoryColor("food")).toBe("hsl(100 55% 48%)");
  });

  it("can turn a category into a fixed cost and back", () => {
    setCategories(editCategory(EMPTY_CATEGORY_SETTINGS, "learning", draftOf("learning", { fixed: true })));
    expect(isFixedCategory("learning")).toBe(true);
    expect(ids(variableCategories())).not.toContain("learning");
    setCategories(editCategory(EMPTY_CATEGORY_SETTINGS, "housing", draftOf("housing", { fixed: false })));
    expect(ids(variableCategories())).toContain("housing");
  });

  it("puts it back with reset", () => {
    const cs = editCategory(EMPTY_CATEGORY_SETTINGS, "food", draftOf("food", { name: "外食", hue: 100 }));
    setCategories(resetCategory(cs, "food"));
    expect(getCategory("food").name).toBe("食費");
    expect(getCategory("food").hue).toBe(12);
  });
});

describe("hiding a category", () => {
  const hidden = editCategory(EMPTY_CATEGORY_SETTINGS, "clothes", draftOf("clothes", { hidden: true }));

  it("leaves it out of the pickers and budgets, but old records still show it", () => {
    setCategories(hidden);
    expect(ids(categoriesOf("expense"))).not.toContain("clothes");
    expect(ids(categoriesOf("expense", { withHidden: true }))).toContain("clothes");
    expect(ids(variableCategories())).not.toContain("clothes");
    expect(getCategory("clothes").name).toBe("衣服");
  });

  it("keeps a record's hidden category in its own select", () => {
    setCategories(hidden);
    expect(ids(withCurrent(categoriesOf("expense"), "clothes")).at(-1)).toBe("clothes");
    expect(withCurrent(categoriesOf("expense"), "food")).toHaveLength(15);
  });

  it("drops its budget from the total", () => {
    const settings = settingsWith({ categories: hidden }, { food: 30000, clothes: 8000 });
    expect(inCategories(settings.categories, () => variableBudget(settings))).toBe(30000);
  });

  it("is not possible for “other”, which unknown ids fall back to", () => {
    setCategories(editCategory(EMPTY_CATEGORY_SETTINGS, "other", draftOf("other", { hidden: true })));
    expect(ids(categoriesOf("expense"))).toContain("other");
  });
});

describe("the order", () => {
  it("moves a category up and down, and not past either end", () => {
    let cs = reorderCategory(EMPTY_CATEGORY_SETTINGS, "daily", -1);
    setCategories(cs);
    expect(ids(categoriesOf("expense")).slice(0, 3)).toEqual(["food", "daily", "treats"]);
    cs = reorderCategory(cs, "food", 1);
    setCategories(cs);
    expect(ids(categoriesOf("expense")).slice(0, 3)).toEqual(["daily", "food", "treats"]);
    expect(reorderCategory(cs, "daily", -1)).toBe(cs);
    expect(reorderCategory(cs, "other", 1)).toBe(cs);
  });

  it("puts categories missing from the saved order after the listed ones", () => {
    setCategories({ ...EMPTY_CATEGORY_SETTINGS, order: { expense: ["fun", "food"] } });
    expect(ids(categoriesOf("expense")).slice(0, 3)).toEqual(["fun", "food", "treats"]);
  });
});

describe("adding a category", () => {
  it("adds it at the end of its type with an unused color, its first character as mark", () => {
    const { categories, id } = addCategory(EMPTY_CATEGORY_SETTINGS, "expense", " カフェ ");
    setCategories(categories);
    const c = getCategory(id);
    expect(id).toMatch(/^c_/);
    expect(c.name).toBe("カフェ");
    expect(c.mark).toBe("カ");
    expect(c.builtIn).toBe(false);
    expect(ids(categoriesOf("expense")).at(-1)).toBe(id);
    expect(ids(categoriesOf("expense", { withHidden: true })).filter((x) => getCategory(x).hue === c.hue)).toEqual([id]);
    expect(ids(variableCategories())).toContain(id);
    setLanguage("en");
    expect(getCategory(id).name).toBe("カフェ");
  });

  it("is found by name in either language, to stop duplicates", () => {
    const { categories } = addCategory(EMPTY_CATEGORY_SETTINGS, "expense", "Cafés");
    expect(categoryNamed(categories, "expense", "cafés")?.name).toBe("Cafés");
    expect(categoryNamed(categories, "expense", "Food")?.id).toBe("food");
    expect(categoryNamed(categories, "expense", "食費")?.id).toBe("food");
    expect(categoryNamed(categories, "income", "食費")).toBeUndefined();
  });

  it("counts its spending in the month's totals, its budget and the AI digest", () => {
    setToday("2026-10-15");
    const { categories, id } = addCategory(EMPTY_CATEGORY_SETTINGS, "expense", "カフェ");
    const settings = settingsWith({ categories }, { food: 30000, [id]: 5000 });
    const txs = [tx("2026-10-02", 800, { category: id }), tx("2026-10-03", 1200)];
    inCategories(categories, () => {
      expect(monthStats(txs, "2026-10", settings).byCategory[id]).toBe(800);
      expect(variableBudget(settings)).toBe(35000);
      const digest = buildAiDigest(txs, settings);
      expect(digest.variableBudgetByCategory["カフェ"]).toBe(5000);
      expect(digest.months[0].byCategory["カフェ"]).toBe(800);
    });
  });

  it("can be a fixed cost, left out of the day-of-week habits", () => {
    setToday("2026-10-15");
    const { categories, id } = addCategory(EMPTY_CATEGORY_SETTINGS, "expense", "ジム");
    const fixed = editCategory(categories, id, { name: "ジム", mark: "", hue: 100, fixed: true, hidden: false });
    inCategories(fixed, () => {
      expect(isFixedCategory(id)).toBe(true);
      // 2026-10-12 is a Monday
      expect(weekdayAverages([tx("2026-10-12", 9000, { category: id })])[1]).toBe(0);
    });
  });
});

describe("saved category settings", () => {
  it("start empty from nothing or junk", () => {
    expect(normalizeCategories(undefined)).toEqual(EMPTY_CATEGORY_SETTINGS);
    expect(normalizeCategories("x")).toEqual(EMPTY_CATEGORY_SETTINGS);
  });

  it("keep valid changes and drop malformed ones", () => {
    const cs: CategorySettings = normalizeCategories({
      edits: { food: { name: "  外食  ", hue: 400, hidden: true, extra: 1 }, nope: { name: "x" }, other: { mark: "ほか" } },
      custom: [
        { id: "c_1", type: "expense", name: "カフェ", hue: 30 },
        { id: "c_1", type: "expense", name: "重複" },
        { id: "c_2", type: "income", name: "", hue: 30 },
        { id: "food", type: "expense", name: "上書き" },
        { id: "c_3", type: "transfer", name: "x" },
        { id: "c_4", type: "income", name: "配当", fixed: true },
      ],
      order: { expense: ["c_1", "food", "c_1", 3] },
    });
    expect(cs.edits).toEqual({ food: { name: "外食", hue: 40, hidden: true }, other: { mark: "ほ" } });
    expect(cs.custom.map((c) => c.id)).toEqual(["c_1", "c_4"]);
    expect(cs.custom[0]).toMatchObject({ mark: "カ", fixed: false, hidden: false });
    expect(cs.custom[1].fixed).toBe(false);
    expect(cs.order).toEqual({ expense: ["c_1", "food"] });
  });
});
