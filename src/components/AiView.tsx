"use client";

import { useRef, useState } from "react";
import { yen } from "@/lib/format";
import { buildAiDigest } from "@/lib/stats";
import { DICTS } from "@/lib/i18n/dict";
import type { Language } from "@/lib/i18n";
import type { AiAnalysis, ChatTurn } from "@/lib/types";
import { useKakeibo } from "./KakeiboProvider";
import { useLanguage, useT } from "./LanguageProvider";
import { RevealSheet } from "./SavingsPrivacy";
import { Button, Card, CardTitle, EmptyState, Icons, buttonClass, cx } from "./ui";

const MIN_RECORDS = 5;

/** Opens a new claude.ai chat with the analysis prompt filled in; Claude then uses the kakeibo connector (MCP). */
const claudeAnalysisUrl = (lang: Language) => "https://claude.ai/new?q=" + encodeURIComponent(DICTS[lang].ai.claudePrompt);

async function errorText(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function AiView() {
  const { savingsHidden } = useKakeibo();
  // AI gets the savings figures and can repeat them, so the whole view is locked while they are hidden.
  if (savingsHidden) return <Locked />;
  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-[1.15fr_1fr]">
      <Analysis />
      <Chat />
    </div>
  );
}

function Locked() {
  const t = useT().ai;
  const [asking, setAsking] = useState(false);
  return (
    <Card className="grid justify-items-center gap-3 py-8 text-center">
      <span className="text-muted [&_svg]:size-7">{Icons.eyeOff}</span>
      <p className="text-sm text-muted">{t.lockedNote}</p>
      <Button variant="primary" onClick={() => setAsking(true)}>
        {t.unlock}
      </Button>
      {asking && <RevealSheet onClose={() => setAsking(false)} />}
    </Card>
  );
}

function Analysis() {
  const { transactions, settings, updateSettings, storeKind } = useKakeibo();
  const t = useT().ai;
  const language = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const last = settings.lastAi;
  const enough = transactions.length >= MIN_RECORDS;

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digest: buildAiDigest(transactions, settings), language }),
      });
      if (!res.ok) throw new Error(await errorText(res, t.genericError));
      const { result } = (await res.json()) as { result: AiAnalysis };
      await updateSettings((s) => ({ ...s, lastAi: { at: new Date().toISOString(), result, source: "app" } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.analyzeFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3.5">
      <Card>
        <CardTitle>{t.analysisTitle}</CardTitle>
        <p className="mb-3 text-sm">{t.analysisLead}</p>
        <Button variant="primary" onClick={run} disabled={busy || !enough}>
          {busy ? t.analyzing : last ? t.analyzeAgain : t.analyze}
        </Button>
        {!enough && <p className="mt-2 text-xs text-muted">{t.needRecords(MIN_RECORDS)}</p>}
        {last && (
          <p className="mt-2 text-xs text-muted">
            {t.lastAnalysis(new Date(last.at).toLocaleString(language === "en" ? "en-US" : "ja-JP"))}
            {last.source === "claude" && t.byClaude}
          </p>
        )}
        {error && <p className="mt-2 text-xs text-bad">{error}</p>}
      </Card>
      {storeKind === "supabase" && (
        <Card>
          <CardTitle>{t.claudeTitle}</CardTitle>
          <p className="mb-3 text-sm">{t.claudeLead}</p>
          <a href={claudeAnalysisUrl(language)} target="_blank" rel="noopener noreferrer" className={buttonClass("default")}>
            {t.claudeButton}
          </a>
          <p className="mt-2 text-xs text-muted">{t.claudeNote}</p>
        </Card>
      )}
      {last ? (
        <AnalysisResult result={last.result} />
      ) : (
        <Card>
          <EmptyState title={t.emptyTitle}>{t.emptyBody}</EmptyState>
        </Card>
      )}
    </div>
  );
}

const INSIGHT_BG = { good: "bg-good-soft", warn: "bg-warn-soft", info: "bg-surface-2" } as const;

function AnalysisResult({ result }: { result: AiAnalysis }) {
  const t = useT().ai;
  return (
    <>
      <Card className="flex items-center gap-4">
        <div className="num text-[52px] leading-none font-bold text-accent">{result.score}</div>
        <div>
          <div className="text-xs text-muted">{t.scoreLabel}</div>
          <div className="text-base font-bold">{result.headline}</div>
        </div>
      </Card>
      <Card>
        <CardTitle>{t.insightsTitle}</CardTitle>
        <div className="grid gap-2">
          {result.insights.map((i, n) => (
            <div key={n} className={cx("rounded-xl px-3.5 py-3", INSIGHT_BG[i.kind] ?? INSIGHT_BG.info)}>
              <b className="mb-0.5 block">{i.title}</b>
              <p className="text-sm">{i.detail}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <CardTitle>{t.actionsTitle}</CardTitle>
        {result.actions.map((a, n) => (
          <div key={n} className="grid grid-cols-[1fr_auto] gap-2.5 border-t border-line py-2.5 first:border-t-0">
            <div>
              <b>{a.title}</b>
              <div className="text-sm">{a.detail}</div>
            </div>
            {a.monthlySaving > 0 && <span className="num h-fit rounded-full bg-good-soft px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-good">{t.perMonth(yen(a.monthlySaving))}</span>}
          </div>
        ))}
        {result.cheer && <p className="mt-3 text-sm text-muted">{result.cheer}</p>}
      </Card>
    </>
  );
}

function Chat() {
  const { transactions, settings } = useKakeibo();
  const t = useT().ai;
  const language = useLanguage();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function ask(question: string) {
    const history: ChatTurn[] = [...turns, { role: "user", content: question }];
    setTurns([...history, { role: "assistant", content: t.thinking }]);
    setInput("");
    setBusy(true);
    const ctl = new AbortController();
    abortRef.current = ctl;
    const setAnswer = (content: string) => setTurns([...history, { role: "assistant", content }]);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digest: buildAiDigest(transactions, settings), turns: history, language }),
        signal: ctl.signal,
      });
      if (!res.ok || !res.body) throw new Error(await errorText(res, t.genericError));
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setAnswer(text);
      }
      if (!text) setAnswer(t.noAnswer);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setAnswer(e instanceof Error ? e.message : t.noAnswer);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <Card>
      <CardTitle>{t.chatTitle}</CardTitle>
      <p className="text-xs text-muted">{t.chatExamples}</p>
      <div className="mt-2.5 grid gap-2">
        {turns.map((turn, i) => (
          <div key={i} className={cx("rounded-xl px-3 py-2.5 text-sm whitespace-pre-wrap", turn.role === "user" ? "max-w-[85%] justify-self-end bg-accent-soft" : "bg-surface-2")}>
            {turn.content}
          </div>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const q = input.trim();
          if (q && !busy) void ask(q);
        }}
      >
        <input
          id="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.chatPlaceholder}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2"
        />
        {busy ? (
          <Button onClick={() => abortRef.current?.abort()}>{t.stop}</Button>
        ) : (
          <Button type="submit" variant="primary">
            {t.send}
          </Button>
        )}
      </form>
    </Card>
  );
}
