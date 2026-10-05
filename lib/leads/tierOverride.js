// lib/leads/tierOverride.js
//
// A person's one-tap tier — "this is a lead", "only a tap", "not relevant" —
// from the conversation (POST /api/messaging/threads/[id]/qualification) or
// from the lead (POST /api/leads/[id]/qualification). One function behind
// both, so the two doors cannot disagree about what the tap does.
//
// What it does:
//   * stores `override: { tier, at, byUserId, byName }` on the thread's
//     leadCapture.qualification — the rules re-run on every new message and
//     carry it, never replace it (lib/leads/qualification.js
//     storableQualification), so it sticks;
//   * if the thread had never been classified, classifies it first, so the
//     screen still shows what the RULES thought beside what the person said;
//   * "lead" on a conversation with no lead runs the capture now, so the lead
//     appears on the board on the tap rather than on the next message;
//   * `tier: null` clears the override and the rules' verdict stands again.
//
// What it never does: delete or change a lead. Marking a conversation that
// already made a lead "only a tap" says what the conversation was; removing
// the lead is the review action's job (lib/leads/conversationReview.js),
// which asks first. And a person's "not a lead" mark on the thread
// (leadCapture.notALead, set when they deleted its lead) still wins over a
// "lead" tap — the capture refuses before it reads the tier, by design.

import { withOverride, TIERS, effectiveTier, publicQualification } from "@/lib/leads/qualification";
import { qualifyCompanyThreads, storeQualification } from "@/lib/leads/qualifyThreads";
import { captureLeadFromConversation } from "@/lib/leads/conversationLead";

/** The tiers a request may set; null clears. Pure. */
export function cleanTier(raw) {
  if (raw === null) return { ok: true, tier: null };
  if (typeof raw === "string" && TIERS.includes(raw)) return { ok: true, tier: raw };
  return { ok: false };
}

/**
 * @returns {{ ok: true, qualification, leadId: string|null, created: boolean } | { ok: false, status, error }}
 */
export async function setTierOverride(prisma, { companyId, threadId, tier, actor = {}, now = new Date(), deps = {} }) {
  const { capture = captureLeadFromConversation, classify = qualifyCompanyThreads } = deps;
  const thread = await prisma.messageThread.findFirst({
    where: { id: threadId, companyId },
    select: { id: true, leadId: true, leadCapture: true, channel: { select: { platform: true } } },
  });
  if (!thread) return { ok: false, status: 404, error: "Not found" };

  let current = thread.leadCapture?.qualification || null;
  if (!current) {
    // Never classified (a thread from before 2026-10-05): the rules first, so
    // the screen can show both what they said and what the person said.
    const run = await classify(prisma, { companyId, threadIds: [thread.id], write: false, now }).catch(() => null);
    current = run?.verdicts?.get(thread.id)?.stored || null;
  }
  const next = withOverride(current || {}, { tier, at: now, byUserId: actor.userId || null, byName: actor.name || null });
  await storeQualification(prisma, { companyId, threadId: thread.id, capture: thread.leadCapture || {}, stored: next });

  let leadId = thread.leadId || null;
  let created = false;
  if (tier === "lead" && !leadId) {
    const r = await Promise.resolve(capture({ companyId, threadId: thread.id, prisma, now })).catch(() => null);
    if (r?.leadId) {
      leadId = r.leadId;
      created = Boolean(r.created);
    }
  }
  return { ok: true, qualification: publicQualification(next), tier: effectiveTier(next), leadId, created };
}
