// lib/activity/log.js
//
// The one way to write the tenant activity trail. Import recordActivity and
// call it from a route handler AFTER the real mutation has committed.
//
// Contract: it NEVER throws. A failure to log must not fail — or roll back —
// the customer's actual action, so this swallows its own errors into a
// console.error and returns. That means the log can miss a row under failure;
// that's the deliberate trade (see the model comment in schema.prisma).
//
// Pass the `member` from getCurrentMember(). Actor name is resolved and stored
// at write time so a later rename or a departed employee never erases who did
// it. If the member carries an impersonation flag, that's recorded too — a
// write under read-only support access should be impossible, and this is where
// it would surface.

import { db } from "@/lib/db";

/**
 * @param {object} member  from getCurrentMember(): { id, userId, companyId, role, impersonation? }
 * @param {object} event
 * @param {string} event.action       dotted verb, e.g. "quote.sent"
 * @param {string} [event.entityType] "quote" | "invoice" | "client" | "payment" | "settings" | ...
 * @param {string} [event.entityId]
 * @param {string} [event.summary]    human one-liner shown in the log
 * @param {object} [event.metadata]
 * @param {string} [event.actorName]  overrides the resolved name (rarely needed)
 */
export async function recordActivity(member, event = {}) {
  try {
    if (!member?.companyId || !event?.action) return;

    // Resolve the actor's display name once, at write time. Cheap (one small
    // lookup) and only on logged actions, which are never hot loops.
    let actorName = event.actorName || null;
    if (!actorName && member.userId) {
      const user = await db.user.findUnique({
        where: { id: member.userId },
        select: { name: true, email: true },
      });
      actorName = user?.name || user?.email || null;
    }

    await db.activityLog.create({
      data: {
        companyId: member.companyId,
        actorUserId: member.userId || null,
        actorMemberId: member.id || null,
        actorName,
        actorRole: member.role || null,
        viaImpersonation: Boolean(member.impersonation),
        action: event.action,
        entityType: event.entityType || null,
        entityId: event.entityId || null,
        summary: event.summary || null,
        metadata: event.metadata || null,
      },
    });
  } catch (err) {
    console.error("[activity] record failed:", err?.message);
  }
}
