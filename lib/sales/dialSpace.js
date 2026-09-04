// lib/sales/dialSpace.js
//
// What occupies the dial control's place when there is no dial control.
//
// ══ The rule this does NOT relax ═══════════════════════════════════════════
//
// lib/sales/callingRules.js's dialHref() is still the only thing in the
// codebase that can produce a `tel:` target, and it still refuses to produce
// one from anything but an `allowed` decision. This module does not
// re-implement it and does not call it: the page calls dialHref and hands the
// answer in, so there remains exactly one producer of a dial target.
//
// What this module adds is a SECOND refusal on the same condition. An href
// handed in beside a refused or unknown decision is dropped on the floor —
// `state === DIAL_READY` and `href !== null` are the same condition here no
// matter what the caller passed. Two independent gates on the same fact, for
// the reason non-negotiable #2 gives for gating impersonation twice: hiding a
// button is not access control, and neither is trusting a caller.
// scripts/check-sales-console.mjs forges the href and reads the answer.
//
// There is still no greyed-out Call button. app/sales/queue/page.js's header
// argues why, and that stands: a control that looks broken teaches a rep to
// press it harder.
//
// ══ What this adds, and why it was needed ═════════════════════════════════
//
// The owner opened the rep console and said "I don't even know where to go to
// dial". He was looking at an empty queue, where the whole call region — the
// button, the compliance notices, everything — simply did not exist. Absence
// of UI is indistinguishable from absence of feature: a rep cannot tell "you
// have claimed nothing" from "this product cannot make calls" from "the
// button is broken today".
//
// So the console reserves ONE place for the dial, always, and this function
// fills it. Every state that is not `ready` carries a title and a body saying
// what is missing and what would fix it. Rendering nothing is not one of the
// return values, which is what makes the rule enforceable rather than a note
// in a review.
//
// ══ Why it is here and not in the page ════════════════════════════════════
//
// Same reason dialHref is not in the page: a decision written in JSX is a
// decision a check script has to argue with a regex about, and this project
// has had that produce a false pass before. This is a pure function over the
// queue payload, so the check calls it with each shape and reads the answer.
import { CALL_ALLOWED, CALL_REFUSED, CALL_UNKNOWN } from "./callingRules";

/** A number, a decision, and permission. The only state with an href. */
export const DIAL_READY = "ready";
/** Nothing is selected — an empty queue, or a list nobody has clicked. */
export const DIAL_NO_PROSPECT = "no_prospect";
/** The row is flagged do-not-contact. Outranks everything, as it does elsewhere. */
export const DIAL_DO_NOT_CONTACT = "do_not_contact";
/** No sales number on the record. Nothing to dial, and it is not a refusal. */
export const DIAL_NO_NUMBER = "no_number";
/** The rules were read and they say no, at least for now. */
export const DIAL_REFUSED = "refused";
/** The rules could not be applied. NOT the same as a refusal — see below. */
export const DIAL_UNCONFIRMED = "unconfirmed";
/** No decision reached this screen at all — a stale bundle, or a failed load. */
export const DIAL_NO_DECISION = "no_decision";

/** Every state, so a renderer can be checked against the complete set. */
export const DIAL_STATES = Object.freeze([
  DIAL_READY,
  DIAL_NO_PROSPECT,
  DIAL_DO_NOT_CONTACT,
  DIAL_NO_NUMBER,
  DIAL_REFUSED,
  DIAL_UNCONFIRMED,
  DIAL_NO_DECISION,
]);

/**
 * Three tones, matching the three the queue screen already paints.
 *
 * `gap` is a finding — we looked, and the answer is no. `unknown` is not a
 * finding at all. Painting them alike is the single most damaging thing this
 * region could do: "it is 21:00 in Tulsa" and "nobody has read Colorado's
 * statute" are different sentences and must not be the same colour.
 */
const TONE_BY_STATE = Object.freeze({
  [DIAL_READY]: "has",
  [DIAL_NO_PROSPECT]: "unknown",
  [DIAL_DO_NOT_CONTACT]: "gap",
  [DIAL_NO_NUMBER]: "gap",
  [DIAL_REFUSED]: "gap",
  [DIAL_UNCONFIRMED]: "unknown",
  [DIAL_NO_DECISION]: "unknown",
});

/**
 * The sentence that names the rule and the hour.
 *
 * Only built from a decision that actually carries a window. A refusal with no
 * window — Arizona's flat prohibition on calling a mobile number is the one in
 * the table — must NOT be given an invented one, because "wait until 08:00"
 * would be a fact we made up about a rule that cannot be waited out.
 */
function windowSentence(compliance) {
  if (!compliance?.windowText) return null;
  const who = compliance.jurisdiction?.name || "The rule that applies";
  const opens = compliance.opensAtText ? ` It opens at ${compliance.opensAtText}.` : "";
  return `${who}: ${compliance.windowText}.${opens}`;
}

