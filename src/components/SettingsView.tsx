"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import { parseAmount, yen } from "@/lib/format";
import { totalBudget } from "@/lib/stats";
import { createClient } from "@/lib/supabase/client";
import { useSeedSamples } from "./HomeView";
import { useKakeibo } from "./KakeiboProvider";
import { Button, Card, CardTitle, Stamp } from "./ui";

export function SettingsView() {
  const { settings, updateSettings, storeKind, deleteSamples, toast, transactions } = useKakeibo();
  const seed = useSeedSamples();
  const router = useRouter();
  const [goal, setGoal] = useState({
    name: settings.goal.name,
    target: String(settings.goal.target),
    saved: String(settings.goal.saved),
  });
  const sampleCount = transactions.filter((t) => t.isSample).length;

  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-[1.15fr_1fr]">
      <Card>
        <CardTitle action={<span className="num text-ink">合計 {yen(totalBudget(settings))}</span>}>月の予算</CardTitle>
        {CATEGORIES.expense.map((c) => (
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
        <p className="mt-1.5 text-xs text-muted">入力欄から離れると保存されます。0 にするとそのカテゴリの予算は表示されません。</p>
      </Card>

      <div className="grid gap-3.5">
        <Card>
          <CardTitle>貯金目標</CardTitle>
          <form
            className="grid gap-1"
            onSubmit={async (e) => {
              e.preventDefault();
              await updateSettings((s) => ({
                ...s,
                goal: { name: goal.name.trim() || "貯金", target: parseAmount(goal.target), saved: parseAmount(goal.saved) },
              }));
              toast("貯金目標を保存しました");
            }}
          >
            {(
              [
                ["name", "目標の名前", "text"],
                ["target", "目標金額", "numeric"],
                ["saved", "これまでに貯めた額", "numeric"],
              ] as const
            ).map(([key, label, mode]) => (
              <label key={key} className="block">
                <span className="mt-2 mb-1 block text-[11px] tracking-wide text-muted">{label}</span>
                <input
                  id={`goal-${key}`}
                  value={goal[key]}
                  inputMode={mode === "numeric" ? "numeric" : undefined}
                  onChange={(e) => setGoal({ ...goal, [key]: e.target.value })}
                  className="w-full rounded-xl border border-line bg-bg px-3 py-2"
                />
              </label>
            ))}
            <Button type="submit" variant="primary" className="mt-3 justify-self-start">
              目標を保存
            </Button>
          </form>
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
