// lib/voice/callbackWindow.js
//
// When to ring somebody back who just asked to be rung back.
//
// ══ Why this is not the booking calendar ═══════════════════════════════════
//
// A callback was offered out of `bookableSlots`, which reads the same
// availability an on-site VISIT is booked from. So a caller who asked "can
// someone call me back?" at seven in the evening was offered Thursday at three
// and Monday the seventh — the next free ESTIMATE slots, days away. That is the
// right answer for a visit, where somebody has to drive over and block out two
// hours, and the wrong one for a phone call that takes ten minutes.
//
// A callback wants to be soon. So it is computed from the clock and the
// company's OPENING HOURS rather than picked out of a calendar.
//
// ══ Business hours, not booking availability ══════════════════════════════
//
// Deliberately `Company.businessHours` and not `AvailabilitySchedule`. The two
// are allowed to disagree and conflating them is a documented failure: an
// estimator's day off is not a company closure. "Is the business open?" is the
// question that decides whether ringing somebody is rude, and it is a fact
// about the company.
//
// ══ And no hours means no offer ════════════════════════════════════════════
//
// A company that has not filled in opening hours has no hours to be inside, and
// the honest response is to offer nothing and take the request instead. The
// alternative — assuming nine-to-five — is how an automated system rings a
// homeowner at two in the morning on behalf of a business that never said it
// was open then. Absence of a statement is not a statement.

import { hasBusinessHours, normaliseHours } from "@/lib/company/businessHours";

/** How soon "soon" is. Long enough for somebody to finish what they are doing. */
export const CALLBACK_DELAY_MINUTES = 15;

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
 * When could we ring them back?
 *
 * @param now           Date — the moment of the call
 * @param timezone      the company's IANA zone
 * @param businessHours Company.businessHours
 * @param count         how many options to offer
 *
 * @returns [{ at: Date, sameDay: boolean }] — empty when there is no honest
 *          answer, which the caller must treat as "take a message".
 */
export function nextCallbackTimes({
  now = new Date(),
  timezone = null,
  businessHours = null,
  count = 3,
} = {}) {
  if (!hasBusinessHours(businessHours)) return [];
  if (!timezone) return [];

  const here = localNow(now, timezone);
  if (!here) return [];

  const hours = normaliseHours(businessHours);
  const wanted = Math.max(1, Math.min(6, Number(count) || 3));

  // Where we start looking: a quarter of an hour from now, rounded up to the
  // next five minutes. "Ten past four" is a time a person says; "4:07" sounds
  // like a machine read it off a clock, because it is.
  let cursor = here.minutes + CALLBACK_DELAY_MINUTES;
  cursor = Math.ceil(cursor / 5) * 5;

  const out = [];
  for (let dayOffset = 0; dayOffset < MAX_LOOKAHEAD_DAYS && out.length < wanted; dayOffset += 1) {
    const dayIndex = (here.day + dayOffset) % 7;
    const rule = hours[dayIndex];
    if (!rule || rule.closed) {
      // Closed today: the next candidate is whenever the next open day starts.
      cursor = 0;
      continue;
    }

    const open = minutesOf(rule.open);
    const close = minutesOf(rule.close);
    if (open === null || close === null || close <= open) {
      cursor = 0;
      continue;
    }

    // First candidate on this day: no earlier than opening, and — on today —
    // no earlier than the delay from now.
    let at = dayOffset === 0 ? Math.max(cursor, open) : open;

    // ── Nothing is offered in the last few minutes before closing ─────────
    //
    // A callback slotted at one minute to four is a callback nobody makes. The
    // step is the margin: if there is not a clear step left in the day, the day
    // is done.
    while (at + STEP_MINUTES <= close && out.length < wanted) {
      out.push({ at: at % MINUTES_IN_DAY, dayOffset, sameDay: dayOffset === 0 });
      at += STEP_MINUTES;
    }
    cursor = 0;
  }

  // Wall-clock minutes back into real instants. Done by walking forward from
  // `now` in whole days and setting the time in the company's zone, so a DST
  // change moves the answer with the clock rather than an hour off it.
  return out.map((slot) => ({
    at: instantFor(now, timezone, slot.dayOffset, slot.at),
    sameDay: slot.sameDay,
  }));
}

/**
 * The instant at `minutes` past midnight, `dayOffset` days from now, in `zone`.
 *
 * Built by search rather than arithmetic: there is no way to construct a Date
 * "at 09:00 in America/Toronto" directly, and adding a fixed offset is wrong
 * twice a year. Two passes converge because the zone offset is stable within a
 * day either side of the target.
 */
function instantFor(now, timeZone, dayOffset, minutes) {
  // Seconds dropped first. Without this the instant inherits whatever second
  // the call happened to be answered on, and the appointment lands at 8:00:13 —
  // which is not a time anybody writes in a diary, and which makes the clash
  // check below miss an existing booking on the same minute.
  const base = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
  base.setSeconds(0, 0);
  let candidate = base;
  for (let pass = 0; pass < 2; pass += 1) {
    const here = localNow(candidate, timeZone);
    if (!here) return candidate;
    candidate = new Date(candidate.getTime() + (minutes - here.minutes) * 60 * 1000);
  }
  return candidate;
}
