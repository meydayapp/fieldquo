// lib/sales/calls/inboundDistribution.js
//
// Who a call arriving on FieldQuo's sales line should ring.
//
// ══ What was there before ═════════════════════════════════════════════════
//
// One environment variable. `inboundPlan` could forward a call to
// FIELDQUO_SALES_TRANSFER_TO and to nothing else, so a contractor ringing back
// the number a rep had called them from was answered, told there was nobody
// free, and hung up on — while the rep who rang them sat in the console with a
// registered Twilio Device and an available presence row.
//
// The owner tested it with his own phone, heard eleven seconds of that, and
// pointed out that he had handed over two contact-centre codebases and got the
// outbound half. He was right. This is the half that was missing.
//
// ══ The order, and why it is this order ═══════════════════════════════════
//
//   1. THE ASSIGNED REP. If the number belongs to somebody, it rings them —
//      that is the whole reason a rep wants their own number, and a callback
//      reaching anyone else defeats it. Rung even if presence says they are
//      on a call: their browser decides whether to show a second call, and
//      "the person you were speaking to is ringing you" is worth interrupting
//      for.
//   2. WHOEVER IS AVAILABLE. On a shared line, or when the assigned rep does
//      not pick up, ring the reps whose own presence says available and whose
//      heartbeat is not stale. Longest-idle first, so one rep does not take
//      every call while another sits idle.
//   3. THE TRANSFER NUMBER. FIELDQUO_SALES_TRANSFER_TO, unchanged. A real
//      phone somebody carries, for when nobody is at a desk.
//   4. NOBODY. Say so, take a message, and log it. Never a silent hang-up.
//
// ══ Presence is a claim, not proof ════════════════════════════════════════
//
// A rep marked available whose browser closed an hour ago is not available,
// which is why agentState has PRESENCE_STALE_MINUTES at all. A stale row is
// skipped here rather than rung: Twilio would spend twenty seconds ringing a
// dead client while a contractor listens to silence, and the fallback that
// should have caught it never runs.
//
// ══ The shape, which is not negotiable ════════════════════════════════════
//
// Rows arrive exactly as presenceFor() emits them — `{ salesRepId, presence }`,
// with the state NESTED under `presence`, the same shape anyRepLive() reads.
// This module first read `row.state` flat, which is undefined on every real
// row: `reachable` then answered false for everybody, and steps 2 and 3 below
// were dead code that no unit test could notice, because the test built the
// rows it wanted rather than the rows the caller sends. So the check now
// builds them with livePresence(), the real producer — if that shape moves,
// the check breaks rather than the phone.
//
// ══ A Quebec caller rings only reps with French ═══════════════════════════
//
// The owner's rule for the queue — a Quebec lead goes only to a rep whose
// sellsIn carries French (lib/sales/leadLanguage.js) — binds the phone too:
// a contractor in Laval ringing back is the same person the queue would not
// have handed to an anglophone rep, and answering them in English is the
// same failure with a worse first impression. So when `needsFrench` is set
// (a Quebec area code on the caller, or a matched prospect in QC), every rep
// target — the number's owner, the last caller, the available sweep — is
// kept only if their id is in `frenchRepIds`. The transfer number is a real
// phone, not a rep, and is kept. If that leaves nobody, the plan is empty
// and the route falls through to the hold queue and voicemail exactly as it
// does when nobody is signed in; never a silent drop. The say-lines are
// language-neutral already and are left alone.
//
// Pure over rows the caller has already read, so scripts/check-inbound-
// distribution.mjs can drive every branch without a database or a phone.
import { repIdentity } from "./browserDial";
import { PRESENCE_STALE_MINUTES, STATE_AVAILABLE } from "./agentState";

/** How long Twilio rings one destination before moving to the next. */
export const RING_SECONDS = 20;

/** How many reps we will ring before giving up and taking a message. */
export const MAX_RING_TARGETS = 3;

/**
 * Is this presence row somebody a call can actually reach?
 *
 * `available` AND heard from recently. The second half is the one that matters:
 * a row saying available whose browser died is the state that eats twenty
 * seconds of a contractor's patience and then reports "no answer".
 */
export function reachable(presence = {}, now = new Date()) {
  if (!presence || presence.state !== STATE_AVAILABLE) return false;
  // livePresence has already worked this out against the same constant. Trust
  // it when it says stale rather than second-guessing it — two answers to one
  // question is how the floor board and the router come to disagree.
  if (presence.stale === true) return false;
  const seen = presence.lastSeenAt ? new Date(presence.lastSeenAt) : null;
  if (!seen || Number.isNaN(seen.getTime())) return false;
  return now.getTime() - seen.getTime() <= PRESENCE_STALE_MINUTES * 60 * 1000;
}

/**
 * The presence object out of one presenceFor() row.
 *
 * One line, but it is the line that was missing: reading `row.state` off a row
 * whose state lives at `row.presence.state` is silently false for everybody.
 */
export function presenceOf(row) {
  return row && typeof row === "object" ? row.presence || null : null;
}

