// app/components/sales/CallHistory.js
//
// What has happened on the phone with this lead, where the rep can see it
// without changing tabs.
//
// One fetch (GET /api/sales/calls/history), two renderings over it:
//
//   CallHistoryStrip  — the rows: "Tue 14 Sep 13:40 · They hung up · 4 s ·
//                       Not now · 'call after the season'", newest first,
//                       the line's own write-ups marked "auto", a callback
//                       time when one was booked. `limit` folds the rest
//                       behind "show all"; `compact` is the one-line form
//                       the Texts header carries.
//   LastTimeLine      — the owner's line above the script when a lead is
//                       back in rotation: "Last time (Aug 15): Not now —
//                       'call after the season'". lib/sales/calls/history.js
//                       decides when there is one.
//
// Re-read on `refreshKey`: the queue bumps it after every outcome so the
// strip shows the call that just ended.
"use client";

import { useCallback, useEffect, useState } from "react";
import { History, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { currentRepId, readLead, sessionStore, writeLead } from "@/lib/sales/queueCache";
import { useTranslation } from "@/app/hooks/useTranslation";
import { effectiveSubDispositions, subDispositionLabel } from "@/lib/sales/calls/subDispositions";
import { useCallSession } from "./CallSession";

function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

function fmtWhen(iso, language, { dateOnly = false } = {}) {
  try {
    return new Intl.DateTimeFormat(language || undefined, dateOnly ? { day: "numeric", month: "short" } : { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return String(iso || "");
  }
}

/** The hook both renderings share. */
export function useCallHistory({ prospectId = null, leadId = null, refreshKey = 0 }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!prospectId && !leadId) {
      setData(null);
      return;
    }
    // The tab's copy first, when the queue page filed one for this
    // prospect (lib/sales/queueCache.js): drawn at once, replaced by the
    // read below. Every outcome bumps refreshKey and comes back through
    // here, so the cached history is never older than the last call.
    const store = prospectId ? sessionStore() : null;
    const cached = prospectId ? readLead(store, { prospectId })?.history || null : null;
    if (cached) setData(cached);
    const q = new URLSearchParams();
    if (prospectId) q.set("prospectId", prospectId);
    if (leadId) q.set("leadId", leadId);
    const zone = browserTimeZone();
    if (zone) q.set("timeZone", zone);
    try {
      const body = await fetchJson(`/api/sales/calls/history?${q.toString()}`);
      setData(body);
      setError("");
      const repId = prospectId ? currentRepId(store) : null;
      if (repId && body) writeLead(store, { repId, prospectId }, { history: body });
    } catch (err) {
      setError(err?.message || "");
    }
  }, [prospectId, leadId]);
  useEffect(() => {
    load();
  }, [load, refreshKey]);
  return { history: data?.history || null, lastTime: data?.lastTime || null, error, reload: load };
}

