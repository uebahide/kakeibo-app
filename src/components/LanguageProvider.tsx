"use client";

import { createContext, useContext, useLayoutEffect, useSyncExternalStore, type ReactNode } from "react";
import { LANGUAGE_COOKIE, languageFromList, normalizeLanguage, setLanguage, type Language } from "@/lib/i18n";
import { DICTS, type Dict } from "@/lib/i18n/dict";

// The language lives outside React so the first client render can already use it: the inline
// script in the root layout resolves it (cookie, else browser) onto <html lang> before paint.
// Read once as this module loads, before React hydrates and touches <html>.
let current: Language | null =
  typeof document === "undefined" ? null : (normalizeLanguage(document.documentElement.lang) ?? languageFromList(navigator.languages ?? []));
const listeners = new Set<() => void>();

function getSnapshot(): Language {
  return (current ??= languageFromList(navigator.languages ?? []));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Switch the display language and remember it in this browser. */
export function changeLanguage(l: Language) {
  try {
    document.cookie = `${LANGUAGE_COOKIE}=${l}; path=/; max-age=${60 * 60 * 24 * 400}; samesite=lax`;
  } catch {
    // cookies blocked: the choice lasts until reload
  }
  if (l === current) return;
  current = l;
  for (const listener of listeners) listener();
}

const LanguageContext = createContext<Language>("ja");

export function LanguageProvider({ children }: { children: ReactNode }) {
  // The server renders Japanese; English is applied right after hydration, while the page is still hidden.
  const lang = useSyncExternalStore(subscribe, getSnapshot, () => "ja" as const);
  // Labels made outside React (dates, categories) read the module-level language; set it before children render.
  setLanguage(lang);

  useLayoutEffect(() => {
    // While hydrating, lang is still the server's Japanese; wait for the re-render in the real language.
    if (lang !== getSnapshot()) return;
    const html = document.documentElement;
    html.lang = lang;
    html.removeAttribute("data-lang-pending");
  }, [lang]);

  return (
    <LanguageContext.Provider value={lang}>
      <title>{DICTS[lang].common.appName}</title>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);

/** Texts in the display language. */
export const useT = (): Dict => DICTS[useContext(LanguageContext)];
