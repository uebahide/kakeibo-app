import {
  AI_MODEL,
  DIGEST_NOTE,
  DIGEST_NOTE_EN,
  FALLBACK_BETA,
  MAX_DIGEST_BYTES,
  aiErrorResponse,
  anthropic,
  answerLanguage,
  authorizeAiRequest,
} from "@/lib/ai/server";
import type { Language } from "@/lib/i18n";
import { DICTS } from "@/lib/i18n/dict";
import { requestLanguage } from "@/lib/i18n/server";
import type { AiAnalysis } from "@/lib/types";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["score", "headline", "insights", "actions", "cheer"],
  properties: {
    score: { type: "integer", description: "家計スコア 0〜100" },
    headline: { type: "string" },
    insights: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "kind"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          kind: { type: "string", enum: ["good", "warn", "info"] },
        },
      },
    },
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "monthlySaving"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          monthlySaving: { type: "integer" },
        },
      },
    },
    cheer: { type: "string" },
  },
} as const;

const PROMPT = `あなたは日本の家計に詳しいファイナンシャルプランナーです。
次の個人の家計簿データを読み、お金の使い方の傾向と、無理なく続けられる改善策を伝えてください。
${DIGEST_NOTE}
数字は必ずデータから引用し、データにない金額を作らないでください。

返す内容:
- score: 予算の守り具合・黒字かどうか・毎月の貯金（目標があればその進み具合）から付けた 0〜100 の整数
- headline: 全体を一言で（30字以内）
- insights: 3〜5件。title は20字以内、detail は60〜100字でデータの数字を引用。kind は良い点なら good、注意点なら warn、それ以外は info
- actions: 2〜3件。具体的な行動（detail は60字以内）と、見込める月の節約額 monthlySaving（currency の単位・整数、見積もれなければ 0）
- cheer: 貯金を続ける励ましの一言（50字以内）`;

const SCHEMA_EN = {
  ...SCHEMA,
  properties: { ...SCHEMA.properties, score: { type: "integer", description: "Household budget score, 0-100" } },
} as const;

const PROMPT_EN = `You are a financial planner who knows household budgets well.
Read the following personal household budget data and explain the spending trends and improvements the person can keep up without strain.
${DIGEST_NOTE_EN}
Always quote numbers from the data, and never make up amounts that aren't in it.
Write every text field (headline, titles, details, cheer) in natural, concise English, even where the data contains Japanese.

Return:
- score: an integer 0-100 based on how well budgets are kept, whether income exceeds spending, and monthly savings (and progress toward the goal, if there is one)
- headline: the overall picture in one line (60 characters or fewer)
- insights: 3-5 items. title in 40 characters or fewer; detail in 120-200 characters, quoting numbers from the data. kind is good for strengths, warn for concerns, otherwise info
- actions: 2-3 items. A concrete action (detail in 120 characters or fewer) and the expected monthly saving monthlySaving (integer in currency units; 0 if it can't be estimated)
- cheer: one encouraging line about keeping up the savings (100 characters or fewer)`;

const PROMPTS: Record<Language, { prompt: string; schema: typeof SCHEMA | typeof SCHEMA_EN }> = {
  ja: { prompt: PROMPT, schema: SCHEMA },
  en: { prompt: PROMPT_EN, schema: SCHEMA_EN },
};

export async function POST(request: Request) {
  const denied = await authorizeAiRequest(request);
  if (denied) return denied;

  const raw = await request.text();
  if (raw.length > MAX_DIGEST_BYTES) return Response.json({ error: DICTS[requestLanguage(request)].server.tooLarge }, { status: 413 });
  let digest: unknown;
  let language: Language;
  try {
    const body = JSON.parse(raw) as { digest?: unknown; language?: unknown };
    digest = body.digest;
    language = answerLanguage(request, body);
  } catch {
    return Response.json({ error: DICTS[requestLanguage(request)].server.badRequest }, { status: 400 });
  }
  const t = DICTS[language].server;
  const { prompt, schema } = PROMPTS[language];

  try {
    const message = await anthropic().beta.messages.create({
      model: AI_MODEL,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema } },
      messages: [{ role: "user", content: `${prompt}\n\n<data>\n${JSON.stringify(digest)}\n</data>` }],
    });

    if (message.stop_reason === "refusal") {
      return Response.json({ error: t.refusedAnalysis }, { status: 422 });
    }
    const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const result = JSON.parse(text) as AiAnalysis;
    result.score = Math.max(0, Math.min(100, Math.round(result.score)));
    return Response.json({ result });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return Response.json({ error: t.unreadableResult }, { status: 502 });
    }
    return aiErrorResponse(err, language);
  }
}