/**
 * What goes where the Call button goes.
 *
 * @param prospect   the queue payload's `current`, or null when nothing is
 *                   selected. Only `contact` is read.
 * @param compliance the decision the SCREEN recomputed on its timer — not the
 *                   one the server stamped into the payload, which is a minute
 *                   old by the time anybody reads it. Null means the screen
 *                   could not reach one.
 * @param href       what dialHref() returned for this prospect. Passed in
 *                   rather than computed, so dialHref stays the one producer —
 *                   and re-gated here rather than trusted, so a caller that
 *                   built one some other way gets it dropped.
 * @param claimedCount how many prospects the rep holds. Only changes the words
 *                   in the `no_prospect` state: "claim your first" and "pick
 *                   one from the list" are different instructions.
 * @returns {{state:string, href:string|null, tone:string, title:string,
 *            detail:string, reasons:Array<{code:string,title:string,fix:string}>}}
 */
export function dialSpace({
  prospect = null,
  compliance = null,
  href = null,
  claimedCount = 0,
} = {}) {
  // `href` is a positional argument here and defaults to null, so every
  // non-ready branch below produces a null one WITHOUT having to remember to.
  // Forgetting is the failure mode this shape removes.
  const shape = (state, title, detail, reasons = [], target = null) => ({
    state,
    href: target,
    tone: TONE_BY_STATE[state] || "unknown",
    title,
    detail,
    reasons,
  });

  /** The href, only if it is a real one. The second gate; see the header. */
  const offered = typeof href === "string" && href.trim() ? href.trim() : null;

  if (!prospect) {
    const held = Number.isFinite(claimedCount) && claimedCount > 0 ? claimedCount : 0;
    return shape(
      DIAL_NO_PROSPECT,
      "No prospect open, so there is nothing to dial.",
      held > 0
        ? `You hold ${held} prospect${held === 1 ? "" : "s"}. Pick one from the list and its ` +
            "number, and whether you may ring it, appear right here."
        : "Pick a trade, claim one, and the call button appears in this spot. It is always this " +
            "spot — an empty one means you have claimed nobody, not that calling is switched off.",
    );
  }

  const contact = prospect.contact || null;
  if (contact && contact.callable === false) {
    if (contact.code === "do_not_contact") {
      return shape(
        DIAL_DO_NOT_CONTACT,
        contact.title || "Do not contact",
        contact.text ||
          "This record is flagged do-not-contact, so no dial control is offered on it.",
      );
    }
    // Anything else that makes a row uncallable is the missing number. Said in
    // the words the owner used — "no sales number yet" — because "contact
    // unavailable" tells a rep nothing about what would fix it.
    return shape(
      DIAL_NO_NUMBER,
      "No sales number yet.",
      (contact.text ||
        "This record carries no phone number, so there is nothing to dial from here.") +
        " Discovery found the business without one. Their website or a directory listing may " +
        "have it — put it on their lead and it appears here.",
    );
  }

  if (!compliance) {
    return shape(
      DIAL_NO_DECISION,
      "We cannot confirm this call is allowed.",
      "This screen could not work out which calling rules apply, so it is not offering a dial " +
        "control it cannot stand behind. Reload the page.",
    );
  }

  const blockers = Array.isArray(compliance.blockers) ? compliance.blockers : [];

  if (compliance.decision === CALL_REFUSED) {
    const window = windowSentence(compliance);
    return shape(
      DIAL_REFUSED,
      // "right now" ONLY when there is a window to wait for. Arizona's flat
      // prohibition on ringing a mobile number is the row that has none, and
      // telling a rep to come back later would be an invented fact about a rule
      // that cannot be waited out.
      window ? "You may not ring this one right now." : "You may not ring this one.",
      window ||
        "The rule that applies to this business refuses this call, and it is not a window that " +
          "opens later. The reason is below.",
      blockers,
    );
  }

  if (compliance.decision === CALL_UNKNOWN) {
    const window = windowSentence(compliance);
    return shape(
      DIAL_UNCONFIRMED,
      "We cannot confirm this call is allowed.",
      // Deliberately NOT "you may not call" — nobody established that. What is
      // missing is an answer, and the blockers below say which one.
      (window ? `${window} ` : "") +
        "Nothing was established either way, so no dial control is offered. This is a gap in what " +
        "we know, not a refusal.",
      blockers,
    );
  }

  if (compliance.decision !== CALL_ALLOWED) {
    // A decision value this file has never seen. A dial control has to be
    // opted INTO — the same discipline claimCandidateWhere() uses when it names
    // the one status that is workable rather than listing the ones that are
    // not, so a decision added later cannot default into a ringing phone.
    return shape(
      DIAL_NO_DECISION,
      "We cannot confirm this call is allowed.",
      `The calling rules answered "${String(compliance.decision)}", which this screen does not ` +
        "know how to read. No dial control is offered on an answer nobody can interpret.",
    );
  }

  if (!offered) {
    // Allowed, and still nothing to ring. Reachable only if a payload carries a
    // decision without a number — a stale bundle against a newer API. The
    // honest answer is still an answer.
    return shape(
      DIAL_NO_NUMBER,
      "No sales number yet.",
      "The calling rules allow this call and this record carries no number to place it to. " +
        "Reload; if it persists, the prospect needs a phone number.",
    );
  }

  return shape(
    DIAL_READY,
    "You may ring this one now.",
    windowSentence(compliance) || "No jurisdiction in the table imposes a window on this one.",
    [],
    offered,
  );
}
