"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function errorMessage(code: string | undefined, message: string): string {
  if (code === "invalid_credentials") return "メールアドレスかパスワードが違います";
  if (code === "email_not_confirmed") return "このアカウントはまだ確認されていません。Supabase でユーザーを確認済みにしてください";
  if (code === "over_request_rate_limit") return "試行回数が多すぎます。少し時間をおいてからお試しください";
  return `ログインできませんでした：${message}`;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) {
      setError(errorMessage(error.code, error.message));
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-sm content-center gap-6 px-4">
      <div>
        <h1 className="font-display text-3xl tracking-[0.06em]">家計簿ノート</h1>
        <p className="mt-1 text-sm text-muted">メールアドレスとパスワードでログインします。</p>
      </div>
      {!isSupabaseConfigured ? (
        <p className="rounded-xl bg-warn-soft p-3 text-sm">Supabase が設定されていないため、ログインなしのデモモードで動いています。</p>
      ) : (
        <form onSubmit={signIn} className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-xs text-muted">メールアドレス</span>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-line bg-surface px-3 py-2.5"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted">パスワード</span>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-xl border border-line bg-surface px-3 py-2.5"
            />
          </label>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "ログインしています…" : "ログイン"}
          </Button>
          {error && <p className="text-sm text-bad">{error}</p>}
        </form>
      )}
    </main>
  );
}
