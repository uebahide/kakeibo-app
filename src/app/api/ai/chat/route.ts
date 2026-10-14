import Anthropic from "@anthropic-ai/sdk";
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
import type { ChatTurn } from "@/lib/types";

const SYSTEM = `あなたは家計の相談相手です。ユーザーの家計簿データを踏まえて、日本語で簡潔に答えてください。
目安は200字程度。箇条書きは「・」を使い、Markdownの記号（#、**など）は使わないでください。
${DIGEST_NOTE}
データにない数字は作らず、わからないことはそう伝えてください。`;

const SYSTEM_EN = `You are someone the user talks to about their household finances. Answer briefly in English, based on the user's household budget data.
Aim for about 100 words. For lists, start lines with "- ", and don't use other Markdown symbols (#, ** etc.).
${DIGEST_NOTE_EN}
Always answer in English, even if the data contains Japanese.
Don't make up numbers that aren't in the data, and say so when you don't know.`;

const SYSTEMS: Record<Language, string> = { ja: SYSTEM, en: SYSTEM_EN };

const MAX_TURNS = 12;

export async function POST(request: Request) {
  const denied = await authorizeAiRequest(request);
  if (denied) return denied;

  const raw = await request.text();
  if (raw.length > MAX_DIGEST_BYTES * 2) return Response.json({ error: DICTS[requestLanguage(request)].server.tooLarge }, { status: 413 });
  let digest: unknown;
  let turns: ChatTurn[];
  let language: Language;
  try {
    const body = JSON.parse(raw) as { digest: unknown; turns: ChatTurn[]; language?: unknown };
    digest = body.digest;
    language = answerLanguage(request, body);
    turns = body.turns
      .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.trim())
      .slice(-MAX_TURNS);
    while (turns.length && turns[0].role !== "user") turns.shift();
    if (!turns.length || turns[turns.length - 1].role !== "user") throw new Error("last turn must be the user");
  } catch {
    return Response.json({ error: DICTS[requestLanguage(request)].server.badRequest }, { status: 400 });
  }
  const t = DICTS[language].server;

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
      system: SYSTEMS[language],
      messages,
    });
  } catch (err) {
    return aiErrorResponse(err, language);
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
        if (final.stop_reason === "refusal") controller.enqueue(encoder.encode(t.refusedChat));
      } catch {
        controller.enqueue(encoder.encode(t.chatInterrupted));
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
