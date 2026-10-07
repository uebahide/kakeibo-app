import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL, DIGEST_NOTE, FALLBACK_BETA, MAX_DIGEST_BYTES, aiErrorResponse, anthropic, authorizeAiRequest } from "@/lib/ai/server";
import type { ChatTurn } from "@/lib/types";

const SYSTEM = `あなたは家計の相談相手です。ユーザーの家計簿データを踏まえて、日本語で簡潔に答えてください。
目安は200字程度。箇条書きは「・」を使い、Markdownの記号（#、**など）は使わないでください。
${DIGEST_NOTE}
データにない数字は作らず、わからないことはそう伝えてください。`;

const MAX_TURNS = 12;

export async function POST(request: Request) {
  const denied = await authorizeAiRequest();
  if (denied) return denied;

  const raw = await request.text();
  if (raw.length > MAX_DIGEST_BYTES * 2) return Response.json({ error: "データが大きすぎます" }, { status: 413 });
  let digest: unknown;
  let turns: ChatTurn[];
  try {
    const body = JSON.parse(raw) as { digest: unknown; turns: ChatTurn[] };
    digest = body.digest;
    turns = body.turns
      .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.trim())
      .slice(-MAX_TURNS);
    while (turns.length && turns[0].role !== "user") turns.shift();
    if (!turns.length || turns[turns.length - 1].role !== "user") throw new Error("last turn must be the user");
  } catch {
    return Response.json({ error: "リクエストの形式が正しくありません" }, { status: 400 });
  }

  const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((t) => ({ role: t.role, content: t.content }));
  // The household data rides along with the first question so the system prompt stays cacheable.
  messages[0] = { role: "user", content: `<data>\n${JSON.stringify(digest)}\n</data>\n\n${turns[0].content}` };

  let stream: ReturnType<ReturnType<typeof anthropic>["beta"]["messages"]["stream"]>;
  try {
    stream = anthropic().beta.messages.stream({
      model: AI_MODEL,
      max_tokens: 8000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: SYSTEM,
      messages,
    });
  } catch (err) {
    return aiErrorResponse(err);
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") controller.enqueue(encoder.encode("\n（この質問にはお答えできませんでした）"));
      } catch {
        controller.enqueue(encoder.encode("\n（回答の途中で問題が起きました。もう一度お試しください）"));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
