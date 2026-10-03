"use client";

// app/app/clock/TimeLog.js
//
// The Time log: one company day at a time, per person, as a vertical
// timeline — the activity, its start and end, how long — and the day's total.
// Everything comes from GET /api/time-clock/log, which decides whose rows
// the reader may see (their own, or everyone's at timeTracking
// view_record_edit_all) and which day "today" is (the company's zone). This
// file draws; it decides neither.
//
// Times print in the company's zone, not the phone's: a manager reading the
// crew's day from another province must see 07:00 where the crew saw 07:00.
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchList } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import { reportResponseError } from "@/lib/clientErrors";
import { activityIcon, activityName, fmtDuration } from "@/app/components/timeclock/activityUi";

function timeIn(iso, timeZone) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone });
  } catch {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
}
function dayTitle(isoDay) {
  // Noon UTC of that calendar date, printed as a date in UTC: the label is
  // the date itself, with no zone to move it across midnight.
  const d = new Date(`${isoDay}T12:00:00Z`);
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

export default function TimeLog() {
  const { t } = useTranslation();
  const [date, setDate] = useState(null); // null = the company's today
  const [data, setData] = useState(null);
  const [errorKey, setErrorKey] = useState("");
  const [loading, setLoading] = useState(true);
  // Running segments grow while the log is open; a minute is fine-grained
  // enough for a log, and no refetch is needed for it.
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchList(`/api/time-clock/log${date ? `?date=${encodeURIComponent(date)}` : ""}`);
    if (result.aborted) return;
    setLoading(false);
    if (!result.ok) {
      setData(null);
      setErrorKey(result.errorKey);
      return;
    }
    setErrorKey("");
    setData(result.data);
    setNow(Date.now());
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (errorKey) {
    return (
      <ListState loading={false} isEmpty={false} errorKey={errorKey} onRetry={load}>
        {null}
      </ListState>
    );
  }

  const shown = data?.date || date;
  const isToday = data && data.date === data.today;

  return (
    <div>
      {/* ── Day navigation ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card p-1.5">
        <button
          type="button"
          onClick={() => data?.prev && setDate(data.prev)}
          disabled={!data?.prev || loading}
          aria-label={t("app.clock.log.prev")}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-foreground hover:bg-muted disabled:opacity-40"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0 text-center">
          <div className="text-sm font-bold text-foreground">
            {isToday ? t("app.clock.log.today") : shown ? dayTitle(shown) : "—"}
          </div>
          {isToday && shown ? <div className="text-xs text-muted-foreground">{dayTitle(shown)}</div> : null}
        </div>
        <button
          type="button"
          onClick={() => data?.next && setDate(data.next)}
          disabled={!data?.next || loading}
          aria-label={t("app.clock.log.next")}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-foreground hover:bg-muted disabled:opacity-40"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      {data ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {data.scope === "all" ? t("app.clock.log.scopeAll") : t("app.clock.log.scopeOwn")}
        </p>
      ) : null}

      {loading && !data ? (
        <div className="min-h-[30vh] grid place-items-center">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : data && data.scope === "own" && data.hasWorker === false ? (
        <p className="mt-4 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{t("app.clock.notWorker")}</p>
      ) : data && data.people.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{t("app.clock.log.empty")}</p>
      ) : data ? (
        <div className={`mt-3 space-y-3 ${loading ? "opacity-60" : ""}`}>
          {data.people.map((p) => (
            <PersonDay key={p.worker.id} person={p} data={data} now={now} t={t} onCorrected={load} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PersonDay({ person, data, now, t, onCorrected }) {
  const [correcting, setCorrecting] = useState(null);
  // A running segment's end is "now", which moves; the server's figure is
  // from load time. Add the minutes since, so the total keeps up with it.
  const drift = person.open ? Math.max(0, now - Date.parse(person.segments.at(-1)?.end || now)) : 0;
  const lastPaid = person.segments.at(-1)?.paid;
  const tracked = person.trackedMs + drift;
  const paid = person.paidMs + (lastPaid ? drift : 0);
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="min-w-0 truncate text-sm font-bold text-foreground">
          {person.me ? t("app.clock.log.you") : person.worker.name || "—"}
        </h3>
        <span className="shrink-0 text-sm font-bold text-foreground tabular-nums">
          {t("app.clock.log.total", { time: fmtDuration(tracked, t) })}
        </span>
      </div>
      {paid !== tracked ? (
        <p className="text-right text-xs text-muted-foreground tabular-nums">
          {t("app.clock.log.paid", { time: fmtDuration(paid, t) })}
        </p>
      ) : null}
      <ol className="mt-3">
        {person.segments.map((s, i) => {
          const Icon = activityIcon(s.kind);
          const isBreak = s.kind === "break" || s.kind === "lunch";
          const last = i === person.segments.length - 1;
          const ms = s.open ? s.ms + drift : s.ms;
          return (
            <li key={`${s.entryId}:${s.start}:${s.kind}`} className="relative flex gap-3 pb-3 last:pb-0">
              {/* The rail: a dot per segment, joined by a line. */}
              <div className="flex flex-col items-center">
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                    isBreak
                      ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                      : "bg-inverted text-inverted-foreground"
                  }`}
                >
                  <Icon size={15} />
                </span>
                {!last ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                    {activityName(s.kind, data.activities, t)}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-foreground tabular-nums">{fmtDuration(ms, t)}</span>
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {timeIn(s.start, data.timezone)} – {s.open ? t("app.clock.log.running") : timeIn(s.end, data.timezone)}
                  {s.paid ? "" : ` · ${t("app.clock.unpaidTag")}`}
                </div>
                {s.job ? (
                  <div className="text-xs text-muted-foreground break-words">
                    {s.job.title || t("app.clock.untitledJob", "Untitled job")}
                    {s.task?.title ? ` · ${s.task.title}` : ""}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {/* ── Your entries: ask for a correction ──────────────────────────
          Only on your own day, and only as a REQUEST (owner, 2026-10-03):
          nothing changes until a manager approves it on Timesheets. One
          request at a time per entry; an entry already on an invoice is
          not offered — the invoice has to change first. */}
      {person.me && data.myEntries?.length ? (
        <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
          {data.myEntries.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="min-w-0 text-muted-foreground tabular-nums">
                {activityName(e.activity, data.activities, t)} · {timeIn(e.clockIn, data.timezone)} –{" "}
                {e.clockOut ? timeIn(e.clockOut, data.timezone) : t("app.clock.log.running")}
              </span>
              {e.correction?.status === "pending" ? (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  {t("app.clock.correction.pending")}
                </span>
              ) : e.billed ? (
                <span className="text-muted-foreground">{t("app.clock.correction.billed")}</span>
              ) : (
                <span className="flex items-center gap-2">
                  {e.correction?.status === "approved" ? (
                    <span className="text-emerald-700 dark:text-emerald-300">{t("app.clock.correction.approved")}</span>
                  ) : e.correction?.status === "rejected" ? (
                    <span className="text-muted-foreground" title={e.correction.decisionNote || undefined}>
                      {t("app.clock.correction.rejected")}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setCorrecting(e)}
                    className="inline-flex min-h-[44px] items-center rounded-full border border-border px-3 font-semibold text-foreground hover:bg-muted"
                  >
                    {t("app.clock.correction.request")}
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {correcting ? (
        <CorrectionSheet
          entry={correcting}
          data={data}
          t={t}
          onClose={() => setCorrecting(null)}
          onDone={async () => {
            setCorrecting(null);
            await onCorrected();
          }}
        />
      ) : null}
    </section>
  );
}

/** "2026-10-03T07:05" for an instant, in the company's zone — what a datetime-local input holds. */
function wallClockInput(iso, timeZone) {
  if (!iso) return "";
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(new Date(iso))
        .map((p) => [p.type, p.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  } catch {
    return "";
  }
}

/**
 * The request form. Times are typed in the company's zone (the server
 * resolves them there, lib/time/wallClock.js), so a crew member whose phone
 * is set to another zone still writes the times they worked. The job list is
 * the clock's own picker list (GET /api/time-clock), so a request cannot
 * name a job the server would refuse.
 */
function CorrectionSheet({ entry, data, t, onClose, onDone }) {
  const [clockIn, setClockIn] = useState(() => wallClockInput(entry.clockIn, data.timezone));
  const [clockOut, setClockOut] = useState(() => wallClockInput(entry.clockOut, data.timezone));
  const [activity, setActivity] = useState(entry.activity);
  const [jobId, setJobId] = useState(entry.jobId || "");
  const [reason, setReason] = useState("");
  const [jobs, setJobs] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    fetchList("/api/time-clock").then((r) => {
      if (live) setJobs(r.ok ? r.data?.jobOptions || [] : []);
    });
    return () => {
      live = false;
    };
  }, []);

  const work = (data.activities || []).filter((a) => a.enabled && !a.isBreak);
  const meta = work.find((a) => a.key === activity);
  const jobRule = meta?.job || "none";
  const options = jobs || [];
  // The entry's own job stays choosable even if it has left the picker list.
  const withCurrent =
    entry.jobId && !options.some((o) => o.id === entry.jobId)
      ? [{ id: entry.jobId, title: entry.job?.title || t("app.clock.untitledJob", "Untitled job") }, ...options]
      : options;

  async function send() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/time-entries/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeEntryId: entry.id,
          clockIn,
          clockOut,
          activity,
          jobId: jobRule === "none" ? null : jobId || null,
          reason,
        }),
      });
      if (!res.ok) {
        const message = await reportResponseError(res, t("app.clock.correction.error"));
        setError(message || t("app.clock.correction.error"));
        return;
      }
      await onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="correction-title"
        className="fq-dialog-card max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card p-5 shadow-2xl sm:rounded-2xl pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="correction-title" className="text-lg font-bold text-foreground">{t("app.clock.correction.title")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("app.clock.correction.intro")}</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-muted-foreground">
            {t("app.clock.correction.start")}
            <input type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-base text-foreground" />
          </label>
          <label className="block text-xs font-semibold text-muted-foreground">
            {t("app.clock.correction.end")}
            <input type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-base text-foreground" />
          </label>
        </div>
        <label className="mt-3 block text-xs font-semibold text-muted-foreground">
          {t("app.clock.correction.activity")}
          <select value={activity} onChange={(e) => setActivity(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-base text-foreground">
            {work.map((a) => (
              <option key={a.key} value={a.key}>
                {activityName(a.key, data.activities, t)}
              </option>
            ))}
          </select>
        </label>
        {jobRule !== "none" ? (
          <label className="mt-3 block text-xs font-semibold text-muted-foreground">
            {t("app.clock.jobLabel", "Which job?")}
            <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-base text-foreground">
              {jobRule === "required" ? (
                <option value="" disabled>
                  {t("app.clock.pickJob")}
                </option>
              ) : (
                <option value="">{t("app.clock.noJobPlain")}</option>
              )}
              {withCurrent.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title || t("app.clock.untitledJob", "Untitled job")}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="mt-3 block text-xs font-semibold text-muted-foreground">
          {t("app.clock.correction.reason")}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            rows={3}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-base text-foreground"
            placeholder={t("app.clock.correction.reasonPlaceholder")}
          />
        </label>
        {error ? (
          <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="min-h-[48px] rounded-xl border border-border bg-background px-4 text-base font-semibold text-foreground hover:bg-muted">
            {t("app.action.cancel")}
          </button>
          <button
            type="button"
            onClick={send}
            disabled={busy || !clockIn || !clockOut || !reason.trim() || (jobRule === "required" && !jobId)}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-inverted px-4 text-base font-semibold text-inverted-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : null}
            {t("app.clock.correction.send")}
          </button>
        </div>
      </div>
    </div>
  );
}