/**
 * The ring plan for one inbound call.
 *
 * @param assignedRepId  the rep the DIALLED NUMBER belongs to, or null when it
 *                       is a shared line.
 * @param presence       rows exactly as presenceFor() returns them —
 *                       `[{ salesRepId, presence: { state, lastSeenAt, … } }]`,
 *                       or null when the presence store is not ready. The
 *                       caller reads them; this ranks them.
 * @param lastCalledBy   the rep who most recently rang THIS caller, from the
 *                       call log. A contractor ringing back should reach the
 *                       person who rang them even on a shared line — the call
 *                       log already knows, and it needs no assignment column.
 * @param transferTo     FIELDQUO_SALES_TRANSFER_TO, normalised, or null.
 * @param needsFrench    true when the caller has to be answered in French —
 *                       lib/sales/leadLanguage.js's inboundNeedsFrench() on
 *                       their number, or requiredLanguageFor() on the row
 *                       they matched. Filters every rep target by
 *                       `frenchRepIds`; the transfer number is exempt.
 * @param frenchRepIds   the ids of reps whose sellsIn carries "fr", read by
 *                       the caller. Ignored unless `needsFrench`.
 * @param now            injectable, so staleness is executable.
 *
 * @returns {{ targets: Array<{kind:"client"|"number", value:string, salesRepId:string|null, why:string}>,
 *             ringSeconds:number, reason:string }}
 *          `targets` in the order they should be tried. Empty means nobody,
 *          and `reason` says which of the four cases that is.
 */
export function ringPlan({
  assignedRepId = null,
  presence = [],
  lastCalledBy = null,
  transferTo = null,
  needsFrench = false,
  frenchRepIds = [],
  // The other direction of the same rule (lib/sales/leadLanguage.js is
  // symmetric since 2026-09-12): an English call — a caller outside Quebec —
  // rings only reps who sell in English, so a French-only rep is not handed
  // an Ontario contractor on the phone any more than in the queue.
  needsEnglish = false,
  englishRepIds = [],
  now = new Date(),
} = {}) {
  const rows = Array.isArray(presence) ? presence : [];
  const byId = new Map(rows.filter((p) => p?.salesRepId).map((p) => [p.salesRepId, presenceOf(p)]));
  const targets = [];
  const seen = new Set();
  const french = new Set(
    (Array.isArray(frenchRepIds) ? frenchRepIds : []).filter((id) => typeof id === "string" && id),
  );
  const english = new Set(
    (Array.isArray(englishRepIds) ? englishRepIds : []).filter((id) => typeof id === "string" && id),
  );
  /** Whether the language rule lets this rep be rung at all. */
  const mayRing = (salesRepId) =>
    (!needsFrench || french.has(salesRepId)) && (!needsEnglish || english.has(salesRepId));

  /** Add a rep once, as a browser client. */
  const pushRep = (salesRepId, why) => {
    if (!salesRepId || seen.has(salesRepId)) return;
    // The rule sits in the one function every step goes through, so no
    // step — owner, last caller, sweep — can forget it.
    if (!mayRing(salesRepId)) return;
    const identity = repIdentity(salesRepId);
    // repIdentity refuses an id outside Twilio's identity character set rather
    // than mangling one into a string that resolves to a different rep.
    if (!identity) return;
    seen.add(salesRepId);
    targets.push({ kind: "client", value: identity, salesRepId, why });
  };

  // 1. The number's owner. Rung whatever their presence says — see the header.
  if (assignedRepId) pushRep(assignedRepId, "this is their number");

  // 2. Whoever rang this caller last. On a shared line this is the closest
  //    thing to an owner there is, and it costs no column.
  if (lastCalledBy && reachable(byId.get(lastCalledBy), now)) {
    pushRep(lastCalledBy, "they rang this contractor last");
  }

  // 3. Everybody else who is genuinely available, longest idle first so one
  //    rep does not take every call while another sits waiting.
  const free = rows
    .filter((p) => reachable(presenceOf(p), now) && !seen.has(p.salesRepId))
    .sort((a, b) => new Date(presenceOf(a)?.lastSeenAt) - new Date(presenceOf(b)?.lastSeenAt));
  for (const p of free) {
    if (targets.length >= MAX_RING_TARGETS) break;
    pushRep(p.salesRepId, "available");
  }

  // 4. A real phone, when there is one. Always last: a browser that rings is
  //    answered by somebody already looking at the prospect's record.
  if (transferTo && targets.length < MAX_RING_TARGETS) {
    targets.push({ kind: "number", value: transferTo, salesRepId: null, why: "the standing transfer number" });
  }

  const reason = targets.length
    ? assignedRepId && targets[0]?.salesRepId === assignedRepId
      ? "assigned"
      : targets[0]?.kind === "number"
        ? "transfer_only"
        : "available"
    : needsFrench && rows.some((p) => reachable(presenceOf(p), now))
      // Somebody was free and the language rule kept them off the plan. Its
      // own reason so the log says "no French rep" rather than "nobody free"
      // when the owner asks why a Quebec caller reached voicemail at noon.
      ? "nobody_french"
      : rows.length
        ? "nobody_free"
        : "nobody_signed_in";

  return { targets: targets.slice(0, MAX_RING_TARGETS), ringSeconds: RING_SECONDS, reason, needsFrench: Boolean(needsFrench) };
}

/**
 * What the caller hears when nobody can be rung.
 *
 * Never a silent hang-up, and never "your call is important to us". It says
 * what happened and what will happen, because the person on the line rang a
 * number a human gave them and deserves to know whether anybody will call back.
 */
export function noAnswerSay({ repName = null } = {}) {
  return repName
    ? `Sorry, ${repName} is not free right now. Leave your name and number after the tone and they will ring you back.`
    : "Sorry, there is nobody free right now. Leave your name and number after the tone and somebody will ring you back.";
}
