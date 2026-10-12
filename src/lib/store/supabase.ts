import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SETTINGS } from "../categories";
import { normalizeGoal } from "../savings";
import type { NewTransaction, Settings, Transaction } from "../types";
import type { KakeiboStore } from "./types";

type TxRow = {
  id: string;
  date: string;
  amount: number;
  type: Transaction["type"];
  category: string;
  memo: string;
  outside_budget?: boolean;
  is_sample: boolean;
  created_at: string;
};

// "*" so the app still loads before the outside_budget column (migration 0003) exists
const TX_COLUMNS = "*";

const fromRow = (r: TxRow): Transaction => ({
  id: r.id,
  date: r.date,
  amount: r.amount,
  type: r.type,
  category: r.category,
  memo: r.memo ?? "",
  outsideBudget: r.outside_budget ?? false,
  isSample: r.is_sample,
  createdAt: r.created_at,
});

const toRow = (t: NewTransaction) => ({
  date: t.date,
  amount: t.amount,
  type: t.type,
  category: t.category,
  memo: t.memo,
  // only sent when set, so normal records still save before migration 0003 is run
  ...(t.outsideBudget ? { outside_budget: true } : {}),
  is_sample: t.isSample,
});

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** Signed-in store. Row level security limits every query to the signed-in user's rows. */
export function createSupabaseStore(supabase: SupabaseClient): KakeiboStore {
  return {
    kind: "supabase",
    async load() {
      const [txRes, setRes] = await Promise.all([
        supabase.from("transactions").select(TX_COLUMNS).order("date", { ascending: false }).limit(10000),
        // "*" so the app still loads before the fixed_costs column (migration 0002) exists
        supabase.from("user_settings").select("*").maybeSingle(),
      ]);
      const rows = check(txRes) as TxRow[];
      const s = check(setRes) as {
        budgets: Settings["budgets"];
        fixed_costs?: Settings["fixedCosts"] | null;
        goal: Settings["goal"];
        no_spend_days: string[];
        last_ai: Settings["lastAi"];
      } | null;
      return {
        transactions: rows.map(fromRow),
        settings: s
          ? {
              budgets: { ...DEFAULT_SETTINGS.budgets, ...s.budgets },
              fixedCosts: s.fixed_costs ?? {},
              goal: normalizeGoal(s.goal),
              noSpendDays: s.no_spend_days ?? [],
              lastAi: s.last_ai ?? null,
            }
          : structuredClone(DEFAULT_SETTINGS),
      };
    },
    async addTransactions(items) {
      const rows = check(await supabase.from("transactions").insert(items.map(toRow)).select(TX_COLUMNS));
      return (rows as TxRow[]).map(fromRow);
    },
    async updateTransaction(id, item) {
      const row = check(
        await supabase.from("transactions").update({ ...toRow(item), outside_budget: Boolean(item.outsideBudget) }).eq("id", id).select(TX_COLUMNS).single(),
      );
      return fromRow(row as TxRow);
    },
    async deleteTransaction(id) {
      check(await supabase.from("transactions").delete().eq("id", id));
    },
    async deleteSamples() {
      check(await supabase.from("transactions").delete().eq("is_sample", true));
    },
    async saveSettings(settings) {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("ログインが切れました。もう一度ログインしてください");
      check(
        await supabase.from("user_settings").upsert({
          user_id: auth.user.id,
          budgets: settings.budgets,
          fixed_costs: settings.fixedCosts,
          goal: settings.goal,
          no_spend_days: settings.noSpendDays,
          last_ai: settings.lastAi,
          updated_at: new Date().toISOString(),
        }),
      );
    },
  };
}
