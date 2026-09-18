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
  hung_up: {
    code: "hung_up",
    label: "They hung up",
    // ── Written by the line, never picked by the rep ─────────────────────
    //
    // A prospect who picks up and puts the phone down inside ten seconds
    // has answered the question the disposition asks — nobody spoke — and
    // the carrier already reported it (answeredAt, endedAt, and the
    // browser's own account of who dropped). Asking the rep to say so after
    // every one of these was what stopped the floor on 2026-09-14: the panel
    // held the next dial until an outcome was typed, on a tab the rep was
    // not on. So autoLogOutcome() writes this one itself, five seconds after
    // the end, unless the rep has already started typing. The picker never
    // offers it (AUTO_LOGGED_CODES), the undo strip names it, and the rep
    // may overwrite it — see SalesCallAttempt.dispositionAutoLogged.
    hint: "They picked up and put it down within seconds. Nobody spoke.",
    reached: false,
    claim: CLAIM_HOLD,
    prospectStatus: null,
    leadStatus: null,
    doNotContact: false,
    requiresNote: false,
    requiresCallback: false,
  },
  reached: {
    code: "reached",
    // ── Written by the line, for an INBOUND call, at day end only ────────
    //
    // A contractor rang back, a rep picked up, they spoke — and nobody wrote
    // it up before the day ended. Before this code existed the cron's only
    // word for an unwritten row was no_answer, which on an answered inbound
    // call is a false statement in the one column the reach rate is counted
    // on. "Reached" is what the carrier actually knows: somebody spoke. It
    // makes no claim about what was said — no status moves, no suppression,
    // no callback — and the rep may overwrite it (dispositionAutoLogged).
    // Never for an outbound row: those still fall to no_answer, because on
    // an outbound row the line already knows hung_up / busy / no_answer and
    // an answered one the rep hung up on is asked about, not guessed.
    label: "Spoke to them — not written up",
    hint: "They rang back and were answered. What was said was never logged.",
    reached: true,
    claim: CLAIM_HOLD,
    prospectStatus: null,
    // A conversation happened, the same reason callback says "contacted".
    leadStatus: "contacted",
    doNotContact: false,
    requiresNote: false,
    requiresCallback: false,
  },
  missed: {
    code: "missed",
    // ── Written by the line, for an INBOUND call, at day end only ────────
    //
    // They rang back and nobody at FieldQuo picked up — the carrier's leg to
    // the desk ended unanswered, or nothing ever reported an answer. Not
    // no_answer: that word means WE rang and THEY did not pick up, and the
    // reports read it that way. The most qualified inbound call this
    // business receives is a missed one (store.js recordInbound), so it
    // gets its own word and a retry rule that rings them back soon.
    label: "Missed their call",
    hint: "They rang back and nobody picked up. Ring them.",
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
  agreed_link_sent: {
    code: "agreed_link_sent",
    label: "Agreed on the call — I sent them the signup link",
    // ── Why this is its own outcome and not "interested" ─────────────────
    //
    // The owner's process (2026-09-13): the rep does NOT take a card. The
    // company enters it on the self-serve signup through the rep's link, so
    // the rep's controllable output is "they agreed and have the link", and
    // "signup completed with card" is a separate, later fact the funnel
    // reads from SalesAttribution + Subscription. Folding agreement into
    // `reached_interested` made the rep's stage unmeasurable: "interested"
    // is a pitch that landed, this is a pitch that CLOSED on the call. The
    // /api/sales/sms send writes this on the open attempt automatically
    // (lib/sales/agreedOnCall.js), so a rep who texts the link while still
    // on the line does not have to log it twice.
    hint: "They said yes and have your link. The signup itself is theirs to finish.",
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
    // ── "Not now", not "not interested" — the owner, 2026-09-14 ──────────
    //
    // "Not interested is not an absolute no, that just means not now." The
    // code keeps its name — every historical row and every report reads it
    // — but the meaning is a later pass, not a close: the retry rule
    // (lib/sales/retryRules.js) schedules the row again in thirty days,
    // platform-editable, and the claim is HELD rather than worked so the
    // lease lapses in the ordinary way and the row returns to rotation for
    // whoever is on. The objection the rep typed rides on the attempt note
    // and is shown above the script when the row comes back ("Last time:
    // Not now — 'call after the season'"). The one permanent stop is
    // do_not_call, below, and it needs the person to have said it.
    label: "Not now",
    hint: "They heard it and it isn't the moment. Type what they said; it comes back in a month with that line on top.",
    reached: true,
    claim: CLAIM_HOLD,
    prospectStatus: null,
    // A conversation happened. "lost" was the old label's verdict, and a
    // verdict is exactly what "not now" is not.
    leadStatus: "contacted",
    doNotContact: false,
    requiresNote: false,
    requiresCallback: false,
  },
  do_not_call: {
    code: "do_not_call",
    // The owner's wording (2026-09-14): chosen only when the person said it.
    label: "Requested no call-backs",
    hint: "Only when they said it. Stops every rep and every channel for this number.",
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
  "hung_up",
  "reached",
  "missed",
  "voicemail",
  "bad_number",
  "gatekeeper",
  "callback",
  "reached_interested",
  "agreed_link_sent",
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
      // ── Why the picker names a key as well as the words ─────────────────
      //
      // This is the dropdown a rep touches on EVERY call, and both halves of
      // every entry were English in all nine languages of the portal — the
      // single most-used control on the surface, untranslated.
      //
      // The keys are DERIVED from `code` rather than written out per entry,
      // and that is deliberate: a disposition added to the table above without
      // a key would otherwise ship silently English, which is how this class
      // of gap opens in the first place. Derived, it cannot — the key exists
      // the moment the code does, and scripts/check-sales-server-copy.mjs
      // fails if the catalogue has not caught up.
      //
      // `label` and `hint` stay as the fallback. They are what
      // scripts/check-sales-call-handling.mjs reads, and they are what a rep
      // sees if a language is missing an entry.
      labelKey: `app.salesCall.disposition.${d.code}.label`,
      hintKey: `app.salesCall.disposition.${d.code}.hint`,
      requiresNote: d.requiresNote,
      requiresCallback: d.requiresCallback,
    };
  });
}

