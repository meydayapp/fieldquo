// lib/sales/smsWindow.js
//
// When FieldQuo's own reps may TEXT a prospect.
//
// ══ Why this is a third window, and not lib/sales/callingWindow.js ═════════
//
// callingWindow.js was written for the sales dialler and its header is right
// about what it governs: Canada's Unsolicited Telecommunications Rules set
// 09:00–21:30 weekdays and 10:00–18:00 weekends, in the called party's zone,
// for telemarketing TELECOMMUNICATIONS — a voice call or a fax. I checked
// whether that window transfers to SMS before reusing it, and it does not:
//
//   CANADA. A commercial text is a commercial electronic message, and CEMs are
//   governed by CASL, not by the Telemarketing Rules. CASL's requirements are
//   consent, sender identification, a mailing address and a working
//   unsubscribe — see lib/sales/salesSmsRules.js, which builds all four into
//   the message. CASL imposes NO time-of-day restriction at all. So the
//   09:00–21:30 / 10:00–18:00 numbers are not the SMS rule; borrowing them
//   would be borrowing the right shape from the wrong statute.
//
//   UNITED STATES. The TCPA restricts telemarketing to 08:00–21:00 in the
//   called party's local time, and the FCC and the courts have long treated a
//   text message as a call for TCPA purposes. Unlike the TSR — which exempts
//   business-to-business almost entirely (AUDIT-compliance.md §7) — the TCPA's
//   restrictions are not lifted for B2B when the number reached is a mobile,
//   and small contractors answer on mobiles. So 08:00–21:00 local IS the
//   operative texting rule, and it is the one this file encodes.
//
// Note which direction each edge moves against the voice window: the morning
// starts an hour EARLIER on weekdays (08:00 vs 09:00), the evening ends half an
// hour EARLIER (21:00 vs 21:30), and the weekend is nine hours WIDER
// (08:00–21:00 vs 10:00–18:00). There is no single pair of numbers that is
// right for both, which is why there are two files.
//
// ══ What is deliberately NOT done here ═════════════════════════════════════
//
// The obvious alternative was to take the intersection of both windows — the
// strictest reading of everything — and refuse a Saturday-morning text a US
// prospect could legally receive. Rejected: over-restriction here is not free,
// because the whole point of this feature is a rep sending a link while the
// prospect is still thinking about the call they just had, and a rule that
// blocks that will be worked around rather than obeyed. The rule encoded is
// the rule that actually binds.
//
// ══ localTimeIn is imported, not copied ════════════════════════════════════
//
// The hard part of this is not the bounds, it is reading a weekday and a
// minute out of ONE formatted instant so the pair cannot straddle midnight.
// callingWindow.js already solved that and explains why. AGENTS.md failure
// class #4 — the copy is the one that rots — has a nasty version here: two
// zone readers that disagree by a day would put one channel inside the window
// and the other outside it, for the same prospect at the same moment.
import { localTimeIn } from "./callingWindow";

/**
 * The texting window, in minutes from local midnight, every day of the week.
 *
 * Flat rather than weekday/weekend because the rule it encodes is flat. A
 * weekend split copied over from the voice window would look like diligence
 * and would be an invented restriction with no statute behind it.
 */
export const SALES_SMS_WINDOW = { startMinute: 8 * 60, endMinute: 21 * 60 };

/** Human-readable, for a screen or a refusal. Derived, never retyped. */
export function describeSalesSmsWindow() {
  const hhmm = (m) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return (
    `${hhmm(SALES_SMS_WINDOW.startMinute)}–${hhmm(SALES_SMS_WINDOW.endMinute)} ` +
    `every day, in the prospect's own time zone`
  );
}

/**
 * The zones a rep may state for a prospect, and the complete list of them.
 *
 * A closed list rather than free text for two reasons. A typo'd IANA name
 * makes Intl throw, which localTimeIn turns into "unknown zone", which blocks
 * the send — a silent, confusing failure. And the send is refused outside
 * +1 anyway (see isNorthAmerican in ./salesSmsRules.js), so a zone outside
 * North America would describe a prospect this feature cannot text.
 *
 * Labelled by place rather than by offset because a rep picks this after
 * hearing where somebody is, not after working out their UTC offset.
 */
export const SALES_SMS_TIME_ZONES = Object.freeze([
  { value: "America/St_Johns", label: "Newfoundland (St. John's)" },
  { value: "America/Halifax", label: "Atlantic (Halifax, Moncton)" },
  { value: "America/Toronto", label: "Eastern (Toronto, Ottawa, Montréal, New York)" },
  { value: "America/Winnipeg", label: "Central (Winnipeg, Chicago)" },
  { value: "America/Edmonton", label: "Mountain (Calgary, Edmonton, Denver)" },
  { value: "America/Regina", label: "Saskatchewan (Regina — no daylight saving)" },
  { value: "America/Phoenix", label: "Arizona (Phoenix — no daylight saving)" },
  { value: "America/Vancouver", label: "Pacific (Vancouver, Seattle, Los Angeles)" },
  { value: "America/Anchorage", label: "Alaska (Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii (Honolulu)" },
]);

/** Is this a zone a rep is allowed to state? */
export function isSalesSmsTimeZone(value) {
  return SALES_SMS_TIME_ZONES.some((z) => z.value === value);
}

/**
 * May a rep text this prospect right now?
 *
 * ══ An unknown time zone REFUSES ═══════════════════════════════════════════
 *
 * The same refusal callingWindow.js makes, for the same reason and with the
 * same force: the rule is stated in the recipient's local time, so without one
 * there is nothing to evaluate, and FieldQuo's own local time is the worst
 * available substitute. A rep in Kyiv sending at a civilised eleven in the
 * morning reaches a Vancouver prospect at one in the morning.
 *
 * `retryLater` distinguishes the two refusals for the screen: "too early" is
 * fixed by waiting, "no zone" is fixed by the rep saying where the person is.
 *
 * @returns { allowed, reason, retryLater }
 */
export function withinSalesSmsHours(now = new Date(), timeZone = null) {
  const local = localTimeIn(timeZone, now);
  if (!local) {
    return {
      allowed: false,
      reason:
        "We don't know what time it is where this prospect is, and the texting " +
        "window is defined in their time zone — so nothing can go out until " +
        "their time zone is recorded.",
      retryLater: false,
    };
  }

  if (
    local.minute < SALES_SMS_WINDOW.startMinute ||
    local.minute >= SALES_SMS_WINDOW.endMinute
  ) {
    return {
      allowed: false,
      reason: `Outside the texting window where they are (${describeSalesSmsWindow()}).`,
      retryLater: true,
    };
  }

  return { allowed: true, reason: null, retryLater: false };
}
