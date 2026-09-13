"use client";

// app/app/scheduler/DayBoard.js
//
// One day of the rota as a dispatch board: a row per person, a column per
// hour, shifts as blocks, lunches and breaks hatched inside them, approved
// leave as a full-row OUT, the hours somebody has not said they are available
// for in grey, and above it all a coverage strip — per half hour, how many are
// on the tools and how many are on break — so a manager staggering lunches can
// see at a glance whether anyone is left on site.
//
// The arithmetic (where a block sits, what a slot counts, whether a set of
// breaks is legal) is lib/shifts/coverage.js, which is pure and executed by
// scripts/check-shift-board.mjs. This file only draws.
//
// ── Clicks, not drags ───────────────────────────────────────────────────────
//
// An empty hour opens the new-shift modal at that hour; a block opens the
// edit modal. There is no drag-and-drop on purpose: a drag that half works on
// a phone in a driveway is worse than a click that works everywhere, and the
// modal is where the availability refusal and the break check live anyway.
//
// ── The board scrolls; the page does not ────────────────────────────────────
//
// Eleven hours at a readable width is wider than a phone. The board is its
// own overflow-x container with the name column stuck to the left, so the
// page body never scrolls sideways (the platform-mobile rule, measured).

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, MapPin, Plus } from "lucide-react";
import Avatar, { initialsOf } from "@/app/components/chat/Avatar";
import { formatTimeOfDay } from "@/lib/format/localeDate";
import { coversDay } from "@/lib/org/availability";
import { openBreak } from "@/lib/timeclock/entryHours";
import { visitStatusClasses, visitStatusLabel } from "@/lib/jobs/visitStatus";
import {
  boardRange,
  clip,
  coverageSlots,
  dayBoundsLocal,
  hourColumns,
  interval,
  placeBlock,
  scheduledMinutes,
  statusAt,
} from "@/lib/shifts/coverage";
import { jobLabel } from "./ShiftModal";
import AttendanceChip from "@/app/components/team/AttendanceChip";

// The name column is a CSS variable, not a number: 164px on a phone, 208px
// from the sm breakpoint, so a 375px screen keeps three hour columns in view
// instead of two. Every cell and the now-line read the same variable.
const NAME_COL = "var(--name-col)";
const NAME_COL_CLASSES = "[--name-col:164px] sm:[--name-col:208px]";
const HOUR_PX = 76;
const VISIT_MS = 3_600_000; // JobVisit has no duration; a visit is drawn as one hour.

// A stable colour per job so the same job reads the same on every row. Jobs
// carry no colour of their own, so one is picked from the id — the same id
// always lands on the same swatch, on every screen and every reload.
const JOB_SWATCHES = [
  "bg-sky-100 border-sky-400 text-sky-950 dark:bg-sky-900/50 dark:border-sky-500 dark:text-sky-50",
  "bg-violet-100 border-violet-400 text-violet-950 dark:bg-violet-900/50 dark:border-violet-500 dark:text-violet-50",
  "bg-emerald-100 border-emerald-400 text-emerald-950 dark:bg-emerald-900/50 dark:border-emerald-500 dark:text-emerald-50",
  "bg-rose-100 border-rose-400 text-rose-950 dark:bg-rose-900/50 dark:border-rose-500 dark:text-rose-50",
  "bg-teal-100 border-teal-400 text-teal-950 dark:bg-teal-900/50 dark:border-teal-500 dark:text-teal-50",
  "bg-orange-100 border-orange-400 text-orange-950 dark:bg-orange-900/50 dark:border-orange-500 dark:text-orange-50",
  "bg-indigo-100 border-indigo-400 text-indigo-950 dark:bg-indigo-900/50 dark:border-indigo-500 dark:text-indigo-50",
  "bg-lime-100 border-lime-500 text-lime-950 dark:bg-lime-900/50 dark:border-lime-500 dark:text-lime-50",
];
const NO_JOB_SWATCH =
  "bg-muted border-foreground/40 text-foreground";

