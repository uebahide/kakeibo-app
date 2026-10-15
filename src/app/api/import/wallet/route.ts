import { createClient } from "@supabase/supabase-js";
import { getCategory } from "@/lib/categories";
import { formatMoney, normalizeCurrency } from "@/lib/format";
import { inLanguage, normalizeLanguage } from "@/lib/i18n";
import { DICTS } from "@/lib/i18n/dict";
import { requestLanguage } from "@/lib/i18n/server";
import { categoryHint, readWalletPayment } from "@/lib/import/wallet";
import { isSupabaseConfigured, supabaseKey, supabaseUrl } from "@/lib/supabase/env";

type Imported = {
  duplicate: boolean;
  amount: number;
  category: string;
  needs_review: boolean;
  currency: string | null;
  language: string | null;
};

// Answers are plain text so the Shortcut can show them as a notification as they are.
const text = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

/**
 * Records a payment sent by the iPhone Shortcuts "Transaction" automation (Wallet tap to pay).
 * The import key from Settings comes as "Authorization: Bearer <key>" (or a "key" field);
 * the body is JSON: { amount, merchant, currency? }.
 */
export async function POST(request: Request) {
  let t = DICTS[requestLanguage(request)].server;
  if (!isSupabaseConfigured) return text(t.supabaseMissing, 503);

  const body = await request.json().catch(() => null);
  const key =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    (body && typeof body === "object" && typeof (body as { key?: unknown }).key === "string" ? (body as { key: string }).key.trim() : "");
  if (!key) return text(t.walletBadKey, 401);
  const payment = readWalletPayment(body);
  if (!payment) return text(t.walletBadAmount, 400);

  // No login here: the key is checked inside import_wallet_payment, which then writes as the key's owner.
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.rpc("import_wallet_payment", {
    p_key: key,
    p_amount: payment.amount,
    p_currency: payment.currency,
    p_merchant: payment.merchant,
    p_hint: categoryHint(payment.merchant),
  });
  if (error) {
    if (error.code === "28000") return text(t.walletBadKey, 401);
    if (error.code === "22023") return text(t.walletBadAmount, 400);
    console.error(error);
    return text(t.walletFailed, 500);
  }

  const r = data as Imported;
  const language = normalizeLanguage(r.language) ?? requestLanguage(request);
  t = DICTS[language].server;
  if (r.duplicate) return text(t.walletDuplicate);
  const userCurrency = normalizeCurrency(r.currency);
  if (payment.currency && payment.currency !== userCurrency) {
    return text(t.walletForeign(`${payment.currency} ${payment.amount}`));
  }
  const amount = formatMoney(r.amount, userCurrency);
  const category = inLanguage(language, () => getCategory(r.category).name);
  return text(r.needs_review ? t.walletReview(amount, category) : t.walletRecorded(amount, category));
}
