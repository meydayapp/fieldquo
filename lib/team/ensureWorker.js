// lib/team/ensureWorker.js
//
// Every team member needs a Worker row, and it has to be LINKED to their user.
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// FieldQuo has two rows per person for good reasons:
//
//   Member — who they are in the app: role, permissions, login.
//   Worker — who they are on the books: hours, pay, leave, payouts.
//
// Accepting an invitation created only the Member. That looked fine, because
// nothing on screen said otherwise — until someone opened Time off and got
// "your account isn't set up as a team member", or ran payroll and a person who
// clearly works there simply wasn't in the list. A row that silently doesn't
// exist is the quiet version of a dead control.
//
// ── What is NOT guessed ─────────────────────────────────────────────────────
//
// `hourlyRate` is left null. Member.laborCostPerHour is a COST (it can carry
// burden, overhead, a margin) and is used for job costing; a pay rate is what
// lands in someone's bank account. Copying one into the other would invent a
// wage. Payroll already warns on a missing rate, which is the honest outcome:
// someone is asked, rather than paid a made-up number.

import { db } from "@/lib/db";

/**
 * Ensure a Worker exists for this member and is linked to their user.
 *
 * @returns { worker, created, linked, conflict }
 *   conflict is set when the user is already a Worker at a DIFFERENT company —
 *   Worker.userId is globally unique, so the link can't be made here. A worker
 *   row is still created so payroll and scheduling work; only the self-service
 *   surfaces (their own leave, their own payslips) need the link.
 */
export async function ensureWorkerForMember({ companyId, userId }) {
  if (!companyId || !userId) return { worker: null, created: false, linked: false };

  // Already linked?
  const linkedAnywhere = await db.worker.findUnique({
    where: { userId },
    select: { id: true, companyId: true, name: true, active: true },
  });
  if (linkedAnywhere?.companyId === companyId) {
    // Someone reactivated in the app should be payable again.
    if (!linkedAnywhere.active) {
      const worker = await db.worker.update({
        where: { id: linkedAnywhere.id },
        data: { active: true },
      });
      return { worker, created: false, linked: false, reactivated: true };
    }
    return { worker: linkedAnywhere, created: false, linked: false };
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) return { worker: null, created: false, linked: false };

  const conflict = Boolean(linkedAnywhere);

  // An admin may have already created a Worker by hand with the same email
  // (very common: the crew is entered before anyone is invited). Link to that
  // rather than creating a duplicate person on the payroll.
  if (!conflict && user.email) {
    const byEmail = await db.worker.findFirst({
      where: {
        companyId,
        userId: null,
        email: { equals: user.email, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (byEmail) {
      const worker = await db.worker.update({
        where: { id: byEmail.id },
        data: { userId, active: true },
      });
      return { worker, created: false, linked: true, conflict: false };
    }
  }

  try {
    const worker = await db.worker.create({
      data: {
        companyId,
        userId: conflict ? null : userId,
        name: user.name || user.email || "Team member",
        email: user.email || null,
        // "employee" is the right default for someone invited into the company;
        // a subcontractor is a deliberate choice an admin makes, not something
        // to infer from an invitation.
        type: "employee",
        active: true,
      },
    });
    return { worker, created: true, linked: !conflict, conflict };
  } catch (err) {
    // Two accepts racing, or the unique userId losing to a concurrent write.
    // Re-read rather than failing the acceptance — the person is in either way.
    if (err?.code === "P2002") {
      const worker = await db.worker.findFirst({ where: { companyId, userId } });
      return { worker, created: false, linked: false, conflict: !worker };
    }
    throw err;
  }
}

/**
 * Backfill every active member of a company. Called from the members list so it
 * self-heals on the next page load — the same pattern reconcilePendingProfiles
 * uses, and for the same reason: people already accepted invitations before
 * this existed.
 */
export async function ensureWorkersForCompany(companyId) {
  if (!companyId) return { created: 0, linked: 0 };
  const members = await db.member.findMany({
    where: { companyId, active: true },
    select: { userId: true },
  });

  let created = 0;
  let linked = 0;
  for (const m of members) {
    try {
      const r = await ensureWorkerForMember({ companyId, userId: m.userId });
      if (r.created) created += 1;
      if (r.linked && !r.created) linked += 1;
    } catch (err) {
      // One bad row must not stop the sweep.
      console.error("[ensureWorker] member", m.userId, err?.message);
    }
  }
  return { created, linked };
}
