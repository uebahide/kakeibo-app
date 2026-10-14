import "server-only";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { DIGEST_NOTE } from "@/lib/ai/server";
import { inTimeZone } from "@/lib/date";
import { buildAiDigest } from "@/lib/stats";
import { createSupabaseStore } from "@/lib/store/supabase";
import { z } from "zod";
import { userClient } from "./auth";

/** Same shape as the in-app analysis (AiAnalysis), so the AI分析 screen can show it as is. */
const AnalysisSchema = z.object({
  score: z.number().int().min(0).max(100).describe("家計スコア 0〜100"),
  headline: z.string().min(1).max(60).describe("全体を一言で（30字以内）"),
  insights: z
    .array(
      z.object({
        title: z.string().min(1).max(40).describe("20字以内"),
        detail: z.string().min(1).max(200).describe("60〜100字。データの数字を引用する"),
        kind: z.enum(["good", "warn", "info"]).describe("良い点は good、注意点は warn、それ以外は info"),
      }),
    )
    .min(1)
    .max(6)
    .describe("見えてきた傾向 3〜5件"),
  actions: z
    .array(
      z.object({
        title: z.string().min(1).max(40),
        detail: z.string().min(1).max(120).describe("具体的な行動。60字以内"),
        monthlySaving: z.number().int().min(0).describe("見込める月の節約額（currency の単位）。見積もれなければ 0"),
      }),
    )
    .min(1)
    .max(4)
    .describe("次の一手 2〜3件"),
  cheer: z.string().min(1).max(100).describe("貯金を続ける励ましの一言（50字以内）"),
});

/** The signed-in user's Supabase client, from the token withMcpAuth checked. */
function supabaseFor(ctx: ServerContext) {
  const token = ctx.http?.authInfo?.token;
  if (!token) throw new Error("ログインしていません");
  return userClient(token);
}

export function registerTools(server: McpServer) {
  server.registerTool(
    "get_monthly_digest",
    {
      title: "家計簿の集計を取得",
      description:
        "家計簿の直近3か月の集計（収入・支出・カテゴリ別・予算・固定費・貯金）を JSON で返す。" +
        "家計の分析やアドバイスをする前に呼ぶ。1件ずつの記録ではなく合計だけを返す。" +
        DIGEST_NOTE,
      annotations: { readOnlyHint: true },
    },
    async (ctx) => {
      const { transactions, settings } = await createSupabaseStore(supabaseFor(ctx)).load();
      // The server runs in UTC; count "today" in the user's own time zone.
      const digest = inTimeZone(settings.timeZone, () => buildAiDigest(transactions, settings));
      return { content: [{ type: "text", text: JSON.stringify(digest) }] };
    },
  );

  server.registerTool(
    "save_analysis",
    {
      title: "分析結果を家計簿に保存",
      description:
        "家計の分析結果を家計簿アプリの「AI分析」画面に保存する。前回の分析は上書きされる。" +
        "get_monthly_digest の数字にもとづいて分析してから呼ぶ。金額は currency の単位。",
      inputSchema: AnalysisSchema,
    },
    async (result, ctx) => {
      const userId = ctx.http?.authInfo?.extra?.userId;
      const { error } = await supabaseFor(ctx)
        .from("user_settings")
        .upsert({
          user_id: userId,
          last_ai: { at: new Date().toISOString(), result, source: "claude" },
          updated_at: new Date().toISOString(),
        });
      if (error) return { isError: true, content: [{ type: "text", text: `保存できませんでした: ${error.message}` }] };
      return { content: [{ type: "text", text: "保存しました。家計簿アプリの「AI分析」画面で見られます。" }] };
    },
  );
}
