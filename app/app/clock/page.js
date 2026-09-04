"use client";

// app/app/clock/page.js
//
// The time clock — the one screen an hourly worker touches every shift. Kept
// deliberately spare: a big live clock, one primary action, today's total.
// Everything writes plain TimeEntry rows through /api/time-clock, which resolves
// the worker from the session, so this is pure record-keeping — no pay maths,
// no money movement.
//
// ── The job picker ─────────────────────────────────────────────────────────
//
// A native <select>, not a custom sheet. This screen is read in a driveway on
// whatever phone the person owns: the OS picker is a full-height list with
// system-sized rows, it works with one thumb, and it needs no JavaScript to
// scroll. A hand-rolled dropdown would look better in a screenshot and be worse
// in a van.
//
// It defaults to the day's only visit and to nothing otherwise — see
// lib/timeclock/jobChoices.js for why two visits get a question rather than a
// guess. "No job" is always an option and is never presented as a failure:
// travel, the yard and a morning of quoting are real hours.
//
// Nothing here detects arrival. There is no location permission, no coordinate
// and no "you're at the Tremblay job" — a browser cannot know that (see
// docs/construction/AUDIT-routing-geo.md §3), and implying it could is the
// dishonest version of this screen.

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, LogIn, LogOut, Loader2, Briefcase, ArrowRightLeft } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import { fetchList } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import { todayHoursFrom } from "@/lib/timeclock/todayHours";

