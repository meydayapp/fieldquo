"use client";

// app/app/scheduler/page.js
//
// Shift scheduling. Managers draft shifts and publish them; workers see only
// their own published shifts. Pure scheduling — no pay, no money.
//
// Two views of the same rows, one toggle:
//
//   Week  the original list, seven day cards — readable on a phone, the
//         place to see the shape of a week.
//   Day   the dispatch board (DayBoard.js): a row per person, a column per
//         hour, lunches and breaks hatched inside the blocks, approved leave
//         as OUT, and a coverage strip so a manager can see who is left on
//         site while two people are at lunch. The owner asked for the board
//         in so many words; the week list stays because it is the view that
//         fits a phone, and the two share the modal and the routes.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Loader2,
  CalendarDays,
  Copy,
  Send,
} from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import {
  formatDayMonth,
  formatTimeOfDay,
  formatWeekdayDayMonth,
  weekdayName,
} from "@/lib/format/localeDate";
import { reportResponseError } from "@/lib/clientErrors";
import { fetchList } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { hasLevel } from "@/lib/permissions/enforce";
import { dayBoundsLocal, localYmd } from "@/lib/shifts/coverage";
import { dailyLabourCost, minutesByWorker, weeklyLabourCost } from "@/lib/shifts/labourCost";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";
import { useVisibleRefresh } from "@/app/hooks/useVisibleRefresh";
import DayBoard from "./DayBoard";
import ShiftModal from "./ShiftModal";

const VIEW_KEY = "scheduler.view";

function startOfWeek(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay()); // Sunday
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// ── Why these take a language ────────────────────────────────────────────
//
// They were `toLocaleTimeString([])` / `toLocaleDateString([])`, which reads
// the BROWSER's locale, not the language the user picked in FieldQuo. A
// Spanish account on an English-configured phone read "Sunday, Sep 7" on a
// screen whose every other word was Spanish — the exact report this fixes.
// The shared formatters live in lib/format/localeDate.js so the scheduler,
// the team schedule and the availability editor cannot drift apart.
function fmtTime(iso, language) {
  return formatTimeOfDay(iso, language);
}

