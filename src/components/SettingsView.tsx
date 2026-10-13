"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { VARIABLE_CATEGORIES } from "@/lib/categories";
import { CURRENCIES, normalizeCurrency, parseAmount, yen } from "@/lib/format";
import { monthLabel } from "@/lib/date";
import { clampStartDay, currentPeriod, periodRangeLabel } from "@/lib/period";
import { variableBudget } from "@/lib/stats";
import { createClient } from "@/lib/supabase/client";
import { useSeedSamples } from "./HomeView";
import { useKakeibo } from "./KakeiboProvider";
import { SavingsEye, SecretModeSetting } from "./SavingsPrivacy";
import { Button, Card, CardTitle, Stamp, cx } from "./ui";

export function SettingsView() {
  const { settings, updateSettings, storeKind, deleteSamples, toast, transactions, setMonth, savingsHidden } = useKakeibo();
  const startDay = settings.monthStartDay;
  const example = currentPeriod(startDay);
  const seed = useSeedSamples();
  const router = useRouter();
  const [goal, setGoal] = useState({
    target: settings.goal.target ? String(settings.goal.target) : "",
    saved: settings.goal.saved ? String(settings.goal.saved) : "",
  });
  const sampleCount = transactions.filter((t) => t.isSample).length;

  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-[1.15fr_1fr]">
      <Card>
        <CardTitle action={<span className="num text-ink">合計 {yen(variableBudget(settings))}</span>}>変動費の月の予算</CardTitle>
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
        <p className="mt-1.5 text-xs text-muted">入力欄から離れると保存されます。0 にするとそのカテゴリの予算は表示されません。家賃や通信費などの固定費は、ホームの「固定費」で月ごとに設定します。</p>
      </Card>

      <div className="grid gap-3.5">
        <Card>
          <CardTitle>月の始まり</CardTitle>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            毎月
            <select
              id="month-start-day"
              value={startDay}
              onChange={async (e) => {
                const day = clampStartDay(e.target.value);
                await updateSettings((s) => ({ ...s, monthStartDay: day }));
                setMonth(currentPeriod(day));
                toast(day === 1 ? "月の始まりを1日に戻しました" : `毎月${day}日を月の始まりにしました`);
              }}
              className="num rounded-xl border border-line bg-bg px-3 py-2"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            日から1か月として集計する
          </label>
          <p className="mt-2 text-xs text-muted">
            給料日に合わせると、予算・固定費・貯金がお給料の周期で区切られます。
            {startDay === 1
              ? "今はカレンダーどおり（1日〜月末）です。"
              : `たとえば「${monthLabel(example)}」は ${periodRangeLabel(example, startDay)} です。`}
          </p>
        </Card>

        <Card>
          <CardTitle>通貨</CardTitle>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1" role="radiogroup" aria-label="通貨">
            {CURRENCIES.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={settings.currency === c.id}
                onClick={async () => {
                  if (settings.currency === c.id) return;
                  await updateSettings((s) => ({ ...s, currency: normalizeCurrency(c.id) }));
                  toast(`金額を ${c.symbol}（${c.name}）で表示します`);
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
          <p className="mt-2 text-xs text-muted">表示の単位だけを切り替えます。入力済みの金額は為替で換算しません。</p>
        </Card>

        <Card>
          <CardTitle>シークレットモード</CardTitle>
          <SecretModeSetting />
        </Card>

        <Card>
          <CardTitle action={<SavingsEye className="-my-1.5" />}>貯金</CardTitle>
          {savingsHidden ? (
            <p className="text-sm text-muted">シークレットモード中です。解除すると、目標額などを変えられます。</p>
          ) : (
            <form
              className="grid gap-1"
              onSubmit={async (e) => {
                e.preventDefault();
                await updateSettings((s) => ({
                  ...s,
                  goal: { ...s.goal, target: parseAmount(goal.target), saved: parseAmount(goal.saved) },
                }));
                toast("保存しました");
              }}
            >
              {(
                [
                  ["target", "目標の貯金額（任意・空欄なら目標なし）"],
                  ["saved", "アプリを使う前からの貯金"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="mt-2 mb-1 block text-[11px] tracking-wide text-muted">{label}</span>
                  <input
                    id={`goal-${key}`}
                    value={goal[key]}
                    inputMode="numeric"
                    placeholder="0"
                    onChange={(e) => setGoal({ ...goal, [key]: e.target.value })}
                    className="num w-full rounded-xl border border-line bg-bg px-3 py-2"
                  />
                </label>
              ))}
              <Button type="submit" variant="primary" className="mt-3 justify-self-start">
                保存
              </Button>
              <p className="mt-2 text-xs text-muted">毎月の貯金額はホームの「貯金」で入れます。これまでの貯金は、ここで入れた額と毎月の貯金額の合計です。</p>
            </form>
          )}
        </Card>

        <Card>
          <CardTitle>データ</CardTitle>
          <p className="mb-2.5 text-sm">
            {storeKind === "supabase"
              ? "記録はクラウドに保存され、スマホとPCのどちらから開いても同じデータが見えます。ほかの人からは見えません。"
              : "デモモードです。記録はこのブラウザだけに保存されます。Supabase を設定すると、ログインしてスマホとPCで同じデータを使えます。"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={seed}>サンプルを入れる</Button>
            <Button
              variant="danger"
              disabled={!sampleCount}
              onClick={async () => {
                try {
                  await deleteSamples();
                  toast("サンプルを削除しました");
                } catch {
                  toast("サンプルを削除できませんでした");
                }
              }}
            >
              サンプルを削除{sampleCount ? `（${sampleCount}件）` : ""}
            </Button>
          </div>
        </Card>

        {storeKind === "supabase" && (
          <Card>
            <CardTitle>アカウント</CardTitle>
            <Button
              onClick={async () => {
                await createClient().auth.signOut();
                router.replace("/login");
                router.refresh();
              }}
            >
              ログアウト
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
