// lib/sales/callingWindow.js
//
// When FieldQuo's own reps may ring a business.
//
// ══ Why this is a SECOND window and not a widening of the first ════════════
//
// lib/voice/outbound.js already has a CALL_WINDOW of 9:00–20:00, and it is
// correct for what it does. It governs a TENANT's AI receptionist ringing a
// HOMEOWNER who asked to be called — 9am to 8pm sits inside the 8am–9pm
// consumer telemarketing window with an hour's margin at each end, which is a
// deliberate politeness margin, not a legal minimum.
//
// This window governs a different call entirely: FieldQuo, first-party,
// ringing a CONTRACTOR'S BUSINESS line as unsolicited B2B outreach. Canada's
// Unsolicited Telecommunications Rules set that window at
//
//     09:00–21:30 weekdays, 10:00–18:00 weekends,
//     in the time zone of the person being called
//
// (docs/sales-intel/AUDIT-compliance.md §7). Note which direction each edge
// moves: the weekday evening is an hour and a half LATER than the homeowner
// window, and the weekend morning is an hour EARLIER than the rule allows —
// so reusing CALL_WINDOW would be non-compliant every Saturday and Sunday
// morning while also being needlessly restrictive on weekday evenings. There
// is no single number that is right for both, which is why there are two.
//
// ══ Why merging them would be wrong even if the numbers agreed ═════════════
//
// They are answers to different questions and they will diverge again. The
// homeowner window is a product decision FieldQuo makes on behalf of its
// tenants and can tighten whenever it likes; this one is a legal minimum
// FieldQuo is bound by and cannot loosen. lib/company/businessHours.js records
// the same argument about opening hours versus booking availability: two
// things allowed to disagree, conflated at the cost of publishing one as the
// other.
//
// ══ Nothing dials yet ══════════════════════════════════════════════════════
//
// There is no outbound sales dialler in this repo — the telephony audit
// confirmed Twilio Voice is not wired at all. This is the RULE, written before
// the thing that needs it, so that whatever dials later has a gate to call
// rather than a constant to invent. Pure, no imports, so
// scripts/check-sales-suppression.mjs executes every edge of it.

/**
 * The Canadian B2B telemarketing window, per weekday.
 *
 * Half-hours matter here — 21:30, not 21:00 — so the bounds are MINUTES from
 * local midnight rather than the whole hours lib/voice/outbound.js can get
 * away with. An hour-granular copy of this rule would round 21:30 to one side
 * or the other, and both roundings are wrong: down loses ninety minutes of
 * legal calling time every weekday, up places calls after the legal cutoff.
 */
export const SALES_CALL_WINDOW = {
  /** Monday–Friday. */
  weekday: { startMinute: 9 * 60, endMinute: 21 * 60 + 30 },
  /** Saturday and Sunday. */
  weekend: { startMinute: 10 * 60, endMinute: 18 * 60 },
};

/** Human-readable, for a screen or a refusal message. Derived, never retyped. */
export function describeSalesCallWindow() {
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const w = SALES_CALL_WINDOW;
  return (
    `${hhmm(w.weekday.startMinute)}–${hhmm(w.weekday.endMinute)} weekdays, ` +
    `${hhmm(w.weekend.startMinute)}–${hhmm(w.weekend.endMinute)} weekends, ` +
    `in the prospect's own time zone`
  );
}

/**
 * The prospect's local weekday and minute-of-day.
 *
 * Both come out of ONE formatted read of the same instant. Asking for the
 * weekday and the time separately is a race across midnight: at 23:59:59.9
 * local the first call can land on Friday and the second on Saturday, which
 * picks the weekday window for a Saturday minute.
 *
 * @returns { weekday: 0-6 (0 = Sunday), minute: 0-1439 } or null when the zone
 *          is unusable.
 */
export function localTimeIn(timeZone, now = new Date()) {
  if (typeof timeZone !== "string" || !timeZone.trim()) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(now);

    const get = (type) => parts.find((p) => p.type === type)?.value;
    const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const weekday = days[get("weekday")];
    // "24" is how hour12:false spells midnight in some ICU versions. Left as
    // 24 it would put every midnight ninety minutes past the weekday cutoff
    // instead of before the morning start.
    const hour = Number(get("hour")) % 24;
    const minute = Number(get("minute"));

    if (weekday === undefined || !Number.isFinite(hour) || !Number.isFinite(minute)) {
      return null;
    }
    return { weekday, minute: hour * 60 + minute };
  } catch {
    return null;
  }
}

/**
 * May a rep dial this prospect right now?
 *
 * ══ An unknown time zone REFUSES ═══════════════════════════════════════════
 *
 * Not "assume Toronto", not "assume ours". The rule is stated in the called
 * party's time zone, so without one there is no way to evaluate it, and
 * FieldQuo's own local time is the single most dangerous substitute available:
 * a rep in Kyiv and a prospect in Vancouver are ten hours apart, and a window
 * evaluated in the caller's zone puts a legal-looking mid-morning call at
 * eleven at night. lib/voice/outbound.js's withinCallingHours already refuses
 * an unknown zone for the smaller version of this reason; here the gap is
 * hours wider.
 *
 * @returns { allowed, reason, retryLater }
 */
export function withinSalesCallingHours(now = new Date(), timeZone = null) {
  const local = localTimeIn(timeZone, now);
  if (!local) {
    return {
      allowed: false,
      reason:
        "We don't know what time it is where this prospect is, and the calling " +
        "window is defined in their time zone — so this can't be dialled until " +
        "a time zone is recorded against them.",
      retryLater: false,
    };
  }

  const isWeekend = local.weekday === 0 || local.weekday === 6;
  const window = isWeekend ? SALES_CALL_WINDOW.weekend : SALES_CALL_WINDOW.weekday;

  if (local.minute < window.startMinute || local.minute >= window.endMinute) {
    return {
      allowed: false,
      reason: `Outside the calling window where they are (${describeSalesCallWindow()}).`,
      // A queued retry is the right answer to "too early", unlike an unknown
      // zone, which no amount of waiting fixes.
      retryLater: true,
    };
  }

  return { allowed: true, reason: null, retryLater: false };
}
