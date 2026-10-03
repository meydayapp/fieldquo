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
            <PersonDay key={p.worker.id} person={p} data={data} now={now} t={t} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PersonDay({ person, data, now, t }) {
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
    </section>
  );
}
