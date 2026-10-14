"use client";

import { useRouter } from "next/navigation";
import { VARIABLE_CATEGORIES } from "@/lib/categories";
import { currencies, normalizeCurrency, parseAmount, yen } from "@/lib/format";
import { monthLabel, timeZones } from "@/lib/date";
import { LANGUAGES, type Language } from "@/lib/i18n";
import { DICTS } from "@/lib/i18n/dict";
import { clampStartDay, currentPeriod, periodRangeLabel } from "@/lib/period";
import { variableBudget } from "@/lib/stats";
import { createClient } from "@/lib/supabase/client";
import { useSeedSamples } from "./HomeView";
import { useKakeibo } from "./KakeiboProvider";
import { changeLanguage, useLanguage, useT } from "./LanguageProvider";
import { SecretModeSetting } from "./SavingsPrivacy";
import { SavingsSettings } from "./SavingsSettings";
import { Button, Card, CardTitle, Stamp, cx } from "./ui";

export function SettingsView() {
  const { settings, updateSettings, storeKind, deleteSamples, toast, transactions, setMonth } = useKakeibo();
  const startDay = settings.monthStartDay;
  const example = currentPeriod(startDay);
  const seed = useSeedSamples();
  const router = useRouter();
  const sampleCount = transactions.filter((x) => x.isSample).length;
  const t = useT();
  const displayLanguage = useLanguage();
  const language = settings.language ?? displayLanguage;

  const chooseLanguage = async (l: Language) => {
    if (l === language && settings.language) return;
    changeLanguage(l);
    await updateSettings((s) => ({ ...s, language: l }));
    toast(DICTS[l].settings.languageToast);
  };

  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-[1.15fr_1fr]">
      <Card>
        <CardTitle action={<span className="num text-ink">{t.settings.budgetTotal(yen(variableBudget(settings)))}</span>}>{t.settings.budgetTitle}</CardTitle>
        {VARIABLE_CATEGORIES.map((c) => (
          <label key={c.id} className="grid grid-cols-[auto_1fr_120px] items-center gap-2.5 py-1.5">
            <Stamp category={c.id} size="sm" />
            <span>{c.name}</span>
            <input
              id={`budget-${c.id}`}
              inputMode="numeric"
              defaultValue={settings.budgets[c.id] ?? 0}
              onBlur={(e) => {
                const value = parseAmount(e.target.value);
                e.target.value = String(value);
                if (value !== (settings.budgets[c.id] ?? 0)) {
                  void updateSettings((s) => ({ ...s, budgets: { ...s.budgets, [c.id]: value } }));
                }
              }}
              className="num w-full rounded-xl border border-line bg-bg px-3 py-2 text-right"
            />
          </label>
        ))}
        <p className="mt-1.5 text-xs text-muted">{t.settings.budgetHint}</p>
      </Card>

      <div className="grid gap-3.5">
        <Card>
          <CardTitle>{t.settings.startDayTitle}</CardTitle>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            {t.settings.startDayBefore}
            <select
              id="month-start-day"
              value={startDay}
              onChange={async (e) => {
                const day = clampStartDay(e.target.value);
                await updateSettings((s) => ({ ...s, monthStartDay: day }));
                setMonth(currentPeriod(day));
                toast(day === 1 ? t.settings.startDayReset : t.settings.startDayToast(day));
              }}
              className="num rounded-xl border border-line bg-bg px-3 py-2"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {t.settings.startDayOption(d)}
                </option>
              ))}
            </select>
            {t.settings.startDayAfter}
          </label>
          <p className="mt-2 text-xs text-muted">
            {t.settings.startDayHint}
            {startDay === 1
              ? t.settings.startDayCalendar
              : t.settings.startDayExample(monthLabel(example), periodRangeLabel(example, startDay))}
          </p>
        </Card>

        <Card>
          <CardTitle>{t.settings.currencyTitle}</CardTitle>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1" role="radiogroup" aria-label={t.settings.currencyTitle}>
            {currencies().map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={settings.currency === c.id}
                onClick={async () => {
                  if (settings.currency === c.id) return;
                  await updateSettings((s) => ({ ...s, currency: normalizeCurrency(c.id) }));
                  toast(t.settings.currencyToast(c.symbol, c.name));
                }}
                className={cx(
                  "rounded-lg py-2 text-sm font-bold",
                  settings.currency === c.id ? "bg-surface text-ink shadow-sm" : "text-muted",
                )}
              >
                {c.symbol} {c.name}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">{t.settings.currencyHint}</p>
        </Card>

        <Card>
          <CardTitle>{t.settings.timeZoneTitle}</CardTitle>
          <div id="time-zone" className="grid scroll-mt-24 grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1" role="radiogroup" aria-label={t.settings.timeZoneTitle}>
            {timeZones().map((z) => (
              <button
                key={z.id}
                type="button"
                role="radio"
                aria-checked={settings.timeZone === z.id}
                onClick={async () => {
                  if (settings.timeZone === z.id) return;
                  await updateSettings((s) => ({ ...s, timeZone: z.id }));
                  toast(t.settings.timeZoneToast(z.name));
                }}
                className={cx(
                  "rounded-lg py-2 text-sm font-bold",
                  settings.timeZone === z.id ? "bg-surface text-ink shadow-sm" : "text-muted",
                )}
              >
                {z.name}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">{t.settings.timeZoneHint}</p>
        </Card>

        <Card>
          <CardTitle>{t.settings.languageTitle}</CardTitle>
          <div id="language" className="grid scroll-mt-24 grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1" role="radiogroup" aria-label={t.settings.languageTitle}>
            {LANGUAGES.map((l) => (
              <button
                key={l.id}
                type="button"
                role="radio"
                lang={l.id}
                aria-checked={language === l.id}
                onClick={() => void chooseLanguage(l.id)}
                className={cx(
                  "rounded-lg py-2 text-sm font-bold",
                  language === l.id ? "bg-surface text-ink shadow-sm" : "text-muted",
                )}
              >
                {l.name}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">{t.settings.languageHint}</p>
        </Card>

        <Card>
          <CardTitle>{t.settings.secretModeTitle}</CardTitle>
          <SecretModeSetting />
        </Card>

        <SavingsSettings />

        <Card>
          <CardTitle>{t.settings.dataTitle}</CardTitle>
          <p className="mb-2.5 text-sm">
            {storeKind === "supabase"
              ? t.settings.dataCloud
              : t.settings.dataLocal}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={seed}>{t.settings.addSamples}</Button>
            <Button
              variant="danger"
              disabled={!sampleCount}
              onClick={async () => {
                try {
                  await deleteSamples();
                  toast(t.settings.samplesDeleted);
                } catch {
                  toast(t.settings.samplesDeleteFailed);
                }
              }}
            >
              {t.settings.deleteSamples(sampleCount)}
            </Button>
          </div>
        </Card>

        {storeKind === "supabase" && (
          <Card>
            <CardTitle>{t.settings.accountTitle}</CardTitle>
            <Button
              onClick={async () => {
                await createClient().auth.signOut();
                router.replace("/login");
                router.refresh();
              }}
            >
              {t.settings.signOut}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
