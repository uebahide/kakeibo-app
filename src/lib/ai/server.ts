import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { normalizeLanguage, type Language } from "@/lib/i18n";
import { DICTS } from "@/lib/i18n/dict";
import { requestLanguage } from "@/lib/i18n/server";
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
export async function authorizeAiRequest(request: Request): Promise<Response | null> {
  const t = DICTS[requestLanguage(request)].server;
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: t.noApiKey }, { status: 503 });
  }
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims) return Response.json({ error: t.signInRequired }, { status: 401 });
    return null;
  }
  if (process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_AI === "true") return null;
  return Response.json({ error: t.demoNoAi }, { status: 403 });
}

export function aiErrorResponse(err: unknown, language: Language): Response {
  const t = DICTS[language].server;
  if (err instanceof Anthropic.RateLimitError) {
    return Response.json({ error: t.rateLimited }, { status: 429 });
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return Response.json({ error: t.badApiKey }, { status: 502 });
  }
  if (err instanceof Anthropic.APIError) {
    return Response.json({ error: t.aiFailed }, { status: 502 });
  }
  console.error(err);
  return Response.json({ error: t.analyzeFailed }, { status: 500 });
}

/**
 * The language an AI request should answer in: what the client sent (its display language),
 * else the digest's own `language`, else the request's cookie / Accept-Language.
 */
export function answerLanguage(request: Request, body: { language?: unknown; digest?: unknown } | null): Language {
  const digest = body?.digest;
  return (
    normalizeLanguage(body?.language) ??
    normalizeLanguage(digest && typeof digest === "object" ? (digest as { language?: unknown }).language : null) ??
    requestLanguage(request)
  );
}

export const DIGEST_NOTE =
  "金額の単位は currency（JPY＝円、HUF＝ハンガリー・フォリント）。1か月は毎月 monthStartDay 日に始まります（給料日に合わせた区切り）。months[0] が今月（途中）で、dayOfMonth / daysInMonth 日まで経過しています。savings はその月に貯金に回した額で、収支から差し引いています。expense は変動費・固定費（毎月自動で計上）・予算外の支出の合計です。予算は変動費だけに設定しています。outsideBudgetExpense は旅行やイベントなど予算外として記録した支出で、予算ではなく余ったお金から出しています。thisWeek は今週（start〜end）の変動費で、allowance は今週使える額、spent は使った額、left は残りです。language は表示言語（ja＝日本語、en＝英語）で、カテゴリ名や曜日もその言語です。文章は language の言語で書いてください。";

/** DIGEST_NOTE for prompts written in English. */
export const DIGEST_NOTE_EN =
  "Amounts are in `currency` (JPY = Japanese yen, HUF = Hungarian forint). Each month starts on day `monthStartDay` (aligned with payday). months[0] is the current month (in progress); `dayOfMonth` of `daysInMonth` days have passed. `savings` is the amount set aside as savings that month and is subtracted from the balance. `expense` is the total of variable costs, fixed costs (recorded automatically every month) and outside-budget spending. Budgets apply to variable costs only. `outsideBudgetExpense` is spending recorded as outside the budget, such as trips or events, paid from leftover money rather than the budget. `thisWeek` covers the current week (`start` to `end`): `allowance` is its share of the variable budget, `spent` what was spent and `left` what remains. Category and weekday names are in the digest's `language` (ja = Japanese, en = English); write in that language.";
