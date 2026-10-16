import "server-only";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { FALLBACK_CATEGORY, categoriesOf, getCategory, inCategories } from "@/lib/categories";
import { inTimeZone, today } from "@/lib/date";
import { formatMoney } from "@/lib/format";
import { inLanguage } from "@/lib/i18n";
import { RECEIPT_BUCKET, normalizeReading, receiptParts, type ReceiptPart, type ReceiptReading } from "@/lib/receipt";
import { groupSplits, splitParts, splitWrites } from "@/lib/split";
import { createSupabaseStore } from "@/lib/store/supabase";
import type { NewTransaction, Settings, Transaction } from "@/lib/types";
import { z } from "zod";
import { accountInput as account, accountMismatch, supabaseFor } from "./auth";

// Tools for sorting out receipts from claude.ai: Claude reads the photo itself (no API key on our side),
// and the app does the arithmetic (discounts, tax, rounding) exactly as when the receipt is read in the app.

const CONFIRM_RULE =
  "書き込む前に必ず confirm: false で呼んで内訳案を受け取り、ユーザーに見せて OK をもらってから confirm: true で呼ぶ。" +
  " Always call with confirm: false first, show the proposed parts to the user, and call with confirm: true only after they agree.";

const ITEMS_NOTE =
  "items はレシートの品目を印字順に。値引き・割引・クーポンはマイナスの金額で、その対象の品目の直後に置く。小計・合計・税・支払い・お釣り・ポイントの行は入れない。" +
  "category は list_receipts_to_sort が返すカテゴリの id。値引きは直前の品目から引き、税と端数は金額の割合で配って、内訳の合計をレシートの合計に合わせる。" +
  " List the receipt's lines in printed order; a discount is its own line with a negative amount right after its item. Leave out subtotals, totals, tax, payment, change and points." +
  " category is a category id from list_receipts_to_sort. Discounts come off the line above, and tax and rounding are shared by amount so the parts add up to the total.";

const Reading = {
  store: z.string().max(60).default("").describe("店名（印字のまま）/ Shop name as printed"),
  total: z.number().int().min(0).describe("支払った合計（税込）。読めなければ 0 / Amount paid, tax included; 0 if unreadable"),
  tax: z.number().int().min(0).default(0).describe("品目の値段に上乗せされた税（外税）。内税なら 0 / Tax added on top of the prices; 0 when prices include tax"),
  items: z
    .array(
      z.object({
        name: z.string().max(60).describe("短い品目名 / Short item name"),
        amount: z.number().int().describe("その行の金額（値引きはマイナス）/ The line's amount (negative for a discount)"),
        category: z.string().max(40).describe("カテゴリ id / Category id"),
      }),
    )
    .min(1)
    .max(100)
    .describe(ITEMS_NOTE),
  confirm: z.boolean().default(false).describe("false なら内訳案だけ返す。true で書き込む / false returns the proposal only; true writes it"),
};

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const fail = (text: string) => ({ isError: true, content: [{ type: "text" as const, text }] });

async function load(ctx: ServerContext) {
  const supabase = supabaseFor(ctx);
  const store = createSupabaseStore(supabase);
  const data = await store.load();
  return { supabase, store, ...data };
}

/** The user's expense categories (id and name), as the app shows them. */
const expenseCategories = (settings: Settings) =>
  inLanguage(settings.language ?? "ja", () => inCategories(settings.categories, () => categoriesOf("expense").map((c) => ({ id: c.id, name: c.name }))));

const nameOf = (settings: Settings, id: string) => inLanguage(settings.language ?? "ja", () => inCategories(settings.categories, () => getCategory(id).name));

function toReading(settings: Settings, input: { store: string; total: number; tax: number; items: ReceiptReading["items"] }): ReceiptReading {
  const ids = expenseCategories(settings).map((c) => c.id);
  return normalizeReading({ ...input, date: "" }, ids, FALLBACK_CATEGORY.expense)!;
}

function describeParts(settings: Settings, parts: ReceiptPart[]): string {
  const money = (n: number) => formatMoney(n, settings.currency);
  const lines = parts.map((p) => `- ${nameOf(settings, p.category)} ${money(p.amount)}${p.note ? `（${p.note}）` : ""}`);
  return `${lines.join("\n")}\n合計 / Total: ${money(parts.reduce((s, p) => s + p.amount, 0))}`;
}

async function write(store: Awaited<ReturnType<typeof load>>["store"], group: Transaction[], parts: ReceiptPart[], base: NewTransaction) {
  const { updates, adds, deletes } = splitWrites(group, parts, base);
  for (const { id, item } of updates) await store.updateTransaction(id, item);
  // One at a time, so each part gets a later creation time and the parts keep their order.
  for (const item of adds) await store.addTransactions([item]);
  for (const id of deletes) await store.deleteTransaction(id);
}

