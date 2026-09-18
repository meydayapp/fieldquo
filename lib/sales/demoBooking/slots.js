// lib/sales/demoBooking/slots.js
//
// The 15-minute slots a prospect may book on a rep's public demo page
// (app/demo/[repCode]), derived from the hours the rep stated and what is
// already on their sales calendar.
//
// ══ Whose hours, whose zone ══════════════════════════════════════════════
//
// SalesRep.demoHours is the rep's own statement: [{ dayOfWeek, startTime,
// endTime }] read in SalesRep.timeZone. A rep who has not said anything
// gets Monday–Friday 09:00–17:00 — the same working day
// lib/sales/outreach/introLink.js's nextBusinessHour() assumes for a
// call-back, and printed on the settings card as the default it is, so it
// is a stated default rather than an inference. An EMPTY array is a
// statement too — "nothing bookable" — and offers nothing.
//
// A rep with no zone has their hours read in FieldQuo's own zone
// (lib/demo/slots.js DEMO_TZ). Not the prospect's zone: a Vancouver rep
// whose page guessed from the visitor's browser would offer 09:00 Halifax
// as 05:00 at their desk. The settings card names the fallback so the rep
// can correct it.
//
// ══ Busy is the calendar, whatever kind of entry ═════════════════════════
//
// A callback at 10:00 blocks the 10:00 demo slot as much as another demo
// does; the rep is on the phone either way. A callback has no endAt, so
// it is taken to occupy one demo length. Cancelled entries do not block.
//
// Pure: the rep row and their events are loaded by book.js and passed in,
// so scripts/check-rep-demo-page.mjs can run the maths against hostile
// input without a database.

import { slotGrid } from "@/lib/booking/slotGrid";
import { DEMO_TZ } from "@/lib/demo/slots";

/** The demo the intro email promises. */
export const REP_DEMO_MINUTES = 15;
/** How far ahead the picker looks. */
export const REP_DEMO_DAYS_AHEAD = 14;
/** Nothing bookable inside this — the rep needs notice. */
export const REP_DEMO_LEAD_MS = 2 * 60 * 60 * 1000;

/** What a rep who has said nothing offers. Printed on the settings card. */
export const DEFAULT_DEMO_HOURS = Object.freeze(
  [1, 2, 3, 4, 5].map((dayOfWeek) => Object.freeze({ dayOfWeek, startTime: "09:00", endTime: "17:00" })),
);

/** Is this an IANA zone Intl can evaluate? */
export function usableTimeZone(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value.trim() });
    return true;
  } catch {
    return false;
  }
}

/** The zone the rep's hours are read in, and whether it was theirs or the fallback. */
export function repDemoZone(rep) {
  const own = rep?.timeZone;
  if (usableTimeZone(own)) return { timeZone: own.trim(), stated: true };
  return { timeZone: DEMO_TZ, stated: false };
}

/**
 * The rep's demo hours as slotGrid windows.
 *
 * @returns { windows: [{dayOfWeek,startTime,endTime,timezone}], stated: boolean }
 *          `stated` is false when the default is in use.
 */
export function repDemoWindows(rep) {
  const { timeZone } = repDemoZone(rep);
  const raw = rep?.demoHours;
  const stated = Array.isArray(raw);
  const source = stated ? raw : DEFAULT_DEMO_HOURS;
  const windows = source
    .filter((w) => w && typeof w === "object")
    .map((w) => ({ dayOfWeek: Number(w.dayOfWeek), startTime: String(w.startTime ?? ""), endTime: String(w.endTime ?? ""), timezone: timeZone }));
  return { windows, stated };
}

/**
 * Validate hours a rep is saving. Same rules slotGrid applies — an
 * incoherent row is refused here rather than silently dropped there, so the
 * rep learns at save time that "17:00–09:00" states nothing.
 *
 * @returns { ok: true, hours } | { ok: false, error }
 */
