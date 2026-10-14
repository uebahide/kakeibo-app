export type Language = "ja" | "en";

export const LANGUAGES: { id: Language; name: string }[] = [
  { id: "ja", name: "日本語" },
  { id: "en", name: "English" },
];

/** Cookie the chosen language is kept in, so pages shown before sign-in (and the server) can read it. */
export const LANGUAGE_COOKIE = "lang";

/** A saved language, or null when none was picked. */
export function normalizeLanguage(value: unknown): Language | null {
  return value === "ja" || value === "en" ? value : null;
}

/** Language for someone who never picked one: English for an English browser, Japanese otherwise. */
export function languageFromList(languages: readonly string[]): Language {
  for (const l of languages) {
    const code = l.trim().slice(0, 2).toLowerCase();
    if (code === "ja") return "ja";
    if (code === "en") return "en";
  }
  return "ja";
}

// The display language; LanguageProvider sets it as it changes, like the currency in format.ts.
// Labels made outside React (dates, categories) read it.
let language: Language = "ja";

export function setLanguage(l: Language) {
  language = l;
}

export const getLanguage = () => language;

/**
 * Runs fn with labels in the given language. For the server, where requests from different
 * users share this module: fn must be synchronous, so no other request runs in between.
 */
export function inLanguage<T>(l: Language, fn: () => T): T {
  const previous = language;
  language = l;
  try {
    return fn();
  } finally {
    language = previous;
  }
}

/** Pick the text for the current language. */
export const pick = <T>(texts: Record<Language, T>): T => texts[language];
