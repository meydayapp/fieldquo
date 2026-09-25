// app/components/auth/samples/ScheduleSample.js
//
// The team step's sample: the scheduler, drawn by the scheduler. WeekGrid
// (app/app/scheduler/WeekGrid.js, the Week view) for one to five people and
// DayBoard (DayBoard.js, the Day view — the dispatch board) from six, fed
// the app-guide harness's week: the cabinet shop's six people and their
// shifts for Mon 14 – Fri 18 Sept 2026 (fixtures/routes-people.js), with this
// morning's clock-ins on the board and the shop's opening hours as its axis.
//
// ── The answer to "is the calendar view how it is actually rendered?" ──────
//
// It was not. The previous panel drew three hand-made grids, and two of them
// were views the product does not have: a day with a COLUMN per person, and a
// board grouped under crew headings for 16+. /app/scheduler offers Day and
// Week and nothing else; these are those two components with real props.
//
// The visitor is on it by name: their typed name replaces the fixture
// person whose row they stand in (the owner's row on the board, the one-
// person week's row on the grid), so "Just me" reads as their own week.
"use client";

import { useMemo } from "react";
import DayBoard from "@/app/app/scheduler/DayBoard";
import WeekGrid from "@/app/app/scheduler/WeekGrid";
import { useTranslation } from "@/app/hooks/useTranslation";
import { calendarShapeForBand, teamSizeBand } from "@/lib/signup/signupPreview";
import { COMPANY, PEOPLE, TODAY } from "@/docs/screens/app-guide/harness/fixtures/company.js";
import { SHIFTS, TIME_ENTRIES, WORKERS, W } from "@/docs/screens/app-guide/harness/fixtures/routes-people.js";
import SampleFrame from "./SampleFrame";

const [MARC, , , DAN, LEO, ANA] = PEOPLE;

const localYmd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The visitor's name as typed, or null (the fixture's name then stays). */
function typedName(form) {
  const name = [form?.firstName, form?.lastName].map((s) => String(s || "").trim()).filter(Boolean).join(" ");
  return name || null;
}

/**
 * The props a band's view is rendered with — exported so the check can
 * assert what the panel passes.
 *
 * @returns {{ shape: "week"|"board", rows: number, workers, shifts, ... }}
 */
export function scheduleSampleFor({ band = null, form = null } = {}) {
  const shape = calendarShapeForBand(band);
  const rows = teamSizeBand(band)?.rows || 1;
  const you = typedName(form);
  // Whose row the visitor stands in: the one-person week is Léo's (his is
  // the full week of shifts); on the board it is the owner's, Marc's.
  const standIn = shape === "board" ? MARC.userId : LEO.userId;
  const rename = (w) => (you && w.userId === standIn ? { ...w, name: you } : w);
  const order = shape === "board"
    ? WORKERS
    : [W[LEO.userId], W[ANA.userId], W[DAN.userId]];
  const workers = order.slice(0, Math.max(1, Math.min(rows, order.length))).map(rename);
  const ids = new Set(workers.map((w) => w.id));
  const shifts = SHIFTS.filter((s) => ids.has(s.workerId)).map((s) =>
    you && s.workerId === W[standIn].id ? { ...s, worker: { name: you } } : s,
  );
  if (shape === "week") {
    const monday = new Date(TODAY);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return d;
    });
    return { shape, rows: workers.length, workers, shifts, days, todayYmd: localYmd(TODAY) };
  }
  // The board's "who is on the clock now": the open entries of this morning.
  const live = TIME_ENTRIES.filter((e) => !e.clockOut && ids.has(e.workerId))
    .map((e) => ({ workerId: e.workerId, clockIn: e.clockIn, jobId: e.jobId, breaks: [] }));
  return {
    shape,
    rows: workers.length,
    workers,
    data: { shifts, workers, visits: [], availability: [], leave: [], live, businessHours: COMPANY.businessHours },
    dateStr: localYmd(TODAY),
    now: TODAY,
  };
}

export default function ScheduleSample({ band = null, form = null, language = "en" }) {
  const { t } = useTranslation();
  const sample = useMemo(() => scheduleSampleFor({ band, form }), [band, form]);
  const label =
    sample.shape === "board"
      ? t("app.signup.aside.calendar.boardLabel", "the Day view — the dispatch board, a row per person")
      : t("app.signup.aside.calendar.weekLabel", "the Week view — a row per person, a column per day");
  return (
    <div data-calendar-shape={sample.shape} data-calendar-rows={sample.rows}>
      <SampleFrame width={sample.shape === "board" ? 1060 : 980} crop={sample.shape === "board" ? 720 : 820} maxHeight={sample.shape === "board" ? 620 : 520} label={label}>
        <div className="bg-background p-4">
          {sample.shape === "board" ? (
            <DayBoard
              data={sample.data}
              dateStr={sample.dateStr}
              now={sample.now}
              isManager
              canEditSchedule={false}
              canDeleteShift={false}
              language={language}
              t={t}
              onAddAt={() => {}}
              onEditShift={() => {}}
            />
          ) : (
            <WeekGrid
              days={sample.days}
              shifts={sample.shifts}
              workers={sample.workers}
              language={language}
              t={t}
              todayYmd={sample.todayYmd}
              onAdd={() => {}}
              onEdit={() => {}}
              onAddEvent={() => {}}
              onEditEvent={() => {}}
            />
          )}
        </div>
      </SampleFrame>
    </div>
  );
}
