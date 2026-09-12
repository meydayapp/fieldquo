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

// ══ Why every branch below names a catalogue key ═══════════════════════════
//
// This module is refusal copy: nine states, each of which exists to tell a rep
// what is missing and what would fix it. A rep on Spanish read every one of
// them in English, inside a Spanish frame — the half-translated state that is
// worse than no translation, because it reads as broken rather than as
// unsupported.
//
// It cannot import a translator. It is pure on purpose (see the header), it is
// executed by scripts/check-sales-console.mjs under bare node, and pulling
// useTranslation in here would make it a client module and take the check
// with it. So each branch names the KEY it was written from, plus the values
// that key interpolates, and app/components/sales/DialRegion.js — the one
// renderer for this whole region — resolves both against the rep's catalogue.
//
// The English stays. It is the fallback when a key is missing, and it is what
// the check scripts read; nothing here got less honest by gaining a key.

/** A number, a decision, and permission. The only state with an href. */
export const DIAL_READY = "ready";
/** Nothing is selected — an empty queue, or a list nobody has clicked. */
export const DIAL_NO_PROSPECT = "no_prospect";
/** The row is flagged do-not-contact. Outranks everything, as it does elsewhere. */
export const DIAL_DO_NOT_CONTACT = "do_not_contact";
/** No sales number on the record. Nothing to dial, and it is not a refusal. */
export const DIAL_NO_NUMBER = "no_number";
/**
 * The number is one of FieldQuo's own.
 *
 * Its own state rather than a refusal, because it is neither a rule about the
 * prospect nor a gap in what we know — it is a fact about the number, and it
 * can never come good by waiting.
 *
 * callPlan() has always refused these at dial time; this screen did not know,
 * so a rep pressed Call, got "that is one of our own numbers", and was left
 * looking at a live Call button beside the sentence explaining why it could
 * not work. A control that appears to work and does not is the rule AGENTS.md
 * opens with, and this was one.
 */
/**
 * They asked us to stop.
 *
 * Added because contactability() started returning `opted_out` when the
 * suppression list carries the number — a contractor who texted STOP — and
 * this file had no branch for it. It fell through to DIAL_NO_NUMBER, so the
 * rep was correctly denied the dial control and then told "No sales number
 * yet ... their website or a directory listing may have it", which is an
 * instruction to go and find the number of somebody who has just asked us
 * never to ring them again. The control was right and the copy was the
 * opposite of the truth.
 */
export const DIAL_OPTED_OUT = "opted_out";

