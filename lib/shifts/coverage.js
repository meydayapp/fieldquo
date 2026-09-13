// lib/shifts/coverage.js
//
// The arithmetic behind the day board on /app/scheduler: where a shift block
// sits on the hour axis, how many people are on the tools in each half hour,
// and whether a set of breaks is a legal set of breaks.
//
// Pure — timestamps in, numbers out. No database, no clock, no React, so it
// runs against a fixed instant in scripts/check-shift-board.mjs, which is the
// only honest way to test the two cases that go wrong in production: a shift
// that crosses midnight and a day with 23 or 25 hours.
//
// ── Everything is milliseconds, never "hour 9" ──────────────────────────────
//
// The board is drawn as a linear axis of INSTANTS between the first and last
// column, and a block's left edge is its start's fraction of that axis. Doing
// it in hour numbers would put the 3am column at the wrong x on the two days a
// year the clocks move — and hide it, because the day still looks right.
// Columns carry their own start and end instants (hourColumns), so a spring-
// forward day simply has no 2am column and an autumn day has a two-hour "1am".
//
// ── Who counts as working ───────────────────────────────────────────────────
//
// "On shift" in a slot means some shift overlaps it. "On break" means one of
// that shift's breaks overlaps it. Coverage is the difference. The strip
// exists so the manager can see that staggering two lunches leaves one person
// on site — a slot inside business hours where the difference is zero is the
// gap they are looking for, and it is flagged rather than left to be counted.

const MS_MIN = 60_000;

export const BREAK_KINDS = Object.freeze(["lunch", "break"]);

const toMs = (v) => {
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  if (v == null || v === "") return NaN;
  return new Date(v).getTime();
};

/** {start,end} as finite ms with end > start, or null when it is not one. */
export function interval(start, end) {
  const s = toMs(start);
  const e = toMs(end);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null;
  return { start: s, end: e };
}

/** The overlap of two intervals, or null when they do not overlap. */
export function clip(a, b) {
  if (!a || !b) return null;
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  return end > start ? { start, end } : null;
}

/**
 * Where a block sits on the axis, as percentages of the axis width.
 *
 * Returns null when the block is entirely off the axis. `clippedStart` and
 * `clippedEnd` say the block runs past the edge — the board draws an arrow so
 * a 22:00–06:00 shift does not read as one that ends at midnight.
 */
export function placeBlock(start, end, axisStart, axisEnd) {
  const block = interval(start, end);
  const axis = interval(axisStart, axisEnd);
  if (!block || !axis) return null;
  const shown = clip(block, axis);
  if (!shown) return null;
  const width = axis.end - axis.start;
  return {
    leftPct: ((shown.start - axis.start) / width) * 100,
    widthPct: ((shown.end - shown.start) / width) * 100,
    clippedStart: block.start < axis.start,
    clippedEnd: block.end > axis.end,
  };
}

/**
 * Local-time hour columns for one calendar day, built through the Date
 * constructor so daylight-saving days come out with 23 or 25 real hours.
 *
 * A column whose start and end are the same instant (the hour that does not
 * exist on a spring-forward day) is dropped rather than drawn at zero width.
 *
 * @param ymd        "2026-09-14" — the viewer's local calendar day
 * @param startHour  first column, 0–23
 * @param endHour    the hour the axis ends on, 1–24 (24 = midnight after)
 */
export function hourColumns(ymd, startHour, endHour) {
  const [y, m, d] = String(ymd)
    .split("-")
    .map((n) => Number(n));
  if (![y, m, d].every(Number.isInteger)) return [];
  const from = Math.max(0, Math.min(23, Math.trunc(startHour)));
  const to = Math.max(from + 1, Math.min(24, Math.trunc(endHour)));
  const out = [];
  for (let h = from; h < to; h += 1) {
    const start = new Date(y, m - 1, d, h, 0, 0, 0).getTime();
    const end = new Date(y, m - 1, d, h + 1, 0, 0, 0).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    out.push({ hour: h, start, end });
  }
  return out;
}

/**
 * The hour range the board shows.
 *
 *   business hours ± 1h when the company has set them for this day;
 *   7:00–18:00 when it has not, or the day is closed;
 *   and always widened to include every shift on the day, so nothing is
 *   drawn half off the edge and nothing is quietly missing.
 *
 * @param businessDay  {closed, open:"08:00", close:"17:00"} for this weekday,
 *                     or null when the company has no hours set
 * @param dayStart     ms of local midnight starting the day
 * @param dayEnd       ms of the next local midnight
 * @param shifts       [{start,end}] on the day (any parseable instants)
 */
