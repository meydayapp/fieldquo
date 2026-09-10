// lib/sales/checkin/schedule.js
//
// WHEN a check-in is meant to go out, decided by the rep and validated here.
//
// ══ What "scheduled" means in this feature, and what it does not ═══════════
//
// It means: the rep intends to send this at that moment, and the screen will
// surface it to them then. It does NOT mean a job will fire and text somebody.
// Nothing in FieldQuo sends a sales check-in without a rep pressing send —
// that is the owner's requirement, it is what lib/sales/checkin/draft.js's
// header promises, and scripts/check-sales-messages.mjs asserts that no cron,
// no route handler other than the one behind the button, and no effect calls
// the send path.
//
// So the honest word for a stored row is DRAFT, and `scheduledFor` is when the
// rep wants to be shown it. Calling the status "scheduled" would be the
// AGENTS.md failure this repo has been swept for repeatedly: a control that
// appears to work — "it's scheduled, it'll go Thursday" — and does not.
//
// ══ Why the texting window is checked HERE as well as at the send ══════════
//
// It is checked at the send, by lib/sales/salesSms.js, fresh, and that check
// is the one that binds — see the fail-closed argument in its header. This one
// is a different job: stopping a rep from writing down an intention that can
// never be honoured. "Follow up Thursday at 6am" is not a plan, it is a
// disappointment scheduled for Thursday, and telling them on Thursday is worse
// than telling them now.
//
// Neither check makes the other redundant. This one runs against a time in the
// future and can be wrong by then — a prospect's zone can be corrected, the
// list can gain a STOP. The send-time one runs against the world as it is at
// the moment a message would leave.
import { SALES_SMS_WINDOW, describeSalesSmsWindow, withinSalesSmsHours } from "../smsWindow";
import { localTimeIn } from "../callingWindow";

const MINUTE_MS = 60 * 1000;
const DAY_MINUTES = 24 * 60;

/**
 * How far ahead a rep may park a follow-up.
 *
 * Sixty days, matching the longest retention window a commission plan uses —
 * past that milestone the routine check-in stops entirely (see
 * signals.js's `milestone_passed`), so a reminder set beyond it would surface
 * a draft for a conversation the product has already decided is over.
 */
export const MAX_HORIZON_DAYS = 60;

/**
 * How far into the past a time may be and still be accepted.
 *
 * A rep pressing "send at 3:00pm" at 3:00pm should not be told 3:00pm has
 * passed because the request took two seconds. Two minutes of slack; anything
 * older is a real mistake and is refused rather than quietly moved.
 */
export const PAST_TOLERANCE_MS = 2 * MINUTE_MS;

export const SCHEDULE_REFUSALS = Object.freeze({
  unreadable: "That is not a date and time we can read.",
  in_past: "That moment has already passed.",
  too_far: `Nothing can be parked more than ${MAX_HORIZON_DAYS} days out.`,
  zone_unknown:
    "We do not know what time it is where this contractor is, and the texting window is " +
    "defined in their time zone — so there is no way to tell whether that moment is inside it.",
  outside_window: `That falls outside the texting window (${describeSalesSmsWindow()}).`,
});

/** A Date, or null. Never "now" as a stand-in for something unreadable. */
function asInstant(value) {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * The next moment at or after `from` that falls inside the texting window in
 * this contractor's zone — or null when we cannot say.
 *
 * Iterative rather than arithmetic, and deliberately: adding "the difference
 * between now and 08:00" to a UTC instant is wrong across a daylight-saving
 * boundary by exactly the hour that matters, and the zones this feature covers
 * include both DST and non-DST North America (America/Regina and
 * America/Phoenix are in SALES_SMS_TIME_ZONES for that reason). So each
 * candidate is re-evaluated in the zone rather than trusted.
 *
 * Bounded at eight hops. The window is open thirteen hours of every day, so
 * one hop always lands inside it in practice; the bound is there so a zone
 * that behaves unexpectedly returns null instead of spinning.
 */
export function nextWindowOpening(from, timeZone) {
  let at = asInstant(from);
  if (!at) return null;

  for (let hop = 0; hop < 8; hop += 1) {
    const local = localTimeIn(timeZone, at);
    // No zone means no opinion, at any hop. Guessing one would put a follow-up
    // at one in the morning in somebody's actual town.
    if (!local) return null;
    if (local.minute >= SALES_SMS_WINDOW.startMinute && local.minute < SALES_SMS_WINDOW.endMinute) {
      return at;
    }
    const ahead =
      local.minute < SALES_SMS_WINDOW.startMinute
        ? SALES_SMS_WINDOW.startMinute - local.minute
        : SALES_SMS_WINDOW.startMinute + DAY_MINUTES - local.minute;
    at = new Date(at.getTime() + ahead * MINUTE_MS);
  }
  return null;
}

/**
 * Validate a moment a rep picked for a check-in.
 *
 * @param raw       whatever the browser sent. An ISO string from a
 *                  `datetime-local` input, in practice — which has no zone on
 *                  it, so the CALLER converts before it gets here. The screen
 *                  sends `new Date(value).toISOString()`, built from the rep's
 *                  own browser clock, which is the right reading: the rep
 *                  picks "Thursday 2pm" meaning their own Thursday 2pm.
 * @param timeZone  the CONTRACTOR's zone, for the window test. Null is a real
 *                  answer and is refused with `zone_unknown`.
 * @param now       injectable.
 *
 * @returns {{ ok: true, at: Date }} |
 *          {{ ok: false, code: string, error: string, suggestion: Date|null }}
 *
 * `suggestion` is only ever the next moment the window is open, and only for
 * `outside_window`. A suggestion for a missing zone would be a guess, and the
 * whole point of that refusal is that we refuse to guess.
 */
export function parseScheduleRequest({ raw, timeZone = null, now = new Date() } = {}) {
  const at = asInstant(raw);
  const clock = asInstant(now) || new Date();

  if (!at) return { ok: false, code: "unreadable", error: SCHEDULE_REFUSALS.unreadable, suggestion: null };

  if (at.getTime() < clock.getTime() - PAST_TOLERANCE_MS) {
    return { ok: false, code: "in_past", error: SCHEDULE_REFUSALS.in_past, suggestion: null };
  }

  const horizon = clock.getTime() + MAX_HORIZON_DAYS * DAY_MINUTES * MINUTE_MS;
  if (at.getTime() > horizon) {
    return { ok: false, code: "too_far", error: SCHEDULE_REFUSALS.too_far, suggestion: null };
  }

  const verdict = withinSalesSmsHours(at, timeZone);
  if (!verdict.allowed) {
    // `retryLater: false` from that function means the zone is unknown, not
    // that the hour is wrong — the two refusals have different fixes and the
    // screen shows different sentences for them.
    const code = verdict.retryLater ? "outside_window" : "zone_unknown";
    return {
      ok: false,
      code,
      error: SCHEDULE_REFUSALS[code],
      suggestion: code === "outside_window" ? nextWindowOpening(at, timeZone) : null,
    };
  }

  return { ok: true, at };
}

/**
 * When the engine says a company is due, when should the draft be aimed at?
 *
 * Now, if now is inside the window; otherwise the next opening. Not "tomorrow
 * at 9" — a rep looking at a due company at ten in the morning should see a
 * draft they can send while the thought is fresh, and the only reason to move
 * it is the legal clock.
 *
 * Returns null when there is no zone, which is the honest answer and which the
 * screen renders as "we cannot time this until you say where they are" rather
 * than as a date.
 */
export function defaultScheduleFor({ timeZone = null, now = new Date() } = {}) {
  return nextWindowOpening(now, timeZone);
}
