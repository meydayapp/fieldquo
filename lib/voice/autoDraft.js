// lib/voice/autoDraft.js
//
// The quote the call was already enough to write.
//
// ══ Why this exists ════════════════════════════════════════════════════════
//
// draftQuoteFromCall has done the whole job for a while — it reads the caller's
// words, matches them against this company's OWN priced catalogue, resolves the
// caller to an existing client or creates one, and hands back a draft with the
// services, the add-ons, the caller's verbatim notes and the recording attached.
// It ran on a button. So the contractor who never opened the receptionist screen
// got nothing, which is most of them: the whole point of a receptionist that
// answers at eleven at night is that nobody is watching.
//
// ══ What it deliberately does NOT do ═══════════════════════════════════════
//
// It does not create a Quote row. The draft stays on the call, the receptionist
// screen shows it for review, and opening the builder prefills a real quote from
// it — so nothing client-facing exists until a person has looked. A wrong number
// that happened to mention a kitchen becomes a draft somebody ignores rather
// than a numbered quote somebody has to delete.
//
// ══ Three ways it refuses, and each one is free ════════════════════════════
//
// Every model call is metered against the company's cap (lib/ai/usage.js), and
// this one runs on EVERY finished call — including hang-ups, wrong numbers and
// "what time do you open?". So the gates come before the spend:
//
//   • already drafted      call_analyzed is retried by the provider, and a
//                          redraft would charge twice for one call and
//                          overwrite a draft the contractor may have read.
//   • no lead              save_caller never fired, so there is no name, no
//                          number and nothing to attach a client to.
//   • nothing was said     a hang-up or a wrong number. Screened on the
//                          SUBSTANCE of what the caller said, never on its
//                          subject: a keyword gate that skipped calls matching
//                          no offering threw away "do you guys do kitchens?"
//                          and paid for "what time do you close?". See
//                          requireSubstance in draftQuoteFromCall.
//
// Quota is checked but NOT consumed as a refusal: a company over its cap simply
// gets no automatic draft, and the button still tells them why in the UI.

import { db } from "@/lib/db";
import { draftQuoteFromCall, DRAFT_REASONS } from "@/lib/ai/callQuoteDraft";
import { checkAiQuota, recordAiUsage } from "@/lib/ai/usage";
import { isAiConfigured } from "@/lib/ai/provider";

/** Why no draft was made. Returned rather than thrown — none of these are errors. */
export const SKIPPED = {
  ALREADY_DRAFTED: "already_drafted",
  NO_LEAD: "no_lead",
  AI_UNAVAILABLE: "ai_unavailable",
  QUOTA: "quota",
  NOT_FOUND: "not_found",
};

/**
 * Draft a quote from a finished call, if it is worth drafting.
 *
 * Best-effort by contract: the caller is a webhook that has already recorded
 * and billed the call, and a drafting failure must never turn that into a 500
 * and a provider retry. Every path returns rather than throws.
 *
 * @returns { drafted: boolean, reason?: string }
 */
export async function autoDraftAfterCall({ companyId, callId }) {
  const call = await db.voiceCall.findFirst({
    where: { id: callId, companyId },
    select: { id: true, leadId: true, fromE164: true, quoteDraft: true },
  });
  if (!call) return { drafted: false, reason: SKIPPED.NOT_FOUND };

  // Idempotent on the draft, not on the event. call_analyzed is retried, and
  // two of them arriving would otherwise pay twice and overwrite a draft the
  // contractor may already have corrected.
  if (call.quoteDraft) return { drafted: false, reason: SKIPPED.ALREADY_DRAFTED };

  // ── A lead is not required, and requiring one lost real jobs ───────────
  //
  // This was `if (!call.leadId) skip`, on the reasoning that save_caller not
  // firing meant there was nobody to attach a draft to. That is wrong in the
  // case that matters most: "do you guys do kitchens?" is a real job, phrased
  // as a question, and the agent often answers it without ever reaching for
  // save_caller. The call still arrives from a number that can be rung back.
  //
  // So what is actually required is a way to reach them — a lead, or caller ID.
  // Without a lead nothing gets created (enoughToCreateClient needs a name
  // somebody said, and caller ID is not one), and the draft comes back with
  // `notCreated` set, which is the honest outcome rather than a client row
  // named after a phone number.
  if (!call.leadId && !call.fromE164) {
    return await skip(companyId, callId, SKIPPED.NO_LEAD);
  }

  if (!isAiConfigured()) return await skip(companyId, callId, SKIPPED.AI_UNAVAILABLE);

  const quota = await checkAiQuota(companyId);
  if (!quota.allowed) return await skip(companyId, callId, SKIPPED.QUOTA);

  const result = await draftQuoteFromCall({
    companyId,
    callId,
    // Screens out the hang-up and the wrong number. Deliberately NOT a
    // subject-matter gate — see the long note in draftQuoteFromCall for the
    // keyword version that matched "what time do you close" to "Soft-close
    // hinges" and missed "do you guys do kitchens".
    requireSubstance: true,
    onUsage: (u) =>
      recordAiUsage({
        companyId,
        // Its own feature name, so a contractor reading their AI usage can see
        // what the automatic drafting cost them separately from what they asked
        // for by hand. Same reason the two have different reasons for refusing.
        feature: "call_quote_draft_auto",
        ...u,
      }),
  });

  if (!result.ok) return await skip(companyId, callId, result.reason);

  // updateMany with the company in the WHERE, the same as the manual route: the
  // row was already scoped by the read above, and this keeps it scoped at the
  // write too.
  await db.voiceCall.updateMany({
    where: { id: callId, companyId },
    // The marker is CLEARED, not left behind. A call that skipped once and
    // drafted later — the contractor added the missing service and pressed the
    // button — must not keep showing why it was passed over.
    data: { quoteDraft: result.draft, quoteDraftAt: new Date(), quoteDraftSkipped: null },
  });

  return { drafted: true, reason: null };
}

/**
 * Record why no draft was made, and say so out loud on the call.
 *
 * ── A silent skip is the failure this whole file is meant to avoid ────────
 *
 * The one that matters is NOTHING_QUOTABLE, and it is the one a contractor can
 * actually fix: their service list does not mention water heaters, so a call
 * about a water heater came back with nothing to price. Left silent that looks
 * exactly like the AI not working, and the fix — add the service — is invisible
 * to the only person who can apply it.
 *
 * Best-effort. Failing to write the marker must not turn a skip into a throw
 * inside a webhook that has already billed the call.
 */
async function skip(companyId, callId, reason) {
  try {
    await db.voiceCall.updateMany({
      where: { id: callId, companyId },
      data: { quoteDraftSkipped: reason },
    });
  } catch {
    // The reason is a nicety; the skip itself is the outcome and it is returned
    // either way.
  }
  return { drafted: false, reason };
}

export { DRAFT_REASONS };
