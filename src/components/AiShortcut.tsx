"use client";

import { useKakeibo } from "./KakeiboProvider";
import { useT } from "./LanguageProvider";
import { Icons, cx } from "./ui";

/** Entry point to the AI view on phones, where it has no tab of its own. */
export function AiShortcut({ className }: { className?: string }) {
  const { setView } = useKakeibo();
  const t = useT().ai;
  return (
    <button
      type="button"
      onClick={() => setView("ai")}
      className={cx(
        "flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left hover:bg-surface-2",
        className,
      )}
    >
      <span className="grid size-10 flex-none place-items-center rounded-full bg-accent-soft text-accent [&_svg]:size-5">{Icons.ai}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{t.shortcutTitle}</span>
        <span className="block text-xs text-muted">{t.shortcutBody}</span>
      </span>
      <span aria-hidden className="text-lg text-muted">
        ›
      </span>
    </button>
  );
}
