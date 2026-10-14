"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/LanguageProvider";
import { Button } from "@/components/ui";
import type { Dict } from "@/lib/i18n/dict";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function errorMessage(t: Dict["auth"], code: string | undefined, message: string): string {
  if (code === "invalid_credentials") return t.invalidCredentials;
  if (code === "email_not_confirmed") return t.emailNotConfirmed;
  if (code === "over_request_rate_limit") return t.rateLimited;
  return t.loginFailed(message);
}

/** Where to go after login: the ?next= path, only if it stays on this site. */
function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next?.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

export default function LoginPage() {
  const router = useRouter();
  const { auth: t, common } = useT();
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
      setError(errorMessage(t, error.code, error.message));
      setBusy(false);
      return;
    }
    router.replace(nextPath());
    router.refresh();
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-sm content-center gap-6 px-4">
      <div>
        <h1 className="font-display text-3xl tracking-[0.06em]">{common.appName}</h1>
        <p className="mt-1 text-sm text-muted">{t.loginLead}</p>
      </div>
      {!isSupabaseConfigured ? (
        <p className="rounded-xl bg-warn-soft p-3 text-sm">{t.demoMode}</p>
      ) : (
        <form onSubmit={signIn} className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-xs text-muted">{t.email}</span>
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
            <span className="text-xs text-muted">{t.password}</span>
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
            {busy ? t.signingIn : t.signIn}
          </Button>
          {error && <p className="text-sm text-bad">{error}</p>}
        </form>
      )}
    </main>
  );
}
