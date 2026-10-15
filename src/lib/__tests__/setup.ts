import { afterEach, vi } from "vitest";
import { setTimeZone } from "@/lib/date";
import { setCurrency } from "@/lib/format";
import { setLanguage } from "@/lib/i18n";

// The display language, currency and time zone are module-level settings; each test starts from the defaults.
afterEach(() => {
  vi.useRealTimers();
  setLanguage("ja");
  setCurrency("JPY");
  setTimeZone("Asia/Tokyo");
});
