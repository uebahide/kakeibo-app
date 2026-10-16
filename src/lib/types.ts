import type { CategorySettings } from "./categories";
import type { TimeZone } from "./date";
import type { Currency } from "./format";
import type { Language } from "./i18n";
import type { WeekStart } from "./week";

export type TxType = "expense" | "income";

export type Transaction = {
  id: string;
  /** YYYY-MM-DD (local date) */
  date: string;
  amount: number;
  type: TxType;
  category: string;
  memo: string;
  /** an expense paid from the month's spare money (trips, events…) instead of the budget */
  outsideBudget?: boolean;
  /** "wallet" when recorded automatically from an iPhone Wallet payment */
  source?: "wallet";
  /** an automatic record whose category (or amount, for another currency) was guessed and is not confirmed yet */
  needsReview?: boolean;
  /** shared by the records one payment was split into (one per category) */
  splitId?: string;
  /** a short note on one part of a split payment (e.g. シャンプー) */
  note?: string;
  /** the receipt photo of the payment (shared by all parts of a split payment) */
  receiptId?: string;
  isSample: boolean;
  createdAt: string;
};

/** `source` is set only by automatic imports; `needsReview: false` confirms an automatic record. */
export type NewTransaction = Omit<Transaction, "id" | "createdAt" | "source">;

export type SavingsGoal = {
  /** target amount; 0 means no target */
  target: number;
  /** savings from before the app was used */
  saved: number;
  /** amount saved each month (YYYY-MM). Counted out of that month's balance. */
  monthly: Record<string, number>;
  /** fixed amount saved every month from `from` (YYYY-MM) on, for months without their own amount; 0 means off */
  fixedMonthly: { amount: number; from: string };
};

export type AiInsight = { title: string; detail: string; kind: "good" | "warn" | "info" };
export type AiAction = { title: string; detail: string; monthlySaving: number };
export type AiAnalysis = {
  score: number;
  headline: string;
  insights: AiInsight[];
  actions: AiAction[];
  cheer: string;
};

/** A recurring cost that is counted as spending every month (rent, phone, subscriptions…). */
export type FixedCost = {
  id: string;
  name: string;
  category: string;
  amount: number;
  paid: boolean;
  isSample?: boolean;
};

export type Settings = {
  /** monthly budget per variable-cost category id */
  budgets: Record<string, number>;
  /** fixed costs per month (YYYY-MM). A month without an entry inherits the latest earlier month. */
  fixedCosts: Record<string, FixedCost[]>;
  /** day of the month (1–28) each month starts on, e.g. payday */
  monthStartDay: number;
  /** day each week starts on: 1 Monday, 0 Sunday */
  weekStartDay: WeekStart;
  /** currency amounts are shown in; numbers are never converted */
  currency: Currency;
  /** time zone "today" is counted in, so the app and Claude agree on the date */
  timeZone: TimeZone;
  /** display language; null when never picked (the browser's language is used) */
  language: Language | null;
  /** the user's changes to the categories (renamed, recolored, reordered, hidden, added) */
  categories: CategorySettings;
  goal: SavingsGoal;
  /** read a receipt photo with Claude as soon as it is attached (off: only when "Read with Claude" is tapped) */
  autoReadReceipts: boolean;
  /** the period (YYYY-MM) whose suggested budget was last used or turned down; "" when never */
  budgetReviewed: string;
  /** days marked as "no spending" (YYYY-MM-DD) */
  noSpendDays: string[];
  /** latest analysis; source "claude" when Claude saved it over MCP (older entries have none) */
  lastAi: { at: string; result: AiAnalysis; source?: "app" | "claude" } | null;
};

export type ChatTurn = { role: "user" | "assistant"; content: string };
