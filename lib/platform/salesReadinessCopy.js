// lib/platform/salesReadinessCopy.js
//
// What /platform/sales-agent says about each link, for the one person reading it.
//
// ══ Why the tenant's sentences are wrong here ══════════════════════════════
//
// The sales agent runs the SAME chain as a contractor's receptionist, on
// purpose: lib/voice/readiness.js resolves it, and a second opinion that could
// disagree with the first would be worse than none. What does not transfer is
// the VOICE. lib/voice/readinessCopy.js is written for a painter in a driveway
// — "You haven't set up a number yet", "Top up above", "turn it on below" — and
// on FieldQuo's own console those sentences address the wrong person about the
// wrong thing. The owner is not going to buy a number in a settings screen; he
// is going to set an environment variable in Vercel, and nothing said so.
//
// So this is an OVERRIDE table, not a replacement. Only the handful of reasons
// whose tenant wording is actively misleading here are listed; everything else
// falls through to readinessCopy.js and cannot drift from it, because there is
// nothing here to drift.
//
// English only. The platform console has no i18n — 0 of its 30 pages — and
// these strings deliberately do not go through it.
//
// Pure data and one pure function. No React, no imports, no environment reads,
// so the page, the route and scripts/check-platform-diagnostics.mjs can all
// share exactly one copy of this.

import { LINK_LABEL, REASON_TEXT } from "@/lib/voice/readinessCopy";

/**
 * Reasons whose tenant sentence is replaced on this screen.
 *
 * Keyed exactly as reasonKeyFor builds them, so a key that stops being emitted
 * shows up as an unreachable entry in the check script rather than sitting here
 * being translated for nobody.
 */
export const PLATFORM_REASON_TEXT = {
  "app.setVoice.chain.provider.not_configured":
    "RETELL_API_KEY isn't set on this deployment, so nothing below could be asked of Retell. Add it in Vercel and redeploy — this is not something Refresh will clear.",

  "app.setVoice.chain.number.none":
    "FIELDQUO_SALES_NUMBER isn't set, so this agent has no number to answer on and nothing further can be checked. Set it in Vercel to a number already bought on FieldQuo's Retell account, redeploy, then press Push. /platform/voice-numbers lists what that account holds.",

  "app.setVoice.chain.number.not_ours":
    "Retell answered, and has no such number on FieldQuo's account. FIELDQUO_SALES_NUMBER names a number this account does not hold — naming is not owning. Check it against /platform/voice-numbers.",

  // Shared between the binding and switch links. Both are true here and the
  // tenant version tells the reader to look for a control "below" that is a
  // tickbox on this very page — named exactly, so nobody hunts for it.
  "app.setVoice.chain.voiceOff":
    "The “Answer calls” tick below is off, so the agent is deliberately detached from the number at Retell. Nothing is broken — tick it and press Save to attach.",

  "app.setVoice.chain.switch.not_live":
    "This page says it is switched on and Retell says nothing is attached to the number. The save did not reach the provider — press “Push the current prompt again” and re-run this check.",
};

/**
 * The sentence for a link that could not be judged because an earlier one is
 * not right yet.
 *
 * ── The whole point of this file ───────────────────────────────────────────
 *
 * Six rows reading "We couldn't check this one. Nothing is claimed either way."
 * is what the owner was looking at, and each row was individually honest. What
 * they never said is that they were all the same problem, one link back. A
 * chain diagnostic has one job: point at the FIRST break. The resolver now
 * carries `blockedBy` (see lib/voice/readiness.js) and this turns it into the
 * sentence.
 *
 * Note what it still refuses to do: it does not claim the waiting link is fine.
 * "Waiting on the number" is not "the webhook is correct" — it is exactly as
 * unknown as it was, with the reason attached.
 */
export function waitingText(blockedBy) {
  const label = LINK_LABEL[blockedBy];
  if (!label) return null;
  return `Waiting on “${label}”. Nothing was asked about this one, so nothing is claimed about it either way — fix that link first and this may well come good on its own.`;
}

/**
 * The sentence to render for one link on this screen.
 *
 * Order is deliberate and is the safety property: a link that is WAITING says
 * so before anything else, because the generic "we couldn't check" is precisely
 * the sentence this file exists to stop showing six times in a column.
 *
 * @param link one entry from resolveReadiness().links
 * @returns { text, waiting } — `waiting` lets the page draw it as a consequence
 *          rather than as its own alarm, without re-deriving why.
 */
export function platformLinkText(link) {
  if (!link) return { text: "", waiting: false };
  if (link.blockedBy) {
    const text = waitingText(link.blockedBy);
    if (text) return { text, waiting: true };
  }
  const text =
    PLATFORM_REASON_TEXT[link.reasonKey] || REASON_TEXT[link.reasonKey] || link.reason || "";
  return { text, waiting: false };
}
