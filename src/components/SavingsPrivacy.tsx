"use client";

import { useState } from "react";
import { useKakeibo } from "./KakeiboProvider";
import { Button, Icons, Sheet, cx } from "./ui";

export const SAVINGS_MASK = "*****";

/** Eye button that hides savings amounts, and asks for the login password to show them again. */
export function SavingsEye({ className }: { className?: string }) {
  const { savingsHidden, hideSavings, toast } = useKakeibo();
  const [asking, setAsking] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={savingsHidden ? "貯金額を表示する" : "貯金額を隠す"}
        title={savingsHidden ? "貯金額を表示する" : "貯金額を隠す"}
        onClick={() => {
          if (savingsHidden) setAsking(true);
          else {
            hideSavings();
            toast("貯金額を隠しました");
          }
        }}
        className={cx(
          "grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2 [&_svg]:size-5",
          className,
        )}
      >
        {savingsHidden ? Icons.eyeOff : Icons.eye}
      </button>
      {asking && <RevealSheet onClose={() => setAsking(false)} />}
    </>
  );
}

/** Asks for the login password and shows savings again; `onRevealed` runs after a correct one. */
export function RevealSheet({ onClose, onRevealed }: { onClose: () => void; onRevealed?: () => void }) {
  const { storeKind, revealSavings, toast } = useKakeibo();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const needsPassword = storeKind === "supabase";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (await revealSavings(password)) {
        toast("貯金額を表示しました");
        onClose();
        onRevealed?.();
      } else {
        setError("パスワードが違います");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title="貯金額を表示する" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-2">
        {needsPassword ? (
          <>
            <label htmlFor="reveal-password" className="text-sm text-muted">
              ログインのパスワードを入れてください。
            </label>
            <input
              id="reveal-password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2"
            />
          </>
        ) : (
          <p className="text-sm text-muted">
            デモモードにはパスワードがないので、そのまま表示します。
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-bad">
            {error}
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          className="mt-1"
          disabled={busy || (needsPassword && !password)}
        >
          {busy ? "確認しています…" : "表示する"}
        </Button>
      </form>
    </Sheet>
  );
}