/** Every key dispositionOptions() names, so a check can hold the catalogue to them. */
export const DISPOSITION_COPY_KEYS = DISPOSITION_ORDER.filter(isDisposition).flatMap((code) => [
  `app.salesCall.disposition.${code}.label`,
  `app.salesCall.disposition.${code}.hint`,
]);

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

// ═══════════════════════════════════════════════════════════════════════════
// What the line already knows, so the rep is not asked
// ═══════════════════════════════════════════════════════════════════════════

/** Who ended the call, as the browser reports it at `disconnect`. */
export const HUNG_UP_BY_REP = "rep";
export const HUNG_UP_BY_PROSPECT = "prospect";

/** Twilio's terminal statuses for the dialled leg, verbatim. */
export const PROVIDER_ENDED = Object.freeze(["completed", "busy", "no-answer", "failed", "canceled"]);

/**
 * The outcomes the line writes by itself. Never in the rep's picker: a rep
 * choosing "no answer" for a call the carrier says was answered is the
 * disagreement lib/sales/calls/reporting.js wants to be able to see, and
 * offering the same word in both places would hide it.
 */
export const AUTO_LOGGED_CODES = Object.freeze(["no_answer", "busy", "hung_up", "reached", "missed"]);

/**
 * The three the line writes on an OUTBOUND call (autoLogOutcome) — the
 * original set. `reached` and `missed` are day-end verdicts on an INBOUND
 * row (dayEndOutcome) and are never written while a call is live.
 */
export const LIVE_AUTO_LOGGED_CODES = Object.freeze(["no_answer", "busy", "hung_up"]);
export const INBOUND_DAY_END_CODES = Object.freeze(["reached", "missed", "hung_up"]);

/** A prospect who dropped inside this many seconds of answering did not have a conversation. */
export const AUTO_LOG_MAX_TALK_SECONDS = 10;
/** How long after the end the rep has to start typing before the line logs it. */
export const AUTO_LOG_GRACE_SECONDS = 5;
/** How long the "Logged as … — change" strip stays up. */
export const AUTO_LOG_UNDO_SECONDS = 15;

/**
 * What the line says happened, from the attempt row alone — or null, with
 * the reason, when only the rep can say.
 *
 * ══ The signals, in the order they are trusted ═════════════════════════════
 *
 *   1. `hungUpBy` — the browser's account, written at `disconnect`. "rep"
 *      means the Hang up button was pressed: the rep ended it, so the rep
 *      knows what happened and is asked. "prospect" means the far end
 *      dropped while the rep's device was still up.
 *   2. `answeredAt` / `endedAt` / `talkSeconds` — the carrier's, from
 *      /api/rep-dial/status. Talk time is the carrier's figure when it gave
 *      one, else the gap between the two stamps; the browser's clock is not
 *      consulted, because it started at the press and counts the ringing.
 *   3. `providerStatus` — for a call that never connected: no-answer, busy,
 *      failed, canceled. "busy" is logged as busy and the rest as no answer,
 *      the closest words the table has for a line nobody picked up.
 *
 * A handset dial has none of these (nothing reports back through a tel:
 * link) and is never auto-logged. A row the carrier has not finished
 * reporting on ("not_reported") is not either — the caller asks again.
 *
 * Pure, and total. Executed by scripts/check-sales-call-panel.mjs against
 * every branch, with the fake status payloads the webhook would have sent.
 *
 * @returns {{ code: string|null, reason: string, talkSeconds: number|null }}
 */
