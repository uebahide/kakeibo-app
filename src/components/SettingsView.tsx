"use client";

import { useRouter } from "next/navigation";
import { variableCategories } from "@/lib/categories";
import { currencies, normalizeCurrency, parseAmount, yen } from "@/lib/format";
import { monthLabel, timeZones } from "@/lib/date";
import { LANGUAGES, type Language } from "@/lib/i18n";
import { DICTS } from "@/lib/i18n/dict";
import { clampStartDay, currentPeriod, periodRangeLabel } from "@/lib/period";
import { variableBudget } from "@/lib/stats";
import { clearSnapshot } from "@/lib/store/offline";
import { createClient } from "@/lib/supabase/client";
import { BudgetSuggestButton } from "./BudgetSuggest";
import { CategoriesCard } from "./CategoriesCard";
import { useSeedSamples } from "./HomeView";
import { useKakeibo } from "./KakeiboProvider";
import { changeLanguage, useLanguage, useT } from "./LanguageProvider";
import { RecentlyDeletedButton } from "./RecentlyDeleted";
import { SecretModeSetting } from "./SavingsPrivacy";
import { SavingsSettings } from "./SavingsSettings";
import { Button, Card, CardTitle, Stamp, cx } from "./ui";
import { WalletImportSettings } from "./WalletImport";

export function SettingsView() {
  const { settings, updateSettings, storeKind, deleteSamples, toast, transactions, setMonth, receipts, canReadReceipts } = useKakeibo();
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
    <div className="grid gap-3.5">
      <SectionNav />
      {/* two balanced columns on a computer, filled top to bottom in this order */}
      <div className="gap-3.5 lg:columns-2">
        <Section id="budget">
          <Card>
            <CardTitle action={<span className="num text-ink">{t.settings.budgetTotal(yen(variableBudget(settings)))}</span>}>{t.settings.budgetTitle}</CardTitle>
            {variableCategories().map((c) => (
              <label key={c.id} className="grid grid-cols-[auto_1fr_120px] items-center gap-2.5 py-1">
                <Stamp category={c.id} size="sm" />
                <span>{c.name}</span>
                <input
                  // a new key when the amount changes elsewhere (a suggestion was used), so the field shows it
                  key={settings.budgets[c.id] ?? 0}
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
                  className="num min-h-11 w-full rounded-xl border border-line bg-bg px-3 py-2 text-right"
                />
              </label>
            ))}
            <p className="mt-1.5 text-xs text-muted">{t.settings.budgetHint}</p>
            <BudgetSuggestButton />
          </Card>

          <CategoriesCard />
        </Section>

        <Section id="display">
          <Card>
            <Row title={t.settings.startDayTitle}>
              <label className="flex flex-wrap items-center gap-2 text-sm">
                {t.settings.startDayBefore}
                <select
                  id="month-start-day"
                  aria-label={t.settings.startDayTitle}
                  value={startDay}
                  onChange={async (e) => {
                    const day = clampStartDay(e.target.value);
                    await updateSettings((s) => ({ ...s, monthStartDay: day }));
                    setMonth(currentPeriod(day));
                    toast(day === 1 ? t.settings.startDayReset : t.settings.startDayToast(day));
                  }}
                  className="num min-h-11 rounded-xl border border-line bg-bg px-3 py-2"
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {t.settings.startDayOption(d)}
                    </option>
                  ))}
                </select>
                {t.settings.startDayAfter}
              </label>
              <Hint>
                {t.settings.startDayHint}
                {startDay === 1
                  ? t.settings.startDayCalendar
                  : t.settings.startDayExample(monthLabel(example), periodRangeLabel(example, startDay))}
              </Hint>
            </Row>

            <Row title={t.settings.weekStartTitle}>
              <Choice
                label={t.settings.weekStartTitle}
                value={settings.weekStartDay}
                options={[
                  { value: 1, name: t.settings.weekStartMonday },
                  { value: 0, name: t.settings.weekStartSunday },
                ]}
                onChoose={async (day, name) => {
                  await updateSettings((s) => ({ ...s, weekStartDay: day }));
                  toast(t.settings.weekStartToast(name));
                }}
              />
              <Hint>{t.settings.weekStartHint}</Hint>
            </Row>

            <Row title={t.settings.currencyTitle}>
              <Choice
                label={t.settings.currencyTitle}
                value={settings.currency}
                options={currencies().map((c) => ({ value: c.id, name: `${c.symbol} ${c.name}` }))}
                onChoose={async (id) => {
                  const c = currencies().find((x) => x.id === id)!;
                  await updateSettings((s) => ({ ...s, currency: normalizeCurrency(id) }));
                  toast(t.settings.currencyToast(c.symbol, c.name));
                }}
              />
              <Hint>{t.settings.currencyHint}</Hint>
            </Row>

            <Row title={t.settings.timeZoneTitle} id="time-zone">
              <Choice
                label={t.settings.timeZoneTitle}
                value={settings.timeZone}
                options={timeZones().map((z) => ({ value: z.id, name: z.name }))}
                onChoose={async (id, name) => {
                  await updateSettings((s) => ({ ...s, timeZone: id }));
                  toast(t.settings.timeZoneToast(name));
                }}
              />
              <Hint>{t.settings.timeZoneHint}</Hint>
            </Row>

            <Row title={t.settings.languageTitle} id="language">
              <Choice
                label={t.settings.languageTitle}
                value={settings.language ? language : null}
                options={LANGUAGES.map((l) => ({ value: l.id, name: l.name, lang: l.id }))}
                onChoose={(l) => void chooseLanguage(l)}
                checked={(l) => language === l}
              />
              <Hint>{t.settings.languageHint}</Hint>
            </Row>
          </Card>
        </Section>

        <Section id="savings">
          <SavingsSettings />
          <Card>
            <CardTitle>{t.settings.secretModeTitle}</CardTitle>
            <SecretModeSetting />
          </Card>
        </Section>

        <Section id="links">
          {receipts && canReadReceipts && (
            <Card>
              <CardTitle>{t.settings.autoReadTitle}</CardTitle>
              <Choice
                label={t.settings.autoReadTitle}
                value={settings.autoReadReceipts}
                options={[
                  { value: true, name: t.settings.autoReadOn },
                  { value: false, name: t.settings.autoReadOff },
                ]}
                onChoose={async (on) => {
                  await updateSettings((s) => ({ ...s, autoReadReceipts: on }));
                  toast(t.settings.autoReadToast(on));
                }}
              />
              <Hint>{t.settings.autoReadHint}</Hint>
            </Card>
          )}

          <WalletImportSettings />

          <Card>
            <CardTitle>{t.settings.dataTitle}</CardTitle>
            <p className="mb-2.5 text-sm">{storeKind === "supabase" ? t.settings.dataCloud : t.settings.dataLocal}</p>
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
              <RecentlyDeletedButton />
            </div>
          </Card>

          {storeKind === "supabase" && (
            <Card>
              <CardTitle>{t.settings.accountTitle}</CardTitle>
              <Button
                onClick={async () => {
                  // Only this browser: other devices and the claude.ai connector stay signed in.
                  await createClient().auth.signOut({ scope: "local" });
                  clearSnapshot();
                  router.replace("/login");
                  router.refresh();
                }}
              >
                {t.settings.signOut}
              </Button>
            </Card>
          )}
        </Section>
      </div>
    </div>
  );
}

