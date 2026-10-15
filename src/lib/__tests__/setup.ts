import { afterEach, vi } from "vitest";
import { EMPTY_CATEGORY_SETTINGS, setCategories } from "@/lib/categories";
import { setTimeZone } from "@/lib/date";
import { setCurrency } from "@/lib/format";
import { setLanguage } from "@/lib/i18n";

// The display language, currency, time zone and categories are module-level settings; each test starts from the defaults.
afterEach(() => {
  vi.useRealTimers();
  setLanguage("ja");
  setCurrency("JPY");
  setTimeZone("Asia/Tokyo");
  setCategories(EMPTY_CATEGORY_SETTINGS);
});
