"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEFAULT_SETTINGS, FALLBACK_CATEGORY, getCategory, setCategories } from "@/lib/categories";
import { setTimeZone } from "@/lib/date";
import { setCurrency } from "@/lib/format";
import { dict } from "@/lib/i18n/dict";
import { currentPeriod } from "@/lib/period";
import { createLocalStore } from "@/lib/store/local";
import { createSupabaseStore } from "@/lib/store/supabase";
import type { KakeiboStore } from "@/lib/store/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/client";
import type { NewTransaction, Settings, Transaction, TxType } from "@/lib/types";
import { changeLanguage, useLanguage } from "./LanguageProvider";

function withoutSampleFixedCosts(fixedCosts: Settings["fixedCosts"]): Settings["fixedCosts"] {
  const out: Settings["fixedCosts"] = {};
  for (const [month, items] of Object.entries(fixedCosts)) {
    const kept = items.filter((f) => !f.isSample);
    // a month left only with samples goes back to inheriting
    if (kept.length || !items.length) out[month] = kept;
  }
  return out;
}

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
  /** `type` presets a new entry's type; ignored when editing. */
  entry: { open: boolean; editing: Transaction | null; type?: TxType };
  openEntry: (tx?: Transaction, type?: TxType) => void;
  closeEntry: () => void;
  addTransactions: (items: NewTransaction[]) => Promise<Transaction[]>;
  updateTransaction: (id: string, item: NewTransaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  deleteSamples: () => Promise<void>;
  /** Deletes a category the user added; its records and fixed costs move to `moveTo`. */
  deleteCategory: (id: string, moveTo: string) => Promise<void>;
  updateSettings: (change: (s: Settings) => Settings) => Promise<void>;
  toast: (msg: string) => void;
  toastMessage: string | null;
  /** Savings amounts masked as ***** on this device (a screen-privacy aid, like hiding a balance). */
  savingsHidden: boolean;
  hideSavings: () => void;
  /** Show savings again. Signed in, this checks the login password; resolves false if it is wrong. */
  revealSavings: (password: string) => Promise<boolean>;
};

const HIDE_KEY = "kakeibo-app.hideSavings";

