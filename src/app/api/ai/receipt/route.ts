import { AI_MODEL, FALLBACK_BETA, aiErrorResponse, anthropic, answerLanguage, authorizeAiRequest } from "@/lib/ai/server";
import type { Language } from "@/lib/i18n";
import { DICTS } from "@/lib/i18n/dict";
import { requestLanguage } from "@/lib/i18n/server";
import { RECEIPT_BUCKET, normalizeReading } from "@/lib/receipt";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["store", "date", "total", "tax", "items"],
  properties: {
    store: { type: "string" },
    date: { type: "string", description: "YYYY-MM-DD, or empty" },
    total: { type: "integer" },
    tax: { type: "integer" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "amount", "category"],
        properties: {
          name: { type: "string" },
          amount: { type: "integer" },
          category: { type: "string" },
        },
      },
    },
  },
} as const;

const prompt = (categories: { id: string; name: string }[]) => `This is a photo of a shop receipt. Read it for a household budget app.

Return:
- store: the shop name as printed (empty if none)
- date: the purchase date as YYYY-MM-DD (empty if it can't be read)
- total: the amount paid, tax included, as a whole number (0 if it can't be read)
- tax: tax added on top of the item prices (外税), as a whole number; 0 when the prices already include tax (内税)
- items: every purchased line in printed order, with
  - name: a short, readable item name in the receipt's own language (e.g. 牛乳, シャンプー)
  - amount: the line's price as a whole number (quantity × unit price when both are printed)
  - category: the id of the category it belongs to, chosen from the list below
  A discount (値引, 割引, クーポン) is its own line with a negative amount, right after the item it applies to.
  Leave out subtotals, totals, tax lines, payment, change, points and card details.

If the photo isn't a receipt or nothing can be read, return empty items and total 0. Never make up items or amounts.

Categories (id: name):
${categories.map((c) => `${c.id}: ${c.name}`).join("\n")}`;

type Body = { receiptId?: unknown; categories?: unknown; fallback?: unknown; language?: unknown; again?: unknown };

export async function POST(request: Request) {
  const denied = await authorizeAiRequest(request);
  if (denied) return denied;
  const tReq = DICTS[requestLanguage(request)].server;
  if (!isSupabaseConfigured) return Response.json({ error: tReq.supabaseMissing }, { status: 503 });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: tReq.badRequest }, { status: 400 });
  }
  const language: Language = answerLanguage(request, body);
  const t = DICTS[language].server;
  const categories = Array.isArray(body.categories)
    ? body.categories
        .flatMap((c) => (c && typeof c.id === "string" && typeof c.name === "string" ? [{ id: c.id.slice(0, 40), name: c.name.slice(0, 40) }] : []))
        .slice(0, 60)
    : [];
  const fallback = typeof body.fallback === "string" ? body.fallback : "other";
  if (typeof body.receiptId !== "string" || !categories.length) return Response.json({ error: t.badRequest }, { status: 400 });
  const ids = categories.map((c) => c.id);

  // Row level security: only the signed-in user's own receipt is found.
  const supabase = await createClient();
  const { data: receipt } = await supabase.from("receipts").select("path, read_result").eq("id", body.receiptId).maybeSingle();
  if (!receipt) return Response.json({ error: t.receiptNotFound }, { status: 404 });
  if (receipt.read_result && body.again !== true) {
    const saved = normalizeReading(receipt.read_result, ids, fallback);
    if (saved) return Response.json({ result: saved });
  }
  const { data: photo, error: downloadError } = await supabase.storage.from(RECEIPT_BUCKET).download(receipt.path);
  if (downloadError || !photo) return Response.json({ error: t.receiptNotFound }, { status: 404 });

  try {
    const message = await anthropic().beta.messages.create({
      model: AI_MODEL,
      max_tokens: 8000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: Buffer.from(await photo.arrayBuffer()).toString("base64") } },
            { type: "text", text: prompt(categories) },
          ],
        },
      ],
    });
    if (message.stop_reason === "refusal") return Response.json({ error: t.receiptUnreadable }, { status: 422 });
    const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const result = normalizeReading(JSON.parse(text), ids, fallback);
    if (!result || !result.items.length) return Response.json({ error: t.receiptUnreadable }, { status: 422 });
    // Kept so opening the receipt again doesn't read it twice; a failed save only costs a re-read later.
    await supabase.from("receipts").update({ read_result: result }).eq("id", body.receiptId);
    return Response.json({ result });
  } catch (err) {
    if (err instanceof SyntaxError) return Response.json({ error: t.unreadableResult }, { status: 502 });
    return aiErrorResponse(err, language);
  }
}