export function autoLogOutcome(row) {
  if (!row || typeof row !== "object") return { code: null, reason: "no_row", talkSeconds: null };
  if (row.disposition) return { code: null, reason: "already_logged", talkSeconds: null };
  // An inbound row is never logged while live: the rep who picked up is asked
  // in the dock (IncomingCallDock.js), and a missed one is dayEndOutcome's.
  // Said by name rather than falling into "handset", which is a different
  // fact — a handset dial has no carrier data; an inbound row may have plenty.
  if (row.direction === "in" || row.dialChannel === "inbound") return { code: null, reason: "inbound", talkSeconds: null };
  if (row.dialChannel !== "browser") return { code: null, reason: "handset", talkSeconds: null };

  const answered = when(row.answeredAt);
  const ended = when(row.endedAt);
  const status = typeof row.providerStatus === "string" ? row.providerStatus : null;
  const terminal = status ? PROVIDER_ENDED.includes(status) : false;

  if (!answered && terminal && status !== "completed") {
    // Never connected. The rep's own Hang up while it was still ringing
    // (Twilio: "canceled") is not a conversation either; the owner's rule
    // is that nothing unanswered is ever put in front of the rep.
    return { code: status === "busy" ? "busy" : "no_answer", reason: status, talkSeconds: null };
  }

  if (row.hungUpBy === HUNG_UP_BY_REP) {
    // The rep pressed the button on a connected call. They were there;
    // they say what happened.
    return { code: null, reason: "rep_hung_up", talkSeconds: talkOf(row, answered, ended) };
  }

  if (answered) {
    // Connected. Only the carrier's end stamp (or its duration) closes it —
    // the browser's disconnect alone would read a dropped WebRTC leg as a
    // hang-up while the prospect is still saying hello.
    const talk = talkOf(row, answered, ended);
    if (talk === null) return { code: null, reason: "not_reported", talkSeconds: null };
    if (talk < AUTO_LOG_MAX_TALK_SECONDS) return { code: "hung_up", reason: "prospect_hung_up", talkSeconds: talk };
    return { code: null, reason: "talked", talkSeconds: talk };
  }

  // Not answered and not terminal: the carrier has not finished. Or
  // "completed" with no answered stamp: the "answered" event was missed and
  // nobody can say whether anyone spoke. Either way, not yet.
  return { code: null, reason: "not_reported", talkSeconds: null };
}

/**
 * The day-end verdict on a row nobody wrote up, by DIRECTION. Pure, total,
 * always a code — the cron (store.js autoLogStale) never leaves a row empty
 * past the rep's day, and this is the one place that decides which word.
 *
 *   out  — the line's own verdict (autoLogOutcome), else no_answer: "not
 *          reached", the closest word the table has for a call FieldQuo
 *          placed and cannot account for.
 *   in   — answered (the carrier's answeredAt, or a rep's claim in
 *          answeredByRepId) → reached, or hung_up when the carrier measured
 *          under AUTO_LOG_MAX_TALK_SECONDS of talk; not answered → missed.
 *          NEVER no_answer: on an inbound row that would say the contractor
 *          did not pick up, when it was FieldQuo that did not.
 *
 * @returns {{ code: string, reason: string }}
 */
export function dayEndOutcome(row) {
  if (!row || typeof row !== "object") return { code: "no_answer", reason: "no_row" };
  if (row.direction !== "in" && row.dialChannel !== "inbound") {
    const verdict = autoLogOutcome(row);
    return { code: verdict.code || "no_answer", reason: verdict.code ? verdict.reason : "unwritten_outbound" };
  }
  const answered = when(row.answeredAt);
  const claimed = typeof row.answeredByRepId === "string" && row.answeredByRepId.length > 0;
  if (!answered && !claimed) return { code: "missed", reason: "inbound_unanswered" };
  const talk = talkOf(row, answered, when(row.endedAt));
  if (talk !== null && talk < AUTO_LOG_MAX_TALK_SECONDS) return { code: "hung_up", reason: "inbound_short" };
  return { code: "reached", reason: "inbound_answered" };
}

function talkOf(row, answered, ended) {
  // Null is "not measured", and Number(null) is 0 — the exact collapse the
  // schema's comment on talkSeconds forbids. Only a number is a number.
  const n = typeof row?.talkSeconds === "number" ? row.talkSeconds : NaN;
  if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  if (answered && ended) return Math.max(0, Math.floor((ended.getTime() - answered.getTime()) / 1000));
  return null;
}

/**
 * "They hung up · 4 s" — the sentence a call row prints about how it ended.
 * A key and its values; the screen translates. Null when nothing is known.
 */
export function endOfCall(row) {
  if (!row || typeof row !== "object") return null;
  const talk = talkOf(row, when(row.answeredAt), when(row.endedAt));
  if (row.hungUpBy === HUNG_UP_BY_PROSPECT) return { key: "app.salesCall.ended.prospect", talkSeconds: talk };
  if (row.hungUpBy === HUNG_UP_BY_REP) return { key: "app.salesCall.ended.rep", talkSeconds: talk };
  const status = typeof row.providerStatus === "string" ? row.providerStatus : null;
  if (status === "busy") return { key: "app.salesCall.ended.busy", talkSeconds: null };
  if (status === "no-answer") return { key: "app.salesCall.ended.noAnswer", talkSeconds: null };
  if (status === "failed" || status === "canceled") return { key: "app.salesCall.ended.failed", talkSeconds: null };
  return null;
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
