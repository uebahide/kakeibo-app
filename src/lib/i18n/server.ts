import "server-only";
import { LANGUAGE_COOKIE, languageFromList, normalizeLanguage, type Language } from ".";

/** The language a request asks for: the chosen-language cookie, else the browser's Accept-Language. */
export function requestLanguage(request: Request): Language {
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim().split("="))
    .find(([name]) => name === LANGUAGE_COOKIE)?.[1];
  const chosen = normalizeLanguage(cookie);
  if (chosen) return chosen;
  const accepted = (request.headers.get("accept-language") ?? "").split(",").map((l) => l.split(";")[0]);
  return languageFromList(accepted);
}