function swatchFor(jobId) {
  if (!jobId) return NO_JOB_SWATCH;
  let h = 0;
  for (let i = 0; i < jobId.length; i += 1) h = (h * 31 + jobId.charCodeAt(i)) >>> 0;
  return JOB_SWATCHES[h % JOB_SWATCHES.length];
}

// Amber hatching for a lunch or break — visible on every swatch above, which
// is why it is a fixed amber rather than derived from the block's own hue.
const HATCH = {
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(217,119,6,0.55) 0 4px, rgba(255,255,255,0.35) 4px 8px)",
};
const OUT_HATCH = {
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(120,120,120,0.18) 0 6px, transparent 6px 12px)",
};

const hourLabelCache = new Map();
function hourLabel(ms, language) {
  const key = language || "en";
  let f = hourLabelCache.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(key, { hour: "numeric" });
    } catch {
      f = new Intl.DateTimeFormat("en", { hour: "numeric" });
    }
    hourLabelCache.set(key, f);
  }
  return f.format(new Date(ms));
}

const hm = (minutes) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
// Hours to one decimal for the week line — "38.5h" reads faster than
// "38h 30m" beside a threshold, and the threshold is in hours.
const hoursShort = (minutes) => `${Math.round((minutes / 60) * 10) / 10}h`;
const localAt = (ymd, hhmm) => new Date(`${ymd}T${hhmm}:00`).getTime();

/**
 * @param data      the /api/shifts payload for exactly this day
 * @param dateStr   "2026-09-14", the viewer's local day
 * @param now       the instant "now" for the status dots (a Date)
 */
/**
 * @param weekMinutes       workerId → scheduled minutes this week (drafts
 *                          included), from lib/shifts/labourCost.js
 * @param otThresholdWeekly the hours after which the week line turns amber
 * @param attendanceByShift shiftId → ShiftAttendance row, for the chip
 * @param holidays          [{ key, name, observed }] falling on this day
 * @param blackouts         [{ from, to, label }] covering this day
 */
