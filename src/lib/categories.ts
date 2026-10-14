import { getLanguage } from "./i18n";
import type { Settings, TxType } from "./types";

export type Category = {
  id: string;
  /** name in the display language */
  readonly name: string;
  /** one-character label shown in the round "stamp" */
  readonly mark: string;
  /** hue for the category color */
  hue: number;
};

/** A category whose name and stamp follow the display language. */
function category(id: string, ja: string, mark: string, en: string, hue: number): Category {
  return {
    id,
    hue,
    get name() {
      return getLanguage() === "en" ? en : ja;
    },
    get mark() {
      return getLanguage() === "en" ? en[0] : mark;
    },
  };
}

export const CATEGORIES: Record<TxType, Category[]> = {
  expense: [
    category("food", "食費", "食", "Food", 12),
    category("daily", "日用品", "日", "Household", 190),
    category("transport", "交通", "交", "Transport", 210),
    category("housing", "住居", "住", "Housing", 28),
    category("utilities", "水道光熱", "光", "Utilities", 45),
    category("phone", "通信", "通", "Phone", 250),
    category("subscription", "サブスク", "サ", "Subscriptions", 310),
    category("insurance", "保険", "保", "Insurance", 100),
    category("fun", "娯楽", "娯", "Fun", 290),
    category("social", "交際", "際", "Social", 330),
    category("clothes", "衣服", "衣", "Clothes", 170),
    category("medical", "医療", "医", "Medical", 150),
    category("learning", "学び", "学", "Learning", 265),
    category("other", "その他", "他", "Other", 220),
  ],
  income: [
    category("salary", "給与", "給", "Salary", 145),
    category("bonus", "賞与", "賞", "Bonus", 40),
    category("side", "副収入", "副", "Side income", 180),
    category("income_other", "その他", "他", "Other", 220),
  ],
};

const BY_ID = new Map<string, Category>(
  [...CATEGORIES.expense, ...CATEGORIES.income].map((c) => [c.id, c]),
);

export function getCategory(id: string): Category {
  return BY_ID.get(id) ?? BY_ID.get("other")!;
}

/** Categories whose spending is fixed (excluded from day-of-week habits and variable budgets). */
export const FIXED_COST_CATEGORIES = new Set(["housing", "utilities", "phone", "subscription", "insurance"]);

/** Categories that get a monthly variable-cost budget. */
export const VARIABLE_CATEGORIES = CATEGORIES.expense.filter((c) => !FIXED_COST_CATEGORIES.has(c.id));

/** Expense categories with the fixed-cost ones first, for choosing a fixed cost's category. */
export const FIXED_CATEGORY_CHOICES = [
  ...CATEGORIES.expense.filter((c) => FIXED_COST_CATEGORIES.has(c.id)),
  ...VARIABLE_CATEGORIES,
];

export function categoryColor(id: string): string {
  const c = getCategory(id);
  const muted = c.id === "other" || c.id === "income_other";
  return `hsl(${c.hue} ${muted ? 10 : 55}% 48%)`;
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
  currency: "JPY",
  timeZone: "Asia/Tokyo",
  language: null,
  goal: { target: 0, saved: 0, monthly: {}, fixedMonthly: { amount: 0, from: "" } },
  noSpendDays: [],
  lastAi: null,
};
