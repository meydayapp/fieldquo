// lib/sales/calls/dispositions.js
//
// What a rep says happened on a call, and exactly what each answer does.
//
// ══ Why a table and not a function full of if-statements ═══════════════════
//
// The same argument lib/sales/callingRules.js opens with, for the same reason.
// A disposition is not a label: "not interested" and "wrong number" both end
// the call, and they must do OPPOSITE things to the pool — one keeps the
// prospect out of every other rep's queue forever, the other puts them in
// front of a human who can fix the record. Written as branches, those two
// consequences live in whichever route happened to be written last. Written as
// a table, they can be read in one screen and executed against hostile input
// by scripts/check-sales-call-handling.mjs.
//
// ══ The attempt is recorded at the DIAL, not at the disposition ════════════
//
// This is the load-bearing decision in the whole feature and it is easy to get
// backwards. Oklahoma and Florida cap CALLS to the same business on the same
// subject at three in 24 hours — not conversations. A rep who dials five times
// and fills in one outcome has made five calls. So the row is written when the
// rep asks to dial, `disposition` starts null, and this module only ever
// UPDATES a row that already exists.
//
// The consequence worth stating: an attempt row means "a rep pressed the call
// button", not "a call connected". While a rep dials from their own handset
// through a `tel:` href, the operating system takes over and nothing reports
// back — no ring, no answer, no duration. Over-counting a press that never
// became a call is the safe direction for a cap with a private right of action
// behind it, and it is the only direction available. There is deliberately no
// duration column: a nullable column nothing can write is AGENTS.md failure
// class 1 wearing a measurement's clothes.
//
// ══ Why this vocabulary is closed, and not a superadmin-editable table ═════
//
// STATUS.md's standing rule 1 says every setting and every rule is editable
// from the superadmin UI. This is neither. Each entry below carries CODE
// BEHAVIOUR — a claim transition, a prospect status, a suppression write — so
// a superadmin adding "Left a message with the wife" would get a row that does
// nothing to the queue: a dead control, added through a UI, which is the thing
// AGENTS.md opens by forbidding. The editable surface here is the playbook a
// rep reads, which already is one. What is configurable is what a rep SAYS;
// what a disposition DOES is code.
//
// ══ Where the vocabulary came from ════════════════════════════════════════
//
// Studied from OMniLeads (LGPL-3.0, read for design only — see
// docs/sales-intel/CALL-HANDLING.md) and then narrowed hard. A contact centre
// separates the telephony result from the human result because its dialler
// produces the first without a person; FieldQuo has no dialler, so one flat
// list a rep picks from is honest and two coupled dropdowns would be theatre.

import { CLAIM_HOURS } from "../prospectView";

/** How a disposition leaves the claim. */
export const CLAIM_HOLD = "hold";
export const CLAIM_WORKED = "worked";
export const CLAIM_RELEASE = "release";

/**
 * How far ahead a callback may be booked.
 *
 * A callback extends the lease to cover it — see planDisposition — so an
 * unbounded date is an unbounded lease, and a rep who books one for 2029 has
 * removed a prospect from every other rep's pool permanently by typing a date.
 * Sixty days is past any real "ring me after the season" and short enough that
 * a forgotten one comes back.
 */
export const MAX_CALLBACK_DAYS = 60;

/**
 * The complete set, in the order a rep reads them.
 *
 * `reached` is the fact that decides everything else: did a human being speak
 * to us. It is a boolean and not three-valued on purpose — unlike a
 * jurisdiction lookup, there is no "we could not establish it" here. The rep
 * was on the call. If they are not sure they spoke to a person, they did not.
 *
 * Field by field:
 *
 *   claim            hold    the lease survives and is EXTENDED (see below).
 *                    worked  claimExpiresAt := null. Permanent, never lapses —
 *                            the schema's own words, "a real conversation is
 *                            not a lease".
 *                    release the claim is dropped. Only ever paired with a
 *                            prospectStatus that keeps the row OUT of the
 *                            pool, because releasing a workable prospect after
 *                            a bad call just hands the next rep the same call.
 *   prospectStatus   written to Prospect.status. Only ever "needs_review" —
 *                    claimCandidateWhere() admits "discovered" and nothing
 *                    else, so this is what takes a row out of circulation
 *                    without a rep being able to reject it outright. Rejecting
 *                    is a curation act and stays with the superadmin console.
 *   leadStatus       written to SalesLead.status when a lead exists. Never
 *                    creates one — see planDisposition.
 *   doNotContact     writes Prospect.doNotContactAt AND a SalesSuppression
 *                    entry. Both, always: the first is a fact about the row
 *                    and the second binds FieldQuo across every channel and
 *                    every rep. lib/sales/outreachInbound.js's header argues
 *                    at length why the per-row flag alone was a bug.
 *   requiresNote     the outcome is meaningless without words. Refused empty.
 *   requiresCallback the outcome is a promise with a time in it.
 *
 * ── Why "extends the lease" ───────────────────────────────────────────────
 *
 * CLAIM_HOURS measures INACTIVITY, not age. A rep who has rung twice and is
 * waiting on a callback is working the prospect; letting the lease die at hour
 * 48 would put that contractor back in the pool for a second rep to ring, which
 * is the one thing ownership exists to prevent. So every disposition that holds
 * the claim resets the clock from now.
 */
