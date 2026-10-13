"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useKakeibo } from "./KakeiboProvider";
import { Button, Icons, Sheet, cx } from "./ui";

export const SAVINGS_MASK = "*****";

const INTRO_KEY = "kakeibo-app.secretIntroSeen";

export const SECRET_MODE_TEXT =
  "シークレットモードにすると、貯金額と、そこから貯金額を割り出せる表示（浮くお金・内訳・AI分析）を隠します。戻すにはログインのパスワードが要ります。";

function introSeen() {
  try {
    return localStorage.getItem(INTRO_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Turns secret mode on (explaining it the first time) or off (behind the password).
 * Render `sheets` next to whatever calls `toggle`.
 */
function useSecretMode() {
  const { savingsHidden, hideSavings, toast } = useKakeibo();
  const [sheet, setSheet] = useState<"intro" | "reveal" | null>(null);
  const turnOn = () => {
    try {
      localStorage.setItem(INTRO_KEY, "1");
    } catch {}
    hideSavings();
    toast("シークレットモードにしました");
  };
  const toggle = () => {
    if (savingsHidden) setSheet("reveal");
    else if (introSeen()) turnOn();
    else setSheet("intro");
  };
  const close = () => setSheet(null);
  const sheets =
    sheet === "reveal" ? (
      <RevealSheet onClose={close} />
    ) : sheet === "intro" ? (
      <Sheet title="シークレットモード" onClose={close}>
        <p className="text-sm">{SECRET_MODE_TEXT}</p>
        <Button
          variant="primary"
          className="mt-3 w-full"
          onClick={() => {
            close();
            turnOn();
          }}
        >
          オンにする
        </Button>
      </Sheet>
    ) : null;
  // Portalled so a sheet opened from the sticky header is not trapped under the tab bar.
  return { on: savingsHidden, toggle, sheets: sheets && createPortal(sheets, document.body) };
}

/** Eye button next to savings amounts that switches secret mode. */
export function SavingsEye({ className }: { className?: string }) {
  const { on, toggle, sheets } = useSecretMode();
  const label = on ? "シークレットモードを解除する" : "シークレットモードにする（貯金額を隠す）";
  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={toggle}
        className={cx(
          "grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2 [&_svg]:size-5",
          className,
        )}
      >
        {on ? Icons.eyeOff : Icons.eye}
      </button>
      {sheets}
    </>
  );
}

/** Header button for secret mode; icon-only on phones, where SecretModeBanner says it is on. */
export function SecretModeButton({ className }: { className?: string }) {
  const { on, toggle, sheets } = useSecretMode();
  return (
    <>
      <button
        type="button"
        aria-pressed={on}
        aria-label={on ? "シークレットモード中（タップで解除）" : "貯金を隠す（シークレットモード）"}
        onClick={toggle}
        className={cx(
          "flex h-9 flex-none items-center gap-1 rounded-full border px-2 text-xs sm:px-2.5 font-bold whitespace-nowrap [&_svg]:size-4",
          on ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-muted hover:bg-surface-2",
          className,
        )}
      >
        {on ? Icons.eyeOff : Icons.eye}
        <span className="max-sm:hidden">{on ? "シークレット中" : "貯金を隠す"}</span>
      </button>
      {sheets}
    </>
  );
}

/** Phone-only strip under the header while secret mode is on; tapping it unlocks. */
export function SecretModeBanner() {
  const { on, toggle, sheets } = useSecretMode();
  if (!on) return null;
  return (
    <>
      <button
        type="button"
        onClick={toggle}
        className="mb-3 flex w-full items-center gap-2 rounded-xl bg-accent px-3 py-2 text-left text-xs font-bold text-accent-ink sm:hidden [&_svg]:size-4"
      >
        {Icons.eyeOff}
        <span className="flex-1">シークレットモード中・貯金額は非表示</span>
        <span className="font-medium opacity-85">解除</span>
      </button>
      {sheets}
    </>
  );
}

/** Settings row: what secret mode does, with an on/off switch. */
export function SecretModeSetting() {
  const { on, toggle, sheets } = useSecretMode();
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted">{SECRET_MODE_TEXT}</p>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="シークレットモード"
          onClick={toggle}
          className={cx("relative h-7 w-12 flex-none rounded-full transition", on ? "bg-accent" : "bg-line")}
        >
          <span className={cx("absolute top-1 left-1 size-5 rounded-full bg-surface shadow transition", on && "translate-x-5")} />
        </button>
      </div>
      {sheets}
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
        toast("シークレットモードを解除しました");
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
    <Sheet title="シークレットモードを解除する" onClose={onClose}>
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
            デモモードにはパスワードがないので、そのまま解除します。
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
          {busy ? "確認しています…" : "解除する"}
        </Button>
      </form>
    </Sheet>
  );
}