export default function DayBoard({
  data,
  dateStr,
  now,
  isManager,
  canEditSchedule,
  canDeleteShift,
  language,
  t,
  onAddAt,
  onEditShift,
  weekMinutes = null,
  otThresholdWeekly = null,
  attendanceByShift = null,
  holidays = [],
  blackouts = [],
}) {
  const day = useMemo(() => dayBoundsLocal(dateStr), [dateStr]);
  const shifts = useMemo(() => data?.shifts || [], [data]);
  const rows = useMemo(() => {
    if (isManager) return data?.workers || [];
    return data?.self ? [data.self] : [];
  }, [data, isManager]);

  // The weekday's opening hours, or null when the company has none set — the
  // axis then falls back to 7–18 (lib/shifts/coverage.js boardRange).
  const businessDay = useMemo(() => {
    if (!day || !Array.isArray(data?.businessHours)) return null;
    const dow = new Date(day.start).getDay();
    return data.businessHours.find((h) => Number(h.day) === dow) || null;
  }, [data, day]);

  const range = useMemo(
    () => (day ? boardRange({ businessDay, dayStart: day.start, dayEnd: day.end, shifts }) : null),
    [businessDay, day, shifts],
  );
  const columns = useMemo(
    () => (range ? hourColumns(dateStr, range.startHour, range.endHour) : []),
    [dateStr, range],
  );
  const axis = useMemo(
    () =>
      columns.length
        ? { start: columns[0].start, end: columns[columns.length - 1].end }
        : null,
    [columns],
  );

  const business = useMemo(() => {
    if (!businessDay || businessDay.closed) return null;
    return interval(localAt(dateStr, businessDay.open), localAt(dateStr, businessDay.close));
  }, [businessDay, dateStr]);

  const slots = useMemo(
    () =>
      axis
        ? coverageSlots({ shifts, axisStart: axis.start, axisEnd: axis.end, business })
        : [],
    [axis, shifts, business],
  );

  const shiftsByWorker = useMemo(() => {
    const map = {};
    for (const s of shifts) (map[s.workerId] ||= []).push(s);
    return map;
  }, [shifts]);
  const visitsByWorker = useMemo(() => {
    const map = {};
    for (const v of data?.visits || []) if (v.workerId) (map[v.workerId] ||= []).push(v);
    return map;
  }, [data]);
  const availabilityByWorker = useMemo(() => {
    const map = {};
    for (const a of data?.availability || []) map[a.workerId] = a.windows || [];
    return map;
  }, [data]);
  // Leave is a calendar day stored at midnight UTC; the board's day is a local
  // one. A UTC-midnight Date of the same calendar date is what coversDay reads.
  const liveByWorker = useMemo(() => {
    const map = {};
    for (const e of data?.live || []) map[e.workerId] ||= e;
    return map;
  }, [data]);
  const leaveByWorker = useMemo(() => {
    const map = {};
    if (!day) return map;
    const d = new Date(day.start);
    const utcDay = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    for (const l of data?.leave || []) {
      if (coversDay({ ...l, status: "approved" }, utcDay)) map[l.workerId] ||= l;
    }
    return map;
  }, [data, day]);

  if (!day || !axis) return null;

  const minWidth = `calc(${NAME_COL} + ${columns.length * HOUR_PX}px)`;
  const nowMs = now instanceof Date ? now.getTime() : Date.now();
  // The timer only says something about NOW. On any other day the dot falls
  // back to the plan (scheduled / not scheduled) and the live entry is not
  // consulted — a Tuesday board must not show Monday's clock-in.
  const isToday = nowMs >= day.start && nowMs < day.end;
  const nowMark = placeBlock(nowMs, nowMs + 1, axis.start, axis.end);

  return (
    <div className="space-y-3">
      <div className={`overflow-x-auto rounded-xl border border-border bg-card ${NAME_COL_CLASSES}`}>
        <div style={{ minWidth }} className="relative">
          {/* ── Coverage strip ───────────────────────────────────────────
              Managers only. A worker's payload holds their own published
              shifts and nothing else, so a strip over it would count one
              person and call every hour they are off "nobody working" — a
              true statement about the payload and a false one about the
              company. Coverage is the manager's question. */}
          {isManager && (
          <div className="flex border-b border-border">
            <div
              className="sticky left-0 z-20 shrink-0 border-r border-border bg-card px-3 py-2"
              style={{ width: NAME_COL }}
            >
              <div className="text-xs font-semibold text-foreground">
                {t("app.scheduler.coverage")}
              </div>
              <div className="text-[10px] leading-tight text-muted-foreground">
                {t("app.scheduler.coverageHint")}
              </div>
            </div>
            <div className="relative flex-1" style={{ height: 44 }}>
              {slots.map((s) => {
                const p = placeBlock(s.start, s.end, axis.start, axis.end);
                if (!p) return null;
                const tone = s.gap
                  ? "bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-200"
                  : s.working > 0
                    ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "text-muted-foreground";
                const title = s.gap
                  ? t("app.scheduler.coverageGap")
                  : `${t("app.scheduler.coverageWorking", { n: s.working })}${s.onBreak ? ` · ${t("app.scheduler.coverageOnBreak", { n: s.onBreak })}` : ""}`;
                return (
                  <div
                    key={s.start}
                    title={title}
                    className={`absolute inset-y-0 flex flex-col items-center justify-center border-r border-border/60 text-[11px] leading-none ${tone}`}
                    style={{ left: `${p.leftPct}%`, width: `${p.widthPct}%` }}
                  >
                    <span className="font-semibold tabular-nums">{s.working}</span>
                    {s.onBreak > 0 && (
                      <span className="mt-0.5 text-[9px] tabular-nums opacity-80">
                        {t("app.scheduler.coverageBrk", { n: s.onBreak })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          )}

          {/* ── Hour header ────────────────────────────────────────────── */}
          <div className="flex border-b border-border">
            <div
              className="sticky left-0 z-20 shrink-0 border-r border-border bg-card px-3 py-1.5 text-[11px] text-muted-foreground"
              style={{ width: NAME_COL }}
            >
              {rows.length === 1 && !isManager
                ? ""
                : t("app.scheduler.peopleCount", { n: rows.length })}
            </div>
            <div className="relative flex-1" style={{ height: 28 }}>
              {columns.map((c) => {
                const p = placeBlock(c.start, c.end, axis.start, axis.end);
                return (
                  <div
                    key={c.start}
                    className="absolute inset-y-0 border-l border-border/60 pl-1 text-[11px] leading-7 text-muted-foreground"
                    style={{ left: `${p.leftPct}%`, width: `${p.widthPct}%` }}
                  >
                    {hourLabel(c.start, language)}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── A statutory holiday or a blackout, across the whole board ──
              One muted band per mark, above the rows: the day is still a
              working day for whoever is scheduled (a plumber works Labour
              Day), so nothing is greyed or refused — it is said. The name
              comes from the catalogue by key (app.holiday.*), the blackout
              label from what the owner typed. */}
          {(holidays.length > 0 || blackouts.length > 0) && (
            <div className="flex border-b border-border bg-muted/60">
              <div
                className="sticky left-0 z-20 shrink-0 border-r border-border bg-muted/60 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground"
                style={{ width: NAME_COL }}
              >
                {holidays.length > 0 ? t("app.scheduler.holidayRowLabel") : t("app.scheduler.blackoutRowLabel")}
              </div>
              <div className="flex-1 px-3 py-1.5 text-[11px] text-muted-foreground">
                {holidays.map((h) => (
                  <span key={`h-${h.key}-${h.observed}`} className="mr-3 inline-flex items-center gap-1">
                    <span className="font-semibold text-foreground">{t(`app.holiday.${h.key}`, h.name)}</span>
                    {" — "}
                    {t("app.scheduler.statutoryHoliday")}
                  </span>
                ))}
                {blackouts.map((b) => (
                  <span key={`b-${b.from}`} className="mr-3 inline-flex items-center gap-1">
                    <span className="font-semibold text-foreground">{b.label || `${b.from} – ${b.to}`}</span>
                    {" — "}
                    {t("app.scheduler.blackoutBand")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Rows ───────────────────────────────────────────────────── */}
          {rows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              {t("app.scheduler.noWorkers")}
            </div>
          ) : (
            rows.map((w) => (
              <WorkerRow
                key={w.id}
                worker={w}
                dateStr={dateStr}
                day={day}
                axis={axis}
                columns={columns}
                business={business}
                shifts={shiftsByWorker[w.id] || []}
                visits={visitsByWorker[w.id] || []}
                windows={availabilityByWorker[w.id] || null}
                leave={leaveByWorker[w.id] || null}
                live={isToday ? liveByWorker[w.id] || null : null}
                weekMinutes={weekMinutes ? weekMinutes[w.id] || 0 : null}
                otThresholdWeekly={otThresholdWeekly}
                attendanceByShift={attendanceByShift}
                isToday={isToday}
                nowMs={nowMs}
                isManager={isManager}
                canEditSchedule={canEditSchedule}
                canDeleteShift={canDeleteShift}
                language={language}
                t={t}
                onAddAt={onAddAt}
                onEditShift={onEditShift}
              />
            ))
          )}

          {/* The current time, when it is on the board. */}
          {nowMark && nowMs >= day.start && nowMs < day.end && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 z-10 w-px bg-red-500"
              style={{
                // Below the coverage strip (44px, managers only), the hour
                // header (28px) and the holiday/blackout band when one is
                // drawn (29px) — the line starts where the rows start.
                top: (isManager ? 72 : 28) + (holidays.length > 0 || blackouts.length > 0 ? 29 : 0),
                left: `calc(${NAME_COL} + (100% - ${NAME_COL}) * ${nowMark.leftPct / 100})`,
              }}
            />
          )}
        </div>
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
        <li className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-sm border border-sky-400 bg-sky-100 dark:bg-sky-900/50" />
          {t("app.scheduler.legendPublished")}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-sm border border-dashed border-sky-400 bg-sky-100/60 dark:bg-sky-900/30" />
          {t("app.scheduler.legendDraft")}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-sm border border-amber-500" style={HATCH} />
          {t("app.scheduler.legendBreak")}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="inline-flex h-3 w-5 items-center justify-center rounded-sm border border-dashed border-foreground/50 bg-card">
            <MapPin size={8} />
          </span>
          {t("app.scheduler.legendVisit")}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-sm border border-border bg-muted" style={OUT_HATCH} />
          {t("app.scheduler.legendOut")}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-sm bg-muted" />
          {t("app.scheduler.legendUnavailable")}
        </li>
        {isManager && (
          <li className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 rounded-sm bg-red-100 dark:bg-red-950/60" />
            {t("app.scheduler.legendGap")}
          </li>
        )}
      </ul>
    </div>
  );
}

function WorkerRow({
  worker,
  dateStr,
  day,
  axis,
  columns,
  business,
  shifts,
  visits,
  windows,
  leave,
  live,
  weekMinutes = null,
  otThresholdWeekly = null,
  attendanceByShift = null,
  isToday,
  nowMs,
  isManager,
  canEditSchedule,
  canDeleteShift,
  language,
  t,
  onAddAt,
  onEditShift,
}) {
  const minutes = scheduledMinutes(shifts, day.start, day.end);
  // The week so far, drafts included — the number a manager reads before
  // pressing Publish. Amber past the overtime threshold payroll will use.
  const overOt =
    weekMinutes != null && otThresholdWeekly != null && weekMinutes / 60 > otThresholdWeekly;
  const allDraft = shifts.length > 0 && shifts.every((s) => !s.published);

  // ── The dot ─────────────────────────────────────────────────────────────
  //
  //   green   clocked in now (an open TimeEntry) and not on a break
  //   amber   clocked in now and on a running break
  //   grey    scheduled today, not clocked in — the plan says on site, the
  //           timer says not yet. Reads differently from green on purpose.
  //   hollow  not scheduled
  //   muted   approved leave
  //
  // Only the first two come from the clock. `statusAt` (the plan) decides
  // between grey and hollow; it never turns the dot green.
  const liveBreak = live ? openBreak(live.breaks) : null;
  const status = leave
    ? "out"
    : liveBreak
      ? "on_break"
      : live
        ? "clocked_in"
        : shifts.length > 0
          ? "scheduled"
          : "off";
  const planNow = statusAt(shifts, nowMs);

  // Grey: the parts of the axis outside every window this person declared.
  // No windows declared at all (null) means nothing is greyed — silence is
  // not a refusal, and the create route would not refuse either.
  const unavailable = useMemo(() => {
    if (!windows || windows.length === 0) return [];
    const open = windows
      .map((w) => interval(w.from, w.to))
      .filter(Boolean)
      .sort((a, b) => a.start - b.start);
    const out = [];
    let cursor = axis.start;
    for (const w of open) {
      if (w.start > cursor) out.push({ start: cursor, end: Math.min(w.start, axis.end) });
      cursor = Math.max(cursor, w.end);
      if (cursor >= axis.end) break;
    }
    if (cursor < axis.end) out.push({ start: cursor, end: axis.end });
    return out.filter((u) => u.end > u.start);
  }, [windows, axis]);

  const dotClass =
    status === "clocked_in"
      ? "bg-emerald-500"
      : status === "on_break"
        ? "bg-amber-500"
        : status === "out"
          ? "bg-zinc-300 dark:bg-zinc-600"
          : status === "scheduled"
            ? "bg-zinc-400"
            : "bg-card ring-1 ring-inset ring-zinc-400";
  const statusWord =
    status === "clocked_in"
      ? t("app.scheduler.statusClockedIn", { time: formatTimeOfDay(live.clockIn, language) })
      : status === "on_break"
        ? t("app.scheduler.statusOnBreakSince", { time: formatTimeOfDay(liveBreak.start, language) })
        : status === "out"
          ? t("app.scheduler.statusOut")
          : status === "scheduled"
            ? isToday && planNow !== "off"
              ? t("app.scheduler.statusNotClockedIn")
              : t("app.scheduler.statusScheduled")
            : t("app.scheduler.notScheduled");

  // The second line under the name — the mockup's "8h 00m · on site since 7:42".
  let detail;
  if (leave) {
    detail = leave.policy?.name
      ? t("app.scheduler.timeOffNamed", { policy: leave.policy.name })
      : t("app.scheduler.timeOff");
  } else if (shifts.length === 0) {
    detail = live ? statusWord : t("app.scheduler.notScheduled");
  } else if (live) {
    detail = `${hm(minutes)} · ${statusWord}`;
  } else {
    detail = `${hm(minutes)} · ${allDraft && isManager ? t("app.scheduler.draft") : statusWord}`;
  }

  const canClickCells = canEditSchedule && !leave;
  // Where the dashed "+" sits on an empty row: the opening hour if the board
  // knows one, else the first column.
  const plusAt =
    business && business.start >= axis.start && business.start < axis.end
      ? business.start
      : axis.start;

  return (
    // data-worker-row is the anchor the people quick-jump on the phone
    // scrolls to (page.js); it carries no data of its own.
    <div className="flex border-b border-border last:border-b-0" data-worker-row={worker.id}>
      <div
        className="sticky left-0 z-20 flex shrink-0 items-center gap-2.5 border-r border-border bg-card px-3 py-2"
        style={{ width: NAME_COL }}
      >
        <span className="relative">
          <Avatar initials={initialsOf(worker.name)} size="sm" tone={leave ? "muted" : "them"} />
          <span
            aria-hidden="true"
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${dotClass}`}
          />
          <span className="sr-only">{statusWord}</span>
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{worker.name}</div>
          {/* The person's title (Foreman, Receptionist…) when the company
              has set one — Worker.title. Nothing when null: an invented word
              here would be a fallback nobody typed. */}
          {worker?.title ? (
            <div className="truncate text-xs text-muted-foreground">{worker.title}</div>
          ) : null}
          {/* Two lines rather than an ellipsis: "7h 30m · on site since
              7:42" is the sentence the dot exists to explain, and cutting it
              at "on site sin…" loses the number that matters. */}
          <div className="line-clamp-2 text-[11px] leading-tight text-muted-foreground">{detail}</div>
          {/* Managers only: the worker's payload has no week beside it. A
              zero is shown as a zero — "0h this week" is a fact about the
              rota, not an absence. */}
          {isManager && weekMinutes != null && (
            <div
              className={`text-[11px] leading-tight ${
                overOt ? "font-semibold text-amber-700 dark:text-amber-300" : "text-muted-foreground"
              }`}
              title={overOt ? t("app.scheduler.overOtTitle", { hours: otThresholdWeekly }) : undefined}
            >
              {t("app.scheduler.weekHours", { hours: hoursShort(weekMinutes) })}
              {overOt ? ` · ${t("app.scheduler.overOt", { hours: otThresholdWeekly })}` : ""}
            </div>
          )}
        </div>
      </div>

      <div className="relative flex-1" style={{ height: 84 }}>
        {/* Unavailable hours */}
        {unavailable.map((u) => {
          const p = placeBlock(u.start, u.end, axis.start, axis.end);
          return p ? (
            <div
              key={u.start}
              title={t("app.scheduler.unavailable")}
              className="absolute inset-y-0 bg-muted/70"
              style={{ left: `${p.leftPct}%`, width: `${p.widthPct}%` }}
            />
          ) : null;
        })}

        {/* Hour cells — the click targets */}
        {columns.map((c) => {
          const p = placeBlock(c.start, c.end, axis.start, axis.end);
          const label = t("app.scheduler.addShiftAt", {
            name: worker.name,
            time: formatTimeOfDay(c.start, language),
          });
          return canClickCells ? (
            <button
              key={c.start}
              type="button"
              aria-label={label}
              title={label}
              onClick={() => onAddAt(worker.id, c.start)}
              className="absolute inset-y-0 border-l border-border/40 hover:bg-foreground/5 focus-visible:bg-foreground/5"
              style={{ left: `${p.leftPct}%`, width: `${p.widthPct}%` }}
            />
          ) : (
            <div
              key={c.start}
              aria-hidden="true"
              className="absolute inset-y-0 border-l border-border/40"
              style={{ left: `${p.leftPct}%`, width: `${p.widthPct}%` }}
            />
          );
        })}

        {/* Approved leave: the whole row, muted, named. */}
        {leave && (
          <div
            className="pointer-events-none absolute inset-x-0 top-1.5 flex h-11 items-center justify-center rounded-md border border-border bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            style={OUT_HATCH}
          >
            {t("app.scheduler.outLabel")}
            {leave.policy?.name ? ` — ${leave.policy.name}` : ""}
          </div>
        )}

        {/* The dashed "+" on an empty row */}
        {!leave && shifts.length === 0 && canClickCells && (
          <button
            type="button"
            onClick={() => onAddAt(worker.id, plusAt)}
            aria-label={t("app.scheduler.addShiftAt", {
              name: worker.name,
              time: formatTimeOfDay(plusAt, language),
            })}
            className="absolute top-1.5 z-[5] flex h-11 items-center justify-center rounded-md border border-dashed border-foreground/40 text-muted-foreground hover:border-foreground hover:text-foreground"
            style={{
              left: `${placeBlock(plusAt, plusAt + 1, axis.start, axis.end)?.leftPct ?? 0}%`,
              width: `${100 / columns.length}%`,
            }}
          >
            <Plus size={16} />
          </button>
        )}

        {/* Shifts */}
        {shifts.map((s) => {
          const p = placeBlock(s.start, s.end, axis.start, axis.end);
          if (!p) return null;
          const sIv = interval(s.start, s.end);
          const label = s.job ? jobLabel(s.job) : s.note || "";
          const times = `${formatTimeOfDay(s.start, language)} – ${formatTimeOfDay(s.end, language)}`;
          const title = [
            times,
            label,
            s.job && s.note ? s.note : null,
            !s.published ? t("app.scheduler.draft") : null,
            s.availabilityOverrideAt ? t("app.scheduler.outsideAvailability") : null,
          ]
            .filter(Boolean)
            .join(" · ");
          const wide = p.widthPct * columns.length > 110; // roughly > 1 column
          const attendance = attendanceByShift ? attendanceByShift[s.id] || null : null;
          const classes = `absolute top-1.5 z-[6] flex h-11 flex-col justify-center overflow-hidden rounded-md border px-1.5 text-left text-[11px] leading-tight ${swatchFor(s.job?.id)} ${s.published ? "" : "border-dashed"} ${p.clippedStart ? "rounded-l-none" : ""} ${p.clippedEnd ? "rounded-r-none" : ""}`;
          const inner = (
            <>
              {/* Breaks, hatched, inside the block's own coordinate space. */}
              {(s.breaks || []).map((b) => {
                const bi = clip(interval(b.start, b.end), sIv);
                if (!bi) return null;
                const shown = clip(bi, axis);
                if (!shown) return null;
                const blockShown = clip(sIv, axis);
                const left = ((shown.start - blockShown.start) / (blockShown.end - blockShown.start)) * 100;
                const width = ((shown.end - shown.start) / (blockShown.end - blockShown.start)) * 100;
                const breakWide = (width / 100) * p.widthPct * columns.length > 45;
                const kindLabel = b.kind === "lunch" ? t("app.scheduler.lunch") : t("app.scheduler.break");
                return (
                  <span
                    key={b.id || b.start}
                    title={`${kindLabel} ${formatTimeOfDay(b.start, language)} – ${formatTimeOfDay(b.end, language)}${b.paid ? ` · ${t("app.scheduler.paidBreak")}` : ""}`}
                    className="absolute inset-y-0 flex items-center justify-center overflow-hidden border-x border-amber-600/60 text-[9px] font-semibold uppercase tracking-wide text-amber-950 dark:text-amber-100"
                    style={{ left: `${left}%`, width: `${width}%`, ...HATCH }}
                  >
                    {breakWide ? kindLabel : ""}
                  </span>
                );
              })}
              <span className="relative z-[1] flex items-center gap-1 truncate font-semibold">
                {p.clippedStart ? "◀ " : ""}
                {s.availabilityOverrideAt && (
                  <AlertTriangle size={11} className="shrink-0 text-amber-700 dark:text-amber-300" />
                )}
                <span className="truncate">{wide ? times : formatTimeOfDay(s.start, language)}</span>
                {p.clippedEnd ? " ▶" : ""}
                {/* The rota's verdict — late, no-show, early out, on time —
                    from the time-clock watch, on the block it is about. */}
                {attendance && wide && <AttendanceChip attendance={attendance} t={t} size="xs" className="ml-auto shrink-0" />}
              </span>
              {wide && (label || !s.published) && (
                <span className="relative z-[1] truncate opacity-90">
                  {!s.published ? `${t("app.scheduler.draft")}${label ? " · " : ""}` : ""}
                  {label}
                </span>
              )}
            </>
          );
          const style = { left: `${p.leftPct}%`, width: `${p.widthPct}%` };
          return canEditSchedule ? (
            <button
              key={s.id}
              type="button"
              title={title}
              aria-label={title}
              onClick={() => onEditShift(s)}
              className={`${classes} hover:brightness-95 focus-visible:ring-2 focus-visible:ring-foreground`}
              style={style}
            >
              {inner}
            </button>
          ) : (
            <div key={s.id} title={title} className={classes} style={style}>
              {inner}
            </div>
          );
        })}

        {/* Visits — dispatched from the job page; read-only here, linked. */}
        {visits.map((v) => {
          const startMs = new Date(v.scheduledAt).getTime();
          const p = placeBlock(startMs, startMs + VISIT_MS, axis.start, axis.end);
          if (!p) return null;
          const label = jobLabel(v.job);
          const title = `${formatTimeOfDay(v.scheduledAt, language)} · ${label} · ${visitStatusLabel(v.status, t)}`;
          return (
            <Link
              key={v.id}
              href={`/app/jobs/${v.jobId}`}
              title={title}
              aria-label={`${t("app.scheduler.visit")} · ${title}`}
              className={`absolute top-[58px] z-[7] flex h-5 items-center gap-1 overflow-hidden rounded border border-dashed px-1 text-[10px] font-medium leading-none hover:brightness-95 ${visitStatusClasses(v.status)}`}
              style={{ left: `${p.leftPct}%`, minWidth: `${p.widthPct}%`, maxWidth: `${Math.min(p.widthPct * 3, 100 - p.leftPct)}%` }}
            >
              <MapPin size={10} className="shrink-0" />
              <span className="truncate">{label || t("app.scheduler.visit")}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
