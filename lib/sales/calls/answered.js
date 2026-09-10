// lib/sales/calls/answered.js
//
// Who actually picked up an inbound call, and whether their claim is allowed.
//
// ══ The bug this exists to end ════════════════════════════════════════════
//
// An inbound SalesCallAttempt's `salesRepId` is written from the CALLER match
// in app/api/rep-dial/inbound — whoever last rang that contractor, or the
// claim holder, or null. That is written before the phone has rung once, and
// ringPlan then offers the call to up to three people at the same time. So the
// rep who ANSWERS a callback was never recorded as having answered it: the
// floor board, that rep's own call history and every report built on
// `salesRepId` credited the call to somebody who was not on it, or to nobody.
//
// It is also the reason a rep could not transfer an inbound call. The transfer
// route reads the attempt by `salesRepId: repId`, which for the rep holding
// the handset was usually a different rep's id.
//
// ══ Why the browser is asked at all ═══════════════════════════════════════
//
// Because nothing else knows. Twilio's `<Dial>` reports "somebody answered" on
// the parent leg when the call ENDS, and it reports the child leg's status on
// a callback this route does not receive. The one system that knows which of
// three ringing browsers pressed Pick up, at the moment it happens, is that
// browser.
//
// What the browser is NOT trusted with is the answer. It sends one CallSid; a
// CallSid alone is a claim. app/api/sales/calls/answered turns it into proof
// by reading the leg back from the carrier and checking it was rung AT THIS
// REP — `client:sales_rep:<their own id>` — before anything is written. That
// check is `legAnsweredBy` below, and it is the whole access control: a rep
// can only claim a leg Twilio agrees was placed to them.
//
// ══ Pure, over rows the caller has already read ═══════════════════════════
//
// The same shape as lib/sales/calls/inboundDistribution.js and for the same
// reason: scripts/check-inbound-transfer.mjs drives every branch — an unknown
// CallSid, an outbound attempt, a leg rung at another rep, an attempt a
// different rep already answered, a second claim by the same rep — with no
// database and no phone.
import { CLIENT_PREFIX, repIdentity } from "./browserDial";

/**
 * Is this a Twilio CallSid, or a string somebody typed?
 *
 * Checked before it reaches either the database or the carrier. Twilio's SIDs
 * are `CA` and 32 lower-case hex characters; anything else is refused here
 * rather than sent to Twilio, which answers a malformed SID with a 404 that is
 * indistinguishable from "that call does not exist".
 */
export function isCallSid(value) {
  return typeof value === "string" && /^CA[0-9a-f]{32}$/.test(value);
}

/**
 * The two ways one posted CallSid can name an inbound call.
 *
 * PARENT — the SID is the contractor's own inbound leg, which is what
 * `SalesCallAttempt.providerCallSid` holds.
 * CHILD — the SID is the leg Twilio placed to this rep's browser out of
 * `<Dial><Client>`. It is a call resource of its own whose `parentCallSid`
 * is the contractor's leg.
 *
 * Both exist because the Voice SDK hands the page `call.parameters.CallSid`
 * for an incoming call and that is the CHILD leg — the one addressed to
 * `client:sales_rep:<id>` — not the inbound call the contractor placed. The
 * parent case is kept as a fallback rather than deleted: a leg delivered some
 * other way (a future SDK, a `<Parameter>`-carried value) must not be
 * mis-filed, and knowing WHICH of the two arrived is what decides whether the
 * rep's own leg SID can be written down.
 */
export const LEG_PARENT = "parent";
export const LEG_CHILD = "child";

/**
 * Does this carrier leg belong to this rep?
 *
 * @param carrierTo  the `to` of the call resource read back from Twilio.
 * @param repId      the rep making the claim, from the session gate.
 * @returns true only when Twilio says the leg was placed to THIS rep's client
 *          identity. A number, another rep's identity, a missing value and a
 *          doubled `client:client:` prefix all answer false — the identity is
 *          rebuilt from the rep's own id and compared, never parsed out of the
 *          carrier's string and trusted.
 */
export function legAnsweredBy({ carrierTo = null, repId = null } = {}) {
  const identity = repIdentity(repId);
  if (!identity || typeof carrierTo !== "string") return false;
  return carrierTo === `${CLIENT_PREFIX}${identity}`;
}

/**
 * May this rep record themselves as having answered this call, and what does
 * that write?
 *
 * ── An answer never overwrites another answer ───────────────────────────
 *
 * `answeredByRepId` being null is the only state in which a claim is allowed.
 * A row that already names somebody refuses, and says who — the rejected
 * alternative was to let the newest claim win, which on the race where two
 * browsers accept in the same second files the call against whichever HTTP
 * request happened to arrive second. That is decided by network jitter and is
 * invisible in the data afterwards; a refusal is at least legible, and the
 * second rep's screen can say the call is not theirs rather than offer them a
 * transfer control over somebody else's caller.
 *
 * A repeat claim by the SAME rep is allowed and idempotent: a dock that
 * reconnects mid-call, or a double-press, must not be told the call belongs to
 * a stranger.
 *
 * ── Outbound rows are refused ───────────────────────────────────────────
 *
 * An outbound attempt already names the rep who placed it, in the only column
 * that can name one, and nothing about a dial is in doubt. Writing an answer
 * onto one would let a rep move another rep's outbound call onto themselves,
 * which is the widest thing this route could possibly do.
 *
 * @param attempt   the SalesCallAttempt row, already read.
 * @param repId     the claiming rep.
 * @param legSid    the rep's OWN leg, when the posted SID turned out to be the
 *                  child. Null when the parent arrived instead — see below.
 * @returns `{ ok, reason, data, transferable }`. `data` is the update, and it
 *          is deliberately the whole update rather than a set of flags: the
 *          store writes what this returns and decides nothing.
 */
export function claimAnswer({ attempt = null, repId = null, legSid = null } = {}) {
  const no = (reason) => ({ ok: false, reason, data: null, transferable: false });

  if (!attempt || typeof attempt !== "object") return no("There is no call to answer.");
  if (typeof repId !== "string" || !repId) return no("There is no rep to attribute this to.");
  if (attempt.direction !== "in") {
    return no("That is a call you placed, not one you answered.");
  }
  const held = typeof attempt.answeredByRepId === "string" ? attempt.answeredByRepId : null;
  if (held && held !== repId) {
    return no("Somebody else picked that call up.");
  }

  // ── Why the rep's leg is written here and not by a webhook ────────────
  //
  // The transfer machinery cannot move a call without it: `repCallSid` is the
  // leg put back with the caller when a transfer target does not answer, and
  // released when one does. On an OUTBOUND call /api/rep-dial/bridge writes it
  // from the CallSid Twilio posts. There is no equivalent webhook on the
  // inbound path — the leg Twilio places to `<Client>` fetches no TwiML of
  // ours — so this is the only moment it becomes knowable, and it is written
  // only after the carrier has confirmed the leg was rung at this rep.
  //
  // Not overwritten once set: a redelivered claim carrying no leg must not
  // erase one that is already there and is holding a live transfer together.
  const data = { answeredByRepId: repId, salesRepId: repId };
  if (legSid) data.repCallSid = legSid;

  return {
    ok: true,
    reason: null,
    data,
    // Whether this call could be handed on, said in the same answer the dock
    // acts on. Both legs have to exist: the contractor's, which the inbound
    // webhook wrote, and the rep's, which is either arriving in this request
    // or was already on the row. A false here removes the transfer control
    // rather than greying it — see AGENTS.md's first rule.
    transferable: Boolean(attempt.providerCallSid) && Boolean(legSid || attempt.repCallSid),
  };
}
