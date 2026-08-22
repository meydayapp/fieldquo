// app/api/invitations/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public — the accept-invitation page needs the invite's email, org name, and
// role to render before the invited person has logged in. Only non-sensitive
// display fields are returned.
export async function GET(_request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const invitation = await db.invitation.findUnique({
    where: { id: _params.id },
    include: { organization: { select: { name: true } } },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  const expired = invitation.expiresAt && new Date(invitation.expiresAt) < new Date();

  // ── Does this person already have a FieldQuo account? ────────────────────
  //
  // The accept page defaulted to "create a password" for everybody. Someone
  // already registered — a bookkeeper working for three contractors, an
  // employee moving between firms — hit Better Auth's "User already exists.
  // Use another email", which is the worst possible sentence here: the whole
  // point is that they MUST use that email, and the message tells them to use
  // a different one.
  //
  // Returning a boolean, never the user record, and only for the address the
  // invitation already names — so this discloses nothing a holder of the
  // invite link didn't already know. It cannot be used to probe whether an
  // arbitrary email is registered.
  const existingUser = await db.user.findUnique({
    where: { email: invitation.email },
    select: { id: true },
  });

  return NextResponse.json({
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    orgName: invitation.organization?.name || "the team",
    expired: Boolean(expired),
    // Drives which form the page opens on. Being invited to a SECOND company
    // is normal and supported — one person, several employers — so this is not
    // a warning, just which question to ask.
    hasAccount: Boolean(existingUser),
  });
}
