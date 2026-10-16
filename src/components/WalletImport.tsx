"use client";

import { useEffect, useState } from "react";
import { getLanguage } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import type { NewTransaction, Transaction } from "@/lib/types";
import { useKakeibo } from "./KakeiboProvider";
import { useT } from "./LanguageProvider";
import { Button, Card, CardTitle, TextButton, TxRow } from "./ui";

type KeyInfo = { created_at: string; last_used_at: string | null };

const when = (iso: string) =>
  new Date(iso).toLocaleString(getLanguage() === "en" ? "en-US" : "ja-JP", { dateStyle: "medium", timeStyle: "short" });

/** Settings card: issue or turn off the key the iPhone shortcut sends payments with. */
export function WalletImportSettings() {
  const { storeKind, toast } = useKakeibo();
  const t = useT().wallet;
  // undefined while loading
  const [info, setInfo] = useState<KeyInfo | null | undefined>(undefined);
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/api/import/wallet`;

  useEffect(() => {
    if (storeKind !== "supabase") return;
    createClient()
      .from("import_keys")
      .select("created_at, last_used_at")
      .maybeSingle()
      // before migration 0008 the table is missing: show the card as not issued
      .then(({ data }) => setInfo((data as KeyInfo | null) ?? null));
  }, [storeKind]);

  async function issue() {
    setBusy(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("create_import_key");
      if (error || typeof data !== "string") throw error;
      setKey(data);
      setInfo({ created_at: new Date().toISOString(), last_used_at: null });
      setConfirmRevoke(false);
      toast(t.issuedToast);
    } catch {
      toast(t.failed);
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!confirmRevoke) {
      setConfirmRevoke(true);
      return;
    }
    setBusy(true);
    try {
      const { data: auth } = await createClient().auth.getUser();
      const { error } = await createClient().from("import_keys").delete().eq("user_id", auth.user?.id ?? "");
      if (error) throw error;
      setInfo(null);
      setKey(null);
      setConfirmRevoke(false);
      toast(t.revokedToast);
    } catch {
      toast(t.failed);
    } finally {
      setBusy(false);
    }
  }

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast(t.copied);
    } catch {
      // clipboard blocked: the text can still be selected by hand
    }
  };

  return (
    <Card>
      <CardTitle>{t.title}</CardTitle>
      <p className="text-sm">{t.intro}</p>
      {storeKind !== "supabase" ? (
        <p className="mt-2 text-xs text-muted">{t.demoOnly}</p>
      ) : (
        <>
          <p className="mt-2.5 text-sm">
            {info ? t.issued(when(info.created_at)) : info === null ? t.notIssued : "…"}
            {info && <span className="block text-xs text-muted">{info.last_used_at ? t.lastUsed(when(info.last_used_at)) : t.neverUsed}</span>}
          </p>

          {key && (
            <div className="mt-2.5 grid gap-2 rounded-xl bg-surface-2 p-3">
              <CopyField label={t.urlLabel} value={url} onCopy={copy} copyLabel={t.copy} />
              <CopyField label={t.keyLabel} value={key} onCopy={copy} copyLabel={t.copy} />
            </div>
          )}

          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button variant={info ? "default" : "primary"} disabled={busy || info === undefined} onClick={issue}>
              {info ? t.reissue : t.issue}
            </Button>
            {info && (
              <Button variant="danger" disabled={busy} onClick={revoke}>
                {confirmRevoke ? t.confirmRevoke : t.revoke}
              </Button>
            )}
          </div>
          {info && <p className="mt-1.5 text-xs text-muted">{t.reissueNote}</p>}

          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-bold text-accent">{t.stepsTitle}</summary>
            <ol className="mt-2 grid list-decimal gap-1.5 pl-5">
              {t.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-muted">{t.stepsNote}</p>
          </details>
        </>
      )}
    </Card>
  );
}

function CopyField({ label, value, onCopy, copyLabel }: { label: string; value: string; onCopy: (v: string) => void; copyLabel: string }) {
  return (
    <div>
      <span className="mb-1 block text-[11px] tracking-wide text-muted">{label}</span>
      <div className="flex gap-2">
        <input readOnly value={value} onFocus={(e) => e.target.select()} className="num min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-xs" />
        <Button onClick={() => onCopy(value)}>{copyLabel}</Button>
      </div>
    </div>
  );
}

/** The record as saved, marked confirmed. */
export const confirmed = (tx: Transaction): NewTransaction => ({
  date: tx.date,
  amount: tx.amount,
  type: tx.type,
  category: tx.category,
  memo: tx.memo,
  outsideBudget: tx.outsideBudget,
  ...(tx.splitId ? { splitId: tx.splitId } : {}),
  ...(tx.note ? { note: tx.note } : {}),
  ...(tx.receiptId ? { receiptId: tx.receiptId } : {}),
  isSample: tx.isSample,
  needsReview: false,
});

/** Home card listing automatic records that still need a look. */
export function WalletReviewCard() {
  const { transactions, updateTransaction, openEntry, toast } = useKakeibo();
  const t = useT().wallet;
  const [busy, setBusy] = useState(false);
  const pending = transactions.filter((tx) => tx.needsReview);
  if (!pending.length) return null;

  async function confirmItems(items: Transaction[]) {
    setBusy(true);
    try {
      for (const tx of items) await updateTransaction(tx.id, confirmed(tx));
      toast(t.confirmed);
    } catch {
      toast(t.confirmFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle action={pending.length > 1 && <TextButton disabled={busy} onClick={() => confirmItems(pending)}>{t.okAll}</TextButton>}>
        {t.reviewTitle(pending.length)}
      </CardTitle>
      {pending.some((tx) => tx.source === "wallet") && <p className="mb-1 text-xs text-muted">{t.reviewHint}</p>}
      {pending.some((tx) => tx.source !== "wallet") && <p className="mb-1 text-xs text-muted">{t.reviewHintReceipt}</p>}
      {pending.map((tx) => (
        <div key={tx.id} className="grid grid-cols-[1fr_auto] items-center gap-2 border-t border-line first:border-t-0">
          <TxRow tx={tx} onClick={() => openEntry(tx)} />
          <Button disabled={busy} onClick={() => confirmItems([tx])}>
            {t.ok}
          </Button>
        </div>
      ))}
    </Card>
  );
}
