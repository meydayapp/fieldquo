// app/api/settings/members/pending/[id]/route.js
//
// Cancel an invitation that hasn't been accepted.
//
// There was no way to do this at all: a typo'd address, someone who left
// before their first day, or an invite sent to the wrong person sat on the
// Team page forever, holding a licence the company was paying for. The `id`
// is the PendingTeamProfile row's — that is what the Team page lists, and it
// is the row that carries the invited person's captured profile.
//
// What this touches, and what it deliberately does not:
//
//   * the Better Auth Invitation row is marked "canceled", so the accept link
//     in the email stops working. Cancelled rather than deleted: an invitation
//     someone was sent is a thing that happened, and the accept route reads
//     status to refuse it.
//   * the PendingTeamProfile row is removed. It IS the pending invite as far
//     as the app is concerned — seat counts and the Team page both read it —
//     so leaving it would mean a cancel button that cancels nothing visible.
//   * the Worker row (quick-add creates one) is LEFT ALONE. It may already
//     carry timesheets, leave or payouts, and "cancel an invitation" is not a
//     licence to delete someone's payroll history. The response says so and
//     the UI repeats it, rather than quietly doing something destructive under
//     a cosmetic-sounding label.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";

export async function DELETE(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const { id } = await params;

  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Server-side, not just a hidden button. Same permission that lets someone
  // send the invite in the first place.
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can cancel invitations" },
      { status: 403 },
    );
  }

  const pending = await db.pendingTeamProfile.findUnique({ where: { id } });

  // Scoped to the caller's company: an id from another tenant must read as
  // "doesn't exist", not as "forbidden", and certainly not as "deleted".
  if (!pending || pending.companyId !== member.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let invitationsCancelled = 0;
  if (member.authOrgId) {
    const result = await db.invitation.updateMany({
      where: {
        organizationId: member.authOrgId,
        email: pending.email,
        status: "pending",
      },
      data: { status: "canceled" },
    });
    invitationsCancelled = result.count;
  }

  await db.pendingTeamProfile.delete({ where: { id } });

  // The Worker row quick-add created, if there is one, so the caller can say
  // something true about what is left behind.
  const worker = await db.worker.findFirst({
    where: { companyId: member.companyId, email: pending.email },
    select: { id: true, name: true },
  });

  return NextResponse.json({
    ok: true,
    email: pending.email,
    invitationsCancelled,
    workerKept: worker ? { id: worker.id, name: worker.name } : null,
  });
}
