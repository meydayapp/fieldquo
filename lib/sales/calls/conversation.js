// lib/sales/calls/conversation.js
//
// Was that a conversation? — answered from the transcript, never from the
// carrier and never from the rep.
//
// ══ Three rates, three different facts ═══════════════════════════════════
//
// The floor board used to refuse a "connect rate" (reporting.js's
// NOT_TRACKED_CALLS carried the refusal until 2026-09-17) because the two
// figures it could have printed were both wrong for the purpose: Twilio's
// answer rate counts an apprentice picking up and a voicemail greeting as
// answered, and the rep's reported reach rate is a self-report that improves
// when a rep logs fewer outcomes. Recording and transcription landed the
// same day, and a transcript is the third fact — the one that says whether
// the person on the other end actually SPOKE.
//
// So a CONVERSATION is a connected call on which the contractor's track
// carries at least CONVERSATION_MIN_CONTRACTOR_WORDS words. The constant is
// exported and printed on every screen that uses the rate, because a rule
// that is not stated beside its number is a rule a reader will guess at.
//
// ══ "Not yet known" is a bucket, not a zero ══════════════════════════════
//
// A connected call with no transcript yet — the recording has not arrived,
// the transcription has not run, or it failed and said so — is neither a
// conversation nor not one. It is counted as `unknown` and printed as "not
// yet known"; the rate is taken over the calls whose transcript exists, and
// the count it was taken over travels with it. Counting an untranscribed
// call as "no conversation" would make the rate fall every time the
// transcriber lagged, which is AGENTS.md failure class 5 with a delay on it.
//
// ══ Pure ═════════════════════════════════════════════════════════════════
//
// Every row arrives as an argument, for the reason reporting.js gives:
// scripts/check-sales-costs.mjs runs every branch on synthetic transcripts.
// `rate` is lib/sales/performance.js's, so every percentage here obeys the
// same floor as every other one on the floor board.

import { rate } from "../performance";

/**
 * How many words the contractor has to say before the call counts as a
 * conversation.
 *
 * Twenty. "Hello? … No thanks, not interested, bye" is about ten words and
 * is a brush-off, not a conversation; a contractor who has asked one question
 * and heard one answer has said more than twenty. Deliberately not higher:
 * the figure the owner wants is "did we get to talk to them", not "did they
 * like it", and that second question is the disposition's.
 */
export const CONVERSATION_MIN_CONTRACTOR_WORDS = 20;

/** The speaker label lib/sales/calls/recording.js's channelSpeakers writes. */
export const CONTRACTOR_SPEAKER = "contractor";

/** Twilio's terminal statuses that mean the far end never picked up. */
export const NOT_ANSWERED_STATUSES = Object.freeze(["no-answer", "busy", "failed", "canceled"]);