export const DISPOSITIONS = Object.freeze({
  no_answer: {
    code: "no_answer",
    label: "No answer",
    hint: "It rang out. Nobody picked up and no machine answered.",
    reached: false,
    claim: CLAIM_HOLD,
    prospectStatus: null,
    leadStatus: null,
    doNotContact: false,
    requiresNote: false,
    requiresCallback: false,
  },
  busy: {
    code: "busy",
    label: "Busy",
    hint: "Engaged tone, or cut off before it rang.",
    reached: false,
    claim: CLAIM_HOLD,
    prospectStatus: null,
    leadStatus: null,
    doNotContact: false,
    requiresNote: false,
    requiresCallback: false,
  },
  voicemail: {
    code: "voicemail",
    label: "Voicemail — I left a message",
    // Said in the label rather than left to the rep to infer: a message left in
    // a rep's own voice is a person speaking. A pre-recorded or synthesised
    // drop is the thing Washington RCW 80.36.400 fines at $1,000 a time, with
    // no business exclusion and liability extending to whoever "assists in the
    // transmission". Nothing in FieldQuo can leave one and nothing should.
    hint: "You spoke into their machine yourself. Never a recording.",
    reached: false,
    claim: CLAIM_HOLD,
    prospectStatus: null,
    leadStatus: null,
    doNotContact: false,
    requiresNote: false,
    requiresCallback: false,
  },
  gatekeeper: {
    code: "gatekeeper",
    label: "Someone answered, but not the owner",
    hint: "A receptionist, a partner, an apprentice. The pitch has not happened.",
    reached: true,
    claim: CLAIM_HOLD,
    prospectStatus: null,
    leadStatus: null,
    doNotContact: false,
    requiresNote: false,
    requiresCallback: false,
  },
  callback: {
    code: "callback",
    label: "They asked me to ring back",
    hint: "A time they agreed to. The claim is held until then and past it.",
    reached: true,
    claim: CLAIM_HOLD,
    prospectStatus: null,
    // Deliberately "contacted": a callback is a conversation that happened.
    leadStatus: "contacted",
    doNotContact: false,
    requiresNote: false,
    requiresCallback: true,
  },
  reached_interested: {
    code: "reached_interested",
    label: "Spoke to them — interested",
    hint: "The pitch landed. This prospect is yours from here.",
    reached: true,
    claim: CLAIM_WORKED,
    prospectStatus: null,
    leadStatus: "contacted",
    doNotContact: false,
    requiresNote: false,
    requiresCallback: false,
  },
  reached_not_interested: {
    code: "reached_not_interested",
    label: "Spoke to them — not interested",
    hint: "They heard it and said no. Nobody else should ring them next week.",
    // WORKED, not released, and this is the point of the disposition. "No" is
    // not "unworked". A released row goes back in the pool and a second rep
    // makes the same call to the same annoyed contractor, which is how a
    // legitimate B2B call becomes a complaint.
    reached: true,
    claim: CLAIM_WORKED,
    prospectStatus: null,
    leadStatus: "lost",
    doNotContact: false,
    requiresNote: false,
    requiresCallback: false,
  },
  do_not_call: {
    code: "do_not_call",
    label: "Asked not to be called again",
    hint: "Their words, as close as you can get them. This is permanent.",
    reached: true,
    claim: CLAIM_WORKED,
    prospectStatus: null,
    leadStatus: "lost",
    doNotContact: true,
    // The existing do_not_contact action already refuses an empty reason —
    // "a do-not-contact with no reason cannot be reviewed later, and this one
    // is permanent". Same rule, same words, one place it is enforced.
    requiresNote: true,
    requiresCallback: false,
  },
  bad_number: {
    code: "bad_number",
    label: "Wrong or dead number",
    hint: "Disconnected, or it reached somebody else entirely.",
    reached: false,
    // Released, because there is nothing here to work — but the row goes to
    // needs_review in the same breath, so the pool cannot hand the same dead
    // number to the next rep. Release without the status change would be a
    // treadmill.
    claim: CLAIM_RELEASE,
    prospectStatus: "needs_review",
    leadStatus: null,
    doNotContact: false,
    requiresNote: false,
    requiresCallback: false,
  },
  not_a_fit: {
    code: "not_a_fit",
    label: "Not a business we can sell to",
    hint: "A retailer, a franchise head office, out of business, wrong trade.",
    reached: true,
    claim: CLAIM_RELEASE,
    // needs_review rather than rejected, deliberately. "Rejected by a human" is
    // a curation verdict on discovered data and it belongs to the superadmin
    // console that owns classification; a rep's read from one phone call is
    // strong evidence FOR that verdict and is not the verdict.
    prospectStatus: "needs_review",
    leadStatus: null,
    doNotContact: false,
    requiresNote: true,
    requiresCallback: false,
  },
});

