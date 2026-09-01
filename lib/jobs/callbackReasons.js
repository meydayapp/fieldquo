// lib/jobs/callbackReasons.js
//
// Why a company went BACK to a job — the vocabulary JobVisit.returnReason and
// Job.callbackReason both share, so a visit-level touch-up and a job-level
// warranty return can never disagree about what the three values mean.
//
// ── Why three, and why "not our fault" is one of them ───────────────────────
//
// The owner's own framing: "sometimes some clients call back because there is
// something they think is missing" — and that's often a scope
// misunderstanding, not a defect. If every return gets filed as rework, the
// rework rate stops meaning anything a contractor would act on. So:
//
//   rework          we missed something, or did it wrong — a cost the
//                   contractor absorbs, and the number that says quality is
//                   slipping.
//   warranty        covered work returning within a warranty period. Also
//                   absorbed, but not a mistake — see the note below on why
//                   this is a person's judgement call, not a computed date.
//   not_our_fault   the client thought something was missing or wrong, and it
//                   wasn't — the visit still happened, but it should not drag
//                   the rework rate down.
//
// lib/analytics/kpis.js counts rework + warranty toward the callback rate and
// excludes not_our_fault — see buildReworkCallbackRate's own comment.
//
// ── Why this is chosen by a person, not computed from a warranty length ─────
//
// Grepped the schema and the pricing code before writing this: there is no
// warranty PERIOD stored anywhere. `warrantyVisits`/`warrantyInspection` in
// lib/pricing/tradeScope.js are a PAID product a company can sell on a quote,
// not a promise with a start and end date the system could compare "today"
// against. Every warranty term that exists today is free text in a contract
// template ("[state your own term and what it covers]" —
// lib/documents/contractTerms.js), written for a human to read, not a date
// for code to compute against. Inventing a default term (say, one year) to
// derive "warranty" automatically would be exactly the padding AGENTS.md
// warns about — a partial fact standing in for one nobody actually gave. So
// this stays a judgement call made by whoever books the return, the same way
// Quote.declineReason is free text rather than a computed category.
export const CALLBACK_REASONS = ["rework", "warranty", "not_our_fault"];

/** value -> [translation key, English fallback] — same shape as JOB_STATUS_LABEL_KEYS. */
export const CALLBACK_REASON_LABEL_KEYS = {
  rework: ["app.callback.reason.rework", "Rework — we missed something"],
  warranty: ["app.callback.reason.warranty", "Warranty — covered work"],
  not_our_fault: ["app.callback.reason.notOurFault", "Not our fault — client thought something was missing"],
};

export function isCallbackReason(value) {
  return CALLBACK_REASONS.includes(value);
}

export function callbackReasonLabel(reason, t) {
  const entry = CALLBACK_REASON_LABEL_KEYS[reason];
  if (!entry) return null;
  return t ? t(entry[0], entry[1]) : entry[1];
}
