// app/components/offline/OfflineShell.js
//
// The phone's side of offline invoicing, in one place:
//
//   - registers public/sw.js and tells it whether caching is on for this
//     company (Company.offlineCachingEnabled — the switch under Settings →
//     Field work);
//   - owns the IndexedDB queue (lib/offline/queue.js) and hands it to the
//     invoice editor and the time clock through useOffline();
//   - watches navigator.onLine and replays the queue the moment there is
//     signal again — on `online`, on the tab becoming visible, and when the
//     worker's Background Sync wakes it;
//   - draws the bar: "Offline — 2 invoices and 3 timesheets waiting to sync",
//     the "Synced ✓" toast afterwards, and "Needs attention" with the
//     server's own sentence for anything it refused.
//
// Everything is feature-detected. No IndexedDB → the queue is in memory for
// the tab's life and the bar says writes made offline will not survive a
// reload. No service worker → no cache, but the queue still works for a
// page that is already open when the signal drops.
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { WifiOff, ChevronDown, ChevronUp, RefreshCw, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { showToast } from "@/lib/toast";
import { idbAvailable, idbStore, memoryStore } from "@/lib/offline/store";
import { makeItem, replayQueue, summarise } from "@/lib/offline/queue";

const SW_PATH = "/sw.js";
const OfflineContext = createContext(null);

/**
 * { online, enabled, items, summary, enqueue, replay, persistent }
 * Null outside /app (nothing else renders the provider).
 */
export function useOffline() {
  return useContext(OfflineContext);
}

export default function OfflineShell({ enabled, children }) {
  const { t } = useTranslation();
  const [online, setOnline] = useState(true);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const storeRef = useRef(null);
  const persistent = useRef(false);
  const replaying = useRef(false);

  // The store: IndexedDB when the browser has it, memory otherwise.
  if (!storeRef.current) {
    persistent.current = typeof window !== "undefined" && idbAvailable();
    storeRef.current = persistent.current ? idbStore() : memoryStore();
  }

  const refresh = useCallback(async () => {
    try {
      setItems(await storeRef.current.list());
    } catch {
      // A broken IndexedDB must not take the shell down; the bar just shows nothing.
    }
  }, []);

  // ── Replay ───────────────────────────────────────────────────────────────
  const replay = useCallback(async () => {
    if (replaying.current || typeof navigator === "undefined" || !navigator.onLine) return;
    replaying.current = true;
    setSyncing(true);
    try {
      const { synced, failed, stoppedOffline } = await replayQueue({
        store: storeRef.current,
        fetch: (...args) => fetch(...args),
        onChange: () => refresh(),
      });
      await refresh();
      if (synced.length) {
        const inv = synced.filter((i) => i.kind === "invoice").length;
        const ts = synced.filter((i) => i.kind === "timesheet").length;
        const warned = synced.filter((i) => i.error);
        showToast({
          message: t("app.offline.syncedToast", { invoices: inv, timesheets: ts }) + (warned.length ? ` ${t("app.offline.syncedWithNotes", { count: warned.length })}` : ""),
          tone: "success",
          tag: "offline:synced",
          href: inv === 1 ? `/app/invoices/${synced.find((i) => i.kind === "invoice").serverId}` : null,
        });
      }
      if (failed.length) {
        showToast({ message: t("app.offline.needsAttentionToast", { count: failed.length }), tone: "error", tag: "offline:failed" });
        setOpen(true);
      }
      if (stoppedOffline) setOnline(false);
    } finally {
      replaying.current = false;
      setSyncing(false);
    }
  }, [refresh, t]);

  // ── Wiring: online/offline, visibility, the worker, the sync wake-up ─────
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    setOnline(navigator.onLine !== false);
    refresh();

    const goOnline = () => {
      setOnline(true);
      replay();
    };
    const goOffline = () => setOnline(false);
    const onVisible = () => {
      if (document.visibilityState === "visible" && navigator.onLine) replay();
    };
    const onMessage = (e) => {
      if (e.data && e.data.type === "fq:sync") replay();
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    document.addEventListener("visibilitychange", onVisible);
    if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", onMessage);

    // Register the worker and hand it the company's switch. A company that
    // turned caching off still gets the message — that is what empties the
    // cache on the next open (see public/sw.js writeEnabled).
    (async () => {
      if (!("serviceWorker" in navigator)) return;
      try {
        let reg = await navigator.serviceWorker.getRegistration(SW_PATH);
        if (!reg && enabled) reg = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
        if (!reg) return;
        const ready = await navigator.serviceWorker.ready;
        (ready.active || reg.active)?.postMessage({ type: "fq:offline-config", enabled: Boolean(enabled) });
      } catch {
        // No worker: the page still works online, and the queue still holds
        // writes made while it is open.
      }
    })();

    // Anything left from last time syncs now.
    if (navigator.onLine) replay();

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      document.removeEventListener("visibilitychange", onVisible);
      if ("serviceWorker" in navigator) navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, [enabled, refresh, replay]);

  // ── Enqueue ──────────────────────────────────────────────────────────────
  const enqueue = useCallback(
    async (kind, payload) => {
      const item = makeItem(kind, payload);
      await storeRef.current.put(item);
      await refresh();
      // Ask Chrome to wake the worker when the signal returns, tab or no tab.
      try {
        const reg = await navigator.serviceWorker?.ready;
        await reg?.sync?.register("fq-offline-queue");
      } catch {
        /* Background Sync is Chrome-only; the online event covers the rest */
      }
      return item;
    },
    [refresh],
  );

  const remove = useCallback(
    async (key) => {
      await storeRef.current.remove(key);
      await refresh();
    },
    [refresh],
  );

  const retry = useCallback(
    async (key) => {
      const it = await storeRef.current.get(key);
      if (!it) return;
      await storeRef.current.put({ ...it, status: "queued", attempts: 0, error: null });
      await refresh();
      replay();
    },
    [refresh, replay],
  );

  const summary = useMemo(() => summarise(items), [items]);
  const value = useMemo(
    () => ({ online, enabled: Boolean(enabled), items, summary, enqueue, replay, persistent: persistent.current }),
    [online, enabled, items, summary, enqueue, replay],
  );

  const pending = summary.total + summary.photos;
  const showBar = !online || pending > 0 || summary.failed > 0;

  return (
    <OfflineContext.Provider value={value}>
      {showBar && (
        <div
          role="status"
          className={`px-3 py-2 text-xs sm:text-sm font-semibold flex items-center gap-2 flex-wrap ${
            !online
              ? "bg-amber-900 text-amber-200 dark:bg-amber-950 dark:text-amber-300"
              : summary.failed > 0
                ? "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200 border-b border-red-200 dark:border-red-900"
                : "bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200 border-b border-sky-200 dark:border-sky-900"
          }`}
        >
          {!online ? <WifiOff size={15} className="shrink-0" /> : syncing ? <RefreshCw size={15} className="shrink-0 animate-spin" /> : summary.failed > 0 ? <AlertTriangle size={15} className="shrink-0" /> : <CheckCircle2 size={15} className="shrink-0" />}
          <span className="flex-1 min-w-0">
            {!online
              ? pending > 0
                ? t("app.offline.barWaiting", { invoices: summary.invoices, timesheets: summary.timesheets })
                : t("app.offline.barOffline")
              : syncing
                ? t("app.offline.barSyncing")
                : summary.failed > 0
                  ? t("app.offline.barNeedsAttention", { count: summary.failed })
                  : t("app.offline.barWaitingOnline", { count: pending })}
          </span>
          {!persistent.current && <span className="text-[11px] font-normal opacity-80">{t("app.offline.noStorage")}</span>}
          <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 underline underline-offset-2">
            {t("app.offline.details")} {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      )}
      {open && showBar && (
        <div className="bg-card border-b border-border px-3 py-2 text-xs space-y-1.5">
          {items.length === 0 && <p className="text-muted-foreground">{t("app.offline.nothingQueued")}</p>}
          {items.map((it) => (
            <QueueRow key={it.key} item={it} onRetry={retry} onRemove={remove} t={t} />
          ))}
          {online && (summary.total > 0 || summary.photos > 0) && (
            <button type="button" onClick={replay} disabled={syncing} className="inline-flex items-center gap-1 font-semibold text-foreground disabled:opacity-60">
              <RefreshCw size={12} className={syncing ? "animate-spin" : ""} /> {t("app.offline.syncNow")}
            </button>
          )}
        </div>
      )}
      {children}
    </OfflineContext.Provider>
  );
}

function QueueRow({ item, onRetry, onRemove, t }) {
  const label =
    item.kind === "invoice"
      ? t("app.offline.rowInvoice", { client: item.payload?.clientName || "" })
      : item.kind === "timesheet"
        ? t("app.offline.rowPunch", { action: t(`app.offline.punch.${item.payload?.action || "in"}`) })
        : t("app.offline.rowPhoto", { name: item.payload?.name || "" });
  const when = new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const status =
    item.status === "synced"
      ? t("app.offline.statusSynced")
      : item.status === "failed"
        ? t("app.offline.statusFailed")
        : t("app.offline.statusQueued");
  return (
    <div className="flex items-start gap-2 flex-wrap">
      <div className="flex-1 min-w-0">
        <span className="font-medium text-foreground">{label}</span>{" "}
        <span className="text-muted-foreground">
          · {t("app.offline.queuedAt", { time: when })} · {status}
          {item.serverId && item.kind === "invoice" ? (
            <>
              {" "}
              · <a className="underline" href={`/app/invoices/${item.serverId}`}>{t("app.offline.openInvoice")}</a>
            </>
          ) : null}
        </span>
        {item.error && <div className={item.status === "failed" ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"}>{item.error}</div>}
      </div>
      {item.status === "failed" && (
        <>
          <button type="button" onClick={() => onRetry(item.key)} className="underline">{t("app.offline.retry")}</button>
          <button
            type="button"
            onClick={() => {
              if (confirm(t("app.offline.removeConfirm"))) onRemove(item.key);
            }}
            className="inline-flex items-center gap-1 text-muted-foreground"
            aria-label={t("app.offline.remove")}
          >
            <Trash2 size={12} /> {t("app.offline.remove")}
          </button>
        </>
      )}
    </div>
  );
}
