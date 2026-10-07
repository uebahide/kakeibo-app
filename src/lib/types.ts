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
  name: string;
  target: number;
  saved: number;
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

export type Settings = {
  /** monthly budget per expense category id */
  budgets: Record<string, number>;
  goal: SavingsGoal;
  /** days marked as "no spending" (YYYY-MM-DD) */
  noSpendDays: string[];
  lastAi: { at: string; result: AiAnalysis } | null;
};

export type ChatTurn = { role: "user" | "assistant"; content: string };
