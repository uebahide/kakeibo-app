"use client";

import { useEffect } from "react";
import { addMonths, monthLabel } from "@/lib/date";
import { AiView } from "./AiView";
import { AnalysisView } from "./AnalysisView";
import { EntrySheet } from "./EntrySheet";
import { HistoryView } from "./HistoryView";
import { HomeView } from "./HomeView";
import { useKakeibo, type View } from "./KakeiboProvider";
import { SettingsView } from "./SettingsView";
import { Card, EmptyState, Icons, cx } from "./ui";

const NAV: { view: View; label: string; icon: React.ReactNode }[] = [
  { view: "home", label: "ホーム", icon: Icons.home },
  { view: "history", label: "履歴", icon: Icons.list },
  { view: "analysis", label: "分析", icon: Icons.chart },
  { view: "ai", label: "AI分析", icon: Icons.ai },
  { view: "settings", label: "設定", icon: Icons.settings },
];

const VIEWS: Record<View, () => React.ReactNode> = {
  home: HomeView,
  history: HistoryView,
  analysis: AnalysisView,
  ai: AiView,
  settings: SettingsView,
};

function Brand({ className }: { className?: string }) {
  return <div className={cx("font-display text-xl tracking-[0.06em]", className)}>家計簿ノート</div>;
}

function MonthNav() {
  const { month, setMonth, view } = useKakeibo();
  const hidden = !month || view === "ai" || view === "settings";
  return (
    <div className={cx("flex items-center gap-0.5 rounded-full border border-line bg-surface p-0.5", hidden && "invisible")}>
      <button type="button" aria-label="前の月" onClick={() => setMonth(addMonths(month, -1))} className="size-9 rounded-full text-lg text-muted hover:bg-surface-2">
        ‹
      </button>
      <span className="min-w-24 text-center text-sm font-bold">{month && monthLabel(month)}</span>
      <button type="button" aria-label="次の月" onClick={() => setMonth(addMonths(month, 1))} className="size-9 rounded-full text-lg text-muted hover:bg-surface-2">
        ›
      </button>
    </div>
  );
}

export function AppShell() {
  const { view, setView, openEntry, entry, ready, loadError, storeKind, toastMessage } = useKakeibo();
  const Current = VIEWS[view];

  // "N" opens the entry sheet on a keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement as HTMLElement | null)?.tagName ?? "");
      if (!typing && !entry.open && (e.key === "n" || e.key === "N") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        openEntry();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entry.open, openEntry]);

  // Phone tab bar: ホーム 履歴 [記入] 分析 AI分析 (settings opens from ホーム)
  const tabs = NAV.filter((n) => n.view !== "settings");

  return (
    <div className="grid min-h-full grid-cols-1 lg:grid-cols-[220px_1fr]">
      <nav aria-label="メニュー" className="sticky top-0 hidden h-dvh flex-col gap-1 border-r border-line bg-surface px-3.5 py-5 lg:flex">
        <Brand className="mx-2 mb-5" />
        <button
          type="button"
          onClick={() => openEntry()}
          className="mb-3.5 flex items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 font-bold text-accent-ink hover:brightness-110 [&_svg]:size-5"
        >
          {Icons.plus}記入する
        </button>
        {NAV.map((n) => (
          <button
            key={n.view}
            type="button"
            onClick={() => setView(n.view)}
            className={cx(
              "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left [&_svg]:size-5",
              view === n.view ? "bg-accent-soft font-bold text-accent" : "font-medium text-muted hover:bg-surface-2",
            )}
          >
            {n.icon}
            {n.label}
          </button>
        ))}
        <p className="mt-auto px-2 text-[11px] text-muted">
          N キーでいつでも記入
          <br />
          {storeKind === "supabase" ? "クラウドに自動保存" : "デモ：このブラウザに保存"}
        </p>
      </nav>

      <main className="mx-auto w-full min-w-0 max-w-[1120px] px-4 pb-32 lg:px-7 lg:pb-10">
        <header className="sticky top-[env(safe-area-inset-top,0px)] z-10 flex items-center justify-between gap-2 bg-bg py-3">
          <Brand className="lg:invisible" />
          <MonthNav />
        </header>
        {loadError ? (
          <Card>
            <EmptyState title="記録を読み込めませんでした">{loadError}</EmptyState>
          </Card>
        ) : ready ? (
          <Current />
        ) : (
          <Card>
            <EmptyState title="読み込み中…">記録を取り出しています</EmptyState>
          </Card>
        )}
      </main>

      <nav
        aria-label="メニュー"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-surface px-1.5 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom,0px))] lg:hidden"
      >
        {tabs.slice(0, 2).map((n) => (
          <TabButton key={n.view} active={view === n.view} onClick={() => setView(n.view)} icon={n.icon} label={n.label} />
        ))}
        <button type="button" onClick={() => openEntry()} aria-label="記入する" className="flex flex-col items-center gap-px text-[10px] font-bold text-accent">
          <span className="-mt-6 grid size-[52px] place-items-center rounded-full bg-accent text-accent-ink shadow-lg [&_svg]:size-6">{Icons.plus}</span>
          記入
        </button>
        {tabs.slice(2).map((n) => (
          <TabButton key={n.view} active={view === n.view} onClick={() => setView(n.view)} icon={n.icon} label={n.label} />
        ))}
      </nav>

      <EntrySheet />

      {toastMessage && (
        <div role="status" className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-4 py-2 text-[13px] text-bg lg:bottom-8">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx("flex flex-col items-center gap-px rounded-xl py-1 text-[10px] [&_svg]:size-[22px]", active ? "font-bold text-accent" : "text-muted")}
    >
      {icon}
      {label}
    </button>
  );
}
