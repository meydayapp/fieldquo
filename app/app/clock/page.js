"use client";

// app/app/clock/page.js
//
// The time clock — the one screen an hourly worker touches every shift. Two
// views: Track time (what am I doing right now) and Time log (what did the
// day look like). Everything writes plain TimeEntry rows through
// /api/time-clock, which resolves the worker from the session, so this is
// pure record-keeping — no pay maths, no money movement.
//
// ── The activity tiles ─────────────────────────────────────────────────────
//
// On site, Driving, Office, Supplies, Break, Lunch, General — whichever the
// company has switched on (lib/timeclock/activities.js; the server sends the
// resolved list and refuses the rest, so no tile is drawn for something the
// server would turn down). Tapping one ends what is running and starts it,
// on the server, in one request (POST action "activity"). Off the clock,
// tapping a work tile IS clocking in; Break and Lunch are taken from the
// clock and are disabled until there is one. Clock out is its own button,
// last, under the thumb.
//
// The tiles that can belong to a job (On site always, Driving and Supplies
// optionally) open a sheet with the job picker first — On site cannot start
// without one, because "on site" with no site is not a statement.
//
// ── The job picker ─────────────────────────────────────────────────────────
//
// A native <select>, not a custom sheet. This screen is read in a driveway on
// whatever phone the person owns: the OS picker is a full-height list with
// system-sized rows, it works with one thumb, and it needs no JavaScript to
// scroll. It defaults to the day's only visit for On site and to nothing
// otherwise — see lib/timeclock/jobChoices.js for why two visits get a
// question rather than a guess.
//
// ── Where the phone was, at the tap ────────────────────────────────────────
//
// Nothing here detects arrival, and nothing here tracks. A browser cannot
// know where a phone is except while its tab is open and in front (see
// docs/construction/AUDIT-routing-geo.md §3), and implying it could is the
// dishonest version of this screen. What it CAN do is ask, once, at the
// moment the person taps a work tile or Clock out — with the OS's own
// permission sheet — and send that one position beside the punch as `stamp`.
// Breaks are not asked about: a coffee is not a punch. Refusing the
// permission, or having no fix, changes nothing about the punch: the request
// goes without a stamp. The one-line note above the tiles says all of this
// before the browser asks.

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, LogOut, Loader2, MapPin, CalendarDays, Timer, Play } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import { fetchList } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import { todayHoursFrom } from "@/lib/timeclock/todayHours";
import { openBreak, unpaidBreakMs } from "@/lib/timeclock/entryHours";
import { effectiveActivity } from "@/lib/timeclock/activities";
import { currentSegment } from "@/lib/timeclock/segments";
import { captureStamp, locationPermissionState } from "@/lib/location/capture";
import { useOffline } from "@/app/components/offline/OfflineShell";
import { isNetworkFailure } from "@/lib/offline/queue";
import { queuedPunchState } from "@/lib/offline/punchState";
import { activityIcon, activityName } from "@/app/components/timeclock/activityUi";
import TimeLog from "./TimeLog";

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

/** ?tab=log opens the Time log — read once, from the URL the home card links to. */
function initialTab() {
  if (typeof window === "undefined") return "track";
  return new URLSearchParams(window.location.search).get("tab") === "log" ? "log" : "track";
}

