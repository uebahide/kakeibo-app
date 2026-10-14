"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Request = { id: string; client: string; email: string };

/** Supabase Auth's OAuth server sends claude.ai's sign-in here so the user can allow the connector. */
export default function ConsentPage() {
  const [request, setRequest] = useState<Request | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("authorization_id");
    (id ? createClient().auth.oauth.getAuthorizationDetails(id) : Promise.resolve(null)).then((res) => {
      if (!res) return setError("認可リクエストが見つかりません。Claude からもう一度接続してください");
      const { data, error } = res;
      if (error || !data) return setError(`認可リクエストを読み込めませんでした：${error?.message ?? "不明なエラー"}`);
      // Already allowed before: go straight back to the client.
      if (!("authorization_id" in data)) return window.location.assign(data.redirect_url);
      setRequest({ id: data.authorization_id, client: data.client.name || "不明なアプリ", email: data.user.email });
    });
  }, []);

  async function answer(allow: boolean) {
    if (!request) return;
    setBusy(true);
    const oauth = createClient().auth.oauth;
    // Both calls send the browser back to the client with the result.
    const { error } = allow ? await oauth.approveAuthorization(request.id) : await oauth.denyAuthorization(request.id);
    if (error) {
      setError(`うまくいきませんでした：${error.message}`);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-sm content-center gap-6 px-4">
      <h1 className="font-display text-3xl tracking-[0.06em]">家計簿ノート</h1>
      {error ? (
        <p className="text-sm text-bad">{error}</p>
      ) : !request ? (
        <p className="text-sm text-muted">読み込んでいます…</p>
      ) : (
        <Card className="grid gap-3">
          <p className="text-base font-bold">{request.client} が家計簿へのアクセスを求めています</p>
          <p className="text-sm">許可すると、{request.client} はあなたの家計簿の集計を読み、AI分析を保存できるようになります。</p>
          <p className="text-xs text-muted">ログイン中：{request.email}</p>
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => answer(true)} disabled={busy}>
              許可する
            </Button>
            <Button onClick={() => answer(false)} disabled={busy}>
              やめる
            </Button>
          </div>
        </Card>
      )}
    </main>
  );
}
