// lib/sales/calls/inboundRouting.js
//
// A contractor rings back one of the numbers a rep called them from. What
// happens next, decided here and performed by app/api/rep-dial/inbound.
//
// ══ Why this is a second module beside inboundMatch.js ════════════════════
//
// inboundMatch.js answers "who is this", and its header is emphatic that it
// answers nothing else: "matchOutcome() returns only facts and never an
// action, which is what makes that enforceable rather than a comment". Adding
// a routing decision to it would put an action on the same object as the
// identification, which is precisely the shape it refuses to have. So the
// identification stays there, the routing lives here, and the route composes
// the two.
//
// `inboundHandling()` in that file is a THIRD thing again and is deliberately
// left alone: it describes what happens on FIELDQUO_SALES_NUMBER, the single
// line the Retell agent answers, for a superadmin reading the floor board. The
// sales_voice POOL is a different set of numbers with no agent on it at all.
//
// ══ Pure, and every input arrives as an argument ══════════════════════════
//
// No database, no environment, no vendor. That is what lets
// scripts/check-sales-inbound-call.mjs execute every branch — a withheld
// caller ID, a number we do not own, a rep who left, an empty floor, a
// suppressed caller, a transfer destination that is not set — instead of
// reading the route and agreeing with it.
//
// ══ THE CALLING WINDOW DOES NOT APPLY HERE, AND THAT IS DELIBERATE ════════
//
// lib/sales/callingRules.js governs when FieldQuo may RING a business. A
// business ringing FieldQuo has chosen the moment, and refusing to answer at
// 21:00 because Oklahoma's solicitation statute closes at 20:00 would be
// reading the rule backwards — it would refuse a prospect who is trying to
// buy. docs/sales-intel/CALL-HANDLING.md §6 says this in the same words. So
// nothing in this file imports salesCallReadiness, and
// scripts/check-sales-inbound-call.mjs asserts that the inbound route does not
// either.
//
// A CALLBACK is the opposite case and is not in this file: placing one is an
// outbound call and goes through salesCallReadiness like every other. Which is
// exactly why nothing here promises one — see `say` below.
//
// ══ SalesSuppression still binds, and answering is not a breach of it ═════
//
// A caller on the do-not-contact list who rings US is answered: the list
// records that FieldQuo may not initiate contact, not that FieldQuo may hang
// up on them. What it does mean is that the call is not an opening to sell,
// and that nothing on this path may clear the entry. So `suppressed` travels
// on the plan for the route to log and for the floor board to show, it removes
// nothing, and the spoken lines below carry no pitch in either case — there is
// no branch where a suppressed caller hears a softer version of a sales
// message, because there is no sales message.

import { REP_STATES } from "./agentState";

/** What the route should do with the call. A closed vocabulary. */
export const INBOUND_NOT_OURS = "not_ours";
export const INBOUND_UNAVAILABLE = "unavailable";
export const INBOUND_CONNECT = "connect";
export const INBOUND_MESSAGE = "message";

export const INBOUND_ACTIONS = Object.freeze([
  INBOUND_NOT_OURS,
  INBOUND_UNAVAILABLE,
  INBOUND_CONNECT,
  INBOUND_MESSAGE,
]);

/**
 * How long the transfer leg may ring before the caller hears the message.
 *
 * Shorter than the 30s an outbound dial waits (browserDial.js's callPlan) and
 * for the opposite reason: there, the person being rung may be up a ladder and
 * the rep can wait. Here the caller is already holding, and twenty seconds of
 * ringback before an honest "nobody picked up" is about the limit of what a
 * person will sit through before deciding the number is dead.
 */
export const TRANSFER_RING_SECONDS = 20;

/**
 * Was this rep reachable at the moment the call arrived?
 *
 * Takes a livePresence() result — the ONE presence model there is. There is
 * deliberately no second notion of "on the floor" in this file: agentState.js
 * already decides what live means and what stale means, and a second opinion
 * here would let the floor board and the phone disagree about whether anybody
 * is working.
 *
 * `null` presence is not "nobody". It is "we could not ask", and it is treated
 * as reachable below for the reason AGENTS.md failure class 5 gives: absence
 * of a statement is not a statement, and the cost of trying a number nobody is
 * at is twenty seconds of ringing, while the cost of not trying is the call.
 */
