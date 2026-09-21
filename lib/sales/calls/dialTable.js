// lib/sales/calls/dialTable.js
//
// The calls table on /platform/sales/performance and /sales/agency/
// performance: one row per rep, ONE denominator, every column naming its
// source.
//
// ══ 2026-09-21: "the data seems to be all over the place" ═════════════════
//
// The owner's verdict on the first version, and he was right about why.
// Three different denominators sat in one row — "of N bridged", "over N
// calls", the disposition's "logged" — and a reader could not subtract one
// column from another. Worse, an earlier measurement had been done BY LINE
// at Twilio: the From number. lib/sales/calls/callerId.js's chooseCallerId
// picks the line nearest the prospect, so Umar's and Favor's calls went out
// from Rachel's 438 and Jesus's 716 lines, and a by-line count put their
// work on other people's rows.
//
// So, the rules this file keeps:
//
//   1. Attribution is by ATTEMPT — the SalesCallAttempt row, which carries
//      the rep — joined to Twilio by the CHILD call sid stored on it
//      (`providerCallSid`, the <Dial><Number> leg to the prospect). Never by
//      the From number. A row with no child sid is not joined and is counted
//      as `unverified`, never guessed into a bucket.
//   2. One denominator: DIALS = attempts to a prospect that carry a prospect
//      leg. Every rate in the row is over it.
//   3. Every column says where it comes from: Twilio (the child leg's
//      status and duration), the rep's write-up (the disposition), or the
//      transcript. When the carrier's data is missing for rows in the
//      period, the Twilio columns say "carrier data missing since <date>" in
//      red rather than falling back to some other column's meaning.
//   4. Talk minutes are the PROSPECT leg's connected seconds, on answered
//      calls only — never ringing time, never the rep's browser leg.
//
// Pure. scripts/check-sales-costs.mjs executes it against every row shape.
import { rate } from "../performance";
import { dispositionFor } from "./dispositions";
import { PICKUP_MIN_SECONDS, CONVERSATION_MIN_SECONDS, pickupBand, measuredConversation } from "./conversation";
import { callbackState, isOutbound } from "./reporting";

/** Twilio's final statuses — a leg with one of these has been reported on. */
const FINAL = new Set(["completed", "busy", "no-answer", "failed", "canceled"]);

/**
 * The columns, in order, each with its source. The screen prints the
 * source word under the header; the owner's plain words for each column
 * and its one-line meaning live in the pages' labels (nine languages on
 * the agency page). No abbreviation like "<20s" appears anywhere: the
 * buckets are "Nobody answered", "Hung up fast", "Voicemail or brief" and
 * "Real conversation", and the seconds are in the meaning line.
 */
export const COLUMN_SOURCES = Object.freeze({
  dials: "twilio",
  nobodyAnswered: "twilio",
  hungUpFast: "twilio",
  voicemailOrBrief: "twilio",
  realConversation: "transcript_or_twilio",
  reached: "rep",
  callbacks: "rep",
  minutesTalking: "twilio",
  gap: "derived",
});