export function boardRange({ businessDay, dayStart, dayEnd, shifts = [] }) {
  let startHour = 7;
  let endHour = 18;
  const open = businessDay && !businessDay.closed ? hhmm(businessDay.open) : null;
  const close = businessDay && !businessDay.closed ? hhmm(businessDay.close) : null;
  if (open && close && close.total > open.total) {
    startHour = Math.max(0, open.hours - 1);
    endHour = Math.min(24, close.hours + (close.mins > 0 ? 2 : 1));
  }
  const day = interval(dayStart, dayEnd);
  if (day) {
    for (const s of Array.isArray(shifts) ? shifts : []) {
      const shown = clip(interval(s?.start, s?.end), day);
      if (!shown) continue;
      // The wall-clock hour, read off the local Date rather than computed as
      // a fraction of the day — on a spring-forward day 07:00 is six real
      // hours after midnight, and a fraction would put the column one off.
      const first = new Date(shown.start);
      const last = new Date(shown.end);
      const h0 = first.getHours();
      const h1 =
        shown.end === day.end
          ? 24
          : last.getHours() + (last.getMinutes() > 0 || last.getSeconds() > 0 ? 1 : 0);
      startHour = Math.min(startHour, Math.max(0, h0));
      endHour = Math.max(endHour, Math.min(24, h1));
    }
  }
  return { startHour, endHour };
}

function hhmm(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const mins = Number(m[2]);
  if (hours > 23 || mins > 59) return null;
  return { hours, mins, total: hours * 60 + mins };
}

/**
 * Coverage per slot across the axis.
 *
 * @param shifts      [{start, end, breaks:[{start,end}]}]
 * @param axisStart   ms
 * @param axisEnd     ms
 * @param business    optional {start, end} ms window in which a zero is a gap
 * @param slotMinutes 30 by default — half an hour is how lunches are cut
 * @returns [{start, end, onShift, onBreak, working, gap}]
 */
export function coverageSlots({
  shifts = [],
  axisStart,
  axisEnd,
  business = null,
  slotMinutes = 30,
}) {
  const axis = interval(axisStart, axisEnd);
  if (!axis) return [];
  const step = Math.max(5, Math.trunc(slotMinutes)) * MS_MIN;
  const windows = [];
  for (const s of Array.isArray(shifts) ? shifts : []) {
    const iv = interval(s?.start, s?.end);
    if (!iv) continue;
    const breaks = [];
    for (const b of Array.isArray(s.breaks) ? s.breaks : []) {
      // A break outside its shift is not a break — the server refuses it, but
      // rows written before this file existed, or by a script, are not the
      // strip's to trust. It counts only the part that is inside the shift.
      const bi = clip(interval(b?.start, b?.end), iv);
      if (bi) breaks.push(bi);
    }
    windows.push({ ...iv, breaks });
  }
  const biz = business ? interval(business.start, business.end) : null;
  const out = [];
  for (let t = axis.start; t < axis.end; t += step) {
    const slot = { start: t, end: Math.min(t + step, axis.end) };
    let onShift = 0;
    let onBreak = 0;
    for (const w of windows) {
      if (!clip(w, slot)) continue;
      onShift += 1;
      if (w.breaks.some((b) => clip(b, slot))) onBreak += 1;
    }
    const working = onShift - onBreak;
    // Only a slot the business is open for can be a gap. Nobody working at
    // 6am is not a problem unless the company opens at 6.
    const inBusiness = biz ? Boolean(clip(biz, slot)) : false;
    out.push({ ...slot, onShift, onBreak, working, gap: inBusiness && working === 0 });
  }
  return out;
}

/**
 * Are these breaks a legal set for this shift?
 *
 * Inside the shift, each one ending after it starts, none overlapping, a kind
 * the schema knows. Returned normalised: sorted, ms trimmed to ISO strings,
 * `paid` a real boolean — the shape the route writes without touching it
 * again. One rule, used by the create route and the edit route, because the
 * second copy of a validator is the one that forgets a case.
 *
 * @returns {{ok:true, breaks:Array}|{ok:false, error:string}}
 */