export function repIsLive(presence) {
  if (!presence || typeof presence !== "object") return null;
  if (!presence.everSeen) return false;
  if (presence.stale) return false;
  return Boolean(REP_STATES[presence.state]?.live);
}

/**
 * Is anybody on the floor?
 *
 * Takes the array presenceFor() returns — `[{ salesRepId, presence }]`. One
 * implementation rather than two, because the sentence the floor board prints
 * ("Nobody is on the floor right now") and the decision the phone takes have
 * to be the same statement or a superadmin is reading a board that disagrees
 * with what a caller experienced ninety seconds ago.
 *
 * `null` in, `null` out: presenceFor() returns null when the presence tables
 * are absent, and that is not an empty floor.
 */
export function anyRepLive(rows) {
  if (!Array.isArray(rows)) return null;
  return rows.some((row) => repIsLive(row?.presence) === true);
}

function firstName(name) {
  const s = typeof name === "string" ? name.trim() : "";
  if (!s) return null;
  return s.split(/\s+/)[0] || null;
}

/**
 * What a caller hears when nobody takes the call.
 *
 * ══ ONE builder, because the message is spoken from two places ════════════
 *
 * The route answers Twilio twice: once to decide what to do with the call, and
 * again after a transfer leg nobody picked up. Both end in this sentence, and
 * two copies of it would drift the first time somebody edited the branch they
 * happened to be looking at — AGENTS.md failure class 4, out loud, to a
 * prospect.
 *
 * ══ It does NOT promise a callback ════════════════════════════════════════
 *
 * "We'll call you back" is the obvious line and it is the one thing this must
 * not say. A callback is an OUTBOUND call: it has to clear the calling window
 * for the contractor's jurisdiction, the do-not-contact flag and the per-24h
 * cap, and a caller on SalesSuppression must not be told one is coming at all.
 * None of that can be promised from inside an inbound webhook, and a promise
 * the system will not keep is the dead control AGENTS.md opens with, in audio.
 *
 * What it CAN claim is that the call was written down, because it was: the
 * attempt row exists before this is spoken. A rep is named only when the row
 * carries their id, because that is what puts it on their own screen.
 */
export function fallbackSayFor({ repName = null } = {}) {
  const who = firstName(repName);
  return [
    "Thanks for calling back.",
    "There is nobody free to pick up right now.",
    who
      ? `We have logged your call for ${who}, who called you from this number.`
      : "We have logged your call.",
    "You can also reach us through the contact form on our website.",
  ];
}

/**
 * The whole decision, as data.
 *
 * @param numberRung   the PlatformSmsNumber row for the number that was
 *                     dialled, already filtered to purpose "sales_voice" and
 *                     active — or null, which is the case where somebody has
 *                     pointed a number at this webhook that FieldQuo does not
 *                     hold for this purpose.
 * @param storeReady   callStoreState().ready. False means the attempt cannot
 *                     be recorded, and a call that leaves no trace is the one
 *                     thing this feature exists to end, so it is said out loud
 *                     rather than answered as though it were fine.
 * @param fromE164     the caller, normalised, or null when withheld.
 * @param match        matchInboundCaller()'s result.
 * @param rep          { id, name, active } for the rep to attribute this to,
 *                     or null. WHICH rep that is is decided by the caller from
 *                     rows it read — see the route.
 * @param anyRepLive   true / false / null across the floor. Null means the
 *                     presence tables could not be read, NOT that it is empty.
 * @param transferTo   FIELDQUO_SALES_TRANSFER_TO, normalised, or null.
 * @param suppressed   is this caller on SalesSuppression for phone?
 */
