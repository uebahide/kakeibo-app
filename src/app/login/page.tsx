"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setState("error");
    } else setState("sent");
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-sm content-center gap-6 px-4">
      <div>
        <h1 className="font-display text-3xl tracking-[0.06em]">家計簿ノート</h1>
        <p className="mt-1 text-sm text-muted">メールアドレスにログイン用のリンクを送ります。</p>
      </div>
      {!isSupabaseConfigured ? (
        <p className="rounded-xl bg-warn-soft p-3 text-sm">Supabase が設定されていないため、ログインなしのデモモードで動いています。</p>
      ) : state === "sent" ? (
        <p className="rounded-xl bg-good-soft p-3 text-sm">
          {email} にリンクを送りました。メールを開いてリンクをタップしてください。
        </p>
      ) : (
        <form onSubmit={send} className="grid gap-3">
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
          <Button type="submit" variant="primary" disabled={state === "sending"}>
            {state === "sending" ? "送信しています…" : "ログインリンクを送る"}
          </Button>
          {state === "error" && <p className="text-sm text-bad">送れませんでした：{error}</p>}
        </form>
      )}
    </main>
  );
}
