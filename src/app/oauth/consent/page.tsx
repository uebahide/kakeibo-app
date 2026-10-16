"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/LanguageProvider";
import { Button, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Request = { id: string; client: string; email: string; scopes: string[] };

/**
 * Forgets the session in this browser only and signs in again, coming back to this request.
 * Used when the session here was ended elsewhere (signing out in the app ends it on every device)
 * and to connect another account.
 */
async function signInAgain() {
  await createClient().auth.signOut({ scope: "local" });
  window.location.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
}

/** Supabase Auth's OAuth server sends claude.ai's sign-in here so the user can allow the connector. */
export default function ConsentPage() {
  const { auth: t, common } = useT();
  // The loading effect runs once, on the hydration render (still the server's Japanese);
  // read texts through a ref so its messages use the language current when the request resolves.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  const [request, setRequest] = useState<Request | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("authorization_id");
    const t = () => tRef.current;
    const supabase = createClient();
    (async () => {
      if (!id) return setError(t().requestMissing);
      // The cookie can outlive its session (the page's server check only reads the token), so ask the
      // auth server; with no live session, sign in again instead of failing with "Auth session missing!".
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return void signInAgain();
      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(id);
      if (error?.name === "AuthSessionMissingError") return void signInAgain();
      if (error || !data) return setError(t().requestLoadFailed(error?.message ?? t().unknownError));
      // Already allowed before: go straight back to the client.
      if (!("authorization_id" in data)) return window.location.assign(data.redirect_url);
      setRequest({
        id: data.authorization_id,
        client: data.client.name || t().unknownApp,
        email: data.user.email,
        scopes: (data.scope ?? "").split(" ").filter(Boolean),
      });
    })();
  }, []);

  async function answer(allow: boolean) {
    if (!request) return;
    setBusy(true);
    const oauth = createClient().auth.oauth;
    const options = { skipBrowserRedirect: true };
    const { data, error } = allow ? await oauth.approveAuthorization(request.id, options) : await oauth.denyAuthorization(request.id, options);
    if (error || !data) {
      setError(t.failed(error?.message ?? t.unknownError));
      setBusy(false);
      return;
    }
    // Back to the client with the result.
    window.location.assign(data.redirect_url);
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-sm content-center gap-6 px-4">
      <h1 className="font-display text-3xl tracking-[0.06em]">{common.appName}</h1>
      {error ? (
        <p className="text-sm text-bad">{error}</p>
      ) : !request ? (
        <p className="text-sm text-muted">{t.loadingRequest}</p>
      ) : (
        <Card className="grid gap-3">
          <p className="text-base font-bold">{t.asksAccess(request.client)}</p>
          <p className="text-sm">{t.allowEffect(request.client)}</p>
          {request.scopes.length > 0 && <p className="text-xs text-muted">{t.scopes(request.scopes)}</p>}
          <p className="text-xs text-muted">
            {t.signedInAs(request.email)}{" "}
            <button type="button" onClick={signInAgain} disabled={busy} className="font-medium text-accent underline underline-offset-2">
              {t.otherAccount}
            </button>
          </p>
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => answer(true)} disabled={busy}>
              {t.allow}
            </Button>
            <Button onClick={() => answer(false)} disabled={busy}>
              {t.deny}
            </Button>
          </div>
        </Card>
      )}
    </main>
  );
}