export function inboundPlan({
  numberRung = null,
  storeReady = true,
  fromE164 = null,
  match = null,
  rep = null,
  anyRepLive = null,
  transferTo = null,
  suppressed = false,
} = {}) {
  const base = {
    // Recording is OFF on every branch, and there is no parameter that turns
    // it on. lib/sales/calls/browserDial.js's callPlan makes the argument for
    // the outbound leg and it applies here unchanged: recording a two-party
    // call is consent law, several of the states callingRules.js already
    // enumerates are all-party-consent, and a disclosure has to be played and
    // the consent stored before a single second may be kept. Shipping the
    // parameter first produces recordings nobody may listen to.
    //
    // A VOICEMAIL is a different question — a message left to a machine after
    // an announcement — and it is not built either, for a plainer reason: the
    // recording would have somewhere to be written and nowhere to be read.
    // There is no playback surface, no retention rule and no proxy for
    // Twilio's media URLs, and a `voicemailUrl` column nothing reads is
    // AGENTS.md failure class 1. See the report accompanying this change.
    record: false,
    suppressed: Boolean(suppressed),
    transferTo: null,
    timeoutSeconds: 0,
    rep: rep && rep.id ? { id: rep.id, name: rep.name || null } : null,
    matchOutcome: match?.outcome || null,
  };

  if (!numberRung || !numberRung.e164) {
    return {
      ...base,
      action: INBOUND_NOT_OURS,
      reason: "not_a_sales_voice_number",
      // Said rather than dropped. A silent hangup on a number a contractor was
      // given reads as a dead line, and the person who has to debug this is a
      // superadmin reading /platform/errors — who needs the call to have made
      // a noise somewhere.
      say: ["Sorry — this number is not in service. Please try the number on our website."],
      recordAttempt: false,
    };
  }

  if (!storeReady) {
    return {
      ...base,
      action: INBOUND_UNAVAILABLE,
      reason: "call_store_unavailable",
      say: [
        "Thanks for calling back.",
        "We are not able to take your call at the moment. Please try again shortly.",
      ],
      recordAttempt: false,
    };
  }

  // A rep is only named when the row will actually reach them: an inbound
  // attempt carrying their id shows up as their unlogged call on their own
  // console. With no rep the row is still written and still visible on the
  // superadmin floor board, so the message drops the name and claims nothing
  // more than that the call was noted.
  const fallbackSay = fallbackSayFor({ repName: base.rep?.name || null });

  const to = typeof transferTo === "string" && transferTo.startsWith("+") ? transferTo : null;

  if (!to) {
    return {
      ...base,
      action: INBOUND_MESSAGE,
      reason: "no_transfer_destination",
      say: fallbackSay,
      recordAttempt: true,
    };
  }

  // ── Ring the desk, unless the floor has said it is empty ───────────────
  //
  // `anyRepLive === false` is a positive statement made by the reps
  // themselves — every one of them signed out or never signed in — and it is
  // the same statement the floor board already prints beside this line
  // ("Nobody is on the floor right now… the transfer will not find
  // anybody"). Ringing anyway would spend twenty seconds of a prospect's
  // patience on a phone we have been told nobody is at.
  //
  // `null` goes the other way and rings: that is the presence tables being
  // unreadable, not an empty floor.
  //
  // What deliberately does NOT gate this is the MATCHED rep's own presence.
  // agentState.js is explicit that every state is DECLARED rather than
  // measured, and the transfer destination is one fixed number rather than
  // that rep's handset — refusing to ring a desk because one person has not
  // pressed "available" would refuse a prospect on the strength of a button.
  if (anyRepLive === false) {
    return {
      ...base,
      action: INBOUND_MESSAGE,
      reason: "floor_empty",
      say: fallbackSay,
      recordAttempt: true,
    };
  }

  return {
    ...base,
    action: INBOUND_CONNECT,
    reason: anyRepLive === null ? "transfer_presence_unknown" : "transfer_floor_live",
    transferTo: to,
    timeoutSeconds: TRANSFER_RING_SECONDS,
    // Nothing is spoken before the transfer. A greeting delays the ring by the
    // length of the greeting, and the caller already knows who they rang —
    // they are ringing back a number that called them.
    say: [],
    // What they hear if nobody picks the transfer up. Carried on the plan
    // rather than recomputed by the second webhook leg, so the two cannot
    // drift into saying different things about the same call.
    fallbackSay,
    recordAttempt: true,
  };
}

/**
 * The path a Twilio voice webhook must be pointed at, for one deployment.
 *
 * A function rather than a constant string in the route, so the sentence a
 * superadmin copies out of the floor board and the path Next.js actually
 * serves cannot be two different things.
 */
export const INBOUND_WEBHOOK_PATH = "/api/rep-dial/inbound";

export function inboundWebhookUrl(origin) {
  const base = typeof origin === "string" ? origin.replace(/\/+$/, "") : "";
  return base ? `${base}${INBOUND_WEBHOOK_PATH}` : null;
}