export const DIAL_OUR_OWN_NUMBER = "our_own_number";
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
  DIAL_OPTED_OUT,
  DIAL_OUR_OWN_NUMBER,
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
  // A refusal we are honouring, not a hole in the data.
  [DIAL_OPTED_OUT]: "gap",
  [DIAL_OUR_OWN_NUMBER]: "gap",
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
  const shape = (state, title, detail, reasons = [], target = null, keys = {}) => ({
    // `showWindow` asks the renderer to print the calling-window statement
    // under the detail, as its own sentences rather than slotted into one.
    //
    // ── Why the window is not interpolated into the sentence above it ──────
    //
    // The English detail reads "Washington's rule: 08:00–20:00 every day, in
    // the prospect's own time zone. It opens at 08:00 on Tue 8 Sep." Three
    // claims, and English happens to join them with a colon and a full stop.
    // Translating the join is what produces a Spanish stem around an English
    // clause. So the renderer prints them as three whole sentences, each of
    // which is a grammatical sentence on its own in every language, and the
    // catalogue never has to own a seam.
    showWindow: Boolean(keys.showWindow),
    state,
    href: target,
    tone: TONE_BY_STATE[state] || "unknown",
    title,
    detail,
    reasons,
    // The key each half was written from, and the values it interpolates.
    // Null rather than absent when a branch genuinely has none, so a renderer
    // reading `titleKey` gets a falsy answer instead of undefined behaviour.
    titleKey: keys.titleKey || null,
    detailKey: keys.detailKey || null,
    params: keys.params || {},
  });

  /** The href, only if it is a real one. The second gate; see the header. */
  const offered = typeof href === "string" && href.trim() ? href.trim() : null;

  if (!prospect) {
    const held = Number.isFinite(claimedCount) && claimedCount > 0 ? claimedCount : 0;
    return shape(
      DIAL_NO_PROSPECT,
      "No lead open, so there is nothing to dial.",
      held > 0
        ? // No count in the English, and that is the point. The number and its
          // noun are declined together by the catalogue through countedNoun —
          // `held === 1 ? "" : "s"` stood here and is the exact rule four of
          // the nine languages disagree with, so it does not get to survive as
          // "just the fallback". The fallback says the half that needs no
          // agreement; the catalogue says the whole sentence.
          "Pick one of the leads you hold from the list and its number, and whether you " +
            "may ring it, appear right here."
        : "Pick a trade, claim one, and the call button appears in this spot. It is always this " +
            "spot — an empty one means you have claimed nobody, not that calling is switched off.",
      [],
      null,
      {
        titleKey: "app.salesDial.space.noProspect.title",
        // The count is declined by the catalogue, through countedNoun — see
        // lib/i18n/plurals.js. The English ternary above is the shape that
        // cannot be translated: four of the nine languages do not split on
        // "is it one", and Ukrainian needs three forms.
        detailKey:
          held > 0
            ? "app.salesDial.space.noProspectHolding.detail"
            : "app.salesDial.space.noProspectEmpty.detail",
        // `countKey` is the convention the renderer knows: resolve THIS key
        // with `countValue`, then interpolate the answer as {count}. It exists
        // so the number and its noun are declined together by the catalogue —
        // countedNoun, never a ternary — without this file naming the noun.
        params: { countKey: "app.salesDial.space.noProspectHolding.count", countValue: held },
      },
    );
  }

  const contact = prospect.contact || null;
  if (contact && contact.callable === false) {
    if (contact.code === "our_own_number") {
      return shape(
        DIAL_OUR_OWN_NUMBER,
        contact.title || "That is one of our own numbers.",
        contact.text ||
          "Ringing our own infrastructure bridges a loop and bills both legs, so no dial control " +
            "is offered on it. If this is the lead's real number, it is on one of FieldQuo's " +
            "number lists by mistake.",
        [],
        null,
        {
          // `contact` carries its own keys when contactability() built it —
          // preferred, for the same reason its words are preferred over these:
          // it looked at the row and this branch did not.
          titleKey: contact.titleKey || "app.salesDial.space.ourOwnNumber.title",
          detailKey: contact.textKey || "app.salesDial.space.ourOwnNumber.detail",
          params: contact.params || {},
        },
      );
    }
    if (contact.code === "do_not_contact") {
      return shape(
        DIAL_DO_NOT_CONTACT,
        contact.title || "Do not contact",
        contact.text ||
          "This record is flagged do-not-contact, so no dial control is offered on it.",
        [],
        null,
        {
          titleKey: contact.titleKey || "app.salesDial.space.doNotContact.title",
          detailKey: contact.textKey || "app.salesDial.space.doNotContact.detail",
          params: contact.params || {},
        },
      );
    }
    if (contact.code === "opted_out") {
      return shape(
        DIAL_OPTED_OUT,
        contact.title || "They asked us to stop.",
        (contact.text ||
          "An opt-out covers calls, texts and email, so no dial control is offered here.") +
          " Only a superadmin can lift it, and it needs a written reason — so if this looks " +
          "wrong, say so rather than finding another number for them.",
        [],
        null,
        {
          titleKey: contact.titleKey || "app.salesDial.space.optedOut.title",
          // ONE key holding both sentences the English concatenates, not the
          // catalogue's half glued to this file's half. That concatenation is
          // exactly the defect: translating only the first clause would have
          // produced a Spanish sentence followed by an English one, in the
          // same paragraph, about the same refusal.
          detailKey: "app.salesDial.space.optedOut.detail",
          params: {},
          // What the suppression list itself said — which entry closed the
          // channel and how — travels separately so the renderer can print it
          // above, in the rep's language, without this file splicing it in.
          reasonKey: contact.reasonKey || null,
          reasonParams: contact.reasonParams || null,
        },
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
      [],
      null,
      {
        titleKey: "app.salesDial.space.noNumber.title",
        detailKey: "app.salesDial.space.noNumber.detail",
        params: {},
      },
    );
  }

  if (!compliance) {
    return shape(
      DIAL_NO_DECISION,
      "We cannot confirm this call is allowed.",
      "This screen could not work out which calling rules apply, so it is not offering a dial " +
        "control it cannot stand behind. Reload the page.",
      [],
      null,
      {
        titleKey: "app.salesDial.space.cannotConfirm.title",
        detailKey: "app.salesDial.space.noDecision.detail",
        params: {},
      },
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
      null,
      {
        titleKey: window
          ? "app.salesDial.space.refusedForNow.title"
          : "app.salesDial.space.refusedOutright.title",
        // With a window, the DETAIL is the window statement itself and the
        // renderer prints it as its own sentences. Without one there is
        // nothing to wait for, and that is a different claim with its own key.
        detailKey: window ? null : "app.salesDial.space.refusedOutright.detail",
        showWindow: Boolean(window),
        params: {},
      },
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
      null,
      {
        titleKey: "app.salesDial.space.cannotConfirm.title",
        detailKey: "app.salesDial.space.unconfirmed.detail",
        showWindow: Boolean(window),
        params: {},
      },
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
      [],
      null,
      {
        titleKey: "app.salesDial.space.cannotConfirm.title",
        detailKey: "app.salesDial.space.unreadableDecision.detail",
        params: { decision: String(compliance.decision) },
      },
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
        "Reload; if it persists, the lead needs a phone number.",
      [],
      null,
      {
        titleKey: "app.salesDial.space.noNumber.title",
        detailKey: "app.salesDial.space.allowedNoNumber.detail",
        params: {},
      },
    );
  }

  return shape(
    DIAL_READY,
    "You may ring this one now.",
    windowSentence(compliance) || "No jurisdiction in the table imposes a window on this one.",
    [],
    offered,
    {
      titleKey: "app.salesDial.space.ready.title",
      detailKey: compliance.windowText ? null : "app.salesDial.space.readyNoWindow.detail",
      showWindow: Boolean(compliance.windowText),
      params: {},
    },
  );
}
