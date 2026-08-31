// lib/ai/jennifer/escalate.js
//
// "ESCALATE, never answer" cannot be a prompt instruction alone. A prompt
// instruction is something a model follows most of the time; a non-negotiable
// needs a code path that runs whether or not the model cooperates. So the
// check here is BLUNT PATTERN MATCHING, executed BEFORE the message ever
// reaches a model — if it matches, the conversation is handed to a human and
// the model is never called for that turn. The escalateToHuman TOOL in
// tools.js is the second, softer layer: for phrasing this regex misses, the
// model still has a documented way to hand off rather than attempt an answer.
//
// Same shape and the same reasoning as looksLikeInstruction() in
// lib/voice/transcript.js: a pattern list can be worked around and will
// occasionally fire on an innocent sentence, and both are acceptable because
// this fails in the SAFE direction. A false positive costs one unnecessary
// handoff to a human, who can plainly see the conversation didn't need one. A
// false negative on "delete my account" or "I want a refund" being ANSWERED
// by a model instead of a person is the failure this file exists to prevent.
//
// Three topics, matching AGENTS.md non-negotiable #5 and Part 6 of the
// support guide exactly:
//
//   money_movement  — a payout, a charge, a refund, a dispute. Never FieldQuo's
//                      to explain away; Part 6 says "confirm which Stripe
//                      integration is involved and hand off."
//   data_deletion   — deleting data, a company or an account. There is no
//                      self-serve or admin-driven deletion flow in the product
//                      at all (see MEMORY.md and Part 6) — a model claiming
//                      otherwise, or claiming to have done it, would be lying.
//   legal_privacy   — access/correction/export of personal data, a request
//                      under a named privacy law, or consent to be called,
//                      texted or recorded. Region-specific and not a support
//                      doc's place to answer.

const MONEY_MOVEMENT =
  /\b(refund(ed|s)?|charge ?back|chargeback|dispute(d)? (the |a |this )?(charge|payment|invoice)|payout (didn.t|never|hasn.t|missing|late)|money (back|missing)|wrongly charged|charged (wrong|twice|me twice)|billed (wrong|twice|incorrectly)|reverse (the |a )?(payment|charge|transaction)|cancel my (subscription|payment|card)|stop (the |a )?(payment|charge)|unauthorized (charge|payment|transaction))\b/i;

const DATA_DELETION =
  /\b(delete (my|our|the) (account|data|company|records?)|erase (my|our) (data|account)|remove (my|our) (account|data|company)( permanently| for good)?|close (my|our) account( permanently| for good)?|wipe (my|our) (data|account)|right to be forgotten|forget (me|us)|permanently delete)\b/i;

const LEGAL_PRIVACY =
  /\b(gdpr|ccpa|pipeda|privacy (request|complaint|law|officer)|lawsuit|legal action|subpoena|court order|data (access|portability|subject) request|consent (to (be |having been )?(called|texted|recorded))|my lawyer|attorney|sue (you|fieldquo)|regulator|data protection authority)\b/i;

/**
 * @returns "money_movement" | "data_deletion" | "legal_privacy" | null
 *
 * Checked against the raw text of what the person just typed — never against
 * anything a tool or an earlier assistant turn produced, which is the same
 * "the caller's own words are the evidence" boundary looksLikeInstruction
 * draws for a phone transcript.
 */
export function escalationReason(text) {
  const s = String(text ?? "");
  if (!s.trim()) return null;
  if (MONEY_MOVEMENT.test(s)) return "money_movement";
  if (DATA_DELETION.test(s)) return "data_deletion";
  if (LEGAL_PRIVACY.test(s)) return "legal_privacy";
  return null;
}

/** A short, human-readable name for the reason — used in the handover card. */
export function escalationLabel(reason) {
  switch (reason) {
    case "money_movement":
      return "something about a payment or payout";
    case "data_deletion":
      return "a request to delete data";
    case "legal_privacy":
      return "a legal or privacy request";
    default:
      return "something that needs a person";
  }
}