function storeHidden(hidden: boolean) {
  try {
    if (hidden) localStorage.setItem(HIDE_KEY, "1");
    else localStorage.removeItem(HIDE_KEY);
  } catch {
    // storage blocked: the choice lasts until reload
  }
}

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
  // Re-render every screen (they read useKakeibo) when the display language changes.
  useLanguage();
  // Money labels read the currency from format.ts; set it before any child renders.
  setCurrency(settings.currency);
  // Same for the time zone "today" is read in.
  setTimeZone(settings.timeZone);
  // And the user's categories.
  setCategories(settings.categories);
  // Set after mount: the current date must not be read while prerendering.
  const [month, setMonth] = useState("");
  const [view, setViewState] = useState<View>("home");
  const [entry, setEntry] = useState<Ctx["entry"]>({ open: false, editing: null });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [savingsHidden, setSavingsHidden] = useState(false);
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
        setTimeZone(data.settings.timeZone);
        setCategories(data.settings.categories);
        setMonth(currentPeriod(data.settings.monthStartDay));
        try {
          setSavingsHidden(localStorage.getItem(HIDE_KEY) === "1");
        } catch {
          // storage blocked: start shown
        }
        setReady(true);
      })
      .catch((e: Error) => !cancelled && setLoadError(e.message));
    return () => {
      cancelled = true;
    };
  }, [store]);

  // A saved language wins over the browser's; it also lands in the cookie the server and login page read.
  useEffect(() => {
    if (settings.language) changeLanguage(settings.language);
  }, [settings.language]);

  // Claude can save an analysis over MCP while the app sits in the background (e.g. after
  // "Claude で分析して保存"), so pick up the latest one whenever the app comes back to the front.
  useEffect(() => {
    if (!ready || !store.loadLastAi) return;
    const loadLastAi = store.loadLastAi;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      loadLastAi()
        .then((lastAi) => {
          if (!lastAi || lastAi.at === settingsRef.current.lastAi?.at) return;
          settingsRef.current = { ...settingsRef.current, lastAi };
          setSettings(settingsRef.current);
        })
        .catch(() => {
          // offline: keep showing what we have
        });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [ready, store]);

  // Payments recorded from the iPhone Wallet arrive while the app sits in the background, so pick up
  // records created since the newest one shown whenever the app comes back to the front.
  const newestRef = useRef("");
  const transactionsRef = useRef(transactions);
  useEffect(() => {
    transactionsRef.current = transactions;
    newestRef.current = transactions.reduce((max, t) => (t.createdAt > max ? t.createdAt : max), "");
  }, [transactions]);
  useEffect(() => {
    if (!ready || !store.loadNewTransactions) return;
    const loadNew = store.loadNewTransactions;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      loadNew(newestRef.current || new Date(0).toISOString())
        .then((created) => {
          if (!created.length) return;
          setTransactions((prev) => {
            const known = new Set(prev.map((t) => t.id));
            const added = created.filter((t) => !known.has(t.id));
            return added.length ? [...prev, ...added].sort(byNewest) : prev;
          });
        })
        .catch(() => {
          // offline: keep showing what we have
        });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [ready, store]);

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

  /** Apply a settings change right away, then save in order (one write at a time). */
  const updateSettings = useCallback(
    (change: (s: Settings) => Settings) => {
      const next = change(settingsRef.current);
      settingsRef.current = next;
      setSettings(next);
      const job = settingsQueue.current.then(() => store.saveSettings(next));
      settingsQueue.current = job.catch(() => {});
      return job.catch(() => toast(dict().common.settingsSaveFailed));
    },
    [store, toast],
  );

  const deleteSamples = useCallback(async () => {
    await store.deleteSamples();
    setTransactions((prev) => prev.filter((t) => !t.isSample));
    if (Object.values(settingsRef.current.fixedCosts).some((items) => items.some((f) => f.isSample))) {
      await updateSettings((s) => ({ ...s, fixedCosts: withoutSampleFixedCosts(s.fixedCosts) }));
    }
  }, [store, updateSettings]);

  const deleteCategory = useCallback(
    async (id: string, moveTo: string) => {
      const target = moveTo || FALLBACK_CATEGORY[getCategory(id).type];
      if (transactionsRef.current.some((t) => t.category === id)) {
        await store.moveCategory(id, target);
        setTransactions((prev) => prev.map((t) => (t.category === id ? { ...t, category: target } : t)));
      }
      await updateSettings((s) => {
        const fixedCosts: Settings["fixedCosts"] = {};
        for (const [month, items] of Object.entries(s.fixedCosts)) {
          fixedCosts[month] = items.map((f) => (f.category === id ? { ...f, category: target } : f));
        }
        const budgets = { ...s.budgets };
        delete budgets[id];
        const order = Object.fromEntries(Object.entries(s.categories.order).map(([type, ids]) => [type, ids?.filter((x) => x !== id)]));
        return {
          ...s,
          budgets,
          fixedCosts,
          categories: { ...s.categories, custom: s.categories.custom.filter((c) => c.id !== id), order },
        };
      });
    },
    [store, updateSettings],
  );

  const hideSavings = useCallback(() => {
    setSavingsHidden(true);
    storeHidden(true);
  }, []);

  const revealSavings = useCallback(
    async (password: string) => {
      if (store.kind === "supabase") {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        const email = data.user?.email;
        if (!email) throw new Error(dict().common.sessionExpired);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          // 400 is a wrong password; anything else (offline, rate limit) is not the user's typo
          if (error.status === 400) return false;
          throw new Error(dict().common.verifyFailed);
        }
      }
      setSavingsHidden(false);
      storeHidden(false);
      return true;
    },
    [store],
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
    openEntry: (tx, type) => setEntry({ open: true, editing: tx ?? null, type }),
    closeEntry: () => setEntry({ open: false, editing: null }),
    addTransactions,
    updateTransaction,
    deleteTransaction,
    deleteSamples,
    deleteCategory,
    updateSettings,
    toast,
    toastMessage,
    savingsHidden,
    hideSavings,
    revealSavings,
  };

  return <KakeiboContext.Provider value={value}>{children}</KakeiboContext.Provider>;
}
