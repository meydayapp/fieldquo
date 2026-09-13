"use client";

// app/app/scheduler/WeekGrid.js
//
// The week as a GRID — the Homebase shape the owner sent: a row per person,
// a column per day, two fixed rows on top (Events, Open shifts), a footer of
// wages and hours per day, sticky first column and header when the grid is
// wider than the screen.
//
// ── A block ──────────────────────────────────────────────────────────────────
//
// "8AM – 3PM" over a small uppercase caption — the shift's label ("Lead",
// "Helper") when one was typed, else the job's client — with "Shift notes"
// under it when a note exists. Colour is per JOB, stable for the job's id
// (jobTone below), so the same site is the same colour on every row and
// every week; the palette is eight bg/text pairs that clear 4.5:1 in both
// themes rather than a hue computed from a hash, because a computed hue
// lands on yellow-on-white eventually. Several shifts on one day stack.
//
// ── Money ────────────────────────────────────────────────────────────────────
//
// The "$0.00" under a name and the WAGES footer render only when `payVisible`
// — the route's canSeeAllPay — and come from the page's `labour` object and
// `dayWages` callback, both computed by lib/shifts/labourCost.js (the same
// arithmetic the day board's line uses; page.js owns the call so the two
// views cannot price a week differently). Without them the grid shows
// hours only — never a $0.00 for a worker with no rate, never a number
// this file worked out on its own. Hours are net of unpaid breaks
// (scheduledMinutes) everywhere.
import { useMemo, useState } from "react";
import { Plus, StickyNote } from "lucide-react";
import { formatTimeOfDay, weekdayName } from "@/lib/format/localeDate";
import { scheduledMinutes } from "@/lib/shifts/coverage";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { jobTone } from "@/lib/shifts/jobTone";

const pad = (n) => String(n).padStart(2, "0");
const ymdOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayBounds = (d) => {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  const e = new Date(s);
  e.setDate(e.getDate() + 1);
  return { start: s.getTime(), end: e.getTime() };
};

/** "8AM – 3PM" without the minutes when both are on the hour. */
function blockTimes(start, end, language) {
  return `${formatTimeOfDay(start, language)} – ${formatTimeOfDay(end, language)}`.replace(/:00(\s?[AP]M)/gi, "$1");
}

function initials(name) {
  return (
    String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "?"
  );
}

/**
 * @param days          the seven Dates of the week, in the company's order
 * @param shifts        the week's shifts (open ones have workerId null)
 * @param workers       [{ id, name, title, hourlyRate? }]
 * @param events        [{ id, date, title, description }]
 * @param labour        page.js's labour object ({ week: { rows, total, thresholdWeekly } }) or null
 * @param dayWages      (column) => number|null — the day's priced cost, or null; page.js supplies it
 * @param onAdd(workerId|null, ymd)   empty cell → the modal
 * @param onEdit(shift)               block → the modal
 * @param onAddEvent(ymd) / onEditEvent(event)
 */