function words(text) {
  if (typeof text !== "string") return 0;
  const m = text.trim().match(/[\p{L}\p{N}'’-]+/gu);
  return m ? m.length : 0;
}

/**
 * Words on the contractor's track. Zero for a transcript with no contractor
 * segments — including a single-track (conference) transcript whose every
 * segment is "unknown", which cannot be attributed and is therefore not
 * counted as the contractor speaking.
 *
 * @param transcript  SalesCallAttempt.transcript — [{ speaker, text }]
 * @returns {number|null} null when there is no transcript to read
 */
export function contractorWords(transcript) {
  if (!Array.isArray(transcript)) return null;
  let n = 0;
  for (const seg of transcript) {
    if (seg?.speaker !== CONTRACTOR_SPEAKER) continue;
    n += words(seg.text);
  }
  return n;
}

/** Twilio's statuses for a call that has not ended. */
const OPEN_STATUSES = Object.freeze(["queued", "initiated", "ringing", "in-progress"]);

/**
 * Did the carrier connect this call to a person or a machine?
 *
 * Any of: an answered timestamp, billed talk seconds, or Twilio's own
 * "completed". A terminal no-answer / busy / failed / canceled — on the
 * status or on the end reason the browser reported — is a no. A handset row
 * has none of these and is `null`: nothing measured it. A browser row with
 * no terminal signal yet — still ringing, or the callback never arrived — is
 * `null` too, and the caller keeps it out of every denominator rather than
 * reading silence as a ring-out.
 */
export function wasConnected(row) {
  if (!row || row.dialChannel === "handset") return null;
  if (row.answeredAt) return true;
  if (Number.isFinite(row.talkSeconds) && row.talkSeconds > 0) return true;
  if (row.providerStatus === "completed") return true;
  if (NOT_ANSWERED_STATUSES.includes(row.providerStatus)) return false;
  if (NOT_ANSWERED_STATUSES.includes(row.endReason)) return false;
  if (row.endedAt || (row.providerStatus && !OPEN_STATUSES.includes(row.providerStatus))) return false;
  return null;
}

/**
 * One call's verdict.
 *
 * @returns {"conversation"|"not_conversation"|"unknown"|"not_connected"|"unmeasured"}
 *   unmeasured   a handset dial, or a bridged call with no terminal signal yet
 *   not_connected the carrier never got a pickup
 *   unknown      connected, and no transcript to read yet (or it failed)
 */
export function conversationVerdict(row) {
  const connected = wasConnected(row);
  if (connected === null) return "unmeasured";
  if (!connected) return "not_connected";
  // A row may carry the count already — /platform/costs counts the words in
  // SQL so a month of transcripts never leaves the database. The same rule,
  // the same threshold; only where the counting ran differs.
  const n = Number.isFinite(row.contractorWords) ? row.contractorWords : contractorWords(row.transcript);
  if (n === null) return "unknown";
  return n >= CONVERSATION_MIN_CONTRACTOR_WORDS ? "conversation" : "not_conversation";
}

// ══ The carrier's stopwatch: picked up, and for how long ═════════════════
//
// Added 2026-09-20, when the owner counted the prospect legs at Twilio by
// hand and set them beside what the reps had logged: 135 legs since
// 2026-09-15 — 22 never answered, 13 under twenty seconds, 72 between
// twenty and sixty, 28 of a minute or more. Twenty-one percent lasted a
// minute; the reps had reported reaching forty-four percent. The answer
// rate above cannot see that gap (a voicemail greeting is "answered"), and
// the transcript rate cannot see it until the transcripts exist. Duration
// can, today, from the columns the status callback already writes.
//
// Two thresholds, both stated on the screen beside their numbers:
//
//   PICKUP_MIN_SECONDS (20)   — under this the far end hung up on hearing
//                               a stranger, or the carrier connected to
//                               silence. Not a pickup worth the name.
//   CONVERSATION_MIN_SECONDS  — a minute. Voicemail greetings plus a
//   (60)                        message land in the 20–60 band; a person
//                               who stayed on for a minute talked.
//
// The minute is a stand-in. Where a transcript exists, the transcript's
// verdict (twenty contractor words, above) REPLACES it for that call —
// the speech-based measure is the one the owner asked for, and the
// stopwatch is what exists for the calls the transcriber has not reached.
// `fromTranscript` / `fromDuration` say how many of each went into the
// figure, so a reader knows which rule most of it obeyed.
//
// Answering-machine detection would split the 20–60 band into people and
// greetings. It is billed per call and the owner has not said yes;
// lib/sales/calls/reconcileProvider.js names where it would go.

export const PICKUP_MIN_SECONDS = 20;
export const CONVERSATION_MIN_SECONDS = 60;

/** The four bands a measured prospect leg falls in, by the carrier's clock. */
export const PICKUP_BANDS = Object.freeze(["unanswered", "under20", "band20to60", "over60"]);

/**
 * Which band. `null` for a leg the carrier never measured (a handset dial,
 * a bridge with no final signal yet) — the caller keeps those out of every
 * denominator.
 */
export function pickupBand(row) {
  const connected = wasConnected(row);
  if (connected === null) return null;
  if (!connected) return "unanswered";
  const s = Number.isFinite(row?.talkSeconds) ? row.talkSeconds : 0;
  if (s < PICKUP_MIN_SECONDS) return "under20";
  if (s < CONVERSATION_MIN_SECONDS) return "band20to60";
  return "over60";
}

/**
 * Did they talk — the transcript's verdict where there is one, the
 * minute where there is not. Returns { talked: boolean, basis:
 * "transcript"|"duration" } or null for an unmeasured leg.
 */
export function measuredConversation(row) {
  const band = pickupBand(row);
  if (band === null) return null;
  // The carrier's machine verdict (lib/sales/calls/amd.js) outranks both
  // the transcript and the clock: a two-minute greeting is on the
  // contractor's track and can pass the word count, and the minute cannot
  // tell a greeting from a person. "machine_*" is voicemail, whatever
  // else the row says. Only when AMD ran — null and "human" fall through.
  if (typeof row?.amdResult === "string" && row.amdResult.startsWith("machine_")) return { talked: false, basis: "amd" };
  const v = conversationVerdict(row);
  if (v === "conversation") return { talked: true, basis: "transcript" };
  if (v === "not_conversation") return { talked: false, basis: "transcript" };
  return { talked: band === "over60", basis: "duration" };
}

/**
 * The carrier-measured figures over the calls a rep PLACED, and the rep's
 * own report beside them.
 *
 * @param attempts  outbound rows, already scoped and already without test
 *                  dials. `reported` is { reached, logged } from
 *                  reporting.js's dispositionMix, or null.
 */
export function pickupFigures(attempts, { reported = null } = {}) {
  const rows = Array.isArray(attempts) ? attempts : [];
  const bands = { unanswered: 0, under20: 0, band20to60: 0, over60: 0 };
  let legs = 0;
  let talked = 0;
  let fromTranscript = 0;
  let fromDuration = 0;
  let fromAmd = 0;
  for (const row of rows) {
    const band = pickupBand(row);
    if (band === null) continue;
    legs += 1;
    bands[band] += 1;
    const c = measuredConversation(row);
    if (c.talked) talked += 1;
    if (c.basis === "transcript") fromTranscript += 1;
    else if (c.basis === "amd") fromAmd += 1;
    else fromDuration += 1;
  }
  const pickedUpCount = bands.band20to60 + bands.over60;
  const pickedUp = rate(pickedUpCount, legs);
  const conversation = rate(talked, legs);
  const reportedRate = reported && Number.isFinite(reported.logged) ? rate(reported.reached, reported.logged) : null;
  // Points of difference between what the rep said and what the clock says,
  // over the same period: positive is over-marking. Null until both sides
  // are a percentage — a comparison of two "3 of 4"s is not a number.
  const overMarkedPoints =
    reportedRate && reportedRate.value !== null && conversation.value !== null ? Math.round(reportedRate.value - conversation.value) : null;
  return {
    /** Prospect legs the carrier measured. Every rate below is over these. */
    legs,
    bands,
    pickedUpCount,
    talkedCount: talked,
    fromTranscript,
    fromDuration,
    /** Calls the carrier's answering-machine verdict decided (lib/sales/calls/amd.js). */
    fromAmd,
    pickupMinSeconds: PICKUP_MIN_SECONDS,
    conversationMinSeconds: CONVERSATION_MIN_SECONDS,
    /** Picked up: the leg completed and lasted PICKUP_MIN_SECONDS or more. */
    pickedUp,
    /** Conversation: transcript's verdict, else a minute. */
    conversation,
    reported: reportedRate,
    overMarkedPoints,
  };
}

/**
 * The three rates over a set of attempts, each labelled with what it is.
 *
 * @param attempts  rows, already scoped and already without test dials
 */
export function connectFigures(attempts) {
  const rows = Array.isArray(attempts) ? attempts : [];
  let measured = 0;
  let connected = 0;
  let conversations = 0;
  let notConversations = 0;
  let unknown = 0;
  let unrecorded = 0;
  let awaitingTranscript = 0;
  for (const row of rows) {
    const v = conversationVerdict(row);
    if (v === "unmeasured") continue;
    measured += 1;
    if (v === "not_connected") continue;
    connected += 1;
    if (v === "conversation") conversations += 1;
    else if (v === "not_conversation") notConversations += 1;
    else {
      unknown += 1;
      // Two different "not yet": a call with no recording at all — placed
      // before recording began on 2026-09-17, or one the recorder missed —
      // will never be known, and saying "not yet" about it for ever would
      // be a promise. A recorded call without a transcript is genuinely
      // pending. Both stay out of the denominator; the screen names each.
      if (row?.recordingSid || row?.recordingUrl) awaitingTranscript += 1;
      else unrecorded += 1;
    }
  }
  const known = conversations + notConversations;
  return {
    /** Bridged calls — the only ones the carrier can report on. */
    measured,
    connected,
    conversations,
    notConversations,
    /** Connected, transcript not there yet. Printed as "not yet known". */
    unknown,
    /** …of which: recorded and waiting on the transcriber. */
    awaitingTranscript,
    /** …of which: never recorded, so never knowable. */
    unrecorded,
    minContractorWords: CONVERSATION_MIN_CONTRACTOR_WORDS,
    /** The carrier's: picked up ÷ bridged. A voicemail greeting counts. */
    answerRate: rate(connected, measured),
    /**
     * Ours: conversations ÷ connected calls whose transcript exists. The
     * `unknown` count sits beside it and is never in the denominator.
     */
    conversationRate: rate(conversations, known),
    labels: {
      answerRate: "Answered (carrier) — the far end picked up, person or machine",
      conversationRate: `Conversation (transcript) — the contractor said ${CONVERSATION_MIN_CONTRACTOR_WORDS}+ words`,
      reportedReachRate: "Reached (reported) — what the rep logged",
    },
  };
}