export function validateBreaks(shiftStart, shiftEnd, breaks) {
  const shift = interval(shiftStart, shiftEnd);
  if (!shift) return { ok: false, error: "The shift's end must be after its start." };
  if (breaks == null) return { ok: true, breaks: [] };
  if (!Array.isArray(breaks)) return { ok: false, error: "breaks must be a list." };
  if (breaks.length > 12) return { ok: false, error: "Too many breaks for one shift." };
  const rows = [];
  for (const b of breaks) {
    if (!b || typeof b !== "object") return { ok: false, error: "Each break needs a start and an end." };
    const iv = interval(b.start, b.end);
    if (!iv) return { ok: false, error: "A break's end must be after its start." };
    if (iv.start < shift.start || iv.end > shift.end) {
      return { ok: false, error: "A break has to fall inside the shift." };
    }
    const kind = BREAK_KINDS.includes(b.kind) ? b.kind : null;
    if (!kind) return { ok: false, error: "A break is a lunch or a break." };
    rows.push({
      start: new Date(iv.start).toISOString(),
      end: new Date(iv.end).toISOString(),
      kind,
      paid: b.paid === true,
    });
  }
  rows.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i].start < rows[i - 1].end) {
      return { ok: false, error: "Two breaks overlap." };
    }
  }
  return { ok: true, breaks: rows };
}

/**
 * A 30-minute lunch at the midpoint of a shift, snapped to the nearest
 * quarter hour so it reads as 12:15 rather than 12:07. Null on a shift too
 * short to hold one.
 */
export function midpointLunch(shiftStart, shiftEnd, minutes = 30) {
  const shift = interval(shiftStart, shiftEnd);
  if (!shift) return null;
  const length = minutes * MS_MIN;
  if (shift.end - shift.start < length * 2) return null;
  const mid = shift.start + (shift.end - shift.start) / 2;
  const quarter = 15 * MS_MIN;
  let start = Math.round((mid - length / 2) / quarter) * quarter;
  start = Math.max(shift.start, Math.min(start, shift.end - length));
  return { start, end: start + length, kind: "lunch", paid: false };
}

/**
 * Scheduled minutes on the day: the shifts clipped to the day, less unpaid
 * breaks. A paid break stays in; an unpaid lunch comes off — this is the
 * number that has to agree with what payroll expects.
 */
export function scheduledMinutes(shifts, dayStart, dayEnd) {
  const day = interval(dayStart, dayEnd);
  if (!day) return 0;
  let ms = 0;
  for (const s of Array.isArray(shifts) ? shifts : []) {
    const iv = interval(s?.start, s?.end);
    const shown = clip(iv, day);
    if (!shown) continue;
    ms += shown.end - shown.start;
    for (const b of Array.isArray(s.breaks) ? s.breaks : []) {
      if (b?.paid === true) continue;
      const bi = clip(clip(interval(b?.start, b?.end), iv), day);
      if (bi) ms -= bi.end - bi.start;
    }
  }
  return Math.max(0, Math.round(ms / MS_MIN));
}

/**
 * What one person is doing at an instant: "on_break", "on_shift" or "off".
 * "out" (approved leave) is the caller's — leave is a calendar day, not an
 * instant, and it is decided from the leave rows, not the shifts.
 */
export function statusAt(shifts, now) {
  const t = toMs(now);
  if (!Number.isFinite(t)) return "off";
  let onShift = false;
  for (const s of Array.isArray(shifts) ? shifts : []) {
    const iv = interval(s?.start, s?.end);
    if (!iv || t < iv.start || t >= iv.end) continue;
    onShift = true;
    for (const b of Array.isArray(s.breaks) ? s.breaks : []) {
      const bi = interval(b?.start, b?.end);
      if (bi && t >= bi.start && t < bi.end) return "on_break";
    }
  }
  return onShift ? "on_shift" : "off";
}

/** "2026-09-14" for a Date in the viewer's local time. */
export function localYmd(d) {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

/** Local midnight starting `ymd`, and the next one — the day's bounds. */
export function dayBoundsLocal(ymd) {
  const [y, m, d] = String(ymd)
    .split("-")
    .map((n) => Number(n));
  if (![y, m, d].every(Number.isInteger)) return null;
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  return { start: start.getTime(), end: end.getTime() };
}
