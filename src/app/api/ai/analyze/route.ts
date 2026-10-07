import { AI_MODEL, DIGEST_NOTE, FALLBACK_BETA, MAX_DIGEST_BYTES, aiErrorResponse, anthropic, authorizeAiRequest } from "@/lib/ai/server";
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
- score: 予算の守り具合・黒字かどうか・貯金目標の進み具合から付けた 0〜100 の整数
- headline: 全体を一言で（30字以内）
- insights: 3〜5件。title は20字以内、detail は60〜100字でデータの数字を引用。kind は良い点なら good、注意点なら warn、それ以外は info
- actions: 2〜3件。具体的な行動（detail は60字以内）と、見込める月の節約額 monthlySaving（円・整数、見積もれなければ 0）
- cheer: 貯金目標に向けた励ましの一言（50字以内）`;

export async function POST(request: Request) {
  const denied = await authorizeAiRequest();
  if (denied) return denied;

  const body = await request.text();
  if (body.length > MAX_DIGEST_BYTES) return Response.json({ error: "データが大きすぎます" }, { status: 413 });
  let digest: unknown;
  try {
    digest = JSON.parse(body).digest;
  } catch {
    return Response.json({ error: "リクエストの形式が正しくありません" }, { status: 400 });
  }

  try {
    const message = await anthropic().beta.messages.create({
      model: AI_MODEL,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: `${PROMPT}\n\n<data>\n${JSON.stringify(digest)}\n</data>` }],
    });

    if (message.stop_reason === "refusal") {
      return Response.json({ error: "この内容は分析できませんでした" }, { status: 422 });
    }
    const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const result = JSON.parse(text) as AiAnalysis;
    result.score = Math.max(0, Math.min(100, Math.round(result.score)));
    return Response.json({ result });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return Response.json({ error: "結果を読み取れませんでした。もう一度お試しください" }, { status: 502 });
    }
    return aiErrorResponse(err);
  }
}
