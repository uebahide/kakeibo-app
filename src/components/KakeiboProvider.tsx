"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEFAULT_SETTINGS, FALLBACK_CATEGORY, getCategory, setCategories } from "@/lib/categories";
import { setTimeZone } from "@/lib/date";
import { setCurrency } from "@/lib/format";
import { dict } from "@/lib/i18n/dict";
import { currentPeriod } from "@/lib/period";
import { createLocalStore } from "@/lib/store/local";
import { withOfflineQueue } from "@/lib/store/offline";
import { createSupabaseStore } from "@/lib/store/supabase";
import type { KakeiboStore, ReceiptStore } from "@/lib/store/types";
import { photosOf, sortTrash, type TrashEntry } from "@/lib/trash";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/client";
import type { NewTransaction, Settings, Transaction, TxType } from "@/lib/types";
import type { WeeklyReview } from "@/lib/weeklyReview";
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
  /** Opened without a signal: showing what was loaded last time on this device, until the connection is back. */
  showingSaved: boolean;
  storeKind: KakeiboStore["kind"];
  /** Receipt photos; only when signed in. */
  receipts?: ReceiptStore;
  /** Whether "Read with Claude" is offered for a receipt photo. */
  canReadReceipts: boolean;
  transactions: Transaction[];
  settings: Settings;
  month: string;
  setMonth: (m: string) => void;
  view: View;
  setView: (v: View) => void;
  /** The filter the history opens with: "all", or a category id when another screen sent the user there. */
  historyFilter: string;
  /** Opens the history with its records filtered (a category id). */
  openHistory: (filter: string) => void;
  /** `type` presets a new entry's type; ignored when editing. `viewing`: a record is shown, not yet edited. */
  entry: { open: boolean; editing: Transaction | null; type?: TxType; viewing?: boolean };
  /** With a record, opens its details first; "Edit" there (editEntry) opens the form. */
  openEntry: (tx?: Transaction, type?: TxType) => void;
  editEntry: () => void;
  closeEntry: () => void;
  addTransactions: (items: NewTransaction[]) => Promise<Transaction[]>;
  updateTransaction: (id: string, item: NewTransaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  /** Deletes records the user chose to delete (a payment and its parts) into "Recently deleted", and offers to undo it for a few seconds. */
  deleteRecords: (items: Transaction[]) => Promise<void>;
  /** "Recently deleted": what was deleted in the last TRASH_DAYS days, newest first. */
  trash: TrashEntry[];
  /** Puts a recently deleted payment back. */
  restoreTrash: (entry: TrashEntry) => Promise<void>;
  /** Deletes everything in "Recently deleted" for good, with the receipt photos. */
  emptyTrash: () => Promise<void>;
  deleteSamples: () => Promise<void>;
  /** Claude's weekly reviews, newest week first. */
  weeklyReviews: WeeklyReview[];
  /** Deletes a category the user added; its records and fixed costs move to `moveTo`. */
  deleteCategory: (id: string, moveTo: string) => Promise<void>;
  updateSettings: (change: (s: Settings) => Settings) => Promise<void>;
  toast: (msg: string, action?: ToastAction) => void;
  /** Load every record again when the app comes back to the front (Claude may change records in claude.ai meanwhile). */
  reloadOnReturn: () => void;
  toastMessage: string | null;
  /** A button shown in the toast, such as "Undo". */
  toastAction: ToastAction | null;
  /** Savings amounts masked as ***** on this device (a screen-privacy aid, like hiding a balance). */
  savingsHidden: boolean;
  hideSavings: () => void;
  /** Show savings again. Signed in, this checks the login password; resolves false if it is wrong. */
  revealSavings: (password: string) => Promise<boolean>;
};

export type ToastAction = { label: string; run: () => void };

/** How long a toast with a button (such as "Undo") stays; a plain message goes sooner. */
export const ACTION_TOAST_MS = 6000;
const TOAST_MS = 2400;

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

