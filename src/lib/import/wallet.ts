/**
 * Reading what the iPhone Shortcuts "Transaction" automation sends for a Wallet payment.
 * Shortcuts writes the amount as text in the phone's own format, e.g. "Ft2,500.00",
 * "2 500,00 Ft", "¥1,200" or "€12.50", so both the number and the currency are read from it.
 */

const CURRENCY_SIGNS: [RegExp, string][] = [
  [/¥|￥|円|\bJPY\b/i, "JPY"],
  [/Ft|\bHUF\b/i, "HUF"],
  [/€|\bEUR\b/i, "EUR"],
  [/£|\bGBP\b/i, "GBP"],
  [/\bCHF\b/i, "CHF"],
  [/\bCZK\b|Kč/i, "CZK"],
  [/\bPLN\b|zł/i, "PLN"],
  [/\$|\bUSD\b/i, "USD"],
];

/** The currency named in an amount text, or null when it names none. */
export function currencyOf(text: string): string | null {
  for (const [sign, code] of CURRENCY_SIGNS) if (sign.test(text)) return code;
  const code = text.match(/\b[A-Z]{3}\b/);
  return code ? code[0] : null;
}

/** The number in an amount text: "2 500,00 Ft" -> 2500, "€12.50" -> 12.5, "1.234,56" -> 1234.56. */
export function numberOf(text: string): number | null {
  const raw = text.replace(/[\s  ']/g, "").match(/\d[\d.,]*/)?.[0];
  if (!raw) return null;
  const lastDot = raw.lastIndexOf(".");
  const lastComma = raw.lastIndexOf(",");
  let decimal: "." | "," | null = null;
  if (lastDot >= 0 && lastComma >= 0) decimal = lastDot > lastComma ? "." : ",";
  else {
    const sep = lastDot >= 0 ? "." : lastComma >= 0 ? "," : null;
    // A lone separator with 1-2 digits after it is a decimal point ("12.5", "2,50");
    // with 3 digits after it, it groups thousands ("1,200").
    if (sep && raw.split(sep).length === 2 && raw.length - raw.lastIndexOf(sep) - 1 <= 2) decimal = sep;
  }
  const [whole, fraction = ""] = decimal ? [raw.slice(0, raw.lastIndexOf(decimal)), raw.slice(raw.lastIndexOf(decimal) + 1)] : [raw, ""];
  const n = Number(`${whole.replace(/[.,]/g, "")}.${fraction.replace(/[.,]/g, "") || "0"}`);
  return Number.isFinite(n) ? n : null;
}

/** Expense category a merchant name suggests, or null. Merchants seen before are matched in the database instead. */
const MERCHANT_HINTS: [RegExp, string][] = [
  // before transport, whose "bolt" would catch dohánybolt and borbolt
  [/kakuyasu|yamaya|liquor|bottle\s*shop|wine\s*shop|borbolt|italbolt|dohánybolt|trafik/i, "treats"],
  [/netflix|spotify|youtube|disney|icloud|apple\.com|google\s*(one|storage)|amazon\s*prime|chatgpt|openai|anthropic|claude\.ai|adobe|dropbox/i, "subscription"],
  [/vodafone|telekom|yettel|docomo|softbank|rakuten\s*mobile|ahamo|povo/i, "phone"],
  [/uber\s*eats|wolt|foodora|foodpanda|demae|lidl|aldi|spar\b|tesco|auchan|penny|coop|cba\b|interspar|7-?eleven|seven-?eleven|lawson|family\s*mart|familymart|ministop|aeon|ito-?yokado|seiyu|mcdonald|burger\s*king|kfc|subway|starbucks|costa|cafe|café|coffee|kávé|bakery|pékség|bistro|restaurant|étterem|pizza|sushi|ramen|izakaya|matsuya|yoshinoya|sukiya|bolt\s*food/i, "food"],
  [/\bbkk\b|máv|mav\b|volán|volan|bolt|uber|taxi|főtaxi|suica|pasmo|icoca|\bjr\b|metro|railway|tokyu|keio|odakyu|shell|\bmol\b|omv|eneos|parking|parkol/i, "transport"],
  [/sephora|douglas|notino|lush\b|l'occitane|kiehl|aesop|@cosme|cosme\s*kitchen|shiseido|kosé|kose\b|clinique|mac\s*cosmetics/i, "cosmetics"],
  [/\bdm\b|rossmann|müller|mueller|ikea|pepco|tedi|action\b|daiso|muji|matsukiyo|matsumoto\s*kiyoshi|welcia|sundrug|tsuruha|don\s*quijote|donki/i, "daily"],
  [/patika|gyógyszer|pharmacy|apotheke|clinic|klinika|hospital|kórház|dental|fogász/i, "medical"],
  [/zara|h&m|\bhm\b|uniqlo|\bgu\b|primark|c&a|reserved|deichmann|decathlon|mango|bershka|pull&bear/i, "clothes"],
  [/libri|bookline|alexandra|kinokuniya|tsutaya|maruzen|junkudo|udemy|coursera|\bbooks?\b/i, "learning"],
  [/cinema|cinema\s*city|mozi|toho|aeon\s*cinema|steam|playstation|nintendo|xbox|museum|múzeum|ticket|jegy/i, "fun"],
];

export function categoryHint(merchant: string): string | null {
  for (const [pattern, category] of MERCHANT_HINTS) if (pattern.test(merchant)) return category;
  return null;
}

export type WalletPayment = { amount: number; currency: string | null; merchant: string };

/**
 * Reads a request body: { amount, merchant, currency? }. `amount` may be a number or the
 * text Shortcuts gives; `currency` overrides the one read from the text.
 */
export function readWalletPayment(body: unknown): WalletPayment | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const amountText = typeof b.amount === "number" ? String(b.amount) : typeof b.amount === "string" ? b.amount : "";
  const amount = numberOf(amountText);
  if (!amount || amount <= 0 || amount > 1e9) return null;
  const given = typeof b.currency === "string" ? b.currency.trim().toUpperCase() : "";
  const currency = /^[A-Z]{3}$/.test(given) ? given : currencyOf(amountText);
  const merchant = typeof b.merchant === "string" ? b.merchant.replace(/\s+/g, " ").trim().slice(0, 60) : "";
  return { amount, currency, merchant };
}