export function registerReceiptTools(server: McpServer) {
  server.registerTool(
    "list_receipts_to_sort",
    {
      title: "整理待ちのレシートを一覧",
      description:
        "家計簿アプリで写真を付けて「あとで整理する」にした記録（確認待ち）と、使えるカテゴリの一覧を返す。" +
        "レシートの整理を頼まれたら最初に呼び、記録ごとに get_receipt_photo で写真を読んで apply_receipt で内訳を書き込む。" +
        " Lists records saved with a receipt photo to sort out later, and the user's expense categories. Call it first when asked to sort out receipts," +
        " then read each photo with get_receipt_photo and write the parts with apply_receipt.",
      inputSchema: z.object({
        include_sorted: z.boolean().default(false).describe("整理済みの写真付き記録も含める / Also list records with a photo that are already sorted"),
        limit: z.number().int().min(1).max(50).default(20),
        account,
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ include_sorted, limit, account }, ctx) => {
      const mismatch = accountMismatch(ctx, account);
      if (mismatch) return fail(mismatch);
      const { transactions, settings } = await load(ctx);
      const entries = groupSplits(transactions.filter((t) => t.receiptId && (include_sorted || t.needsReview))).slice(0, limit);
      return ok(
        JSON.stringify({
          currency: settings.currency,
          language: settings.language ?? "ja",
          records: entries.map((e) => ({
            record_id: e.tx.id,
            date: e.tx.date,
            total: e.amount,
            memo: e.tx.memo,
            needs_review: e.parts.some((p) => p.needsReview),
            parts: e.parts.map((p) => ({ category: nameOf(settings, p.category), amount: p.amount, ...(p.note ? { note: p.note } : {}) })),
          })),
          categories: expenseCategories(settings),
        }),
      );
    },
  );

  server.registerTool(
    "get_receipt_photo",
    {
      title: "レシートの写真を取得",
      description:
        "記録に付いたレシートの写真を画像で返す。写真の品目と金額を読み、apply_receipt に渡す。アプリで前に読み取った結果があれば一緒に返す。" +
        " Returns the receipt photo of a record as an image to read for apply_receipt, with any earlier reading from the app.",
      inputSchema: z.object({ record_id: z.string().uuid().describe("list_receipts_to_sort の record_id"), account }),
      annotations: { readOnlyHint: true },
    },
    async ({ record_id, account }, ctx) => {
      const mismatch = accountMismatch(ctx, account);
      if (mismatch) return fail(mismatch);
      const { supabase, transactions } = await load(ctx);
      const tx = transactions.find((t) => t.id === record_id);
      if (!tx?.receiptId) return fail("写真の付いた記録が見つかりません / No record with a receipt photo has this id");
      const { data: receipt } = await supabase.from("receipts").select("path, read_result").eq("id", tx.receiptId).maybeSingle();
      if (!receipt) return fail("写真が見つかりません / The photo is missing");
      const { data: photo, error } = await supabase.storage.from(RECEIPT_BUCKET).download(receipt.path);
      if (error || !photo) return fail(`写真を読み込めませんでした / Couldn't load the photo${error ? `: ${error.message}` : ""}`);
      const parts = splitParts(transactions, tx);
      return {
        content: [
          { type: "image" as const, data: Buffer.from(await photo.arrayBuffer()).toString("base64"), mimeType: "image/jpeg" },
          {
            type: "text" as const,
            text: JSON.stringify({
              record_id,
              date: tx.date,
              total: parts.reduce((s, p) => s + p.amount, 0),
              memo: tx.memo,
              ...(receipt.read_result ? { earlier_reading: receipt.read_result } : {}),
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "apply_receipt",
    {
      title: "レシートの内訳を記録に書き込む",
      description:
        "写真付きの記録を、読んだレシートの品目からカテゴリごとの内訳に分けて確定する（確認待ちから外れる）。" +
        CONFIRM_RULE +
        " Splits a record with a receipt photo into one part per category from the receipt's lines, and confirms it.",
      inputSchema: z.object({
        record_id: z.string().uuid(),
        ...Reading,
        use_total: z
          .enum(["record", "receipt"])
          .optional()
          .describe(
            "記録の金額とレシートの合計が違うときだけ指定。record は記録の金額に合わせ、receipt はレシートの合計に直す。ユーザーに選んでもらう。" +
              " Only when the record's amount and the receipt total differ: record keeps the record's amount, receipt changes it to the receipt total. Ask the user.",
          ),
        account,
      }),
    },
    async (input, ctx) => {
      const mismatch = accountMismatch(ctx, input.account);
      if (mismatch) return fail(mismatch);
      const { supabase, store, transactions, settings } = await load(ctx);
      const tx = transactions.find((t) => t.id === input.record_id);
      if (!tx) return fail("記録が見つかりません / No record has this id");
      if (tx.type !== "expense") return fail("支出の記録だけ分けられます / Only an expense can be split");
      const group = splitParts(transactions, tx);
      const recordTotal = group.reduce((s, p) => s + p.amount, 0);
      const reading = toReading(settings, input);
      let parts = receiptParts(reading);
      if (!parts.length) return fail("品目の金額がありません / No item amounts to split");
      const receiptTotal = parts.reduce((s, p) => s + p.amount, 0);
      const money = (n: number) => formatMoney(n, settings.currency);
      if (receiptTotal !== recordTotal) {
        if (!input.use_total) {
          const ask = `記録の金額 ${money(recordTotal)} とレシートの合計 ${money(receiptTotal)} が違います。どちらにするかユーザーに聞き、use_total（record か receipt）を付けて呼び直してください。/ The record's amount and the receipt total differ; ask the user which to keep and call again with use_total.`;
          return input.confirm ? fail(ask) : ok(`${describeParts(settings, parts)}\n\n${ask}`);
        }
        if (input.use_total === "record") parts = receiptParts({ ...reading, total: recordTotal });
      }
      if (!input.confirm) {
        return ok(`内訳案 / Proposed parts（${tx.date} ${tx.memo || reading.store}）\n${describeParts(settings, parts)}\n\nユーザーに確認してから confirm: true で呼んでください。/ Check with the user, then call again with confirm: true.`);
      }
      const base: NewTransaction = {
        date: tx.date,
        amount: 0,
        type: "expense",
        category: parts[0].category,
        memo: tx.memo || reading.store,
        outsideBudget: tx.outsideBudget,
        ...(tx.receiptId ? { receiptId: tx.receiptId } : {}),
        isSample: tx.isSample,
        needsReview: false,
      };
      try {
        await write(store, group, parts, base);
      } catch (e) {
        return fail(`書き込めませんでした / Couldn't save: ${e instanceof Error ? e.message : String(e)}`);
      }
      // So reading the receipt in the app later shows the same result without reading it again.
      if (tx.receiptId) await supabase.from("receipts").update({ read_result: reading }).eq("id", tx.receiptId);
      return ok(`書き込みました。家計簿アプリの履歴で見られます。/ Saved. It's in the app's history.\n${describeParts(settings, parts)}`);
    },
  );

  server.registerTool(
    "add_record",
    {
      title: "レシートから新しい記録を作る",
      description:
        "チャットに貼られたレシートの写真を読んで、家計簿に新しい支出を記録する（品目をカテゴリごとの内訳に分ける）。写真は家計簿には保存されない。" +
        "同じ日・同じ金額の記録がすでにあれば内訳案と一緒に知らせるので、同じ支払いならそちらを apply_receipt で分けるかユーザーに聞く。" +
        CONFIRM_RULE +
        " Records a new expense from a receipt photo pasted into the chat, split into one part per category. The photo itself isn't stored." +
        " If a record with the same date and amount exists, the proposal says so; ask the user whether it is the same payment.",
      inputSchema: z.object({
        ...Reading,
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("購入日 YYYY-MM-DD。なければ今日 / Purchase date; today if left out"),
        outside_budget: z.boolean().default(false).describe("旅行やイベントなど予算外の支出 / Spending outside the budget, such as a trip"),
        account,
      }),
    },
    async (input, ctx) => {
      const mismatch = accountMismatch(ctx, input.account);
      if (mismatch) return fail(mismatch);
      const { store, transactions, settings } = await load(ctx);
      const reading = toReading(settings, input);
      const parts = receiptParts(reading);
      if (!parts.length) return fail("品目の金額がありません / No item amounts to record");
      const date = input.date ?? inTimeZone(settings.timeZone, today);
      const total = parts.reduce((s, p) => s + p.amount, 0);
      if (!input.confirm) {
        const same = groupSplits(transactions.filter((t) => t.type === "expense" && t.date === date)).filter((e) => e.amount === total);
        const note = same.length
          ? `\n\n同じ日・同じ金額の記録があります（${same.map((e) => `${e.tx.memo || nameOf(settings, e.tx.category)} record_id ${e.tx.id}`).join("、")}）。同じ支払いなら新しく作らず、その記録を apply_receipt で分けるとよいか聞いてください。/ A record with the same date and amount exists; ask whether it's the same payment.`
          : "";
        return ok(`内訳案 / Proposed parts（${date} ${reading.store}）\n${describeParts(settings, parts)}${note}\n\nユーザーに確認してから confirm: true で呼んでください。/ Check with the user, then call again with confirm: true.`);
      }
      const base: NewTransaction = {
        date,
        amount: 0,
        type: "expense",
        category: parts[0].category,
        memo: reading.store,
        outsideBudget: input.outside_budget,
        isSample: false,
      };
      try {
        await write(store, [], parts, base);
      } catch (e) {
        return fail(`書き込めませんでした / Couldn't save: ${e instanceof Error ? e.message : String(e)}`);
      }
      return ok(`記録しました。家計簿アプリの履歴で見られます。/ Recorded. It's in the app's history.\n${describeParts(settings, parts)}`);
    },
  );
}
