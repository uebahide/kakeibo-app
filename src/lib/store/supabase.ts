import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SETTINGS, isDefaultCategories, normalizeCategories } from "../categories";
import { normalizeTimeZone } from "../date";
import { normalizeCurrency } from "../format";
import { normalizeLanguage } from "../i18n";
import { dict } from "../i18n/dict";
import { clampStartDay } from "../period";
import { RECEIPT_BUCKET } from "../receipt";
import { normalizeGoal } from "../savings";
import { normalizeWeekStart } from "../week";
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
  source?: string | null;
  needs_review?: boolean;
  split_id?: string | null;
  note?: string | null;
  receipt_id?: string | null;
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
  ...(r.source === "wallet" ? { source: "wallet" as const } : {}),
  needsReview: r.needs_review ?? false,
  ...(r.split_id ? { splitId: r.split_id } : {}),
  ...(r.note ? { note: r.note } : {}),
  ...(r.receipt_id ? { receiptId: r.receipt_id } : {}),
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
  // only set when confirming an automatic record, which exists only once migration 0008 is run
  ...(t.needsReview !== undefined ? { needs_review: t.needsReview } : {}),
  // only sent for split payments, which need migration 0011
  ...(t.splitId ? { split_id: t.splitId } : {}),
  ...(t.note ? { note: t.note } : {}),
  // only sent with a receipt photo, which needs migration 0012
  ...(t.receiptId ? { receipt_id: t.receiptId } : {}),
  is_sample: t.isSample,
});

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** Signed-in store. Row level security limits every query to the signed-in user's rows. */
export function createSupabaseStore(supabase: SupabaseClient): KakeiboStore {
  // Before migration 0004 the month_start_day column is missing; only send it once it exists or is needed.
  let hasStartDayColumn = false;
  // Same for the currency column (migration 0005).
  let hasCurrencyColumn = false;
  // And the time_zone column (migration 0006).
  let hasTimeZoneColumn = false;
  // And the week_start_day column (migration 0009).
  let hasWeekStartColumn = false;
  // And the split_id and note columns (migration 0011), seen on any loaded record.
  let hasSplitColumn = false;
  // And the receipt_id column (migration 0012).
  let hasReceiptColumn = false;
  // And the categories column (migration 0010).
  let hasCategoriesColumn = false;
  // And the language column (migration 0007): null until known (no settings row was loaded yet).
  // Without the column the language is never sent and the choice lives only in this browser's
  // cookie, so picking a language can't break saving.
  let hasLanguageColumn: boolean | null = null;
  // Claude saves analyses straight to last_ai over MCP. Only send last_ai when the app itself
  // changed it, so saving some other setting never overwrites a newer analysis with a stale copy.
  let loadedLastAi: Settings["lastAi"] = null;
  return {
    kind: "supabase",
    async load() {
      const [txRes, setRes] = await Promise.all([
        supabase.from("transactions").select(TX_COLUMNS).order("date", { ascending: false }).limit(10000),
        // "*" so the app still loads before the fixed_costs column (migration 0002) exists
        supabase.from("user_settings").select("*").maybeSingle(),
      ]);
      const rows = check(txRes) as TxRow[];
      hasSplitColumn = rows.some((r) => "split_id" in r);
      hasReceiptColumn = rows.some((r) => "receipt_id" in r);
      hasStartDayColumn = Boolean(setRes.data && "month_start_day" in setRes.data);
      hasCurrencyColumn = Boolean(setRes.data && "currency" in setRes.data);
      hasTimeZoneColumn = Boolean(setRes.data && "time_zone" in setRes.data);
      hasWeekStartColumn = Boolean(setRes.data && "week_start_day" in setRes.data);
      hasCategoriesColumn = Boolean(setRes.data && "categories" in setRes.data);
      hasLanguageColumn = setRes.data ? "language" in setRes.data : null;
      const s = check(setRes) as {
        budgets: Settings["budgets"];
        fixed_costs?: Settings["fixedCosts"] | null;
        month_start_day?: number | null;
        currency?: string | null;
        time_zone?: string | null;
        week_start_day?: number | null;
        categories?: unknown;
        language?: string | null;
        goal: Settings["goal"];
        no_spend_days: string[];
        last_ai: Settings["lastAi"];
      } | null;
      loadedLastAi = s?.last_ai ?? null;
      return {
        transactions: rows.map(fromRow),
        settings: s
          ? {
              budgets: { ...DEFAULT_SETTINGS.budgets, ...s.budgets },
              fixedCosts: s.fixed_costs ?? {},
              monthStartDay: clampStartDay(s.month_start_day),
              currency: normalizeCurrency(s.currency),
              timeZone: normalizeTimeZone(s.time_zone, s.currency),
              weekStartDay: normalizeWeekStart(s.week_start_day),
              language: normalizeLanguage(s.language),
              categories: normalizeCategories(s.categories),
              goal: normalizeGoal(s.goal),
              noSpendDays: s.no_spend_days ?? [],
              lastAi: s.last_ai ?? null,
            }
          : structuredClone(DEFAULT_SETTINGS),
      };
    },
    async addTransactions(items) {
      const rows = check(await supabase.from("transactions").insert(items.map(toRow)).select(TX_COLUMNS));
      if ((rows as TxRow[]).some((r) => "receipt_id" in r)) hasReceiptColumn = true;
      return (rows as TxRow[]).map(fromRow);
    },
    async updateTransaction(id, item) {
      const row = check(
        await supabase
          .from("transactions")
          .update({ ...toRow(item), outside_budget: Boolean(item.outsideBudget), ...(hasSplitColumn || item.splitId ? { split_id: item.splitId ?? null, note: item.note ?? null } : {}), ...(hasReceiptColumn || item.receiptId ? { receipt_id: item.receiptId ?? null } : {}) }).eq("id", id).select(TX_COLUMNS).single(),
      );
      return fromRow(row as TxRow);
    },
    async loadNewTransactions(since) {
      const rows = check(await supabase.from("transactions").select(TX_COLUMNS).gt("created_at", since).order("created_at"));
      return (rows as TxRow[]).map(fromRow);
    },
    async deleteTransaction(id) {
      check(await supabase.from("transactions").delete().eq("id", id));
    },
    async deleteSamples() {
      check(await supabase.from("transactions").delete().eq("is_sample", true));
    },
    async moveCategory(from, to) {
      check(await supabase.from("transactions").update({ category: to }).eq("category", from));
    },
    async saveSettings(settings) {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error(dict().common.sessionExpired);
      const row: Record<string, unknown> = {
        user_id: auth.user.id,
        budgets: settings.budgets,
        fixed_costs: settings.fixedCosts,
        ...(hasStartDayColumn || settings.monthStartDay !== 1 ? { month_start_day: settings.monthStartDay } : {}),
        ...(hasCurrencyColumn || settings.currency !== "JPY" ? { currency: settings.currency } : {}),
        ...(hasTimeZoneColumn || settings.timeZone !== normalizeTimeZone(null, settings.currency)
          ? { time_zone: settings.timeZone }
          : {}),
        ...(hasWeekStartColumn || settings.weekStartDay !== 1 ? { week_start_day: settings.weekStartDay } : {}),
        ...(hasCategoriesColumn || !isDefaultCategories(settings.categories) ? { categories: settings.categories } : {}),
        goal: settings.goal,
        no_spend_days: settings.noSpendDays,
        ...(settings.lastAi !== loadedLastAi ? { last_ai: settings.lastAi } : {}),
        updated_at: new Date().toISOString(),
      };
      const withLanguage = hasLanguageColumn === true || (hasLanguageColumn === null && settings.language !== null);
      let res = await supabase.from("user_settings").upsert(withLanguage ? { ...row, language: settings.language } : row);
      if (res.error && withLanguage && hasLanguageColumn === null && res.error.message.includes("language")) {
        // A new user's first save before migration 0007: save the rest, and keep the language in the cookie.
        hasLanguageColumn = false;
        res = await supabase.from("user_settings").upsert(row);
      } else if (!res.error && withLanguage) {
        hasLanguageColumn = true;
      }
      check(res);
      loadedLastAi = settings.lastAi;
    },
    receipts: {
      async upload(photo) {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) throw new Error(dict().common.sessionExpired);
        const id = crypto.randomUUID();
        const path = `${auth.user.id}/${id}.jpg`;
        check(await supabase.storage.from(RECEIPT_BUCKET).upload(path, photo, { contentType: "image/jpeg" }));
        const res = await supabase.from("receipts").insert({ id, path });
        if (res.error) {
          await supabase.storage.from(RECEIPT_BUCKET).remove([path]);
          throw new Error(res.error.message);
        }
        return id;
      },
      async photoUrl(id) {
        const row = check(await supabase.from("receipts").select("path").eq("id", id).single()) as { path: string };
        const signed = check(await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(row.path, 60 * 60));
        if (!signed) throw new Error("no signed url");
        return signed.signedUrl;
      },
      async remove(id) {
        const row = check(await supabase.from("receipts").select("path").eq("id", id).maybeSingle()) as { path: string } | null;
        if (!row) return;
        check(await supabase.storage.from(RECEIPT_BUCKET).remove([row.path]));
        check(await supabase.from("receipts").delete().eq("id", id));
      },
    },
    async loadLastAi() {
      const row = check(await supabase.from("user_settings").select("last_ai").maybeSingle()) as {
        last_ai: Settings["lastAi"];
      } | null;
      loadedLastAi = row?.last_ai ?? null;
      return loadedLastAi;
    },
  };
}