export default function TimeClockPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("track");
  useEffect(() => {
    setTab(initialTab());
  }, []);
  const pickTab = (next) => {
    setTab(next);
    try {
      const url = new URL(window.location.href);
      if (next === "log") url.searchParams.set("tab", "log");
      else url.searchParams.delete("tab");
      window.history.replaceState(null, "", url);
    } catch {
      /* the view still switches; only the address bar keeps the old tab */
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={20} className="text-foreground" />
        <h1 className="text-2xl font-bold text-foreground">{t("app.clock.title")}</h1>
      </div>
      {/* Two views of one record. A segmented control rather than two pages:
          the person flips between "what am I doing" and "what did I do"
          constantly, and a page load in a basement is a long wait. */}
      <div role="tablist" className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {[
          ["track", Timer, t("app.clock.tabTrack")],
          ["log", CalendarDays, t("app.clock.tabLog")],
        ].map(([key, Icon, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => pickTab(key)}
            className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-colors ${
              tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>
      {tab === "log" ? <TimeLog /> : <TrackTime onOpenLog={() => pickTab("log")} />}
    </div>
  );
}

function TrackTime({ onOpenLog }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [errorKey, setErrorKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());
  // The job sheet: { activity, jobId, taskId } while open. "" is a real
  // choice — "no job" — not an unset one.
  const [sheet, setSheet] = useState(null);
  const tick = useRef(null);
  // Whether the next tap would put the browser's location sheet on screen.
  // The explanation renders only in that state — once permission is granted
  // there is nothing to warn about, and once refused there is nothing to ask.
  const [locationState, setLocationState] = useState("unavailable");
  const [enrolling, setEnrolling] = useState(false);
  const [enrolError, setEnrolError] = useState("");
  // The offline queue. A punch made with no signal is stored on the phone
  // with the moment it was tapped and replayed by the shell; until then
  // this screen shows the punch as "waiting to sync" rather than pretending
  // the server has it. See lib/offline/punchState.js for how a queued
  // punch overrides what the (cached) server answer says.
  const offline = useOffline();
  const online = offline ? offline.online : true;

  // ── A failed load must not read as "you're clocked out" ──────────────
  //
  // This returned early on a non-ok response and left `data` at null. Every
  // figure below is derived with `?.`, so the page then rendered the FULL
  // clocked-out screen: "You're clocked out.", 0.00 hours today, "No entries
  // yet today.", and a Clock in button. A worker who was on the clock
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
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // The one write this screen makes that is not a punch. On success the
  // whole payload is re-read, so the clock draws itself from the row the
  // server now has rather than from a guess about it.
  const selfEnrol = useCallback(async () => {
    setEnrolling(true);
    setEnrolError("");
    try {
      const res = await fetch("/api/time-clock/enrol", { method: "POST" });
      if (!res.ok) {
        const message = await reportResponseError(
          res,
          t("app.clock.selfEnrolFailed", "Couldn't set you up."),
        );
        setEnrolError(message || t("app.clock.selfEnrolFailed", "Couldn't set you up."));
        return;
      }
      await load();
    } finally {
      setEnrolling(false);
    }
  }, [load, t]);

  useEffect(() => {
    let cancelled = false;
    locationPermissionState().then((state) => {
      if (!cancelled) setLocationState(state);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // One-second heartbeat drives the wall clock, the segment timer and the
  // day's total.
  useEffect(() => {
    tick.current = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick.current);
  }, []);

  /**
   * Send one punch: a tile ("activity") or Clock out ("out"). Queued on the
   * phone when there is no signal, with the moment it was tapped.
   */
  async function punch(body, { askWhere = true, jobTitle = null } = {}) {
    setBusy(true);
    try {
      // Asked once, here, at the tap — never for a break. null when the
      // phone did not answer, and then the body carries no `stamp` key.
      const stamp = askWhere ? await captureStamp() : null;
      if (askWhere) locationPermissionState().then(setLocationState);
      const queuePunch = async () => {
        await offline.enqueue("timesheet", {
          ...body,
          jobTitle,
          at: new Date().toISOString(),
          ...(stamp && { stamp }),
        });
        setSheet(null);
      };
      if (offline && !online) {
        await queuePunch();
        return;
      }
      let res;
      try {
        res = await fetch("/api/time-clock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, ...(stamp && { stamp }) }),
        });
      } catch (err) {
        if (offline && isNetworkFailure(err)) {
          await queuePunch();
          return;
        }
        throw err;
      }
      if (!res.ok) {
        await reportResponseError(res, t("app.clock.punchError", "Couldn't record that."));
        return;
      }
      setSheet(null);
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
      <div>
        <ListState loading={false} isEmpty={false} errorKey={errorKey} onRetry={load}>
          {null}
        </ListState>
      </div>
    );
  }

  // Not linked to a worker record — say so plainly instead of a dead button.
  //
  // Unless the person IS the admin they would be asking. An owner, admin or
  // supervisor (the authority that adds anybody under Team → Workers) is
  // offered "Set yourself up to clock in", which creates their own Worker row
  // through the same path invite acceptance uses — no pay rate, no seat; see
  // lib/timeclock/selfEnrol.js. `canSelfEnrol` comes from the server.
  if (data && data.worker === null) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <Clock className="mx-auto mb-3 text-muted-foreground" size={28} />
        <h2 className="text-lg font-bold text-foreground">{t("app.clock.title")}</h2>
        {data.canSelfEnrol ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(
                "app.clock.selfEnrolIntro",
                "You don't have a worker record yet, so there's nothing for your hours to land on. You can create your own.",
              )}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t(
                "app.clock.selfEnrolTerms",
                "This creates your worker record, linked to your login, with no pay rate — whoever runs payroll sets that under Team → Workers. It doesn't use a seat: you're already a member.",
              )}
            </p>
            {enrolError && (
              <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
                {enrolError}
              </p>
            )}
            <button
              type="button"
              onClick={selfEnrol}
              disabled={enrolling}
              className="mt-4 w-full bg-inverted text-inverted-foreground rounded-xl py-3 text-sm font-semibold disabled:opacity-60 min-h-[48px]"
            >
              {enrolling
                ? t("app.clock.selfEnrolling", "Setting you up…")
                : t("app.clock.selfEnrol", "Set yourself up to clock in")}
            </button>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{t("app.clock.notWorker")}</p>
        )}
      </div>
    );
  }

  // A queued punch overrides the server's (possibly cached) answer: the
  // last thing tapped is the truth on this phone until it syncs.
  const queued = queuedPunchState(offline?.items, data?.open);
  const open = queued.open;
  const clockedIn = Boolean(open);
  const waitingToSync = queued.pending;
  const runningBreak = open ? openBreak(open.breaks) : null;
  const working = open ? effectiveActivity(open) : null;
  // What is running right now: the break if there is one, else the work.
  const nowKind = runningBreak ? (runningBreak.kind === "lunch" ? "lunch" : "break") : working;
  const segment = open ? currentSegment(open, now) : null;
  const segmentMs = segment ? now.getTime() - new Date(segment.start).getTime() : 0;
  // Today's total, recomputed on every heartbeat rather than read once from
  // the payload. `data.todayHours` is correct at request time and frozen
  // afterwards — this screen never refetches — so it showed 07:12:33 elapsed
  // beside 0.02 hours today. Same function the route uses; the reasoning, and
  // why the open entry has to come from today's ROWS, is in that file.
  const liveToday = todayHoursFrom(data?.today, now);

  const activities = (data?.activities || []).filter((a) => a.enabled);
  const options = data?.jobOptions || [];
  const todayOptions = options.filter((o) => o.today);
  const otherOptions = options.filter((o) => !o.today);
  const jobLabel = (o) => o?.title || t("app.clock.untitledJob", "Untitled job");
  const stepsFor = (id) => options.find((o) => o.id === id)?.steps || [];
  const currentJobName = open?.job?.title
    ? open?.task?.title
      ? `${open.job.title} · ${open.task.title}`
      : open.job.title
    : null;

  function tap(a) {
    if (busy) return;
    if (a.isBreak) {
      punch({ action: "activity", activity: a.key }, { askWhere: false });
      return;
    }
    // Back from a break to what was running: the same tile, the same job —
    // the server ends the break and the stretch carries on.
    if (runningBreak && a.key === working) {
      punch(
        { action: "activity", activity: a.key, jobId: open.jobId || null, taskId: open.taskId || null },
        { askWhere: false, jobTitle: open.job?.title || null },
      );
      return;
    }
    if (a.job === "none") {
      punch({ action: "activity", activity: a.key });
      return;
    }
    // A tile that can carry a job asks which first. On site starts on the
    // job already running (to change step), else the day's only visit.
    const jobId =
      a.key === working && open?.jobId
        ? open.jobId
        : a.key === "visit"
          ? data?.suggestedJobId || ""
          : "";
    const taskId = a.key === working && open?.jobId === jobId ? open?.taskId || "" : "";
    setSheet({ activity: a.key, job: a.job, jobId, taskId });
  }

  // How wide the Clock out button sits on the tiles' last row: whatever the
  // tiles leave free, and the whole row when they fill it. Bottom of the
  // grid, under the thumb, whatever the company switched off.
  const leftover = (3 - (activities.length % 3)) % 3;
  const outSpan = leftover === 2 ? "col-span-2" : leftover === 1 ? "col-span-1" : "col-span-3";

  return (
    <div>
      {/* ── The timer ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-5 text-center overflow-hidden">
        <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
        </div>
        {clockedIn ? (
          <div className="mt-3">
            {(() => {
              const Icon = activityIcon(nowKind);
              const onBreak = Boolean(runningBreak);
              return (
                <div
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${
                    onBreak
                      ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                      : "bg-inverted text-inverted-foreground"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full animate-pulse ${onBreak ? "bg-amber-500" : "bg-brand-accent"}`} />
                  <Icon size={15} />
                  {activityName(nowKind, data?.activities, t)}
                </div>
              );
            })()}
            <div className="mt-3 text-5xl font-bold tabular-nums text-foreground">{fmtElapsed(segmentMs)}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {segment ? t("app.clock.since", { time: fmtTime(segment.start) }) : null}
              {waitingToSync ? ` · ${t("app.clock.waitingToSync")}` : ""}
            </div>
            {/* On a break, the way back is said in words as well as by the
                lit tile: the work that was running, resumed — the server
                ends the break and the same stretch carries on. */}
            {runningBreak && working ? (
              <button
                type="button"
                onClick={() => tap(activities.find((a) => a.key === working) || { key: working, job: "none" })}
                disabled={busy}
                className="mt-3 w-full inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-5 py-3 text-base font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
              >
                {busy ? <Loader2 size={18} className="animate-spin" /> : <Play size={16} />}
                {t("app.clock.backTo", { activity: activityName(working, data?.activities, t) })}
              </button>
            ) : null}
            {/* Which job these hours are landing on. Said out loud, because a
                picker whose result is invisible afterwards is a control you
                cannot tell is working. */}
            {!runningBreak && (
              <div className="mt-2 text-sm font-semibold text-foreground break-words">
                {currentJobName
                  ? t("app.clock.onJob", "On {job}", { job: currentJobName })
                  : t("app.clock.noJobEntry", "Not linked to a job")}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3">
            <div className="text-4xl font-bold tabular-nums text-foreground">{fmtClock(now)}</div>
            <div className="mt-2 text-sm text-muted-foreground">{t("app.clock.notClockedIn")}</div>
          </div>
        )}
        {/* Number.isFinite, not `|| 0`: a genuine 0.00 is a real answer and
            must print, while a figure that never arrived must not become
            one. The load-failure gate above means this is belt and braces. */}
        {Number.isFinite(liveToday) && (
          <div className="mt-4 flex items-center justify-between rounded-xl bg-muted px-4 py-2.5 text-sm">
            <span className="font-semibold text-muted-foreground">{t("app.clock.totalToday")}</span>
            <span className="font-bold text-foreground tabular-nums">
              {t("app.clock.hoursValue", { hours: liveToday.toFixed(2) })}
            </span>
          </div>
        )}
      </div>

      {/* ── Said before the browser asks ──────────────────────────────────
          Quebec's Law 25 s. 8.1 wants a person told, before a technology
          that can locate them is used, what it does and how it is switched
          on; the OS sheet is the switch, and this is the telling. Only in
          the "prompt" state: granted needs no warning, refused gets no
          second ask this session (lib/location/capture.js). */}
      {locationState === "prompt" && (
        <p className="mt-4 flex items-start gap-1.5 text-left text-xs text-muted-foreground">
          <MapPin size={13} className="mt-0.5 shrink-0" />
          <span>{t("app.clock.locationNotice")}</span>
        </p>
      )}

      {/* ── The tiles ─────────────────────────────────────────────────── */}
      <p className="mt-4 mb-2 text-xs font-semibold text-muted-foreground">
        {clockedIn ? t("app.clock.tapToSwitch") : t("app.clock.tapToStart")}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {activities.map((a) => {
          const Icon = activityIcon(a);
          const current = clockedIn && a.key === nowKind;
          // A break is taken from the clock; off it, the tile is honest
          // about being unavailable rather than inviting a refusal. A tile
          // that is ALREADY running and has nothing to change (no job to
          // swap) is lit and inert.
          const disabled =
            busy || (a.isBreak && !clockedIn) || (current && (a.isBreak || a.job === "none"));
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => tap(a)}
              disabled={disabled}
              aria-pressed={current}
              className={`relative flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
                current
                  ? a.isBreak
                    ? "border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                    : "border-inverted bg-inverted text-inverted-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted disabled:opacity-50"
              }`}
            >
              {current && !a.isBreak ? <span className="absolute inset-x-3 top-0 h-1 rounded-b-full bg-brand-accent" /> : null}
              <Icon size={24} />
              <span className="max-w-full text-center leading-tight break-words">{activityName(a.key, data?.activities, t)}</span>
              {!a.paid ? (
                <span className="text-[11px] font-medium opacity-75">{t("app.clock.unpaidTag")}</span>
              ) : null}
            </button>
          );
        })}
        {clockedIn ? (
          <button
            type="button"
            onClick={() => punch({ action: "out" })}
            disabled={busy}
            className={`${outSpan} flex min-h-[88px] items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60`}
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
            {t("app.clock.clockOut")}
          </button>
        ) : null}
      </div>
      {!clockedIn && (
        <p className="mt-2 text-xs text-muted-foreground">
          {data?.todayCount === 1
            ? t("app.clock.suggestedNote", "You're scheduled here today — change it if you're somewhere else.")
            : data?.todayCount > 1
              ? t("app.clock.pickOneNote", "You have {count} jobs scheduled today — pick the one you're starting.", {
                  count: data.todayCount,
                })
              : t("app.clock.clockInHint")}
        </p>
      )}

      {/* ── Today ─────────────────────────────────────────────────────── */}
      <div className="mt-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">{t("app.clock.today")}</h2>
          <button
            type="button"
            onClick={onOpenLog}
            className="inline-flex min-h-[44px] items-center text-xs font-semibold text-foreground underline"
          >
            {t("app.clock.openLog")}
          </button>
        </div>
        {!data?.today?.length ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("app.clock.noneToday")}</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {data.today.map((e) => {
              const kind = effectiveActivity(e);
              const Icon = activityIcon(kind);
              return (
                <li key={e.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <span className="flex min-w-0 items-start gap-2">
                    <Icon size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block text-foreground">
                        {activityName(kind, data?.activities, t)} · {fmtTime(e.clockIn)} –{" "}
                        {e.clockOut ? fmtTime(e.clockOut) : t("app.clock.open")}
                      </span>
                      {/* Named either way. "No job" is a fact worth showing —
                          it is how somebody notices an hour that should have
                          had one. */}
                      <span className="block text-xs text-muted-foreground break-words">
                        {e.job?.title
                          ? e.task?.title
                            ? `${e.job.title} · ${e.task.title}`
                            : e.job.title
                          : t("app.clock.noJobEntry", "Not linked to a job")}
                        {e.paid === false ? ` · ${t("app.clock.unpaidTag")}` : ""}
                      </span>
                      {/* The breaks that came off this entry — the reason its
                          hours are less than clock-in to clock-out. Unpaid
                          only: that is what was deducted. */}
                      {e.breaks?.length > 0 && (
                        <span className="block text-xs text-muted-foreground">
                          {t("app.clock.breakMinutes", {
                            minutes: Math.round(unpaidBreakMs(e.breaks, e.clockIn, e.clockOut || now) / 60_000),
                          })}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="text-muted-foreground tabular-nums shrink-0">
                    {e.clockOut && e.hours != null ? t("app.clock.hoursValue", { hours: Number(e.hours).toFixed(2) }) : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{t("app.clock.reviewNote")}</p>
      </div>

      {sheet ? (
        <JobSheet
          sheet={sheet}
          setSheet={setSheet}
          busy={busy}
          activities={data?.activities}
          todayOptions={todayOptions}
          otherOptions={otherOptions}
          jobLabel={jobLabel}
          stepsFor={stepsFor}
          truncated={data?.truncated}
          // The entry already running, when the sheet is for its own tile —
          // Start is then only live once the job or step actually changes,
          // because the server refuses "switch to what you are on".
          running={!runningBreak && sheet.activity === working ? { jobId: open?.jobId || "", taskId: open?.taskId || "" } : null}
          onStart={() => {
            const option = options.find((o) => o.id === sheet.jobId);
            punch(
              {
                action: "activity",
                activity: sheet.activity,
                jobId: sheet.jobId || null,
                taskId: sheet.activity === "visit" && sheet.jobId ? sheet.taskId || null : null,
              },
              { jobTitle: option?.title || null },
            );
          }}
          t={t}
        />
      ) : null}
    </div>
  );
}

/**
 * The job, chosen before the tile starts. A bottom sheet on a phone, a
 * dialog above that — the same chrome as every other sheet on the employee
 * screens. On site cannot start without a job; Driving and Supplies may.
 */
function JobSheet({ sheet, setSheet, busy, activities, todayOptions, otherOptions, jobLabel, stepsFor, truncated, running, onStart, t }) {
  const name = activityName(sheet.activity, activities, t);
  const required = sheet.job === "required";
  const nothingToPick = todayOptions.length + otherOptions.length === 0;
  const steps = sheet.activity === "visit" ? stepsFor(sheet.jobId) : [];
  const unchanged = Boolean(running) && running.jobId === (sheet.jobId || "") && running.taskId === (sheet.taskId || "");
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={() => setSheet(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="clock-sheet-title"
        className="fq-dialog-card w-full max-w-md rounded-t-2xl bg-card p-5 shadow-2xl sm:rounded-2xl pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="clock-sheet-title" className="text-lg font-bold text-foreground">
          {t("app.clock.sheetTitle", { activity: name })}
        </h2>
        {nothingToPick && required ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("app.clock.noJobsToPick")}</p>
        ) : (
          <>
            <label htmlFor="clock-sheet-job" className="mt-3 block text-xs font-semibold text-muted-foreground">
              {t("app.clock.jobLabel", "Which job?")}
            </label>
            <select
              id="clock-sheet-job"
              value={sheet.jobId}
              onChange={(e) => setSheet({ ...sheet, jobId: e.target.value, taskId: "" })}
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-3 text-base text-foreground"
            >
              {required ? (
                <option value="" disabled>
                  {t("app.clock.pickJob")}
                </option>
              ) : (
                <option value="">{t("app.clock.noJobPlain")}</option>
              )}
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
            {/* The step, only for time on site at a job with a plan. Hours
                booked to a step show as "clocked" on it (lib/jobs/plan.js). */}
            {steps.length > 0 && (
              <div className="mt-2">
                <label htmlFor="clock-sheet-step" className="text-xs font-semibold text-muted-foreground">
                  {t("app.clock.stepLabel", "Which step?")}
                </label>
                <select
                  id="clock-sheet-step"
                  value={sheet.taskId}
                  onChange={(e) => setSheet({ ...sheet, taskId: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-3 text-base text-foreground"
                >
                  <option value="">{t("app.clock.noStep", "The job — no particular step")}</option>
                  {steps.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {required ? t("app.clock.visitJobNote") : t("app.clock.optionalJobNote")}
              {truncated ? ` ${t("app.clock.truncatedNote", "Only your most recent jobs are listed.")}` : ""}
            </p>
          </>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSheet(null)}
            className="min-h-[48px] rounded-xl border border-border bg-background px-4 text-base font-semibold text-foreground hover:bg-muted"
          >
            {t("app.action.cancel")}
          </button>
          <button
            type="button"
            onClick={onStart}
            disabled={busy || unchanged || (required && !sheet.jobId)}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-inverted px-4 text-base font-semibold text-inverted-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : null}
            {t("app.clock.start")}
          </button>
        </div>
      </div>
    </div>
  );
}