const SECTIONS = ["budget", "display", "savings", "links"] as const;
type SectionId = (typeof SECTIONS)[number];

/** Buttons that jump to each group of settings; on a phone the groups are far apart. */
function SectionNav() {
  const t = useT();
  return (
    <div role="group" aria-label={t.settings.sectionsLabel} className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:hidden">
      {SECTIONS.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => document.getElementById(`settings-${id}`)?.scrollIntoView({ block: "start", behavior: "smooth" })}
          className="min-h-11 flex-none rounded-full border border-line bg-surface px-2.5 text-xs font-bold text-muted hover:bg-surface-2"
        >
          {t.settings.sections[id]}
        </button>
      ))}
    </div>
  );
}

function Section({ id, children }: { id: SectionId; children: React.ReactNode }) {
  const t = useT();
  const headingId = `settings-${id}`;
  return (
    <section aria-labelledby={headingId} className="mb-3.5 grid break-inside-avoid gap-3.5">
      <h2 id={headingId} className="scroll-mt-20 px-1 pt-1 text-base font-bold">
        {t.settings.sections[id]}
      </h2>
      {children}
    </section>
  );
}

/** One setting inside a card that holds several, with a line between them. */
function Row({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-24 border-t border-line py-3.5 first:border-t-0 first:pt-0 last:pb-0">
      <h3 className="mb-2.5 text-[13px] font-bold tracking-wide text-muted">{title}</h3>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-xs text-muted">{children}</p>;
}

/** Two-way switch: the option picked looks raised. Picking the one already on does nothing. */
function Choice<V extends string | number | boolean>({
  label,
  value,
  options,
  onChoose,
  checked = (v) => v === value,
}: {
  label: string;
  value: V | null;
  options: { value: V; name: string; lang?: string }[];
  onChoose: (value: V, name: string) => void;
  checked?: (value: V) => boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          lang={o.lang}
          aria-checked={checked(o.value)}
          onClick={() => {
            if (o.value === value) return;
            onChoose(o.value, o.name);
          }}
          className={cx("min-h-10 rounded-lg py-2 text-sm font-bold", checked(o.value) ? "bg-surface text-ink shadow-sm" : "text-muted")}
        >
          {o.name}
        </button>
      ))}
    </div>
  );
}