/** The order the picker renders, so the screen cannot invent its own. */
export const DISPOSITION_ORDER = Object.freeze([
  "no_answer",
  "busy",
  "voicemail",
  "bad_number",
  "gatekeeper",
  "callback",
  "reached_interested",
  "reached_not_interested",
  "not_a_fit",
  "do_not_call",
]);

/** Is this one of ours? Total, and false for every shape that is not. */
export function isDisposition(code) {
  return typeof code === "string" && Object.hasOwn(DISPOSITIONS, code);
}

/** The row, or null. Never a partial default — an unknown code is unknown. */
export function dispositionFor(code) {
  return isDisposition(code) ? DISPOSITIONS[code] : null;
}

/**
 * The list a picker renders. Built from DISPOSITION_ORDER rather than from
 * Object.keys, so a new entry that nobody put in the order is invisible on
 * screen instead of appearing in whatever order the engine felt like.
 * scripts/check-sales-call-handling.mjs asserts the two agree.
 */
export function dispositionOptions() {
  return DISPOSITION_ORDER.filter(isDisposition).map((code) => {
    const d = DISPOSITIONS[code];
    return {
      code: d.code,
      label: d.label,
      hint: d.hint,
      requiresNote: d.requiresNote,
      requiresCallback: d.requiresCallback,
    };
  });
}

