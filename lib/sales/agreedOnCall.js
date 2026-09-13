// lib/sales/agreedOnCall.js
//
// Texting the signup link IS "agreed on the call" — so the send writes the
// disposition, and the rep is not asked to say the same thing twice.
//
// ══ Which attempt, and why only that one ══════════════════════════════════
//
// The rep's most recent OUTBOUND attempt to this lead (by leadId, or by the
// lead's prospect) that has no outcome yet and was dialled inside
// OPEN_CALL_WINDOW_MS. That is the call they are on, or just hung up from.
// An attempt that already carries an outcome is left alone: saveDisposition
// refuses to overwrite one on principle ("a second submission is a duplicate
// press or a change of mind"), and the funnel counts the texted link itself
// as the agreed signal (lib/sales/funnelStages.js), so nothing is lost by
// not rewriting "interested" to "agreed". An attempt older than the window is
// not this conversation; writing "agreed" on yesterday's no-answer would be
// the funnel inventing a conversation.
//
// ══ Never on the send's critical path ═════════════════════════════════════
//
// Called AFTER Twilio accepted the message and the SalesSmsMessage row is
// written. A failure here is logged and reported in the response as
// `dispositioned: false`; the text went, and that is the fact the rep
// pressed the button for. Same posture as captureSalesAttribution() in the
// signup route: bookkeeping must never fail the thing it books.

import { db } from "@/lib/db";
import { recordError } from "@/lib/platform/errorLog";
import { saveDisposition } from "@/lib/sales/calls/store";
import { AGREED_CODE } from "@/lib/sales/funnelStages";

/** How recent an open attempt has to be to count as the call the link was sent from. */
export const OPEN_CALL_WINDOW_MS = 4 * 60 * 60 * 1000;

/**
 * @returns {{ dispositioned: boolean, attemptId: string|null, reason: string|null }}
 */
export async function markAgreedOnCall({ repId, lead, now = new Date(), client = db } = {}) {
  if (!repId || !lead?.id) return { dispositioned: false, attemptId: null, reason: "no_lead" };
  try {
    const since = new Date(now.getTime() - OPEN_CALL_WINDOW_MS);
    const target = [{ leadId: lead.id }];
    if (lead.prospectId) target.push({ prospectId: lead.prospectId });
    const open = await client.salesCallAttempt.findFirst({
      where: {
        salesRepId: repId,
        direction: "out",
        disposition: null,
        dialledAt: { gte: since },
        OR: target,
      },
      orderBy: { dialledAt: "desc" },
      select: { id: true },
    });
    if (!open) return { dispositioned: false, attemptId: null, reason: "no_open_call" };
    const saved = await saveDisposition({ salesRepId: repId, attemptId: open.id, code: AGREED_CODE, now, client });
    if (!saved.ok) return { dispositioned: false, attemptId: open.id, reason: saved.error };
    return { dispositioned: true, attemptId: open.id, reason: null };
  } catch (err) {
    await recordError({
      area: "sales_sms",
      code: "agreed_write_failed",
      message: `Signup-link text went out but the call could not be marked agreed: ${err?.message}`,
      detail: { leadId: lead?.id, salesRepId: repId },
    }).catch(() => {});
    return { dispositioned: false, attemptId: null, reason: err?.message || "failed" };
  }
}
