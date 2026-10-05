// lib/leads/leadTombstone.js
//
// "This Meta lead was deleted on purpose" — read by lib/meta/leadsImport.js
// before it creates a lead, written by lib/leads/deleteLead.js as part of the
// deletion's own audit row. Its own small module so the webhook and the cron
// import it without the delete path's dependencies.
//
// Why the audit row: Meta re-delivers a lead by design (webhook retries, the
// ninety-day poll, the history backfill), and the leadgen id that made those
// idempotent lived on the LeadRequest row that was just deleted. ActivityLog
// rows are never deleted by anything in this codebase, they are per company,
// and the delete writes one per lead inside its transaction — so the row is a
// sound tombstone and needs no new column.

/** The ActivityLog verb a lead deletion is recorded under. */
export const LEAD_DELETED_ACTION = "lead.deleted";

/**
 * Was this Meta leadgen id deleted by the company?
 *
 * Fails OPEN: if the lookup itself errors the lead is imported — a duplicate a
 * person can delete again is better than a real enquiry silently lost, the
 * same choice the identity matcher makes on failure.
 */
export async function isDeletedMetaLead(prisma, { companyId, metaLeadId }) {
  if (!companyId || !metaLeadId || !prisma?.activityLog?.findFirst) return false;
  try {
    const row = await prisma.activityLog.findFirst({
      where: {
        companyId,
        action: LEAD_DELETED_ACTION,
        metadata: { path: ["metaLeadIds"], array_contains: [String(metaLeadId)] },
      },
      select: { id: true },
    });
    return Boolean(row);
  } catch (err) {
    console.warn(`[leads/tombstone] lookup failed for leadgen ${metaLeadId}: ${err?.message}`);
    return false;
  }
}
