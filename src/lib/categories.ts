import type { Settings, TxType } from "./types";

export type Category = {
  id: string;
  name: string;
  /** one-character label shown in the round "stamp" */
  mark: string;
  /** hue for the category color */
  hue: number;
};

export const CATEGORIES: Record<TxType, Category[]> = {
  expense: [
    { id: "food", name: "食費", mark: "食", hue: 12 },
    { id: "daily", name: "日用品", mark: "日", hue: 190 },
    { id: "transport", name: "交通", mark: "交", hue: 210 },
    { id: "housing", name: "住居", mark: "住", hue: 28 },
    { id: "utilities", name: "水道光熱", mark: "光", hue: 45 },
    { id: "phone", name: "通信", mark: "通", hue: 250 },
    { id: "fun", name: "娯楽", mark: "娯", hue: 290 },
    { id: "social", name: "交際", mark: "際", hue: 330 },
    { id: "clothes", name: "衣服", mark: "衣", hue: 170 },
    { id: "medical", name: "医療", mark: "医", hue: 150 },
    { id: "learning", name: "学び", mark: "学", hue: 265 },
    { id: "other", name: "その他", mark: "他", hue: 220 },
  ],
  income: [
    { id: "salary", name: "給与", mark: "給", hue: 145 },
    { id: "bonus", name: "賞与", mark: "賞", hue: 40 },
    { id: "side", name: "副収入", mark: "副", hue: 180 },
    { id: "income_other", name: "その他", mark: "他", hue: 220 },
  ],
};

const BY_ID = new Map<string, Category>(
  [...CATEGORIES.expense, ...CATEGORIES.income].map((c) => [c.id, c]),
);

export function getCategory(id: string): Category {
  return BY_ID.get(id) ?? BY_ID.get("other")!;
}

/** Categories whose spending is fixed (excluded from day-of-week habits). */
export const FIXED_COST_CATEGORIES = new Set(["housing", "utilities", "phone"]);

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
    housing: 80000,
    utilities: 15000,
    phone: 8000,
    fun: 15000,
    social: 10000,
    clothes: 8000,
    medical: 5000,
    learning: 5000,
    other: 5000,
  },
  goal: { name: "旅行資金", target: 300000, saved: 0 },
  noSpendDays: [],
  lastAi: null,
};
