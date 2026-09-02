// app/api/platform/sales/reps/[id]/invite/route.js
//
// Sending a rep's invitation again.
//
// This exists because the alternative is a dead end. Invitations expire after
// seven days, mail gets refused (Resend will not deliver sandbox mail to anyone
// but the account owner — see lib/email/teamInvite.js), and inboxes eat things.
// Without this route the only recovery would be deleting the rep and starting
// over, which is exactly what the "deactivate, never delete" rule in the
// sibling route forbids.
//
// ══ A resend ROTATES the token ═══════════════════════════════════════════
//
// It does not re-send the old one. The previous hash is overwritten, so the
// first link stops working the moment the second is issued. A superadmin who
// resends because they suspect the first email went somewhere it shouldn't
// gets what they expect — one live invitation per rep, always the newest.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { inviteExpiry, newInviteToken } from "@/lib/sales/invite";
import { sendSalesInviteEmail } from "@/lib/sales/inviteEmail";

export async function POST(request, { params }) {
  // Next 16: `params` is a Promise.
  const _params = await params;

  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (admin.role !== "superadmin") {
    return NextResponse.json(
      { error: "Only superadmins can manage the sales team" },
      { status: 403 },
    );
  }

  const rep = await db.salesRep.findUnique({
    where: { id: _params.id },
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      endedAt: true,
      acceptedAt: true,
    },
  });
  if (!rep) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (rep.acceptedAt) {
    return NextResponse.json(
      {
        error:
          "This rep has already set a password. Re-inviting would hand out a way in beside the one they already have — deactivate the account instead if that's the intent.",
      },
      { status: 409 },
    );
  }
  if (!rep.active || rep.endedAt) {
    return NextResponse.json(
      { error: "This rep is deactivated. Reactivate them first." },
      { status: 409 },
    );
  }

  const { token, hash } = newInviteToken();
  await db.salesRep.update({
    where: { id: rep.id },
    data: {
      inviteTokenHash: hash,
      inviteExpiresAt: inviteExpiry(),
      invitedAt: new Date(),
    },
  });

  const inviter = await db.platformAdmin.findUnique({
    where: { id: admin.id },
    select: { email: true },
  });

  const outcome = await sendSalesInviteEmail({
    request,
    to: rep.email,
    name: rep.name,
    token,
    inviterEmail: inviter?.email,
  });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "sales_rep_reinvited",
      details: {
        salesRepId: rep.id,
        email: rep.email,
        emailSent: outcome.sent,
        ...(outcome.error ? { emailError: outcome.error } : {}),
      },
    },
  });

  // The outcome, not a green tick. The token was rotated whatever happened to
  // the mail, so a caller that ignored a failed send would leave the rep with a
  // dead old link and no new one — worse than before the button was pressed.
  if (!outcome.sent) {
    return NextResponse.json(
      {
        error: `The invitation was re-issued but the email didn't go out: ${outcome.error}`,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ sent: true });
}