export default function WeekGrid({
  days,
  shifts,
  workers,
  events = [],
  labour = null,
  dayWages = null,
  payVisible = false,
  language,
  t,
  canEdit = false,
  onAdd,
  onEdit,
  onAddEvent,
  onEditEvent,
  todayYmd,
}) {
  const { money } = useCompanyPreferences();
  const [hover, setHover] = useState(null);
  const columns = useMemo(() => days.map((d) => ({ date: d, ymd: ymdOf(d), ...dayBounds(d) })), [days]);

  // Shifts by (worker, day). A shift overlapping a day sits in that day's
  // cell by its START day — the week grid is a plan, and a night shift is
  // planned on the evening it begins.
  const cells = useMemo(() => {
    const map = {};
    for (const s of shifts || []) {
      const key = `${s.workerId || "open"}|${ymdOf(new Date(s.start))}`;
      (map[key] ||= []).push(s);
    }
    for (const list of Object.values(map)) list.sort((a, b) => new Date(a.start) - new Date(b.start));
    return map;
  }, [shifts]);
  const eventsByDay = useMemo(() => {
    const map = {};
    for (const e of events || []) {
      const d = new Date(e.date);
      const key = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
      (map[key] ||= []).push(e);
    }
    return map;
  }, [events]);

  // Per-worker week hours and cost from the labour object (the same rows the
  // day board's line prints); per-day hours from scheduledMinutes; per-day
  // wages from the page's callback, which prices the day with the week's
  // earlier days as the overtime context (Saturday's hours after forty are
  // overtime). No callback, no money.
  const weekRowBy = useMemo(() => {
    const m = {};
    for (const r of labour?.week?.rows || []) m[r.workerId] = r;
    return m;
  }, [labour]);
  const weekStartMs = columns[0]?.start ?? 0;
  const perDay = useMemo(
    () =>
      columns.map((c) => {
        const assigned = (shifts || []).filter((s) => s.workerId);
        const dayShifts = assigned.filter((s) => ymdOf(new Date(s.start)) === c.ymd);
        const hours = Math.round((scheduledMinutes(dayShifts, c.start, c.end) / 60) * 100) / 100;
        const people = new Set(dayShifts.map((s) => s.workerId)).size;
        const wages = payVisible && typeof dayWages === "function" ? dayWages(c) : null;
        return { hours, people, wages };
      }),
    [columns, shifts, payVisible, dayWages],
  );
  const weekHours = Math.round(perDay.reduce((a, d) => a + d.hours, 0) * 100) / 100;
  const weekWages = payVisible && labour?.week ? labour.week.total : null;
  const openHours = Math.round((scheduledMinutes((shifts || []).filter((s) => !s.workerId), weekStartMs, columns[columns.length - 1]?.end ?? 0) / 60) * 100) / 100;

  const nameCol = "sticky left-0 z-10 w-44 min-w-[11rem] border-r border-border bg-card px-3 py-2";

  const cellFor = (rowKey, workerId, col) => {
    const list = cells[`${rowKey}|${col.ymd}`] || [];
    const hovered = hover === `${rowKey}|${col.ymd}`;
    return (
      <td
        key={col.ymd}
        className={`group relative min-w-[8.5rem] border-r border-border p-1 align-top ${col.ymd === todayYmd ? "bg-emerald-50/40 dark:bg-emerald-950/10" : ""}`}
        onMouseEnter={() => setHover(`${rowKey}|${col.ymd}`)}
        onMouseLeave={() => setHover(null)}
      >
        <div className="flex min-h-[3.25rem] flex-col gap-1">
          {list.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onEdit?.(s)}
              aria-label={t("app.scheduler.weekBlockLabel", { times: blockTimes(s.start, s.end, language), who: s.worker?.name || t("app.scheduler.openShift") })}
              className={`w-full rounded-lg px-2 py-1.5 text-left ${jobTone(s.job?.id)} ${s.published ? "" : "ring-1 ring-inset ring-amber-500/60"}`}
            >
              <div className="text-sm font-semibold leading-tight tabular-nums">{blockTimes(s.start, s.end, language)}</div>
              <div className="truncate text-[10px] font-bold uppercase tracking-wide opacity-80">
                {s.label || s.job?.client?.name || s.job?.title || (s.workerId ? "" : t("app.scheduler.openShift"))}
                {!s.published ? ` · ${t("app.scheduler.draft")}` : ""}
              </div>
              {s.note ? (
                <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] underline opacity-90">
                  <StickyNote size={10} /> {t("app.scheduler.shiftNotes")}
                </div>
              ) : null}
            </button>
          ))}
          {canEdit ? (
            <button
              type="button"
              onClick={() => onAdd?.(workerId, col.ymd)}
              aria-label={t("app.scheduler.addShiftFor", { who: workerId ? workers.find((w) => w.id === workerId)?.name || "" : t("app.scheduler.openShift"), date: col.ymd })}
              className={`mt-auto inline-flex min-h-[28px] w-full items-center justify-center gap-1 rounded-md border border-dashed border-border text-[11px] font-bold uppercase tracking-wide text-muted-foreground transition-opacity print:hidden ${hovered || list.length === 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100"} ${list.length ? "" : "min-h-[3.25rem]"}`}
            >
              {t("app.scheduler.addPlus")} <Plus size={12} />
            </button>
          ) : null}
        </div>
      </td>
    );
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card print:overflow-visible print:rounded-none print:border-0" data-week-grid>
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-20 bg-card">
          <tr className="border-b border-border">
            <th className={`${nameCol} text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground`}>
              {t("app.scheduler.employeeView")}
            </th>
            {columns.map((c) => (
              <th key={c.ymd} className={`min-w-[8.5rem] border-r border-border px-2 py-2 text-left ${c.ymd === todayYmd ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"}`}>
                <div className="text-[11px] font-bold uppercase tracking-wide">
                  {weekdayName(c.date.getDay(), language, "short")} {c.date.getDate()}
                </div>
                <div className="text-[10px] font-medium text-muted-foreground tabular-nums">
                  {t("app.scheduler.peopleCount", { n: perDay[columns.indexOf(c)].people })}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* ── Events ─────────────────────────────────────────────── */}
          <tr className="border-b border-border bg-muted/30">
            <td className={`${nameCol} bg-muted/30`}>
              <div className="text-xs font-bold text-foreground">{t("app.scheduler.eventsRow")}</div>
            </td>
            {columns.map((c) => {
              const list = eventsByDay[c.ymd] || [];
              const hovered = hover === `events|${c.ymd}`;
              return (
                <td key={c.ymd} className="group min-w-[8.5rem] border-r border-border p-1 align-top" onMouseEnter={() => setHover(`events|${c.ymd}`)} onMouseLeave={() => setHover(null)}>
                  <div className="flex min-h-[2.25rem] flex-col gap-1">
                    {list.map((e) => (
                      <button key={e.id} type="button" onClick={() => onEditEvent?.(e)} className="w-full rounded-md bg-foreground/90 px-2 py-1 text-left text-background" title={e.description || undefined}>
                        <div className="truncate text-xs font-semibold">{e.title}</div>
                        {e.description ? <div className="truncate text-[10px] opacity-80">{e.description}</div> : null}
                      </button>
                    ))}
                    {canEdit ? (
                      <button type="button" onClick={() => onAddEvent?.(c.ymd)} className={`inline-flex min-h-[24px] w-full items-center justify-center gap-1 rounded-md border border-dashed border-border text-[10px] font-bold uppercase tracking-wide text-muted-foreground print:hidden ${hovered ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                        {t("app.scheduler.addPlus")} <Plus size={11} />
                      </button>
                    ) : null}
                  </div>
                </td>
              );
            })}
          </tr>
          {/* ── Open shifts ────────────────────────────────────────── */}
          <tr className="border-b border-border">
            <td className={nameCol}>
              <div className="text-xs font-bold text-foreground">{t("app.scheduler.openShiftsRow")}</div>
              <div className="text-[11px] text-muted-foreground tabular-nums">{t("app.scheduler.hrs", { hours: openHours.toFixed(2) })}</div>
            </td>
            {columns.map((c) => cellFor("open", null, c))}
          </tr>
          {/* ── One row per person ─────────────────────────────────── */}
          {(workers || []).map((w) => {
            const row = weekRowBy[w.id];
            return (
              <tr key={w.id} className="border-b border-border">
                <td className={nameCol}>
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold text-foreground">{initials(w.name)}</span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">{w.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground tabular-nums">
                        {t("app.scheduler.hrs", { hours: (row?.hours ?? 0).toFixed(2) })}
                        {payVisible ? ` / ${row?.cost == null ? "—" : money(row.cost)}` : ""}
                        {row?.overtime ? <span className="ml-1 font-semibold text-amber-700 dark:text-amber-300">OT</span> : null}
                      </div>
                    </div>
                  </div>
                </td>
                {columns.map((c) => cellFor(w.id, w.id, c))}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-muted/40">
            <td className={`${nameCol} bg-muted/40`}>
              {payVisible ? (
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  {t("app.scheduler.wages")} <span className="ml-1 text-foreground tabular-nums">{weekWages == null ? "—" : money(weekWages)}</span>
                </div>
              ) : null}
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {t("app.scheduler.hours")} <span className="ml-1 text-foreground tabular-nums">{weekHours.toFixed(2)}</span>
              </div>
            </td>
            {perDay.map((d, i) => (
              <td key={columns[i].ymd} className="border-r border-border px-2 py-2 align-top tabular-nums">
                {payVisible ? <div className="text-[11px] text-foreground">{d.wages == null ? "—" : money(d.wages)}</div> : null}
                <div className="text-[11px] text-muted-foreground">{d.hours.toFixed(2)}</div>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
