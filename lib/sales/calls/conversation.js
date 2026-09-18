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
