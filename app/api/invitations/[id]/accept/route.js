// app/api/invitations/[id]/accept/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { reconcilePendingProfiles } from "@/lib/team/reconcilePendingProfile";

// The invited person must be signed in (with the invited email) before this
// runs — the accept page handles sign-up/sign-in first. Steps:
//  1. Accept the Better Auth org invitation (adds the OrgMember row).
//  2. Create the app's OWN Member row (the RBAC join getCurrentMember reads) —
//     Better Auth's OrgMember and the app Member are separate tables.
//  3. Reconcile the PendingTeamProfile (phone/labour/permissions captured at
//     invite time) onto that Member.
export async function POST(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json(
      { error: "You must be signed in to accept an invitation" },
      { status: 401 },
    );
  }

  const invitation = await db.invitation.findUnique({
    where: { id: _params.id },
  });
  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  if (
    invitation.email.toLowerCase() !== (session.user.email || "").toLowerCase()
  ) {
    return NextResponse.json(
      { error: "This invitation was sent to a different email address." },
      { status: 403 },
    );
  }

  // 1. Better Auth acceptance (idempotent-ish; ignore "already accepted").
  try {
    await auth.api.acceptInvitation({
      body: { invitationId: _params.id },
      headers: request.headers,
    });
  } catch (err) {
    // If it was already accepted we can still ensure the app Member exists.
    console.warn("[accept invitation] acceptInvitation:", err?.message);
  }

  // 2. Map the Better Auth organization → the app Company, then ensure a
  //    Member row exists.
  const company = await db.company.findUnique({
    where: { authOrgId: invitation.organizationId },
    select: { id: true },
  });
  if (!company) {
    return NextResponse.json(
      { error: "Could not resolve the company for this invitation." },
      { status: 500 },
    );
  }

  await db.member.upsert({
    where: {
      userId_companyId: { userId: session.user.id, companyId: company.id },
    },
    update: { active: true },
    create: {
      userId: session.user.id,
      companyId: company.id,
      role: invitation.role || "employee",
      active: true,
    },
  });

  // Make this the active org on the session so company-scoped routes resolve.
  try {
    await auth.api.setActiveOrganization({
      body: { organizationId: invitation.organizationId },
      headers: request.headers,
    });
  } catch (err) {
    console.warn("[accept invitation] setActiveOrganization:", err?.message);
  }

  // 3. Pull the pre-captured profile onto the Member.
  await reconcilePendingProfiles(company.id).catch((err) =>
    console.error("[accept invitation] reconcile failed", err),
  );

  return NextResponse.json({ ok: true, companyId: company.id });
}