export function parseDemoHours(value) {
  if (!Array.isArray(value)) return { ok: false, error: "Hours must be a list." };
  if (value.length > 21) return { ok: false, error: "Too many rows." };
  const hours = [];
  for (const row of value) {
    const dayOfWeek = Number(row?.dayOfWeek);
    const startTime = String(row?.startTime ?? "").trim();
    const endTime = String(row?.endTime ?? "").trim();
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return { ok: false, error: "Each row needs a day of the week." };
    const t = (s) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(s);
      if (!m) return null;
      const mins = Number(m[1]) * 60 + Number(m[2]);
      return Number(m[2]) > 59 || mins > 24 * 60 ? null : mins;
    };
    const s = t(startTime);
    const e = t(endTime);
    if (s === null || e === null) return { ok: false, error: "Times are HH:MM." };
    if (e <= s) return { ok: false, error: "The end must be after the start." };
    if (e - s < REP_DEMO_MINUTES) return { ok: false, error: `A window must hold at least one ${REP_DEMO_MINUTES}-minute demo.` };
    hours.push({ dayOfWeek, startTime: `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`, endTime: `${String(Math.floor(e / 60)).padStart(2, "0")}:${String(e % 60).padStart(2, "0")}` });
  }
  return { ok: true, hours };
}

/**
 * The rep's calendar as busy spans. An entry with no end occupies one demo
 * length; a cancelled one occupies nothing.
 *
 * @param events [{ startAt, endAt, status }]
 */
export function busyFromEvents(events = []) {
  const out = [];
  for (const e of Array.isArray(events) ? events : []) {
    if (!e || e.status === "cancelled") continue;
    const start = e.startAt instanceof Date ? e.startAt : new Date(e.startAt);
    if (Number.isNaN(start.getTime())) continue;
    const end = e.endAt ? (e.endAt instanceof Date ? e.endAt : new Date(e.endAt)) : new Date(start.getTime() + REP_DEMO_MINUTES * 60_000);
    if (Number.isNaN(end.getTime()) || end <= start) {
      out.push({ start, end: new Date(start.getTime() + REP_DEMO_MINUTES * 60_000) });
    } else {
      out.push({ start, end });
    }
  }
  return out;
}

/** The window the picker covers: now to the end of the 14th day, in the rep's zone. */
export function repDemoRange(rep, now = new Date()) {
  const { timeZone } = repDemoZone(rep);
  // Fourteen days on, then the whole of that day: the grid's own day walk
  // in the window's zone handles DST, so a plain millisecond span is enough
  // here — the last day is cut at the rep's midnight by the grid's `to`.
  const to = new Date(now.getTime() + (REP_DEMO_DAYS_AHEAD + 1) * 24 * 60 * 60 * 1000);
  return { from: new Date(now.getTime()), to, timeZone };
}

/**
 * Every slot the rep is free for.
 *
 * @param rep     { timeZone, demoHours }
 * @param events  their SalesEvent rows in the range
 * @returns Date[] ascending
 */
export function repDemoSlots(rep, events = [], now = new Date()) {
  const { windows } = repDemoWindows(rep);
  const { from, to, timeZone } = repDemoRange(rep, now);
  return slotGrid({
    windows,
    from,
    to,
    slotMinutes: REP_DEMO_MINUTES,
    leadMs: REP_DEMO_LEAD_MS,
    now,
    busy: busyFromEvents(events),
    timezone: timeZone,
  }).flatMap((d) => d.starts);
}

/**
 * Is `iso` a slot this rep offers right now? Re-derived from hours and
 * calendar, never trusted from the browser — a hand-posted 03:00 is refused
 * whatever the page showed.
 */
export function repFreeAt(rep, events, iso, now = new Date()) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return repDemoSlots(rep, events, now).some((s) => s.getTime() === t);
}

/** Initials for the page's avatar: "Daniel Ortega" → "DO". */
export function initialsOf(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
