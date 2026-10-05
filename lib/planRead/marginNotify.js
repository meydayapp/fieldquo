// lib/planRead/marginNotify.js
//
// When a finished drawing read, priced at the company's own rates, misses the
// company's target margin: tell the owner, the managers and the person
// assigned to the work — bell and push (lib/notifications/notify.js
// notifyEvent does both). The owner, 2026-10-04: "show the gap … AND notify
// the owner/manager/project manager (bell + push; whoever is assigned as PM on
// the quote/job if any)".
//
// Who:
//   planRead.belowTarget          everyone who approves estimates (owner,
//                                 admin, supervisors) — the catalog's audience
//   planRead.belowTargetAssigned  the ONE person assigned: the quote's
//                                 assignee when the read has a quote, else the
//                                 lead's assignee — narrowed by
//                                 recipientUserIds; skipped when that person
//                                 already got the first one.
//
// Once per finished read: a second notice for the same run is refused by
// looking for the first (NotificationEvent has no dedupe key of its own —
// lib/services/newSeedNotice.js does the same).
//
// Never throws, never blocks the read (the caller does not await the sends).

import { db as realDb } from "@/lib/db";
import { notifyEvent as realNotify } from "@/lib/notifications/notify";

const APPROVER_ROLES = new Set(["owner", "admin", "supervisor"]);

/**
 * @returns {Promise<{ sent: boolean, reason?: string, assignee?: string|null }>}
 */
export async function notifyBelowTarget({ read, recommendation, companyId }, { prisma = realDb, notify = realNotify } = {}) {
  try {
    if (!read?.id || !companyId) return { sent: false, reason: "no_read" };
    if (!recommendation || recommendation.meetsTarget || !(Number(recommendation.gap) > 0)) return { sent: false, reason: "meets_target" };
    const since = read.readAt ? new Date(read.readAt) : null;
    const already = await prisma.notificationEvent.findFirst({
      where: { companyId, type: "planRead.belowTarget", entityId: read.id, ...(since ? { createdAt: { gte: since } } : {}) },
      select: { id: true },
    });
    if (already) return { sent: false, reason: "already_sent" };
    const params = { title: String(read.title || "").slice(0, 120) };
    notify({ companyId, type: "planRead.belowTarget", entityId: read.id, params, actorUserId: null }).catch(() => {});

    let assignee = null;
    if (read.quoteId) {
      const q = await prisma.quote.findFirst({ where: { id: read.quoteId, companyId }, select: { assignedToId: true } });
      assignee = q?.assignedToId || null;
    }
    if (!assignee && read.leadId) {
      const l = await prisma.leadRequest.findFirst({ where: { id: read.leadId, companyId }, select: { assignedToId: true } });
      assignee = l?.assignedToId || null;
    }
    if (assignee) {
      const member = await prisma.member.findFirst({ where: { companyId, userId: assignee }, select: { role: true } });
      if (member && !APPROVER_ROLES.has(member.role)) {
        notify({ companyId, type: "planRead.belowTargetAssigned", entityId: read.id, params, recipientUserIds: [assignee], actorUserId: null }).catch(() => {});
      }
    }
    return { sent: true, assignee };
  } catch (err) {
    console.error("[planRead] below-target notice:", err?.message);
    return { sent: false, reason: "error" };
  }
}

/** What run.js calls once a read settles "ready": price it now, and tell
 *  people when it misses the target. Loaded lazily by run.js (a static
 *  import would be a cycle through priceRead.js). */
export async function notifyAfterRead({ read, companyId }, deps = {}) {
  try {
    const { priceReadNow } = await import("./priceRead");
    const out = await priceReadNow(read, { companyId, prisma: deps.prisma || realDb });
    if (!out?.pricing) return { sent: false, reason: "no_pricing" };
    return notifyBelowTarget({ read, recommendation: out.pricing.recommendation, companyId }, deps);
  } catch (err) {
    console.error("[planRead] pricing after read:", err?.message);
    return { sent: false, reason: "error" };
  }
}
