// app/api/invitations/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public — the accept-invitation page needs the invite's email, org name, and
// role to render before the invited person has logged in. Only non-sensitive
// display fields are returned.
export async function GET(_request, { params }) {
  const invitation = await db.invitation.findUnique({
    where: { id: params.id },
    include: { organization: { select: { name: true } } },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  const expired = invitation.expiresAt && new Date(invitation.expiresAt) < new Date();

  return NextResponse.json({
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    orgName: invitation.organization?.name || "the team",
    expired: Boolean(expired),
  });
}