/**
 * What actually happens when a contractor rings one of the sales_voice
 * numbers back — as a sentence the floor board prints verbatim.
 *
 * ══ Why this is NOT inboundMatch.js's inboundHandling() ═══════════════════
 *
 * That function describes FIELDQUO_SALES_NUMBER: one line, answered by the
 * Retell agent, with an optional cold transfer. This describes the POOL of
 * local numbers reps dial from, which has no agent on it and never will —
 * putting a conversational AI on a number whose entire purpose is that a
 * roofer recognises the area code would defeat the reason it was bought. Two
 * different phone systems, two different sentences; merging them would produce
 * one that is wrong about both.
 *
 * Three states, and the third exists for AGENTS.md failure class 5: "we hold
 * no numbers" and "we could not read the number list" are the same empty array
 * and different facts, so the caller says which it has.
 */
export function salesVoiceInboundState({
  numbers = [],
  lookupFailed = false,
  transferConfigured = false,
  anyLive = null,
  webhookUrl = null,
} = {}) {
  if (lookupFailed) {
    return {
      state: "unknown",
      count: null,
      webhookUrl,
      text: "Couldn't read FieldQuo's number list just now, so this can't say what a contractor ringing back would reach. Nothing has changed either way.",
      tone: "unknown",
    };
  }

  const held = (Array.isArray(numbers) ? numbers : []).filter(Boolean);
  if (held.length === 0) {
    return {
      state: "none",
      count: 0,
      webhookUrl,
      text: "FieldQuo holds no sales_voice numbers, so there is no number for a contractor to ring back and nothing to answer. Buy one under Crew lines with the purpose set to Sales voice.",
      tone: "gap",
    };
  }

  // Said even when the rest is healthy, because it is the one step that
  // happens in Twilio's console rather than in this product: a number that is
  // bought and not pointed here still rings out, and nothing in the database
  // can tell the difference. PlatformSmsNumber.voiceUrl records the intent and
  // is not proof — the same argument the crew inbound route makes for not
  // comparing its stored webhook URL.
  const pointAt = webhookUrl
    ? ` Each one must have its Voice webhook set to ${webhookUrl} in the Twilio console — a number that is bought and not pointed there still rings out.`
    : "";

  if (!transferConfigured) {
    return {
      state: "logged_only",
      count: held.length,
      webhookUrl,
      text: `${held.length} sales_voice ${held.length === 1 ? "number is" : "numbers are"} held. A contractor ringing one back is answered, told there is nobody free, and the call is logged against the rep who rang them. Nobody can be put through — FIELDQUO_SALES_TRANSFER_TO is unset.${pointAt}`,
      tone: "gap",
    };
  }

  if (anyLive === false) {
    return {
      state: "floor_empty",
      count: held.length,
      webhookUrl,
      text: `${held.length} sales_voice ${held.length === 1 ? "number is" : "numbers are"} held and a transfer destination is set, but nobody is on the floor right now. A contractor ringing back is answered and logged, and is not put through to a phone the floor has said nobody is at.${pointAt}`,
      tone: "gap",
    };
  }

  return {
    state: "connects",
    count: held.length,
    webhookUrl,
    text: `${held.length} sales_voice ${held.length === 1 ? "number is" : "numbers are"} held. A contractor ringing one back is put through to the transfer destination, and the call is logged against the rep who rang them either way.${pointAt}`,
    tone: anyLive === null ? "unknown" : "has",
  };
}

/**
 * Twilio's DialCallStatus values that mean a human took the call.
 *
 * `answered` is not in Twilio's vocabulary for this field and is absent on
 * purpose — inventing it would produce a branch that never runs.
 */
const DIAL_ANSWERED = new Set(["completed"]);

/**
 * What to do after the transfer leg ends.
 *
 * Split out as its own pure function because the interesting case is the one
 * that is easy to get wrong: `completed` with a duration of zero seconds is a
 * call that was answered and immediately hung up, which is still an answered
 * call, while `no-answer` with no duration at all is the caller still holding
 * and waiting to be told something. Returning `{ answered, say }` rather than
 * a boolean keeps the second case from being handled by falling off the end.
 */
export function afterTransfer({ dialCallStatus = null, plan = null } = {}) {
  const status = typeof dialCallStatus === "string" ? dialCallStatus : null;
  const answered = Boolean(status && DIAL_ANSWERED.has(status));
  return {
    answered,
    status,
    say: answered
      ? []
      : Array.isArray(plan?.fallbackSay) && plan.fallbackSay.length
        ? plan.fallbackSay
        : [
            "Thanks for calling back.",
            "There is nobody free to pick up right now, and we have logged your call.",
          ],
  };
}
