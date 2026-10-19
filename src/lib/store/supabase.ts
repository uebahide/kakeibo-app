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
import type { TrashEntry } from "../trash";
import type { NewTransaction, Settings, Transaction } from "../types";
import { WEEKLY_REVIEWS, type WeeklyReview } from "../weeklyReview";
import { OfflineError } from "./offline";
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
/** Records asked for per request; the API may return fewer (its own row limit), which the next page picks up. */
const PAGE_SIZE = 1000;

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

function check<T>(res: { data: T; error: { message: string } | null; status?: number }): T {
  // status 0: the request never got an answer (no signal)
  if (res.error) throw res.status === 0 ? new OfflineError(res.error.message) : new Error(res.error.message);
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
  // And the auto_read_receipts column (migration 0013).
  let hasAutoReadColumn = false;
  let hasBudgetReviewedColumn = false;
  // And the language column (migration 0007): null until known (no settings row was loaded yet).
  // Without the column the language is never sent and the choice lives only in this browser's
  // cookie, so picking a language can't break saving.
  let hasLanguageColumn: boolean | null = null;
  // And the deleted_records table (migration 0015): false once a query on it fails.
  let hasTrashTable = true;
  // Claude saves analyses straight to last_ai over MCP. Only send last_ai when the app itself
  // changed it, so saving some other setting never overwrites a newer analysis with a stale copy.
  let loadedLastAi: Settings["lastAi"] = null;
  /** Puts records back with their own ids and creation times. */
  async function restoreTransactions(items: Transaction[]): Promise<Transaction[]> {
    const rows = items.map((t) => ({
      // needs_review only when set, so a restore works before migration 0008 like a normal save
      ...toRow({ ...t, needsReview: t.needsReview || undefined }),
      ...(t.source ? { source: t.source } : {}),
      id: t.id,
      created_at: t.createdAt,
    }));
    return (check(await supabase.from("transactions").insert(rows).select(TX_COLUMNS)) as TxRow[]).map(fromRow);
  }

  /**
   * Every record, newest first. The API returns at most a set number of rows per request (1000 by
   * default), so read page after page until one comes back empty. Each page starts after the last
   * record read (not at an offset), so a record added or deleted meanwhile (a Wallet payment) can't
   * shift the pages and repeat or skip one.
   */
  async function loadAllTransactions(): Promise<TxRow[]> {
    const rows: TxRow[] = [];
    for (;;) {
      const last = rows.at(-1);
      let query = supabase
        .from("transactions")
        .select(TX_COLUMNS)
        // id breaks ties so the order is the same on every request
        .order("date", { ascending: false })
        .order("id");
      if (last) query = query.or(`date.lt.${last.date},and(date.eq.${last.date},id.gt.${last.id})`);
      const page = check(await query.limit(PAGE_SIZE)) as TxRow[];
      if (!page.length) return rows;
      rows.push(...page);
    }
  }

  return {
    kind: "supabase",
    async load() {
      const [rows, setRes] = await Promise.all([
        loadAllTransactions(),
        // "*" so the app still loads before the fixed_costs column (migration 0002) exists
        supabase.from("user_settings").select("*").maybeSingle(),
      ]);
      hasSplitColumn = rows.some((r) => "split_id" in r);
      hasReceiptColumn = rows.some((r) => "receipt_id" in r);
      hasStartDayColumn = Boolean(setRes.data && "month_start_day" in setRes.data);
      hasCurrencyColumn = Boolean(setRes.data && "currency" in setRes.data);
      hasTimeZoneColumn = Boolean(setRes.data && "time_zone" in setRes.data);
      hasWeekStartColumn = Boolean(setRes.data && "week_start_day" in setRes.data);
      hasCategoriesColumn = Boolean(setRes.data && "categories" in setRes.data);
      hasAutoReadColumn = Boolean(setRes.data && "auto_read_receipts" in setRes.data);
      hasBudgetReviewedColumn = Boolean(setRes.data && "budget_reviewed" in setRes.data);
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
        auto_read_receipts?: boolean | null;
        budget_reviewed?: string | null;
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
              autoReadReceipts: Boolean(s.auto_read_receipts),
              budgetReviewed: s.budget_reviewed ?? "",
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
    restoreTransactions,
    async trashTransactions(items) {
      const ids = items.map((t) => t.id);
      let entry: TrashEntry | null = null;
      if (hasTrashTable) {
        const res = await supabase.from("deleted_records").insert({ records: items }).select("id, deleted_at").single();
        if (res.error) hasTrashTable = false;
        else entry = { id: res.data.id, deletedAt: res.data.deleted_at, records: items };
      }
      const del = await supabase.from("transactions").delete().in("id", ids);
      if (del.error) {
        if (entry) await supabase.from("deleted_records").delete().eq("id", entry.id);
        throw new Error(del.error.message);
      }
      return entry;
    },
    async loadTrash() {
      if (!hasTrashTable) return [];
      const res = await supabase.from("deleted_records").select("id, deleted_at, records").order("deleted_at", { ascending: false });
      if (res.error) {
        // before migration 0015
        hasTrashTable = false;
        return [];
      }
      return (res.data as { id: string; deleted_at: string; records: Transaction[] }[]).map((r) => ({ id: r.id, deletedAt: r.deleted_at, records: r.records }));
    },
    async restoreTrash(entry) {
      // records already back (a restore whose second step failed) are left as they are
      const ids = entry.records.map((t) => t.id);
      const existing = check(await supabase.from("transactions").select("id").in("id", ids)) as { id: string }[];
      const known = new Set(existing.map((r) => r.id));
      const missing = entry.records.filter((t) => !known.has(t.id));
      const restored = missing.length ? await restoreTransactions(missing) : [];
      check(await supabase.from("deleted_records").delete().eq("id", entry.id));
      return restored;
    },
    async accountId() {
      // the session kept in this browser; called right after a load got through, so it is fresh
      const { data } = await supabase.auth.getSession();
      return data.session?.user.id ?? null;
    },
    async sendQueued(items) {
      // a record whose earlier send got through without an answer is already there
      const ids = items.map((t) => t.id);
      const existing = check(await supabase.from("transactions").select(TX_COLUMNS).in("id", ids)) as TxRow[];
      const known = new Set(existing.map((r) => r.id));
      const missing = items.filter((t) => !known.has(t.id));
      return [...existing.map(fromRow), ...(missing.length ? await restoreTransactions(missing) : [])];
    },
    async dropTrash(id) {
      check(await supabase.from("deleted_records").delete().eq("id", id));
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
        ...(hasAutoReadColumn || settings.autoReadReceipts ? { auto_read_receipts: settings.autoReadReceipts } : {}),
        ...(hasBudgetReviewedColumn || settings.budgetReviewed ? { budget_reviewed: settings.budgetReviewed || null } : {}),
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
    async loadWeeklyReviews() {
      const res = await supabase.from("weekly_reviews").select("review").order("week_start", { ascending: false }).limit(WEEKLY_REVIEWS);
      // before migration 0016
      if (res.error) return [];
      return (res.data as { review: WeeklyReview }[]).map((r) => r.review);
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
