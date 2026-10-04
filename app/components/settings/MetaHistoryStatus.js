// app/components/settings/MetaHistoryStatus.js
//
// "Older history" on the two Meta cards: how far back the Facebook /
// Instagram history walk has got (lib/meta/historyBackfill.js) — per channel
// on the Facebook & Instagram card, per lead form on the lead-forms panel —
// and "Fetch older", which starts it (or walks it again from the top; nothing
// is duplicated, every write is keyed on Meta's own id).
//
// Drawn only where the parent already knows the walk can run (a connected
// Page with messaging granted; at least one lead form switched on), so the
// button is never a control that answers "nothing to fetch". The server
// refuses the same cases anyway, with a sentence.
"use client";

import { useCallback, useEffect, useState } from "react";
import { History, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

const POLL_MS = 15000;
const ACTIVE = new Set(["queued", "running", "rate_limited"]);
const ERROR_KEYS = new Set(["auth_error", "leads_access"]);

/**
 * @param scope   "messages" | "leads"
 * @param canRun  the parent's own gate (billing admin, not impersonating)
 */
export default function MetaHistoryStatus({ scope, canRun = true, t }) {
  const [state, setState] = useState(null);
  const [failed, setFailed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      setState(await fetchJson("/api/meta/history"));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = (scope === "messages" ? state?.messages : state?.leads) || [];
  const running = rows.some((r) => ACTIVE.has(r.status));

  // While a walk is moving, the card keeps up with it — the person pressed a
  // button and should see the counts climb, not a frozen "Waiting to run".
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [running, load]);

  async function start() {
    setStarting(true);
    setError("");
    setNote("");
    try {
      const data = await fetchJson("/api/meta/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      setState(data);
      setNote(t("app.metaHistory.started"));
    } catch (err) {
      setError(err?.message || t("app.metaHistory.error.other"));
    } finally {
      setStarting(false);
    }
  }

  const date = (v) => (v ? new Date(v).toLocaleDateString() : "");
  const when = (v) => (v ? new Date(v).toLocaleString() : "");

  return (
    <div className="rounded-lg border border-border p-2.5 space-y-1.5" data-meta-history={scope}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <History size={13} aria-hidden="true" /> {t("app.metaHistory.title", "Older history")}
        </div>
        {canRun && (
          <button
            type="button"
            onClick={start}
            disabled={starting || running}
            className="inline-flex items-center gap-1.5 min-h-[32px] px-2.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
            data-fetch-older
          >
            {starting || running ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : null}
            {starting || running ? t("app.metaHistory.fetching") : t("app.metaHistory.fetchOlder")}
          </button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {scope === "messages" ? t("app.metaHistory.explainMessages") : t("app.metaHistory.explainLeads")}
      </p>

      {failed ? (
        <p className="text-xs text-muted-foreground">{t("app.metaHistory.loadError")}</p>
      ) : !state ? null : !rows.length ? (
        <p className="text-xs text-muted-foreground">{t("app.metaHistory.never")}</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r, i) => {
            const c = r.counts || {};
            const line =
              scope === "messages"
                ? t("app.metaHistory.messagesLine", {
                    platform: t(`app.messages.platform.${r.platform}`, r.platform || ""),
                    conversations: c.conversations || 0,
                    messages: c.messages || 0,
                  })
                : t("app.metaHistory.leadsLine", {
                    name: r.name || r.formId || "",
                    leads: c.leads || 0,
                    linked: c.linked || 0,
                    duplicates: c.duplicates || 0,
                  });
            const status =
              r.status === "rate_limited"
                ? t("app.metaHistory.status.rate_limited", { time: when(r.retryAfter) })
                : t(`app.metaHistory.status.${r.status}`, r.status);
            return (
              <li key={`${r.platform || r.formId}-${i}`} className="text-xs">
                <p className="text-foreground">
                  {line}
                  {r.oldestSeenAt ? <span className="text-muted-foreground"> · {t("app.metaHistory.backTo", { date: date(r.oldestSeenAt) })}</span> : null}
                </p>
                <p className={`text-[11px] ${r.status === "error" ? "text-red-700 dark:text-red-300" : "text-muted-foreground"}`}>
                  {status}
                  {r.lastRunAt ? ` · ${t("app.metaHistory.lastRun", { date: when(r.lastRunAt) })}` : ""}
                  {r.status === "error" ? ` · ${ERROR_KEYS.has(r.lastErrorKind) ? t(`app.metaHistory.error.${r.lastErrorKind}`) : t("app.metaHistory.error.other")}` : ""}
                </p>
                {scope === "messages" && Number(c.attachments) > 0 && (
                  <p className="text-[11px] text-muted-foreground">{t("app.metaHistory.attachments", { count: c.attachments })}</p>
                )}
                {scope === "messages" && Number(c.leads) > 0 && (
                  <p className="text-[11px] text-muted-foreground">{t("app.metaHistory.leadsFromMessages", { count: c.leads })}</p>
                )}
                {Number(c.truncated) > 0 && <p className="text-[11px] text-muted-foreground">{t("app.metaHistory.truncated", { count: c.truncated })}</p>}
              </li>
            );
          })}
        </ul>
      )}
      {note && <p className="text-[11px] text-emerald-700 dark:text-emerald-400">{note}</p>}
      {error && <p className="text-[11px] text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
}
