import "server-only";
import type { McpServer } from "@modelcontextprotocol/server";
import { DIGEST_NOTE } from "@/lib/ai/server";
import { inCategories } from "@/lib/categories";
import { inTimeZone } from "@/lib/date";
import { inLanguage } from "@/lib/i18n";
import { buildAiDigest } from "@/lib/stats";
import { createSupabaseStore } from "@/lib/store/supabase";
import { z } from "zod";
import { accountInput as account, accountMismatch, supabaseFor } from "./auth";
import { registerReceiptTools } from "./receipts";
import { registerWeeklyTools } from "./weekly";

/**
 * Same shape as the in-app analysis (AiAnalysis), so the AI analysis screen can show it as is.
 * Texts are written in the digest's `language`; limits leave room for English, which runs about twice as long.
 */
const AnalysisSchema = z.object({
  score: z.number().int().min(0).max(100).describe("家計スコア 0〜100 / Household budget score, 0-100"),
  headline: z.string().min(1).max(120).describe("全体を一言で（30字以内）/ The overall picture in one line (60 English characters or fewer)"),
  insights: z
    .array(
      z.object({
        title: z.string().min(1).max(80).describe("20字以内 / 40 English characters or fewer"),
        detail: z.string().min(1).max(400).describe("60〜100字。データの数字を引用する / 120-200 English characters, quoting numbers from the data"),
        kind: z.enum(["good", "warn", "info"]).describe("良い点は good、注意点は warn、それ以外は info / good for strengths, warn for concerns, otherwise info"),
      }),
    )
    .min(1)
    .max(6)
    .describe("見えてきた傾向 3〜5件 / 3-5 trends"),
  actions: z
    .array(
      z.object({
        title: z.string().min(1).max(80),
        detail: z.string().min(1).max(240).describe("具体的な行動。60字以内 / A concrete action, 120 English characters or fewer"),
        monthlySaving: z
          .number()
          .int()
          .min(0)
          .describe("見込める月の節約額（currency の単位）。見積もれなければ 0 / Expected monthly saving in currency units; 0 if it can't be estimated"),
      }),
    )
    .min(1)
    .max(4)
    .describe("次の一手 2〜3件 / 2-3 next steps"),
  cheer: z.string().min(1).max(200).describe("貯金を続ける励ましの一言（50字以内）/ One encouraging line about saving (100 English characters or fewer)"),
});

export function registerTools(server: McpServer) {
  server.registerTool(
    "get_monthly_digest",
    {
      title: "家計簿の集計を取得",
      description:
        "家計簿の直近3か月の集計（収入・支出・カテゴリ別・予算・固定費・貯金）を JSON で返す。" +
        "家計の分析やアドバイスをする前に呼ぶ。1件ずつの記録ではなく合計だけを返す。" +
        DIGEST_NOTE +
        " Write the analysis and any answer in the digest's `language` (ja = Japanese, en = English).",
      inputSchema: z.object({ account }),
      annotations: { readOnlyHint: true },
    },
    async ({ account }, ctx) => {
      const mismatch = accountMismatch(ctx, account);
      if (mismatch) return { isError: true, content: [{ type: "text", text: mismatch }] };
      const { transactions, settings } = await createSupabaseStore(supabaseFor(ctx)).load();
      // The server runs in UTC; count "today" in the user's own time zone, and name categories
      // and weekdays in the user's language (Japanese until one is picked), which the digest carries,
      // with the user's own categories.
      const digest = inLanguage(settings.language ?? "ja", () =>
        inTimeZone(settings.timeZone, () => inCategories(settings.categories, () => buildAiDigest(transactions, settings))),
      );
      return { content: [{ type: "text", text: JSON.stringify(digest) }] };
    },
  );

  server.registerTool(
    "save_analysis",
    {
      title: "分析結果を家計簿に保存",
      description:
        "家計の分析結果を家計簿アプリの「AI分析」画面に保存する。前回の分析は上書きされる。" +
        "get_monthly_digest の数字にもとづいて分析してから呼ぶ。金額は currency の単位。" +
        "文章はダイジェストの language の言語で書く。" +
        " Write every text field in the digest's `language` (ja = Japanese, en = English).",
      inputSchema: AnalysisSchema.extend({ account }),
    },
    async ({ account, ...result }, ctx) => {
      const mismatch = accountMismatch(ctx, account);
      if (mismatch) return { isError: true, content: [{ type: "text", text: mismatch }] };
      const userId = ctx.http?.authInfo?.extra?.userId;
      const { error } = await supabaseFor(ctx)
        .from("user_settings")
        .upsert({
          user_id: userId,
          last_ai: { at: new Date().toISOString(), result, source: "claude" },
          updated_at: new Date().toISOString(),
        });
      if (error) return { isError: true, content: [{ type: "text", text: `保存できませんでした / Couldn't save: ${error.message}` }] };
      return { content: [{ type: "text", text: "保存しました。家計簿アプリの「AI分析」画面で見られます。/ Saved. It's shown on the AI analysis screen of the Kakeibo app." }] };
    },
  );

  registerReceiptTools(server);
  registerWeeklyTools(server);
}
