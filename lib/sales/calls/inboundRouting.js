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
 *
 * ── `everSeen`, deliberately not `everSignedIn` ──────────────────────────
 *
 * livePresence also reports whether the rep has ever opened the portal, which
 * is what the floor board needed to stop calling a working rep "never signed
 * in". It has no business here. Signing in is not a rep saying they are ready
 * for the next prospect, and routing on it would put somebody who opened a
 * browser tab this morning into the pool for a stranger's call.
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
  ringable = null,
} = {}) {
  const base = {
    // The CONVERSATION is recorded on every branch that connects one —
    // since 2026-09-17, the owner's decision; lib/sales/calls/recording.js
    // has the reasoning and the <Dial> attributes, and the rep's opening
    // carries the disclosure. `record` here is the plan's statement of that
    // fact: true whenever a rep is rung, so the check can assert that no
    // branch which connects two people forgets it. A branch that connects
    // nobody (suppressed, refused) has nothing to record and says false.
    //
    // A VOICEMAIL is the other audio — a message left to a machine after an
    // announcement — on its own columns: the queue's <Record> stage writes
    // it, app/api/rep-dial/inbound's after-voicemail stage attaches it.
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

  // ── No transfer number is NOT "take a message" ─────────────────────────
  //
  // This used to be `if (!to) return MESSAGE`. It was written when the desk
  // phone in FIELDQUO_SALES_TRANSFER_TO was the only thing a callback could
  // be put through to, and it was never removed when inboundDistribution.js
  // taught the route to ring reps' BROWSERS. The route checks this action
  // before it looks at the ring plan, so with the variable unset in
  // production — which it is, and always has been — every ring-back went
  // straight to the fallback sentence and the beep while the rep who had
  // just spoken to the caller sat in the console with a registered Device.
  // scripts/check-sales-inbound-call.mjs asserted that branch as correct,
  // which is how it survived: the check locked the bug in.
  //
  // On 2026-09-17 a contractor rang a rep back thirteen seconds after she
  // hung up, twice. Neither call rang her. This is the line that decided it.
  //
  // So the transfer number is now what its name says — one more thing to
  // ring, carried on the plan for ringPlan() to append — and its absence
  // changes nothing about whether the browsers ring. What DOES still take a
  // message without ringing is the floor saying it is empty, below.

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
  //
  // …unless the ring plan found a BROWSER to ring anyway. `ringable` is the
  // number of client targets inboundDistribution.js produced, and two of
  // its rules do not consult presence at all: the number's owner is rung
  // whatever their row says, and the rep who dialled this caller minutes
  // ago is rung on the strength of that dial (RECENT_CALLER_MINUTES). A rep
  // who rings from the console without ever pressing "Available" — the
  // 2026-09-17 case — leaves the floor reading empty while her Device is
  // registered and ringing-capable. So an empty floor with a ringable
  // target still rings, and says so with `floorEmpty`, which the route
  // uses to skip the hold queue if that ring fails: a floor that has said
  // it is empty is not a floor to keep a caller waiting on.
  if (anyRepLive === false && !(Number.isFinite(ringable) && ringable > 0)) {
    return {
      ...base,
      action: INBOUND_MESSAGE,
      reason: "floor_empty",
      say: fallbackSay,
      recordAttempt: true,
    };
  }
  const floorEmpty = anyRepLive === false;

  return {
    ...base,
    action: INBOUND_CONNECT,
    // Four reasons, not two, because "we rang because a desk phone is set"
    // and "we rang because somebody is at a browser" are different facts on
    // the floor board when a call goes wrong. `presence_unknown` is the
    // presence tables being unreadable — rung anyway, see above.
    reason: floorEmpty
      ? "floor_empty_ringable"
      : anyRepLive === null
        ? to
          ? "transfer_presence_unknown"
          : "presence_unknown"
        : to
          ? "transfer_floor_live"
          : "floor_live",
    floorEmpty,
    transferTo: to,
    // Two people are about to be connected: recorded (see `base`).
    record: true,
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
 * numbers back — as one short paragraph the floor board prints verbatim.
 *
 * ══ Why this is NOT inboundMatch.js's inboundHandling() ═══════════════════
 *
 * That function describes FIELDQUO_SALES_NUMBER: one line, answered by the
 * Retell agent. This describes the POOL of local numbers reps dial from,
 * which has no agent on it and never will — putting a conversational AI on a
 * number whose entire purpose is that a roofer recognises the area code
 * would defeat the reason it was bought.
 *
 * ══ Shortened on 2026-09-17, on the owner's verdict ═══════════════════════
 *
 * The block used to say that FIELDQUO_SALES_TRANSFER_TO was unset and what
 * that meant, and to carry the per-number webhook table beneath it. Since
 * the browsers ring whether or not a desk phone is configured, the transfer
 * sentences described a fallback nobody uses and read as a fault; the table
 * moved to /platform/crew-lines ("Sales number configuration"), read live
 * from Twilio by lib/sales/calls/numberConfig.js. What is left is the true
 * sentence, the count of numbers, and a warning line ONLY when a number is
 * misconfigured — `misconfigured` is that count, from the live audit.
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
  misconfigured = null,
  configUnknown = false,
} = {}) {
  if (lookupFailed) {
    return {
      state: "unknown",
      count: null,
      webhookUrl,
      text: "Couldn't read FieldQuo's number list just now, so this can't say what a contractor ringing back would reach. Nothing has changed either way.",
      warning: null,
      tone: "unknown",
    };
  }

  const held = (Array.isArray(numbers) ? numbers : []).filter(Boolean);
  if (held.length === 0) {
    return {
      state: "none",
      count: 0,
      webhookUrl,
      text: "FieldQuo holds no number a contractor can ring back, so nothing answers. Buy one under Crew lines with the purpose set to Sales — one number the team calls AND texts from — or Sales voice for a call-only number in another area code.",
      warning: null,
      tone: "gap",
    };
  }

  const bad = Number.isFinite(misconfigured) ? misconfigured : null;
  const pointed =
    bad === 0
      ? " all pointed here."
      : bad === null || configUnknown
        ? " configuration not checked just now."
        : ` ${bad} ${bad === 1 ? "is" : "are"} not pointed here.`;
  const count = `${held.length} ${held.length === 1 ? "number" : "numbers"} held;${pointed}`;
  const desk = transferConfigured ? " A standing desk phone rings after the browsers." : "";
  const warning =
    bad !== null && bad > 0
      ? `${bad} ${bad === 1 ? "number is" : "numbers are"} misconfigured at Twilio — a contractor ringing ${bad === 1 ? "it" : "one of them"} back may reach nothing, or the hang-up may go unrecorded. See Number configuration.`
      : null;

  if (anyLive === false) {
    return {
      state: "floor_empty",
      count: held.length,
      webhookUrl,
      text: `A contractor ringing back rings the number's owner and the last rep who called them, then anyone available; unanswered → held → voicemail.${desk} Nobody is on the floor right now, so a call would go to voicemail. ${count}`,
      warning,
      tone: "gap",
    };
  }

  return {
    state: "connects",
    count: held.length,
    webhookUrl,
    text: `A contractor ringing back rings the number's owner and the last rep who called them, then anyone available; unanswered → held → voicemail.${desk} ${count}`,
    warning,
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