/** `canReadReceipts`: the server has a Claude API key, so the app can read receipt photos itself. */
export function KakeiboProvider({ children, canReadReceipts = false }: { children: ReactNode; canReadReceipts?: boolean }) {
  const store = useMemo<KakeiboStore>(
    () => (isSupabaseConfigured ? withOfflineQueue(createSupabaseStore(createClient())) : createLocalStore()),
    [],
  );
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showingSaved, setShowingSaved] = useState(false);
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
  const [historyFilter, setHistoryFilter] = useState("all");
  const [entry, setEntry] = useState<Ctx["entry"]>({ open: false, editing: null });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastAction, setToastAction] = useState<ToastAction | null>(null);
  // What to do once the last delete can no longer be undone (delete its receipt photo, when there is no "Recently deleted").
  const undoExpired = useRef<(() => void) | null>(null);
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
        setShowingSaved(Boolean(data.fromDevice));
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

  // The service worker keeps the app's page and files, so it opens without a signal (production only:
  // in development it would serve stale code).
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // not supported here (private browsing): the app works as before, online only
    });
  }, []);

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
  const reloadRef = useRef(false);
  const reloadOnReturn = useCallback(() => {
    reloadRef.current = true;
  }, []);
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
      if (reloadRef.current) {
        reloadRef.current = false;
        store
          .load()
          .then((data) => setTransactions(data.transactions.sort(byNewest)))
          .catch(() => {
            // offline: keep showing what we have
          });
        return;
      }
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

  // Keep what is shown on this device, so the app can open without a signal next time.
  useEffect(() => {
    if (!ready || !store.saveSnapshot) return;
    const save = store.saveSnapshot;
    const timer = setTimeout(() => save({ transactions, settings }), 1000);
    return () => clearTimeout(timer);
  }, [ready, store, transactions, settings]);

  const finishUndo = useCallback(() => {
    const expired = undoExpired.current;
    undoExpired.current = null;
    expired?.();
  }, []);

  // Any new toast replaces the "Undo" button, so the delete it offered to undo becomes final.
  const toast = useCallback(
    (msg: string, action?: ToastAction) => {
      finishUndo();
      setToastMessage(msg);
      setToastAction(action ?? null);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(
        () => {
          setToastMessage(null);
          setToastAction(null);
          finishUndo();
        },
        action ? ACTION_TOAST_MS : TOAST_MS,
      );
    },
    [finishUndo],
  );

  // Leaving the app while "Undo" is still shown makes the delete final.
  useEffect(() => {
    window.addEventListener("pagehide", finishUndo);
    return () => window.removeEventListener("pagehide", finishUndo);
  }, [finishUndo]);

  // Records kept on this device while offline go out once the connection is back (and when the app opens or
  // comes back to the front, in case the "online" event was missed). If the app opened offline, load everything again.
  useEffect(() => {
    if (!ready || !store.sync) return;
    const sync = store.sync;
    let cancelled = false;
    const run = () =>
      sync()
        .then((result) => {
          if (cancelled || !result) return;
          if (result.loaded) {
            setTransactions(result.loaded.transactions.sort(byNewest));
            settingsRef.current = result.loaded.settings;
            setSettings(result.loaded.settings);
            setShowingSaved(false);
          } else {
            const sent = new Map(result.sent.map((t) => [t.id, t]));
            setTransactions((prev) => prev.map((t) => sent.get(t.id) ?? t));
          }
          if (result.sent.length) toast(dict().common.sentPending(result.sent.length));
        })
        .catch(() => {
          // still offline: try again on the next "online" or return to the app
        });
    const onVisible = () => document.visibilityState === "visible" && void run();
    void run();
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ready, store, toast]);

  const setView = useCallback((v: View) => {
    setViewState(v);
    setHistoryFilter("all");
    window.scrollTo({ top: 0 });
  }, []);

  const openHistory = useCallback((filter: string) => {
    setViewState("history");
    setHistoryFilter(filter);
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

  // Claude saves weekly reviews over MCP on a schedule, so load them once ready and again whenever the app comes back to the front.
  const [weeklyReviews, setWeeklyReviews] = useState<WeeklyReview[]>([]);
  // Demo mode makes its review from the sample records, so load again when they come or go.
  const demoSamples = store.kind === "local" && transactions.some((t) => t.isSample);
  useEffect(() => {
    if (!ready || !store.loadWeeklyReviews) return;
    const loadWeeklyReviews = store.loadWeeklyReviews;
    let cancelled = false;
    const load = () =>
      loadWeeklyReviews()
        .then((reviews) => !cancelled && setWeeklyReviews(reviews))
        .catch(() => {
          // offline: keep showing what we have
        });
    const onVisible = () => document.visibilityState === "visible" && void load();
    void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ready, store, demoSamples]);

  // "Recently deleted": loaded once the records are in; entries past TRASH_DAYS go for good, with their photos.
  const [trash, setTrash] = useState<TrashEntry[]>([]);
  const dropPhotos = useCallback(
    (records: Transaction[]) => {
      for (const id of photosOf(records)) void store.receipts?.remove(id).catch(() => {});
    },
    [store],
  );
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    store
      .loadTrash()
      .then(async (entries) => {
        const { kept, expired } = sortTrash(entries);
        if (!cancelled) setTrash(kept);
        for (const e of expired) {
          await store.dropTrash(e.id);
          dropPhotos(e.records);
        }
      })
      .catch(() => {
        // offline: the list stays empty until the next load
      });
    return () => {
      cancelled = true;
    };
  }, [ready, store, dropPhotos]);

  const restoreTrash = useCallback(
    async (entry: TrashEntry) => {
      const restored = await store.restoreTrash(entry);
      setTrash((prev) => prev.filter((e) => e.id !== entry.id));
      setTransactions((prev) => {
        const known = new Set(prev.map((t) => t.id));
        return [...prev, ...restored.filter((t) => !known.has(t.id))].sort(byNewest);
      });
    },
    [store],
  );

  const trashRef = useRef(trash);
  useEffect(() => {
    trashRef.current = trash;
  }, [trash]);
  const emptyTrash = useCallback(async () => {
    for (const e of trashRef.current) {
      await store.dropTrash(e.id);
      setTrash((prev) => prev.filter((x) => x.id !== e.id));
      dropPhotos(e.records);
    }
  }, [store, dropPhotos]);

  const deleteRecords = useCallback(
    async (items: Transaction[]) => {
      const entry = await store.trashTransactions(items);
      const gone = new Set(items.map((p) => p.id));
      setTransactions((prev) => prev.filter((t) => !gone.has(t.id)));
      if (entry) setTrash((prev) => [entry, ...prev]);
      let undone = false;
      toast(dict().entry.deleted, {
        label: dict().entry.undo,
        run: () => {
          if (undone) return;
          undone = true;
          undoExpired.current = null;
          (entry
            ? restoreTrash(entry)
            : store.restoreTransactions(items).then((restored) =>
                setTransactions((prev) => {
                  const known = new Set(prev.map((t) => t.id));
                  return [...prev, ...restored.filter((t) => !known.has(t.id))].sort(byNewest);
                }),
              )
          )
            .then(() => toast(dict().entry.restored))
            .catch(() => {
              if (!entry) dropPhotos(items);
              toast(dict().entry.restoreFailed);
            });
        },
      });
      // Without "Recently deleted" (before migration 0015) the photo goes once "Undo" is gone.
      // Set after toast(), which makes any earlier delete final first.
      if (!entry) undoExpired.current = () => dropPhotos(items);
    },
    [store, toast, restoreTrash, dropPhotos],
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
    showingSaved,
    storeKind: store.kind,
    receipts: store.receipts,
    canReadReceipts,
    transactions,
    settings,
    month,
    setMonth,
    view,
    setView,
    historyFilter,
    openHistory,
    entry,
    openEntry: (tx, type) => setEntry({ open: true, editing: tx ?? null, type, viewing: Boolean(tx) }),
    editEntry: () => setEntry((e) => ({ ...e, viewing: false })),
    closeEntry: () => setEntry({ open: false, editing: null }),
    addTransactions,
    updateTransaction,
    deleteTransaction,
    deleteRecords,
    trash,
    restoreTrash,
    emptyTrash,
    deleteSamples,
    weeklyReviews,
    deleteCategory,
    updateSettings,
    toast,
    reloadOnReturn,
    toastMessage,
    toastAction,
    savingsHidden,
    hideSavings,
    revealSavings,
  };

  return <KakeiboContext.Provider value={value}>{children}</KakeiboContext.Provider>;
}
