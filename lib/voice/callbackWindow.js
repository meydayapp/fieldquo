// lib/voice/callbackWindow.js
//
// Is the business open at this moment?
//
// ══ What this file used to be, and why it isn't ════════════════════════════
//
// It generated callback times from the company's OPENING HOURS — about fifteen
// minutes out, three options, skipping to the next open day after closing. The
// reasoning was that a caller asking to be rung back wants a call soon, not the
// next free estimate slot days away, and that reasoning was right.
//
// The implementation was wrong, and a real booking proved it: a caller was put
// in at 8:30 on a Monday with the estimator whose Monday starts at three.
// Opening hours know whether the BUSINESS is open. They know nothing about
// whose calendar a booking lands on, who is on leave, or what is already taken
// — and computeAvailableSlots knows all three. The original behaviour, which
// looked wrong for offering "Thursday at three", was reading real availability
// and was correct.
//
// So availability decides WHEN, and what survives here is the one thing
// availability cannot answer: whether the business is shut. Personal
// availability can disagree with opening hours, and somebody who set themselves
// free at seven in the morning should not have a customer rung on the company's
// behalf before the doors open.

import { hasBusinessHours, normaliseHours } from "@/lib/company/businessHours";

/** How soon "soon" is. Long enough for somebody to finish what they are doing. */
export const CALLBACK_DELAY_MINUTES = 15;

/**
 * How long a callback actually takes.
 *
 * The event type the phone books against is usually configured for an in-person
 * consultation — an hour, somebody sitting in a kitchen. A callback booked
 * against it inherited that hour, so "can you ring me back" reserved sixty
 * minutes of an estimator's day and two of them emptied a Monday.
 *
 * Used only to SHORTEN. A company that has configured something briefer than
 * this keeps their own number; nothing here lengthens an appointment.
 */
export const CALLBACK_MINUTES = 15;

/** Spacing between the options offered, so they are real alternatives. */
const STEP_MINUTES = 15;

/** How far ahead to look before giving up. A week of closed days is a real answer. */
const MAX_LOOKAHEAD_DAYS = 8;

const MINUTES_IN_DAY = 24 * 60;

/** "08:30" → 510. Null for anything that is not a time. */
function minutesOf(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * The company's own wall clock: which day it is there, and how far into it.
 *
 * Read through Intl rather than from the server's clock, for the same reason
 * every other time in this product is: a Vercel function runs in UTC and a
 * contractor in Gatineau closes at four in the afternoon THEIR time.
 */
function localNow(now, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const get = (t) => parts.find((p) => p.type === t)?.value || "";
    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
      get("weekday").slice(0, 3),
    );
    if (day < 0) return null;
    return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
  } catch {
    // An unusable timezone offers nothing rather than falling back to UTC and
    // ringing somebody at the wrong hour with total confidence.
    return null;
  }
}

/**
 * Is this instant inside the company's opening hours?
 *
 * A GUARD, not a source. Real availability decides WHEN a callback can happen —
 * it knows whose calendar it lands on, who is on leave and what is already
 * booked, and none of that is knowable from opening hours. This only refuses a
 * slot the business is shut for, which personal availability can disagree with:
 * somebody who set themselves available at seven in the morning should not have
 * a customer rung on the company's behalf before it opens.
 *
 * True when there are no hours on file. A company that has stated nothing has
 * not stated a closure either, and refusing every slot on the strength of an
 * empty column would take the receptionist's whole calendar away.
 */
export function withinBusinessHours(at, timezone, businessHours) {
  if (!hasBusinessHours(businessHours)) return true;
  if (!timezone) return true;
  const here = localNow(at instanceof Date ? at : new Date(at), timezone);
  if (!here) return true;
  const rule = normaliseHours(businessHours)[here.day];
  if (!rule || rule.closed) return false;
  const open = minutesOf(rule.open);
  const close = minutesOf(rule.close);
  if (open === null || close === null) return true;
  return here.minutes >= open && here.minutes < close;
}