function when(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Is this attempt joined to the carrier: does it carry the prospect leg's
 * sid AND that leg's final status? A sid with no status is a leg Twilio
 * has not reported on (or a dropped callback the reconcile has not yet
 * fetched) — it is a dial, but its Twilio columns are missing.
 */
export function joinState(row) {
  if (!row) return "no_leg";
  if (!row.providerCallSid) return "no_leg";
  if (!FINAL.has(row.providerStatus)) return "leg_unreported";
  return "joined";
}

/**
 * One rep's row (or everyone's), over the attempts they PLACED in the period.
 *
 * @param attempts   SalesCallAttempt rows, already scoped to the rep and the
 *                   period and already without test dials
 * @param now        for the callbacks-promised state
 */
export function dialTableRow(attempts = [], { now = new Date() } = {}) {
  const placed = (Array.isArray(attempts) ? attempts : []).filter(isOutbound);
  const withLeg = placed.filter((r) => joinState(r) !== "no_leg");
  const joined = withLeg.filter((r) => joinState(r) === "joined");
  const unreported = withLeg.filter((r) => joinState(r) === "leg_unreported");
  const noLeg = placed.filter((r) => joinState(r) === "no_leg");

  // The denominator: dials to a prospect that carry a prospect leg.
  const dials = withLeg.length;

  // Twilio's columns, over the joined rows only. A leg with no final
  // status has no pickup to report, and counting it as "not picked up"
  // would be the fallback rule 3 forbids.
  //
  // Each joined dial lands in exactly one of four buckets, so the four sum
  // to the joined dials and a stacked bar of them is the whole row. "Real
  // conversation" is the transcript's verdict where one exists and the
  // minute where none does (conversation.js measuredConversation): a
  // 45-second call the contractor talked through is real; a two-minute
  // call the transcript says was a brush-off is "voicemail or brief".
  const buckets = { nobodyAnswered: 0, hungUpFast: 0, voicemailOrBrief: 0, realConversation: 0 };
  let pickedUp = 0;
  let fromTranscript = 0;
  let talkSeconds = 0;
  let answered = 0;
  // Hold and supervision, from the attempt's own columns (holdSeconds is
  // the sum of closed HOLD/UNHOLD intervals; supervisionKind is the last
  // thing a supervisor did on the call). Over the joined dials, like every
  // other figure on the row.
  let holdSeconds = 0;
  let held = 0;
  let supervised = 0;
  for (const row of joined) {
    if (Number.isFinite(row?.holdSeconds) && row.holdSeconds > 0) {
      held += 1;
      holdSeconds += row.holdSeconds;
    }
    if (typeof row?.supervisionKind === "string" && row.supervisionKind) supervised += 1;
    const band = pickupBand(row);
    if (band === null) continue;
    if (band === "unanswered") {
      buckets.nobodyAnswered += 1;
      continue;
    }
    if (Number.isFinite(row.talkSeconds) && row.talkSeconds > 0) {
      answered += 1;
      talkSeconds += row.talkSeconds;
    }
    if (band === "under20") {
      buckets.hungUpFast += 1;
      continue;
    }
    pickedUp += 1;
    const c = measuredConversation(row);
    if (c?.basis === "transcript") fromTranscript += 1;
    if (c?.talked) buckets.realConversation += 1;
    else buckets.voicemailOrBrief += 1;
  }
  const talked = buckets.realConversation;

  // The rep's columns, over the SAME dials: what they wrote on each.
  let reached = 0;
  let logged = 0;
  for (const row of withLeg) {
    const d = row.disposition ? dispositionFor(row.disposition) : null;
    if (!d) continue;
    logged += 1;
    if (d.reached) reached += 1;
  }
  const cb = callbackState(withLeg, now);

  // Where the carrier's data is missing for the period: the earliest dial
  // whose leg Twilio has not reported on, or that has no leg though it
  // was a browser dial. A handset dial is not "missing" — it never had a
  // leg — and is reported as unverified instead.
  const missingRows = [...unreported, ...noLeg.filter((r) => r.dialChannel === "browser")];
  const missingSince = missingRows.map((r) => when(r.dialledAt)).filter(Boolean).sort((a, b) => a - b)[0] || null;

  const reachedRate = rate(reached, dials);
  const realRate = rate(talked, dials);
  const gap = reachedRate.value !== null && realRate.value !== null ? Math.round(reachedRate.value - realRate.value) : null;

  return {
    dials,
    joined: joined.length,
    /** Dials whose leg the carrier has not reported on. */
    legUnreported: unreported.length,
    /** Attempts with no prospect leg: handset dials, and browser dials the reconcile could not join. Not in the denominator. */
    unverified: { total: noLeg.length, handset: noLeg.filter((r) => r.dialChannel === "handset").length, browser: noLeg.filter((r) => r.dialChannel === "browser").length },
    /** Set when any Twilio column is short of data in this period. */
    carrierMissingSince: missingSince,
    carrierMissingCount: missingRows.length,
    /** The four measured buckets, counts over the joined dials; they sum to `joined`. */
    buckets,
    /** Each bucket over the denominator — rate() with its floor, so a bucket of 3 of 4 prints "3 of 4", not 75%. */
    bucketRates: Object.fromEntries(Object.entries(buckets).map(([k, n]) => [k, rate(n, dials)])),
    pickedUp: rate(pickedUp, dials),
    realConversation: realRate,
    conversationFromTranscript: fromTranscript,
    conversationFromClock: joined.length - fromTranscript,
    reached: reachedRate,
    /** Dispositioned dials — how many of the denominator the rep wrote anything on. */
    logged,
    callbacksPromised: cb ? cb.booked : 0,
    minutesTalking: Math.round(talkSeconds / 60),
    talkSeconds,
    answeredCalls: answered,
    /** Minutes the prospect spent on hold, and on how many calls. Zero is a real zero. */
    minutesOnHold: Math.round(holdSeconds / 60),
    holdSeconds,
    heldCalls: held,
    /** Calls a supervisor listened to, whispered on, barged into or took. */
    supervisedCalls: supervised,
    /** Points between the rep's word and the measured real conversations. Positive: the rep marked more than the clock saw. */
    gap,
    thresholds: { pickup: PICKUP_MIN_SECONDS, conversation: CONVERSATION_MIN_SECONDS },
    sources: COLUMN_SOURCES,
  };
}

/**
 * The line above the table: what the carrier holds for the period against
 * what FieldQuo holds, and how many of each could not be joined.
 *
 * @param legs      Twilio prospect legs in the period: [{ sid, parentCallSid, to, status, duration }]
 *                  (outbound-dial children to a phone number, not to a client:)
 * @param attempts  the period's placed attempts, without test dials
 * @param listedAll false when the Twilio list hit its cap — the line says so
 */
export function reconciliationLine({ legs = [], attempts = [], listedAll = true } = {}) {
  const placed = (Array.isArray(attempts) ? attempts : []).filter(isOutbound);
  const sids = new Set(placed.map((r) => r.providerCallSid).filter(Boolean));
  const legSids = new Set((Array.isArray(legs) ? legs : []).map((l) => l?.sid).filter(Boolean));
  const joinedAttempts = placed.filter((r) => r.providerCallSid && legSids.has(r.providerCallSid)).length;
  const unjoinedAttempts = placed.length - joinedAttempts;
  const unjoinedLegs = [...legSids].filter((s) => !sids.has(s)).length;
  return {
    twilioLegs: legSids.size,
    attempts: placed.length,
    joined: joinedAttempts,
    unjoinedAttempts,
    unjoinedLegs,
    listedAll,
    /** Red when the carrier and FieldQuo disagree on what happened. */
    differ: legSids.size !== placed.length || unjoinedAttempts > 0 || unjoinedLegs > 0,
  };
}
