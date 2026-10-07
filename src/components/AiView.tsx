"use client";

import { useRef, useState } from "react";
import { yen } from "@/lib/format";
import { buildAiDigest } from "@/lib/stats";
import type { AiAnalysis, ChatTurn } from "@/lib/types";
import { useKakeibo } from "./KakeiboProvider";
import { Button, Card, CardTitle, EmptyState, cx } from "./ui";

const MIN_RECORDS = 5;

async function errorText(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? "うまくいきませんでした。もう一度お試しください";
  } catch {
    return "うまくいきませんでした。もう一度お試しください";
  }
}

export function AiView() {
  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-[1.15fr_1fr]">
      <Analysis />
      <Chat />
    </div>
  );
}

function Analysis() {
  const { transactions, settings, updateSettings } = useKakeibo();
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
        body: JSON.stringify({ digest: buildAiDigest(transactions, settings) }),
      });
      if (!res.ok) throw new Error(await errorText(res));
      const { result } = (await res.json()) as { result: AiAnalysis };
      await updateSettings((s) => ({ ...s, lastAi: { at: new Date().toISOString(), result } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "分析できませんでした");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3.5">
      <Card>
        <CardTitle>AIによる傾向分析</CardTitle>
        <p className="mb-3 text-sm">直近3か月の集計・予算・貯金目標をAIに渡して、お金の使い方のクセと節約のヒントを出します。送るのはカテゴリやメモごとの合計で、1件ずつの記録は送りません。</p>
        <Button variant="primary" onClick={run} disabled={busy || !enough}>
          {busy ? "分析しています…" : last ? "もう一度分析する" : "AIで分析する"}
        </Button>
        {!enough && <p className="mt-2 text-xs text-muted">{MIN_RECORDS}件以上記録すると分析できます</p>}
        {last && <p className="mt-2 text-xs text-muted">前回の分析：{new Date(last.at).toLocaleString("ja-JP")}</p>}
        {error && <p className="mt-2 text-xs text-bad">{error}</p>}
      </Card>
      {last ? (
        <AnalysisResult result={last.result} />
      ) : (
        <Card>
          <EmptyState title="分析結果はここに表示されます">スコア、見えてきた傾向、次の一手の3つにまとめます</EmptyState>
        </Card>
      )}
    </div>
  );
}

const INSIGHT_BG = { good: "bg-good-soft", warn: "bg-warn-soft", info: "bg-surface-2" } as const;

function AnalysisResult({ result }: { result: AiAnalysis }) {
  return (
    <>
      <Card className="flex items-center gap-4">
        <div className="num text-[52px] leading-none font-bold text-accent">{result.score}</div>
        <div>
          <div className="text-xs text-muted">家計スコア（100点満点）</div>
          <div className="text-base font-bold">{result.headline}</div>
        </div>
      </Card>
      <Card>
        <CardTitle>見えてきた傾向</CardTitle>
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
        <CardTitle>次の一手</CardTitle>
        {result.actions.map((a, n) => (
          <div key={n} className="grid grid-cols-[1fr_auto] gap-2.5 border-t border-line py-2.5 first:border-t-0">
            <div>
              <b>{a.title}</b>
              <div className="text-sm">{a.detail}</div>
            </div>
            {a.monthlySaving > 0 && <span className="num h-fit rounded-full bg-good-soft px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-good">月 {yen(a.monthlySaving)}</span>}
          </div>
        ))}
        {result.cheer && <p className="mt-3 text-sm text-muted">{result.cheer}</p>}
      </Card>
    </>
  );
}

function Chat() {
  const { transactions, settings } = useKakeibo();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function ask(question: string) {
    const history: ChatTurn[] = [...turns, { role: "user", content: question }];
    setTurns([...history, { role: "assistant", content: "考えています…" }]);
    setInput("");
    setBusy(true);
    const ctl = new AbortController();
    abortRef.current = ctl;
    const setAnswer = (content: string) => setTurns([...history, { role: "assistant", content }]);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digest: buildAiDigest(transactions, settings), turns: history }),
        signal: ctl.signal,
      });
      if (!res.ok || !res.body) throw new Error(await errorText(res));
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setAnswer(text);
      }
      if (!text) setAnswer("答えを取得できませんでした。");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setAnswer(e instanceof Error ? e.message : "答えを取得できませんでした。");
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <Card>
      <CardTitle>AIに相談する</CardTitle>
      <p className="text-xs text-muted">例：「外食を減らすコツは？」「来月の食費予算はいくらが妥当？」</p>
      <div className="mt-2.5 grid gap-2">
        {turns.map((t, i) => (
          <div key={i} className={cx("rounded-xl px-3 py-2.5 text-sm whitespace-pre-wrap", t.role === "user" ? "max-w-[85%] justify-self-end bg-accent-soft" : "bg-surface-2")}>
            {t.content}
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
          placeholder="家計について質問する"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2"
        />
        {busy ? (
          <Button onClick={() => abortRef.current?.abort()}>止める</Button>
        ) : (
          <Button type="submit" variant="primary">
            送る
          </Button>
        )}
      </form>
    </Card>
  );
}
