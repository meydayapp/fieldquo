// lib/sales/leadDial.js
//
// What a rep's own lead looks like to the dial control.
//
// ══ Why a lead needed its own module ══════════════════════════════════════
//
// The queue's dial reads a Prospect: a discovered row with a normalised
// `phoneE164`, a country, a province and a `doNotContactAt`. A SalesLead has
// none of that shape — a free-text `phone` the rep typed, and, until now, no
// location at all. So the screen could not simply hand a lead to
// lib/sales/dialSpace.js: it needed a translation, and the translation is
// exactly the kind of thing that gets written twice and then disagrees.
//
// Written as a pure function over rows the caller has already fetched, so the
// check script can walk every shape without a database.
//
// ══ What it deliberately does NOT decide ══════════════════════════════════
//
// Whether the call is allowed. That is lib/sales/callingRules.js's
// salesCallReadiness(), and it stays there — this only supplies the country,
// the province and the time zone it needs. Two modules with an opinion about
// calling hours is one module too many.
//
// It also does not gate on the suppression list on its own authority: the
// authoritative refusal happens server-side in app/api/sales/calls before
// anything rings. What this adds is the SCREEN's copy of the same fact, so a
// rep sees "they asked us to stop" before pressing rather than after.
import { contactability } from "./prospectView";
import { normalisePhone } from "./suppressionRules";

/**
 * The lead's number, normalised, or null.
 *
 * A lead's phone is whatever the rep typed — "613-555-0142", "(613) 555 0142",
 * an extension, a note. normalisePhone is the same function the suppression
 * list and the SMS path key on, so a number that cannot be normalised here is
 * a number that could not have been suppressed or texted either. Falling back
 * to the linked prospect's number matches what targetFor() already does on the
 * server, so the screen and the dial agree about which number would ring.
 */
export function leadPhoneE164(lead = {}) {
  return normalisePhone(lead.phone) || lead.prospect?.phoneE164 || null;
}

/**
 * May this lead be rung at all — before any question of hours?
 *
 * Order matters and is the same order the queue uses: do-not-contact outranks
 * everything, then an opt-out, then the absence of a number. A record that is
 * both flagged and unreachable is reported as flagged, because that is the
 * fact a rep must not act against.
 *
 * @param lead      the SalesLead, with `prospect` selected when it has one.
 * @param optedOut  what contactOptedOut() said for the phone channel. Passed
 *                  in rather than queried, because this file is synchronous
 *                  and the caller has already awaited it for email.
 */
export function leadContactability(lead = {}, { optedOut = null } = {}) {
  // The prospect's flag, when there is a prospect. A lead attached to a
  // discovered business inherits the do-not-contact recorded against that
  // business — the flag is on the business, not on the piece of paper.
  const dnc = contactability({
    doNotContactAt: lead.prospect?.doNotContactAt || null,
    doNotContactReason: lead.prospect?.doNotContactReason || null,
    // Passed so contactability's own no-phone branch is never the one that
    // fires here; the no-phone case below says more about a lead than its
    // generic sentence does.
    phoneE164: "+10000000000",
  });
  if (!dnc.callable) return dnc;

  if (optedOut?.optedOut) {
    return {
      callable: false,
      code: "opted_out",
      title: "They asked us to stop.",
      text:
        (optedOut.reason ? `${optedOut.reason} ` : "") +
        "An opt-out covers every channel by default, so no dial control is offered on this one.",
    };
  }

  if (!leadPhoneE164(lead)) {
    return {
      callable: false,
      code: "no_phone",
      title: "No phone number on this lead.",
      text: lead.phone
        ? `"${String(lead.phone).slice(0, 40)}" is not a number that can be dialled. Put it in ` +
          "full, with the country code, and the call button appears here."
        : "Add their number to this lead and the call button appears here.",
    };
  }

  return { callable: true, code: null, title: null, text: null };
}

/**
 * Where the phone rings, for the calling-rules gate.
 *
 * The lead's own country and province win over the linked prospect's. That is
 * not arbitrary: the lead's pair is typed by the rep who spoke to them, and
 * discovery's is inferred from a directory row that can be a head office in
 * another state. The rep is closer to the fact.
 *
 * Every field is nullable and nothing is defaulted. A missing province makes
 * salesCallReadiness answer `unknown`, which is the correct answer and the one
 * the screen then offers a way to fix.
 */
export function leadCallingContext(lead = {}) {
  return {
    country: lead.country || lead.prospect?.country || null,
    province: lead.province || lead.prospect?.province || null,
    timeZone: lead.timeZone || null,
    // Which of the two records supplied the location, so the screen can say
    // "inherited from the discovered business" rather than implying the rep
    // typed something they did not.
    source: lead.country && lead.province ? "lead" : lead.prospect?.province ? "prospect" : null,
  };
}

/**
 * Everything the lead screen's dial region needs, in one object.
 *
 * Shaped to match what dialSpace() reads off a queue row — `contact` and
 * `phoneE164` — so the two screens hand it the same thing.
 */
export function leadDialView(lead = {}, { optedOut = null } = {}) {
  return {
    phoneE164: leadPhoneE164(lead),
    contact: leadContactability(lead, { optedOut }),
    callingContext: leadCallingContext(lead),
  };
}