/** "01:42" for a mark's second. */
function stampOf(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** The sub-reason's label in the rep's language, from the lists — or its key. */
function subLabel(key, subLists, language) {
  const lists = subLists && typeof subLists === "object" ? subLists : effectiveSubDispositions(null).lists;
  for (const list of Object.values(lists)) {
    const e = (Array.isArray(list) ? list : []).find((x) => x.key === key);
    if (e) return subDispositionLabel(e, language);
  }
  return key;
}

/** "They hung up · 4 s" — or "" when the line knows nothing about the end. */
function endedText(t, row) {
  if (!row?.ended) return "";
  const ended = t(row.ended.key);
  return typeof row.ended.talkSeconds === "number" ? t("app.salesCall.ended.withTalk", { ended, seconds: row.ended.talkSeconds }) : ended;
}

/**
 * An inbound call nobody answered — it went to voicemail, or rang out — has
 * nothing for the rep to write: the day-end cron logs it as `missed`
 * (dayEndOutcome), and unloggedWhere() keeps it off the unlogged list for
 * the same reason. Until the cron reaches it the row carried "Not written
 * up" in amber, which reads as a to-do (QA 2026-09-17). The row already
 * says what it was — the voicemail line, or "rang, nobody picked up" — so
 * there is no outcome sentence at all, and the missed line is quiet.
 */
function nothingToWriteUp(row) {
  return row.direction === "in" && !row.answered && !row.disposition && Boolean(row.missed || row.voicemail);
}

function outcomeText(t, row) {
  if (row.disposition) return t(`app.salesCall.disposition.${row.disposition}.label`);
  if (row.deferred) return t("app.salesCall.history.deferred");
  if (nothingToWriteUp(row)) return "";
  return t("app.salesCall.history.unlogged");
}

/**
 * `loaded` — `{ history, lastTime, error }` from useCallHistory — lets a
 * screen that draws the strip twice (the queue: under the dialler and in
 * the Disposition tab) and the line once fetch ONCE and hand it in. Without
 * it the strip fetches for itself.
 */
export function CallHistoryStrip({ prospectId = null, leadId = null, refreshKey = 0, limit = 3, compact = false, title = true, loaded = null }) {
  const { t, language } = useTranslation();
  // The platform's sub-reason lists, from the call session when the shell
  // has read them (CallSession.js); the code defaults otherwise.
  const { subLists = null } = useCallSession();
  const own = useCallHistory(loaded ? { prospectId: null, leadId: null, refreshKey } : { prospectId, leadId, refreshKey });
  const { history, error } = loaded || own;
  const [all, setAll] = useState(false);
  if (!prospectId && !leadId && !loaded) return null;
  if (error) {
    return (
      <p className="text-xs text-amber-900 dark:text-amber-200 break-words" role="alert" data-call-history="error">
        {t("app.salesCall.history.loadFailed")}
      </p>
    );
  }
  if (history === null) {
    return compact ? null : (
      <p className="flex items-center gap-2 text-xs text-muted-foreground" data-call-history="loading">
        <Loader2 size={12} className="animate-spin" /> {t("app.salesCall.history.loading")}
      </p>
    );
  }
  if (history.length === 0) {
    return compact ? null : (
      <p className="text-xs text-muted-foreground break-words" data-call-history="none">
        {t("app.salesCall.history.none")}
      </p>
    );
  }
  const rows = all || !limit ? history : history.slice(0, limit);
  return (
    <div className="space-y-1.5" data-call-history={history.length}>
      {title && !compact ? (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <History size={12} aria-hidden="true" /> {t("app.salesCall.history.title", { count: history.length })}
        </p>
      ) : null}
      <ul className={compact ? "text-xs text-muted-foreground" : "divide-y divide-border/60 rounded-lg border border-border text-xs"}>
        {rows.map((row) => {
          const ended = endedText(t, row);
          return (
            <li key={row.id} className={compact ? "flex flex-wrap items-center gap-x-1.5" : "px-2.5 py-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5"} data-call-history-row={row.id} data-call-history-outcome={row.disposition || (row.deferred ? "deferred" : nothingToWriteUp(row) ? (row.voicemail ? "voicemail" : "missed") : "unlogged")}>
              <span className="tabular-nums text-muted-foreground">{fmtWhen(row.dialledAt, language)}</span>
              {row.direction === "in" ? <span className="rounded-full bg-muted px-1.5 text-[10px] uppercase tracking-wide">{t("app.salesCall.history.inbound")}</span> : null}
              {!row.mine ? <span className="rounded-full bg-muted px-1.5 text-[10px] uppercase tracking-wide">{t("app.salesCall.history.anotherRep")}</span> : null}
              {ended ? <span className="text-muted-foreground">· {ended}</span> : null}
              {/* The two inbound outcomes that used to be invisible here.
                  The audio is FieldQuo's own URL, never the provider's —
                  lib/sales/calls/voicemail.js. */}
              {row.voicemail ? (
                <span className="text-foreground">
                  · {typeof row.voicemail.seconds === "number" ? t("app.salesCall.history.voicemailSeconds", { seconds: row.voicemail.seconds }) : t("app.salesCall.history.voicemail")}{" "}
                  {/* A 44px hit area on a 15px word: the padding is taken
                      back with negative margins so the row's height is the
                      line's, not the target's (QA 2026-09-17: 24×15 on a
                      phone). */}
                  <a href={row.voicemail.href} target="_blank" rel="noopener" className="underline font-medium inline-flex items-center min-h-[44px] -my-3 px-1.5 -mx-1" data-call-history-voicemail={row.id}>
                    {t("app.salesCall.history.play")}
                  </a>
                </span>
              ) : null}
              {row.missed ? <span className="text-muted-foreground" data-call-history-missed={row.id}>· {t("app.salesCall.history.missed")}</span> : null}
              {outcomeText(t, row) ? (
                <span className={row.disposition ? "font-medium text-foreground" : "text-amber-900 dark:text-amber-200"}>· {outcomeText(t, row)}</span>
              ) : null}
              {row.autoLogged ? (
                <span className="rounded-full border border-border px-1.5 text-[10px] uppercase tracking-wide text-muted-foreground" title={t("app.salesCall.history.autoLoggedTitle")}>
                  {t("app.salesCall.history.auto")}
                </span>
              ) : null}
              {row.callbackAt ? <span className="text-muted-foreground">· {t("app.salesCall.history.callbackAt", { when: fmtWhen(row.callbackAt, language) })}</span> : null}
              {/* The sub-reason, as its key's label from the lists the form
                  drew — a custom entry has no catalogue key, so the label
                  travels with the lists (subDispositions.js). */}
              {row.subDisposition ? (
                <span className="text-muted-foreground break-words" data-call-history-sub={row.subDisposition}>
                  · {subLabel(row.subDisposition, subLists, language)}
                  {row.subDispositionDetail ? ` (${row.subDispositionDetail})` : ""}
                </span>
              ) : null}
              {row.amdMachine ? (
                <span className="rounded-full border border-border px-1.5 text-[10px] uppercase tracking-wide text-muted-foreground" title={t("app.salesCall.history.machineTitle")} data-call-history-amd>
                  {t("app.salesCall.history.machine")}
                </span>
              ) : null}
              {row.note ? <span className="w-full sm:w-auto italic text-foreground break-words">“{row.note}”</span> : null}
              {/* The owner's verdict on this outcome, when it was not an
                  approval (dispositionAudit.js): the rep reads why, on the
                  call it is about. */}
              {row.audit ? (
                <span
                  className={`w-full break-words rounded-md px-1.5 py-0.5 text-xs ${row.audit.verdict === "rejected" ? "bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200" : "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"}`}
                  data-call-history-audit={row.audit.verdict}
                >
                  {row.audit.note
                    ? t(`app.salesCall.audit.${row.audit.verdict}.withNote`, { note: row.audit.note })
                    : t(`app.salesCall.audit.${row.audit.verdict}.plain`)}
                </span>
              ) : null}
              {row.marks?.length ? (
                <span className="w-full text-xs text-muted-foreground break-words" data-call-history-marks={row.marks.length}>
                  {t("app.salesCall.mark.listTitle", { count: row.marks.length })}{" "}
                  {row.marks.map((m, i) => (
                    <span key={i} className="mr-2 tabular-nums">
                      [{stampOf(m.atSeconds)}] {m.note || "—"}
                    </span>
                  ))}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {!compact && limit && history.length > limit ? (
        <button type="button" className="text-xs underline text-muted-foreground hover:text-foreground" onClick={() => setAll((v) => !v)} data-call-history-toggle>
          {all ? t("app.salesCall.history.showFewer") : t("app.salesCall.history.showAll", { count: history.length })}
        </button>
      ) : null}
    </div>
  );
}

export function LastTimeLine({ prospectId = null, leadId = null, refreshKey = 0, loaded = null }) {
  const { t, language } = useTranslation();
  const own = useCallHistory(loaded ? { prospectId: null, leadId: null, refreshKey } : { prospectId, leadId, refreshKey });
  const { lastTime } = loaded || own;
  if (!lastTime) return null;
  const outcome = t(`app.salesCall.disposition.${lastTime.disposition}.label`);
  return (
    <p className="rounded-lg border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 px-3 py-2 text-sm text-sky-950 dark:text-sky-100 break-words" data-last-time={lastTime.disposition}>
      {lastTime.note
        ? t("app.salesCall.history.lastTimeWithNote", { date: fmtWhen(lastTime.dialledAt, language, { dateOnly: true }), outcome, note: lastTime.note })
        : t("app.salesCall.history.lastTime", { date: fmtWhen(lastTime.dialledAt, language, { dateOnly: true }), outcome })}
    </p>
  );
}