export default function SchedulerPage() {
  const { t, language } = useTranslation();
  // "day" | "week". Remembered per browser: a dispatcher who lives on the
  // board should not be handed the list every morning. A stored value that
  // is not one of the two is ignored rather than trusted.
  const [view, setViewState] = useState("day");
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(VIEW_KEY);
      if (stored === "week" || stored === "day") setViewState(stored);
    } catch {
      /* private mode: the default stands */
    }
  }, []);
  const setView = (v) => {
    setViewState(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* not remembered, still shown */
    }
  };
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [dateStr, setDateStr] = useState(() => localYmd(new Date()));
  const [data, setData] = useState(null);
  const [errorKey, setErrorKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // { dateStr } for a new shift from the week list; { workerId, dateStr,
  // start, end } for a new one from a board cell; { shift } to edit one.
  const [modal, setModal] = useState(null);
  const [shiftNotice, setShiftNotice] = useState(null); // warnings from the last save
  // "Copied 4, skipped 1" / "Published 6" — the result of a toolbar action,
  // said once, in a sentence, rather than left to be inferred from the board.
  const [actionNotice, setActionNotice] = useState(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const dayBounds = useMemo(() => dayBoundsLocal(dateStr), [dateStr]);

  // ── A week that failed to load is not a week with no shifts ────────────
  //
  // This returned early on a non-ok response and left `data` untouched, which
  // produced two different wrong screens depending on when it failed:
  //
  //   * On the first load, `data` stayed null and all seven day cards rendered
  //     "No shifts scheduled." A rota that could not be fetched read as a rota
  //     nobody had written.
  //   * On week navigation, `weekStart` and the date headings advanced while
  //     `data` kept the PREVIOUS week's shifts — so last Tuesday's crew was
  //     drawn under next Tuesday's date. Silently wrong data is worse than an
  //     empty state, because nothing about it looks wrong.
  //
  // `setData(null)` closes the second and the error key closes the first.
  //
  // The day board asks for exactly its day, the week list for its week; the
  // route answers both with the same shape, so one loader serves both views.
  // The week the day belongs to (Sunday to Sunday, the pay week the
  // overtime threshold is counted over) rides along on every load, so the
  // board can say "38.5h this week" beside each name and price the week
  // before anything is published. The route answers it as `weekShifts`.
  const costWeek = useMemo(() => {
    const anchor = view === "day" && dayBounds ? new Date(dayBounds.start) : weekStart;
    const start = startOfWeek(anchor);
    return { start, end: addDays(start, 7) };
  }, [view, dayBounds, weekStart]);

  const load = useCallback(async () => {
    const from =
      view === "day" && dayBounds ? new Date(dayBounds.start) : weekStart;
    const to = view === "day" && dayBounds ? new Date(dayBounds.end) : weekEnd;
    const result = await fetchList(
      `/api/shifts?from=${from.toISOString()}&to=${to.toISOString()}&weekFrom=${costWeek.start.toISOString()}&weekTo=${costWeek.end.toISOString()}`,
    );
    if (result.aborted) return;
    if (!result.ok) {
      setData(null);
      setErrorKey(result.errorKey);
      return;
    }
    setErrorKey("");
    setData(result.data);
  }, [view, dayBounds, weekStart, weekEnd, costWeek]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // ── Hours and money, before publish ─────────────────────────────────────
  //
  // lib/shifts/labourCost.js, pure. Rates arrive only when the route's
  // canSeeAllPay said so (`payVisible`); without them the same arithmetic
  // yields hours and overtime and no total, and the line says hours only.
  const money = useCompanyMoney();
  const labour = useMemo(() => {
    if (!data?.manager) return null;
    const weekShifts = data.weekShifts || [];
    const workers = (data.workers || []).map((w) => ({
      ...w,
      hourlyRate: data.rates ? data.rates[w.id] ?? null : null,
    }));
    const weekMinutes = minutesByWorker(weekShifts, costWeek.start.getTime(), costWeek.end.getTime());
    const week = weeklyLabourCost({ minutes: weekMinutes, workers, thresholdWeekly: data.otThresholdWeekly });
    let day = null;
    if (view === "day" && dayBounds) {
      day = dailyLabourCost({
        dayMinutes: minutesByWorker(weekShifts, dayBounds.start, dayBounds.end),
        weekMinutesBefore: minutesByWorker(weekShifts, costWeek.start.getTime(), dayBounds.start),
        workers,
        thresholdWeekly: data.otThresholdWeekly,
      });
    }
    return { weekMinutes, week, day, payVisible: Boolean(data.payVisible) };
  }, [data, costWeek, view, dayBounds]);
  const attendanceByShift = useMemo(() => {
    const map = {};
    for (const a of data?.attendance || []) map[a.shiftId] = a;
    return map;
  }, [data]);
  // The marks on this day: the holiday whose observed day is this date, the
  // blackout ranges covering it. Both are calendar days (ISO strings).
  const dayMarks = useMemo(() => {
    const holidays = (data?.holidays || []).filter((h) => h.observed === dateStr);
    const blackouts = (data?.blackouts || []).filter((b) => b.from <= dateStr && b.to >= dateStr);
    return { holidays, blackouts };
  }, [data, dateStr]);

  // ── The board follows the time clock, live ──────────────────────────────
  //
  // A lunch punched on /app/clock has to change the dot here without anyone
  // pressing reload. Same GET, every thirty seconds while the tab is visible
  // and at once when it becomes visible (app/hooks/useVisibleRefresh.js);
  // between polls the one-minute `now` tick above re-reads the dots from the
  // timestamps already loaded, so a colour is never more than a minute stale.
  // Not while a modal is open — a refetch under a half-typed shift would
  // redraw the board behind it for nothing — and not after a failed load,
  // which has its own Retry.
  useVisibleRefresh(
    view === "day" && !modal && !errorKey,
    30_000,
    () => load(),
  );

  // `manager` comes from the API and means user:view — "may see the whole
  // rota". It is the right gate for READING everyone's week: the subtitle and
  // the missing-hours reminder below both stay on it.
  const isManager = data?.manager;
  const caller = usePermissions();
  // ── Reading the rota and writing it are different questions ──────────────
  //
  // Add shift and Publish week were both gated on `isManager` — user:view —
  // while POST /api/shifts and POST /api/shifts/publish each require
  // schedule at edit_all. A supervisor whose schedule dial is set to view_own
  // or edit_own still holds user:view, so they got the Add button, the modal,
  // the whole-company worker dropdown, typed a shift, and lost it to
  // "You can only change your own schedule."
  //
  // The file already asked this question properly for DELETE (below) and never
  // carried it across to the two controls that create. Same grid, same level
  // the routes ask, asked here too.
  const canEditSchedule = hasLevel(caller, "schedule", "edit_all");
  // DELETE /api/shifts/[id] asks a narrower question again: edit_delete_all,
  // the level above the one the Dispatcher preset grants. So a Dispatcher
  // drafted and published a week and was also shown a ✕ that could only 403.
  const canDeleteShift = hasLevel(caller, "schedule", "edit_delete_all");
  const shiftsByDay = useMemo(() => {
    const map = {};
    for (const s of data?.shifts || []) {
      const k = ymd(new Date(s.start));
      (map[k] ||= []).push(s);
    }
    return map;
  }, [data]);

  // The same route for "Publish week" and "Publish this day" — it already
  // took a range; the day button simply sends a shorter one.
  async function publish(from, to) {
    setBusy(true);
    try {
      const res = await fetch("/api/shifts/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: from.toISOString(), to: to.toISOString() }),
      });
      if (!res.ok)
        return reportResponseError(
          res,
          t("app.scheduler.publishError", "Couldn't publish."),
        );
      const body = await res.json().catch(() => null);
      setActionNotice(t("app.scheduler.publishedCount", { count: body?.count ?? 0 }));
      await load();
    } finally {
      setBusy(false);
    }
  }
  const publishWeek = () => publish(weekStart, weekEnd);
  const publishDay = () =>
    dayBounds && publish(new Date(dayBounds.start), new Date(dayBounds.end));

  // ── Copy from last week ──────────────────────────────────────────────────
  //
  // The same weekday seven days earlier, shifts AND breaks, moved forward a
  // week and created as drafts through the ordinary create route — so every
  // copied shift faces the same availability and leave check a typed one
  // does. A person who already has a shift on the day is skipped (their day
  // was already decided); a copy the route refuses (now on leave, now
  // unavailable) is counted as skipped rather than forced through with an
  // override nobody chose. Confirmed first, because it creates rows.
  async function copyFromLastWeek() {
    if (!dayBounds) return;
    const sourceStart = new Date(dayBounds.start);
    sourceStart.setDate(sourceStart.getDate() - 7);
    const sourceStr = localYmd(sourceStart);
    const source = dayBoundsLocal(sourceStr);
    const dow = new Date(dayBounds.start).getDay();
    if (
      !window.confirm(
        t("app.scheduler.copyConfirm", {
          weekday: weekdayName(dow, language),
          date: formatDayMonth(sourceStart, language),
        }),
      )
    )
      return;
    setBusy(true);
    try {
      const result = await fetchList(
        `/api/shifts?from=${new Date(source.start).toISOString()}&to=${new Date(source.end).toISOString()}`,
      );
      if (!result.ok) {
        setActionNotice(t("app.scheduler.copyLoadFailed"));
        return;
      }
      const sourceShifts = (result.data?.shifts || []).filter(
        (s) => new Date(s.start) >= source.start && new Date(s.start) < source.end,
      );
      if (sourceShifts.length === 0) {
        setActionNotice(
          t("app.scheduler.copyNothing", { date: formatDayMonth(sourceStart, language) }),
        );
        return;
      }
      const taken = new Set((data?.shifts || []).map((s) => s.workerId));
      // Seven local days forward, through the Date constructor, so a copy
      // across a clock change keeps its wall-clock time.
      const forward = (iso) => {
        const d = new Date(iso);
        d.setDate(d.getDate() + 7);
        return d.toISOString();
      };
      let copied = 0;
      let skipped = 0;
      for (const s of sourceShifts) {
        if (taken.has(s.workerId)) {
          skipped += 1;
          continue;
        }
        const res = await fetch("/api/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workerId: s.workerId,
            start: forward(s.start),
            end: forward(s.end),
            jobId: s.job?.id || null,
            note: s.note || undefined,
            breaks: (s.breaks || []).map((b) => ({
              start: forward(b.start),
              end: forward(b.end),
              kind: b.kind,
              paid: b.paid === true,
            })),
          }),
        });
        if (res.ok) {
          copied += 1;
          taken.add(s.workerId);
        } else {
          skipped += 1;
        }
      }
      setActionNotice(t("app.scheduler.copyDone", { copied, skipped }));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function removeShift(id) {
    const res = await fetch(`/api/shifts/${id}`, { method: "DELETE" });
    if (!res.ok) return reportResponseError(res);
    await load();
  }

  const weekLabel = `${formatDayMonth(weekStart, language)} – ${formatDayMonth(addDays(weekStart, 6), language)}`;
  const anyDraft = (data?.shifts || []).some((s) => !s.published);
  const todayStr = localYmd(now);
  const shiftDay = (n) => {
    const d = new Date(dayBounds ? dayBounds.start : Date.now());
    d.setDate(d.getDate() + n);
    setDateStr(localYmd(d));
  };
  const pad = (n) => String(n).padStart(2, "0");
  // A board cell: this person, this hour, eight hours long, kept inside the
  // day — a click at 16:00 offers 16:00–23:59, not a shift into tomorrow the
  // modal cannot express.
  const openNewAt = (workerId, startMs) => {
    const start = new Date(startMs);
    const endMs = Math.min(startMs + 8 * 3_600_000, dayBounds.end - 60_000);
    const end = new Date(endMs);
    setModal({
      workerId,
      dateStr,
      start: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
      end: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
    });
  };

  const viewToggle = (
    <div
      role="tablist"
      aria-label={t("app.scheduler.viewLabel")}
      className="inline-flex rounded-lg border border-border p-0.5"
    >
      {["day", "week"].map((v) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={view === v}
          onClick={() => setView(v)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            view === v
              ? "bg-inverted text-inverted-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          {v === "day" ? t("app.scheduler.viewDay") : t("app.scheduler.viewWeek")}
        </button>
      ))}
    </div>
  );

  return (
    <div
      className={`${view === "day" ? "max-w-6xl" : "max-w-3xl"} mx-auto p-4 sm:p-6`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays size={20} className="text-foreground" />
            <h1 className="text-2xl font-bold text-foreground">
              {t("app.scheduler.title")}
            </h1>
          </div>
          {isManager && (
            <p className="mt-1 text-sm text-muted-foreground">
              {view === "day"
                ? t("app.scheduler.boardSubtitle")
                : t(
                    "app.scheduler.managerSubtitle",
                    "Add shifts for the week, then Publish so your team can see them — shifts stay hidden until you publish.",
                  )}
            </p>
          )}
        </div>
        {viewToggle}
      </div>

      {view === "day" ? (
        /* ── Day toolbar ───────────────────────────────────────────────── */
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shiftDay(-1)}
              className="p-2 rounded-lg border border-border hover:bg-muted"
              aria-label={t("app.scheduler.prevDay")}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setDateStr(todayStr)}
              className="px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted"
            >
              {t("app.scheduler.today")}
            </button>
            <button
              type="button"
              onClick={() => shiftDay(1)}
              className="p-2 rounded-lg border border-border hover:bg-muted"
              aria-label={t("app.scheduler.nextDay")}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <input
            type="date"
            value={dateStr}
            onChange={(e) => e.target.value && setDateStr(e.target.value)}
            aria-label={t("app.scheduler.date")}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <span className="text-sm font-semibold text-foreground">
            {dayBounds && formatWeekdayDayMonth(new Date(dayBounds.start), language)}
            {dateStr === todayStr && (
              <span className="ml-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {t("app.scheduler.today")}
              </span>
            )}
          </span>
          {canEditSchedule && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyFromLastWeek}
                disabled={busy || loading || Boolean(errorKey)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
              >
                <Copy size={14} />
                {t("app.scheduler.copyLastWeek", {
                  weekday: dayBounds
                    ? weekdayName(new Date(dayBounds.start).getDay(), language)
                    : "",
                })}
              </button>
              {anyDraft && (
                <button
                  type="button"
                  onClick={publishDay}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Send size={15} />
                  )}
                  {t("app.scheduler.publishDay")}
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
      /* Week nav */
      <div
        data-tour="scheduler-week"
        className="flex items-center justify-between gap-2 mb-4"
      >
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="p-2 rounded-lg border border-border hover:bg-muted"
            aria-label={t("app.scheduler.prevWeek", "Previous week")}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted"
          >
            {t("app.scheduler.thisWeek")}
          </button>
          <button
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="p-2 rounded-lg border border-border hover:bg-muted"
            aria-label={t("app.scheduler.nextWeek", "Next week")}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <span className="text-sm font-semibold text-foreground">
          {weekLabel}
        </span>
      </div>
      )}

      {/* Gated on canEditSchedule, not isManager — POST /api/shifts and
          POST /api/shifts/publish both require schedule at edit_all, and
          isManager only means user:view. See the comment above the two
          constants. */}
      {view === "week" && canEditSchedule && (
        <div className="flex items-center gap-2 mb-4">
          <button
            data-tour="scheduler-add"
            onClick={() =>
              setModal({
                dateStr: ymd(
                  new Date() >= weekStart && new Date() < weekEnd
                    ? new Date()
                    : weekStart,
                ),
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2"
          >
            <Plus size={15} /> {t("app.scheduler.addShift")}
          </button>
          {anyDraft && (
            <button
              onClick={publishWeek}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}
              {t("app.scheduler.publishWeek")}
            </button>
          )}
        </div>
      )}

      {/* ── Who has no usual hours set ──────────────────────────────────────
          A worker with no WorkingHours has no pattern, so nothing warns when
          they are scheduled at an odd time and payroll has no baseline to
          sanity-check their logged time against. The rota is where somebody
          notices, so the reminder lives here rather than on a settings screen
          nobody opens.

          Named, not counted. "3 people are missing hours" sends someone
          hunting; the names send them straight there. */}
      {isManager && data?.missingHours?.length > 0 && (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          {/* One key holding the whole warning, names interpolated. It used
              to be an English fragment, a <strong> of names, and a second
              English fragment — which is the shape that produces a sentence
              half in one language and half in another the moment anyone
              translates part of it. The names lose their bold; a sentence that
              reads is worth more than a bold noun inside a broken one. */}
          <p className="text-amber-900 dark:text-amber-200">
            {t("app.scheduler.missingHours", {
              names: data.missingHours.map((w) => w.name).join(", "),
            })}
          </p>
          <Link
            href="/app/settings/availability"
            className="mt-1 inline-block text-xs font-medium text-amber-900 underline dark:text-amber-200"
          >
            {t("app.scheduler.setTheirHours")}
          </Link>
        </div>
      )}

      {/* ── What the rota costs, before it is published ─────────────────────
          Hours for everyone who can see the board; money only when the route
          sent rates (payroll at view_all — the same gate as the Workers
          tab). People scheduled with no rate are NAMED, not priced at zero:
          a total that quietly omits three of five people is not a total. */}
      {isManager && labour && !loading && !errorKey && (
        <LabourLine labour={labour} view={view} money={money} t={t} />
      )}

      {/* Created, and worth a word: the shift is outside this person's usual
          pattern. Not an error — that is what an extra day or an early start
          IS — but a mistyped hour looks exactly the same, and only the manager
          can tell the two apart. */}
      {shiftNotice && (
        <div className="mb-3 rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
          {t("app.scheduler.shiftAdded")} {shiftNotice.join(" ")}
        </div>
      )}
      {actionNotice && (
        <div className="mb-3 flex items-start justify-between gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
          <span>{actionNotice}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            aria-label={t("app.action.close")}
            className="shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {errorKey ? (
        /* The week could not be read. Seven cards saying "No shifts
           scheduled." would be seven claims nobody made — and on a week that
           was navigated to, the cards would carry the PREVIOUS week's shifts
           under the new dates. One panel, one sentence, one retry. */
        <ListState loading={false} isEmpty={false} errorKey={errorKey} onRetry={load}>
          {null}
        </ListState>
      ) : loading ? (
        <div className="min-h-[30vh] grid place-items-center">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : view === "day" ? (
        <>
          <DayBoard
            data={data}
            dateStr={dateStr}
            now={now}
            isManager={Boolean(isManager)}
            canEditSchedule={canEditSchedule}
            canDeleteShift={canDeleteShift}
            language={language}
            t={t}
            onAddAt={openNewAt}
            onEditShift={(shift) => setModal({ shift })}
            weekMinutes={labour?.weekMinutes || null}
            otThresholdWeekly={data?.otThresholdWeekly ?? null}
            attendanceByShift={attendanceByShift}
            holidays={dayMarks.holidays}
            blackouts={dayMarks.blackouts}
          />
          {/* The board has drawn every row and none of them holds a shift.
              Said once under the board, not as a separate empty panel that
              would hide the rows, the OUT blocks and the visits. */}
          {(data?.shifts || []).length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              {isManager
                ? t("app.scheduler.emptyDay")
                : t("app.scheduler.emptyDayWorker")}
            </p>
          )}
          {canEditSchedule && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("app.scheduler.boardHint")}
            </p>
          )}
        </>
      ) : (
        <div className="space-y-3">
          {isManager && labour && <WeekHoursPanel labour={labour} money={money} t={t} />}
          {days.map((day) => {
            const key = ymd(day);
            const list = (shiftsByDay[key] || []).sort(
              (a, b) => new Date(a.start) - new Date(b.start),
            );
            const isToday = ymd(new Date()) === key;
            return (
              <div
                key={key}
                className={`rounded-xl border bg-card p-4 ${isToday ? "border-foreground/40" : "border-border"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-foreground">
                    {formatWeekdayDayMonth(day, language)}
                    {isToday && (
                      <span className="ml-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        {t("app.scheduler.today")}
                      </span>
                    )}
                  </h3>
                  {/* Same route, same level. This one is also a 44px target
                      now: it was a bare 16px icon with no padding, and it is
                      the fastest way to add a shift to a given day. */}
                  {canEditSchedule && (
                    <button
                      type="button"
                      onClick={() => setModal({ dateStr: key })}
                      className="-mr-2 inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={t("app.scheduler.addShift")}
                    >
                      <Plus size={16} />
                    </button>
                  )}
                </div>
                {!list.length ? (
                  <p className="text-sm text-muted-foreground">
                    {t("app.scheduler.noShifts")}
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {list.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {fmtTime(s.start, language)} – {fmtTime(s.end, language)}
                            {isManager && s.worker?.name
                              ? ` · ${s.worker.name}`
                              : ""}
                          </div>
                          {(s.job?.title || s.note) && (
                            <div className="text-xs text-muted-foreground truncate">
                              {[s.job?.title, s.note]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          )}
                          {/* The lunch is part of the shift; a list that
                              hid it would tell a worker to be on the tools
                              for eight hours straight. */}
                          {s.breaks?.length > 0 && (
                            <div className="text-xs text-muted-foreground truncate">
                              {s.breaks
                                .map(
                                  (b) =>
                                    `${b.kind === "lunch" ? t("app.scheduler.lunch") : t("app.scheduler.break")} ${fmtTime(b.start, language)}–${fmtTime(b.end, language)}`,
                                )
                                .join(" · ")}
                            </div>
                          )}
                          {/* The worker sees this on their OWN shift. That is
                              the point of recording it rather than confirming
                              it in a dialog: they were scheduled outside what
                              they said they were available for, and they should
                              learn it here, not on the morning. */}
                          {s.availabilityOverrideAt && (
                            <div className="text-xs text-amber-700 dark:text-amber-400">
                              {t("app.scheduler.outsideAvailability")}
                              {s.availabilityOverrideBy?.name
                                ? ` · ${s.availabilityOverrideBy.name}`
                                : ""}
                              {s.availabilityOverrideNote
                                ? ` — ${s.availabilityOverrideNote}`
                                : ""}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {!s.published && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                              {t("app.scheduler.draft")}
                            </span>
                          )}
                          {/* Same modal the board opens: times, job, note,
                              lunch and breaks. Edit was only reachable from
                              the board until this button; the list is the
                              phone view and a phone user has the same
                              shifts to fix. */}
                          {canEditSchedule && (
                            <button
                              type="button"
                              onClick={() => setModal({ shift: s })}
                              className="text-xs font-medium text-foreground underline"
                            >
                              {t("app.action.edit")}
                            </button>
                          )}
                          {isManager && canDeleteShift && (
                            <button
                              onClick={() => removeShift(s.id)}
                              className="text-muted-foreground hover:text-red-600"
                              aria-label={t("app.action.delete")}
                            >
                              <X size={15} />
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isManager && !loading && (
        <p className="mt-4 text-xs text-muted-foreground">
          {t("app.scheduler.workerNote")}
        </p>
      )}

      {modal && isManager && (
        <ShiftModal
          shift={modal.shift || null}
          initial={modal.shift ? {} : modal}
          workers={data?.workers || []}
          jobs={data?.jobs || []}
          canDelete={canDeleteShift}
          onClose={() => setModal(null)}
          onSaved={async (warnings) => {
            setModal(null);
            setShiftNotice(warnings?.length ? warnings : null);
            await load();
          }}
          onDeleted={async () => {
            setModal(null);
            await load();
          }}
          t={t}
        />
      )}
    </div>
  );
}

// ── The labour line ─────────────────────────────────────────────────────────
//
// One sentence per figure, whole keys, numbers interpolated. `total` is null
// when nobody scheduled has a rate; the overtime hours are shown whether or
// not there is money, because they are the thing a manager can still fix
// before publishing.
function LabourLine({ labour, view, money, t }) {
  const { week, day, payVisible } = labour;
  const missing = (view === "day" && day ? day.missingRate : week.missingRate).map((m) => m.name).filter(Boolean);
  const weekHours = Math.round((Object.values(labour.weekMinutes).reduce((a, b) => a + b, 0) / 60) * 10) / 10;
  const otHours = Math.round(week.rows.reduce((a, r) => a + r.overtimeHours, 0) * 10) / 10;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm">
      {view === "day" && day && payVisible && (
        <span className="text-foreground">
          <span className="text-muted-foreground">{t("app.scheduler.costDay")}</span>{" "}
          <span className="font-semibold tabular-nums">{day.total == null ? "—" : money(day.total)}</span>
        </span>
      )}
      {payVisible ? (
        <span className="text-foreground">
          <span className="text-muted-foreground">{t("app.scheduler.costWeek")}</span>{" "}
          <span className="font-semibold tabular-nums">{week.total == null ? "—" : money(week.total)}</span>
        </span>
      ) : null}
      <span className="text-muted-foreground">
        {t("app.scheduler.weekScheduled", { hours: weekHours })}
      </span>
      <span className={otHours > 0 ? "font-semibold text-amber-700 dark:text-amber-300" : "text-muted-foreground"}>
        {t("app.scheduler.weekOvertime", { hours: otHours, threshold: week.thresholdWeekly })}
      </span>
      {missing.length > 0 && (
        <span className="text-amber-700 dark:text-amber-300" title={t("app.scheduler.rateNotSetTitle")}>
          {t("app.scheduler.rateNotSet", { names: missing.join(", ") })}
        </span>
      )}
      {!payVisible && (
        <span className="text-[11px] text-muted-foreground">{t("app.scheduler.costHidden")}</span>
      )}
    </div>
  );
}

// ── The week list's per-person hours ────────────────────────────────────────
function WeekHoursPanel({ labour, money, t }) {
  const { week, payVisible } = labour;
  if (!week.rows.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-2 text-sm font-bold text-foreground">{t("app.scheduler.weekHoursTitle")}</h3>
      <ul className="divide-y divide-border">
        {week.rows.map((r) => (
          <li key={r.workerId} className="flex items-center justify-between gap-3 py-1.5 text-sm">
            <span className="min-w-0 truncate text-foreground">{r.name || r.workerId}</span>
            <span className="flex shrink-0 items-center gap-3 tabular-nums">
              <span className={r.overtime ? "font-semibold text-amber-700 dark:text-amber-300" : "text-muted-foreground"}>
                {t("app.scheduler.weekHours", { hours: `${r.hours}h` })}
                {r.overtime ? ` · ${t("app.scheduler.overOt", { hours: week.thresholdWeekly })}` : ""}
              </span>
              {payVisible && (
                <span className="w-20 text-right text-foreground">
                  {r.cost == null ? (
                    <span className="text-amber-700 dark:text-amber-300" title={t("app.scheduler.rateNotSetTitle")}>
                      {t("app.scheduler.rateNotSetShort")}
                    </span>
                  ) : (
                    money(r.cost)
                  )}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
