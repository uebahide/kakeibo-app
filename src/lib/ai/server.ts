import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

/** Retry declined requests on Anthropic's recommended fallback model. */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  return (client ??= new Anthropic());
}

export const MAX_DIGEST_BYTES = 64 * 1024;

/**
 * Who may call the AI routes. With Supabase, only signed-in users.
 * Without it (demo mode) only in development, unless ALLOW_DEMO_AI=true,
 * so a deployed demo cannot spend the API key for strangers.
 */
export async function authorizeAiRequest(): Promise<Response | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 503 });
  }
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims) return Response.json({ error: "ログインしてください" }, { status: 401 });
    return null;
  }
  if (process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_AI === "true") return null;
  return Response.json({ error: "デモ環境ではAIを使えません" }, { status: 403 });
}

export function aiErrorResponse(err: unknown): Response {
  if (err instanceof Anthropic.RateLimitError) {
    return Response.json({ error: "混み合っています。少し時間をおいてお試しください" }, { status: 429 });
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return Response.json({ error: "APIキーが正しくありません" }, { status: 502 });
  }
  if (err instanceof Anthropic.APIError) {
    return Response.json({ error: "AIの呼び出しに失敗しました" }, { status: 502 });
  }
  console.error(err);
  return Response.json({ error: "分析できませんでした" }, { status: 500 });
}

export const DIGEST_NOTE =
  "金額はすべて円。months[0] が今月（途中）で、dayOfMonth / daysInMonth まで経過しています。";
