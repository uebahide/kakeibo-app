"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEFAULT_SETTINGS } from "@/lib/categories";
import { currentMonth } from "@/lib/date";
import { createLocalStore } from "@/lib/store/local";
import { createSupabaseStore } from "@/lib/store/supabase";
import type { KakeiboStore } from "@/lib/store/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/client";
import type { NewTransaction, Settings, Transaction } from "@/lib/types";

export type View = "home" | "history" | "analysis" | "ai" | "settings";

type Ctx = {
  ready: boolean;
  loadError: string | null;
  storeKind: KakeiboStore["kind"];
  transactions: Transaction[];
  settings: Settings;
  month: string;
  setMonth: (m: string) => void;
  view: View;
  setView: (v: View) => void;
  entry: { open: boolean; editing: Transaction | null };
  openEntry: (tx?: Transaction) => void;
  closeEntry: () => void;
  addTransactions: (items: NewTransaction[]) => Promise<Transaction[]>;
  updateTransaction: (id: string, item: NewTransaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  deleteSamples: () => Promise<void>;
  updateSettings: (change: (s: Settings) => Settings) => Promise<void>;
  toast: (msg: string) => void;
  toastMessage: string | null;
};

const KakeiboContext = createContext<Ctx | null>(null);

export function useKakeibo(): Ctx {
  const ctx = useContext(KakeiboContext);
  if (!ctx) throw new Error("useKakeibo must be used inside KakeiboProvider");
  return ctx;
}

const byNewest = (a: Transaction, b: Transaction) =>
  b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

export function KakeiboProvider({ children }: { children: ReactNode }) {
  const store = useMemo<KakeiboStore>(
    () => (isSupabaseConfigured ? createSupabaseStore(createClient()) : createLocalStore()),
    [],
  );
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  // Set after mount: the current date must not be read while prerendering.
  const [month, setMonth] = useState("");
  const [view, setViewState] = useState<View>("home");
  const [entry, setEntry] = useState<Ctx["entry"]>({ open: false, editing: null });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const settingsRef = useRef(settings);
  const settingsQueue = useRef(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    store
      .load()
      .then((data) => {
        if (cancelled) return;
        setTransactions(data.transactions.sort(byNewest));
        setSettings(data.settings);
        settingsRef.current = data.settings;
        setMonth(currentMonth());
        setReady(true);
      })
      .catch((e: Error) => !cancelled && setLoadError(e.message));
    return () => {
      cancelled = true;
    };
  }, [store]);

  const toast = useCallback((msg: string) => {
    setToastMessage(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 2400);
  }, []);

  const setView = useCallback((v: View) => {
    setViewState(v);
    window.scrollTo({ top: 0 });
  }, []);

  const addTransactions = useCallback(
    async (items: NewTransaction[]) => {
      const created = await store.addTransactions(items);
      setTransactions((prev) => [...prev, ...created].sort(byNewest));
      return created;
    },
    [store],
  );

  const updateTransaction = useCallback(
    async (id: string, item: NewTransaction) => {
      const updated = await store.updateTransaction(id, item);
      setTransactions((prev) => prev.map((t) => (t.id === id ? updated : t)).sort(byNewest));
    },
    [store],
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      await store.deleteTransaction(id);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    },
    [store],
  );

  const deleteSamples = useCallback(async () => {
    await store.deleteSamples();
    setTransactions((prev) => prev.filter((t) => !t.isSample));
  }, [store]);

  /** Apply a settings change right away, then save in order (one write at a time). */
  const updateSettings = useCallback(
    (change: (s: Settings) => Settings) => {
      const next = change(settingsRef.current);
      settingsRef.current = next;
      setSettings(next);
      const job = settingsQueue.current.then(() => store.saveSettings(next));
      settingsQueue.current = job.catch(() => {});
      return job.catch(() => toast("設定を保存できませんでした"));
    },
    [store, toast],
  );

  const value: Ctx = {
    ready,
    loadError,
    storeKind: store.kind,
    transactions,
    settings,
    month,
    setMonth,
    view,
    setView,
    entry,
    openEntry: (tx) => setEntry({ open: true, editing: tx ?? null }),
    closeEntry: () => setEntry({ open: false, editing: null }),
    addTransactions,
    updateTransaction,
    deleteTransaction,
    deleteSamples,
    updateSettings,
    toast,
    toastMessage,
  };

  return <KakeiboContext.Provider value={value}>{children}</KakeiboContext.Provider>;
}
