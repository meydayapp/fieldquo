// app/api/settings/members/pending/[id]/resend/route.js
//
// Send a pending invitation again.
//
// There was no way to. An invitation lived 48 hours (Better Auth's default —
// now seven days, see INVITATION_EXPIRES_DAYS in lib/auth.js) and the Team
// page offered Cancel and nothing else, so a crew member who opened Friday's
// email on Monday found a dead link, and the owner's only move was to cancel
// the invite and type the whole New User form again. The `id` is the
// PendingTeamProfile row's, the same one the Team page lists and the cancel
// button posts.
//
// ── The mechanism, honestly ────────────────────────────────────────────────
//
// Better Auth's organization plugin has no separate resend endpoint. What it
// has is a `resend: true` flag on createInvitation
// (node_modules/better-auth/dist/plugins/organization/routes/crud-invites.mjs):
// when a LIVE pending invitation exists for the address it pushes that row's
// expiresAt out by invitationExpiresIn and runs sendInvitationEmail again,
// returning the same invitation id — so the link in the first email keeps
// working alongside the new one.
//
// The catch is "live". The plugin's findPendingInvitation filters out rows
// whose expiresAt has passed, so for an EXPIRED invitation `resend` finds
// nothing and createInvitation issues a fresh row instead. That is the right
// outcome (a new link that works), but it would leave the dead row sitting at
// status "pending" next to the live one — and the invite POST's duplicate
// guard reads status, not expiry. So the expired rows are marked "canceled"
// first, in this handler, and then createInvitation is called once for both
// cases. Cancelled rather than deleted, for the reason the cancel route
// gives: an invitation somebody was sent is a thing that happened.
//
// The profile the owner typed (name, phone, grid, pay rate, language) is on
// PendingTeamProfile and is untouched: nothing here re-asks for it, and the
// invite email reads its language from that row as it always did.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission, toBetterAuthRole } from "@/lib/permissions";
import { auth } from "@/lib/auth";
import { takeInviteEmailOutcome } from "@/lib/email/teamInvite";
import { recordError } from "@/lib/platform/errorLog";

export async function POST(request, { params }) {
  // Next 16: params is a Promise.
  const { id } = await params;

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // The same permission that sends an invitation in the first place and
  // cancels one — resending is neither more nor less than sending.
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only an owner, admin or supervisor can resend an invitation." },
      { status: 403 },
    );
  }

  const pending = await db.pendingTeamProfile.findUnique({ where: { id } });
  // Another tenant's id reads as "doesn't exist", never as forbidden.
  if (!pending || pending.companyId !== member.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!member.authOrgId) {
    return NextResponse.json(
      {
        error:
          "This company isn't fully set up for invitations yet. Contact support and quote your company name.",
      },
      { status: 409 },
    );
  }

  // Only a pending invitation can be sent again. An accepted one has a member
  // behind it; a cancelled one was cancelled on purpose — both are "send a
  // new invitation", not "resend this one", and the Team page says so.
  const rows = await db.invitation.findMany({
    where: { organizationId: member.authOrgId, email: pending.email },
    select: { id: true, status: true, expiresAt: true },
    orderBy: { createdAt: "desc" },
  });
  const pendingRows = rows.filter((r) => r.status === "pending");
  if (pendingRows.length === 0) {
    const latest = rows[0]?.status || "none";
    return NextResponse.json(
      {
        error:
          latest === "accepted"
            ? "That invitation was already accepted."
            : "That invitation is no longer pending. Send a new one from Add employee.",
        status: latest,
      },
      { status: 409 },
    );
  }

  // See the header: expired rows would otherwise stay "pending" beside the
  // fresh one the plugin is about to create.
  const now = new Date();
  const expired = pendingRows.filter((r) => r.expiresAt && new Date(r.expiresAt) < now);
  if (expired.length) {
    await db.invitation.updateMany({
      where: { id: { in: expired.map((r) => r.id) } },
      data: { status: "canceled" },
    });
  }

  let invite;
  try {
    invite = await auth.api.createInvitation({
      body: {
        email: pending.email,
        // Better Auth knows admin/member only; the granular role stays on
        // PendingTeamProfile and becomes Member.role on accept, as on send.
        role: toBetterAuthRole(pending.role),
        organizationId: member.authOrgId,
        resend: true,
      },
      headers: request.headers,
    });
  } catch (err) {
    await recordError({
      area: "team-invite",
      code: err?.status || err?.body?.code || err?.name || null,
      message: `resend createInvitation failed for ${pending.email}: ${err?.message}`,
      companyId: member.companyId,
      detail: { authOrgId: member.authOrgId, body: err?.body ?? null },
    });
    return NextResponse.json(
      {
        error:
          err?.body?.message ||
          err?.message ||
          "Couldn't resend the invitation. The existing one is unchanged.",
      },
      { status: 502 },
    );
  }

  // Whether the email went out is read back, not assumed — the plugin swallows
  // what the send hook throws. Same collection point as the invite POST.
  const emailOutcome = takeInviteEmailOutcome(member.authOrgId, pending.email);

  return NextResponse.json({
    ok: true,
    email: pending.email,
    invitationId: invite?.id ?? null,
    expiresAt: invite?.expiresAt ?? null,
    renewed: expired.length === 0,
    emailSent: emailOutcome.sent,
    emailError: emailOutcome.sent ? undefined : emailOutcome.error,
  });
}
