import "server-only";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { DIGEST_NOTE } from "@/lib/ai/server";
import { buildAiDigest } from "@/lib/stats";
import { createSupabaseStore } from "@/lib/store/supabase";
import { userClient } from "./auth";

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
      const digest = buildAiDigest(transactions, settings);
      return { content: [{ type: "text", text: JSON.stringify(digest) }] };
    },
  );

  // 次のツール save_analysis はここに registerTool で足す
}