function fmtClock(d) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtElapsed(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function TimeClockPage() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [errorKey, setErrorKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());
  // "" is a real choice — "no job" — not an unset one, so it is never coerced
  // into the suggestion once the person has touched the picker.
  const [jobId, setJobId] = useState("");
  const [switchTo, setSwitchTo] = useState("");
  const touched = useRef(false);
  const tick = useRef(null);

  // ── A failed load must not read as "you're clocked out" ──────────────
  //
  // This returned early on a non-ok response and left `data` at null. Every
  // figure below is derived with `?.`, so the page then rendered the FULL
  // clocked-out screen: "You're clocked out.", 0.00 hours today, "No entries
  // yet today.", and a green Clock in button. A worker who was on the clock
  // pressed it and got a 409 from POST /api/time-clock ("You're already
  // clocked in — clock out first."), and the only correction was a toast,
  // which goes away.
  //
  // That is lib/loadState.js's bug wearing `null` instead of `[]`: a state
  // that cannot say "not known" gets read as a claim. So the failure is held,
  // and the render stops at it.
  const load = useCallback(async () => {
    const result = await fetchList("/api/time-clock");
    if (result.aborted) return;
    if (!result.ok) {
      // Back to "not known" rather than left holding a stale punch — a retry
      // that fails must not keep last minute's clocked-in state on screen.
      setData(null);
      setErrorKey(result.errorKey);
      return;
    }
    setErrorKey("");
    setData(result.data);
    // The day's only visit is filled in for them. Only before they have chosen
    // anything: re-applying it on every reload would silently undo a deliberate
    // "no job", which is the sort of control that looks like it works.
    if (!touched.current && result.data?.suggestedJobId) {
      setJobId(result.data.suggestedJobId);
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // One-second heartbeat drives both the wall clock and the elapsed timer.
  useEffect(() => {
    tick.current = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick.current);
  }, []);

  async function punch(action, sendJobId) {
    setBusy(true);
    try {
      const res = await fetch("/api/time-clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "out" ? {} : { jobId: sendJobId || null }),
        }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.clock.punchError", "Couldn't record that."));
        return;
      }
      touched.current = false;
      setSwitchTo("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  // The load failed. Stop here rather than deriving a whole shift from a body
  // that never arrived — the shared panel, its "nothing has been deleted"
  // sentence and its retry, exactly as every other refused load on the app.
  if (errorKey) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={20} className="text-foreground" />
          <h1 className="text-2xl font-bold text-foreground">{t("app.clock.title")}</h1>
        </div>
        <ListState loading={false} isEmpty={false} errorKey={errorKey} onRetry={load}>
          {null}
        </ListState>
      </div>
    );
  }

  // Not linked to a worker record — say so plainly instead of a dead button.
  if (data && data.worker === null) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6">
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <Clock className="mx-auto mb-3 text-muted-foreground" size={28} />
          <h1 className="text-lg font-bold text-foreground">{t("app.clock.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("app.clock.notWorker")}</p>
        </div>
      </div>
    );
  }

  const open = data?.open;
  const clockedIn = Boolean(open);
  const elapsedMs = open ? now.getTime() - new Date(open.clockIn).getTime() : 0;
  // Today's total, recomputed on every heartbeat rather than read once from
  // the payload. `data.todayHours` is correct at request time and frozen
  // afterwards — this screen never refetches — so it showed 07:12:33 elapsed
  // beside 0.02 hours today. Same function the route uses; the reasoning, and
  // why the open entry has to come from today's ROWS, is in that file.
  const liveToday = todayHoursFrom(data?.today, now);

  const options = data?.jobOptions || [];
  const todayOptions = options.filter((o) => o.today);
  const otherOptions = options.filter((o) => !o.today);
  const jobLabel = (o) =>
    o?.title || t("app.clock.untitledJob", "Untitled job");
  const currentJobName = open?.job?.title || null;

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={20} className="text-foreground" />
        <h1 className="text-2xl font-bold text-foreground">{t("app.clock.title")}</h1>
      </div>

      {/* The clock face */}
      <div className="rounded-2xl border border-border bg-card p-6 text-center overflow-hidden">
        <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
        </div>
        <div className="mt-1 text-4xl font-bold tabular-nums text-foreground">{fmtClock(now)}</div>

        {clockedIn ? (
          <div className="mt-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {t("app.clock.onTheClock")}
            </div>
            <div className="mt-3 text-5xl font-bold tabular-nums text-foreground">{fmtElapsed(elapsedMs)}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t("app.clock.since", { time: fmtTime(open.clockIn) })}
            </div>
            {/* Which job these hours are landing on. Said out loud, because a
                picker whose result is invisible afterwards is a control you
                cannot tell is working. */}
            <div className="mt-2 text-sm font-semibold text-foreground">
              {currentJobName
                ? t("app.clock.onJob", "On {job}", { job: currentJobName })
                : t("app.clock.noJobEntry", "Not linked to a job")}
            </div>
          </div>
        ) : (
          <div className="mt-5 text-sm text-muted-foreground">{t("app.clock.notClockedIn")}</div>
        )}

        {/* ── The job, chosen before the punch ──────────────────────────────
            Only when there is something to choose from. A company with no open
            jobs gets no picker rather than an empty one. */}
        {!clockedIn && options.length > 0 && (
          <div className="mt-5 text-left">
            <label
              htmlFor="clock-job"
              className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"
            >
              <Briefcase size={13} />
              {t("app.clock.jobLabel", "Which job?")}
            </label>
            <JobSelect
              id="clock-job"
              value={jobId}
              onChange={(v) => {
                touched.current = true;
                setJobId(v);
              }}
              todayOptions={todayOptions}
              otherOptions={otherOptions}
              jobLabel={jobLabel}
              t={t}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {data.todayCount === 1
                ? t(
                    "app.clock.suggestedNote",
                    "You're scheduled here today — change it if you're somewhere else.",
                  )
                : data.todayCount > 1
                  ? t("app.clock.pickOneNote", "You have {count} jobs scheduled today — pick the one you're starting.", {
                      count: data.todayCount,
                    })
                  : t(
                      "app.clock.noVisitNote",
                      "Nothing scheduled for you today. Pick a job if you're on one — otherwise leave it blank.",
                    )}
              {data.truncated
                ? ` ${t("app.clock.truncatedNote", "Only your most recent jobs are listed.")}`
                : ""}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => punch(clockedIn ? "out" : "in", jobId)}
          disabled={busy}
          className={`mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-4 text-base font-semibold text-white transition-colors disabled:opacity-60 ${
            clockedIn ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {busy ? (
            <Loader2 size={18} className="animate-spin" />
          ) : clockedIn ? (
            <LogOut size={18} />
          ) : (
            <LogIn size={18} />
          )}
          {clockedIn ? t("app.clock.clockOut") : t("app.clock.clockIn")}
        </button>
      </div>

      {/* ── Moving to a second job ────────────────────────────────────────────
          The failure this exists to stop: somebody stays clocked in all day and
          the whole shift lands on the first job. Switching closes the current
          entry now and opens a new one — the hours already worked keep the job
          they were worked on. */}
      {clockedIn && options.length > 0 && (
        <div className="mt-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <ArrowRightLeft size={14} />
            {t("app.clock.switchTitle", "Moved to another job?")}
          </h2>
          <JobSelect
            id="clock-switch-job"
            value={switchTo}
            onChange={setSwitchTo}
            todayOptions={todayOptions}
            otherOptions={otherOptions}
            jobLabel={jobLabel}
            t={t}
          />
          <button
            type="button"
            onClick={() => punch("switch", switchTo)}
            disabled={busy || (switchTo || "") === (open?.jobId || "")}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3 text-base font-semibold text-foreground transition-colors disabled:opacity-50"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRightLeft size={16} />}
            {t("app.clock.switchAction", "Switch job")}
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            {t(
              "app.clock.switchNote",
              "Your hours so far stay where they are. A new entry starts from now.",
            )}
          </p>
        </div>
      )}

      {/* Today */}
      <div className="mt-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">{t("app.clock.today")}</h2>
          {/* Number.isFinite, not `|| 0`: a genuine 0.00 is a real answer and
              must print, while a figure that never arrived must not become
              one. The load-failure gate above means this is belt and braces. */}
          {Number.isFinite(liveToday) && (
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {t("app.clock.hoursValue", { hours: liveToday.toFixed(2) })}
            </span>
          )}
        </div>
        {!data?.today?.length ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("app.clock.noneToday")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {data.today.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block text-foreground">
                    {fmtTime(e.clockIn)} – {e.clockOut ? fmtTime(e.clockOut) : t("app.clock.open")}
                  </span>
                  {/* Named either way. "No job" is a fact worth showing — it is
                      how somebody notices an hour that should have had one. */}
                  <span className="block text-xs text-muted-foreground break-words">
                    {e.job?.title || t("app.clock.noJobEntry", "Not linked to a job")}
                  </span>
                </span>
                <span className="text-muted-foreground tabular-nums shrink-0">
                  {e.clockOut && e.hours != null ? t("app.clock.hoursValue", { hours: Number(e.hours).toFixed(2) }) : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{t("app.clock.reviewNote")}</p>
      </div>
    </div>
  );
}

/**
 * The picker itself.
 *
 * `text-base` is 16px and load-bearing: anything smaller makes iOS Safari zoom
 * the page on focus, and the person is then looking at a magnified fragment of
 * a screen they were about to tap a big button on.
 *
 * Two optgroups, and the "no job" row sits above both rather than at the
 * bottom — it is the honest default for a lot of days, not the leftover option.
 */
function JobSelect({ id, value, onChange, todayOptions, otherOptions, jobLabel, t }) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-3 text-base text-foreground"
    >
      <option value="">{t("app.clock.noJob", "No job — travel, yard, quoting")}</option>
      {todayOptions.length > 0 && (
        <optgroup label={t("app.clock.groupToday", "Scheduled for you today")}>
          {todayOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.scheduledAt ? `${fmtTime(o.scheduledAt)} — ` : ""}
              {jobLabel(o)}
              {o.client ? ` (${o.client})` : ""}
            </option>
          ))}
        </optgroup>
      )}
      {otherOptions.length > 0 && (
        <optgroup label={t("app.clock.groupOther", "Your other open jobs")}>
          {otherOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {jobLabel(o)}
              {o.client ? ` (${o.client})` : ""}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
