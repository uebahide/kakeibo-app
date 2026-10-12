export type TxType = "expense" | "income";

export type Transaction = {
  id: string;
  /** YYYY-MM-DD (local date) */
  date: string;
  amount: number;
  type: TxType;
  category: string;
  memo: string;
  isSample: boolean;
  createdAt: string;
};

export type NewTransaction = Omit<Transaction, "id" | "createdAt">;

export type SavingsGoal = {
  /** target amount; 0 means no target */
  target: number;
  /** savings from before the app was used */
  saved: number;
  /** amount saved each month (YYYY-MM). Counted out of that month's balance. */
  monthly: Record<string, number>;
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
  goal: SavingsGoal;
  /** days marked as "no spending" (YYYY-MM-DD) */
  noSpendDays: string[];
  lastAi: { at: string; result: AiAnalysis } | null;
};

export type ChatTurn = { role: "user" | "assistant"; content: string };