function when(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function refuse(reason) {
  return { ok: false, reason, attempt: null, prospect: null, lead: null, suppression: null };
}

/**
 * The complete set of writes one disposition implies — computed, not performed.
 *
 * ══ Why a plan object and not a function that writes ═══════════════════════
 *
 * lib/sales/attribution.js already does this: "never re-derives an outcome into
 * an action, which is where the two got out of step". Same shape here. The
 * route runs one transaction over what this returns; this function has no
 * database, so every branch — a callback with no date, a do-not-call with an
 * empty reason, a code nobody has heard of, a date sixty-one days out — is
 * executed by the check script rather than reasoned about.
 *
 * Returns `{ ok: false, reason }` for anything it will not plan. The caller
 * turns that into a 400 verbatim; there is no partial plan and no default.
 *
 * @param code       a DISPOSITIONS key.
 * @param note       free text. Required by some codes, kept for all of them.
 * @param callbackAt required by `callback`, refused everywhere else.
 * @param now        the clock, so the check can hold it still.
 */
export function planDisposition({
  code = null,
  note = "",
  callbackAt = null,
  now = new Date(),
} = {}) {
  const d = dispositionFor(code);
  if (!d) {
    return refuse(
      `"${String(code)}" is not a call outcome this build knows. Pick one of: ${DISPOSITION_ORDER.join(", ")}.`,
    );
  }

  const at = when(now) || new Date();
  const text = typeof note === "string" ? note.trim() : "";

  if (d.requiresNote && !text) {
    return refuse(
      `"${d.label}" needs a sentence saying what was actually said. It is the only record there will be.`,
    );
  }

  let callback = null;
  if (d.requiresCallback) {
    callback = when(callbackAt);
    if (!callback) {
      return refuse(`"${d.label}" needs the time they agreed to. A callback with no time is not one.`);
    }
    if (callback.getTime() <= at.getTime()) {
      return refuse("That callback time has already passed.");
    }
    const limit = at.getTime() + MAX_CALLBACK_DAYS * 24 * 60 * 60 * 1000;
    if (callback.getTime() > limit) {
      return refuse(
        `A callback can be booked up to ${MAX_CALLBACK_DAYS} days out. Longer than that holds the prospect out of every other rep's queue for months.`,
      );
    }
  } else if (callbackAt) {
    // Not ignored. A screen that sent a date with "no answer" has a bug, and
    // silently dropping it would store a promise nobody made.
    return refuse(`"${d.label}" does not take a callback time.`);
  }

  // ── The claim ───────────────────────────────────────────────────────────
  const leaseMs = CLAIM_HOURS * 60 * 60 * 1000;
  let claimExpiresAt;
  let assignedRepId;
  if (d.claim === CLAIM_WORKED) {
    // The schema's own vocabulary: null expiry means worked and permanent.
    claimExpiresAt = null;
    assignedRepId = "keep";
  } else if (d.claim === CLAIM_RELEASE) {
    claimExpiresAt = null;
    assignedRepId = null;
  } else {
    // Held, and the clock restarts. A callback further out than the ordinary
    // lease carries the lease with it — see MAX_CALLBACK_DAYS for the bound
    // that stops that becoming a permanent hold.
    const ordinary = at.getTime() + leaseMs;
    const covering = callback ? callback.getTime() + leaseMs : 0;
    claimExpiresAt = new Date(Math.max(ordinary, covering));
    assignedRepId = "keep";
  }

  return {
    ok: true,
    reason: null,
    disposition: d.code,
    reached: d.reached,
    attempt: {
      disposition: d.code,
      dispositionAt: at,
      dispositionNote: text || null,
      callbackAt: callback,
    },
    prospect: {
      // "keep" is a sentinel the route reads, never a value it writes. Written
      // out rather than left undefined so a caller cannot mistake "do not
      // touch this column" for "set it to undefined", which Prisma treats as
      // the former only by luck of the argument shape.
      assignedRepId,
      claimExpiresAt,
      status: d.prospectStatus,
      doNotContactAt: d.doNotContact ? at : null,
      doNotContactReason: d.doNotContact ? text : null,
    },
    lead: d.leadStatus ? { status: d.leadStatus } : null,
    // The channels are decided here rather than at the write, because "stop
    // calling me" said on the phone is a narrower request than an unqualified
    // "stop", and lib/sales/suppressionRules.js's own header says the widening
    // belongs where it can be argued. A person who says it on a call has asked
    // about calls; recording it as a blanket stop across email and SMS would
    // be padding absent data with a default — AGENTS.md failure class 5 — in
    // the direction that silently deletes a channel they never mentioned.
    suppression: d.doNotContact
      ? { channels: ["phone"], source: "call", reason: text, requestedAt: at }
      : null,
  };
}

/**
 * How many calls have been placed to this number in the last 24 hours.
 *
 * ══ Counted by NUMBER, not by prospect, and that is not a detail ═══════════
 *
 * The cap is "per called party, not per rep" — lib/sales/callingRules.js
 * already says so in the refusal it prints. It is also per called party and
 * not per ROW: Prospect deduplication flags rather than merges
 * (`possibleDuplicateOfId`, "merging destroys provenance"), so two rows can
 * carry one phone number, and counting by prospectId would let three calls
 * become six by arithmetic nobody intended.
 *
 * Pure, and takes rows the caller has already read, for the reason
 * lib/sales/performance.js gives: every branch — a row on the boundary, a row
 * with a broken date, an empty list — is executed rather than read.
 *
 * Returns a number. `[]` is a real zero. A non-array is null, because "we did
 * not get an answer" and "nobody has rung them" are the two states this whole
 * gate exists to keep apart.
 */
export function attemptsWithin24h(rows, now = new Date()) {
  if (!Array.isArray(rows)) return null;
  const at = (when(now) || new Date()).getTime();
  const since = at - 24 * 60 * 60 * 1000;
  let n = 0;
  for (const row of rows) {
    const d = when(row?.dialledAt);
    if (!d) continue;
    const ms = d.getTime();
    // Strictly inside the window at the older end, and never counting a row
    // stamped in the future — a clock-skewed row is a broken row, not a call
    // that has not happened yet.
    if (ms > since && ms <= at) n += 1;
  }
  return n;
}
