// app/api/team/quick-add/route.js
//
// The dashboard onboarding card's "Add Employee" popup. Creates the Worker
// row, the invitation, and the PendingTeamProfile that carries the granular
// permissions until the invite is accepted — the same three things the full
// New User page does, minus the permission grid.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getCurrentMember } from "@/lib/currentMember";
import {
  requirePermission,
  presetPermissionsFor,
  toBetterAuthRole,
} from "@/lib/permissions";
import { checkUserLimit } from "@/lib/platform/planLimits";
import { takeInviteEmailOutcome } from "@/lib/email/teamInvite";
import { validateInvite } from "@/lib/permissions/inviteGuard";

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can add employees" },
      { status: 403 },
    );
  }

  const limitCheck = await checkUserLimit(member.companyId);
  if (!limitCheck.allowed) {
    return NextResponse.json(
      {
        error: `Plan limit reached: ${limitCheck.currentCount}/${limitCheck.limit} licenses.`,
      },
      { status: 402 },
    );
  }

  const {
    name,
    firstName,
    lastName,
    email,
    phone,
    address,
    city,
    province,
    postalCode,
    country,
    role,
    workerType,
    hourlyRate,
    permissions,
  } = await request.json();

  // `name` is what the full New User page sends, and now what the popup sends
  // too. firstName/lastName is still accepted so an older client (or a phone
  // that hasn't reloaded) keeps working rather than 400-ing on a field it has
  // no idea it should have stopped sending.
  const fullName =
    String(name || "").trim() ||
    `${String(firstName || "").trim()} ${String(lastName || "").trim()}`.trim();

  if (!fullName || !email) {
    return NextResponse.json(
      { error: "Name and email are required" },
      { status: 400 },
    );
  }
  if (!["admin", "supervisor", "employee"].includes(role)) {
    return NextResponse.json(
      { error: "role must be admin, supervisor, or employee" },
      { status: 400 },
    );
  }

  // ── A value whitelist is not a permission check ─────────────────────────
  //
  // The line above only asserts the role exists. This route then wrote `role`
  // and RAW `permissions` to PendingTeamProfile, which becomes a Member on
  // accept — so a Manager could quick-add themselves at a second address as an
  // Administrator with run_payroll, exactly the escalation that was closed on
  // /api/settings/members and left open here.
  //
  // Same guard both routes now, so the two cannot drift again.
  const actorMember = await db.member.findUnique({
    where: { id: member.id },
    select: { role: true, permissions: true },
  });
  const vetted = validateInvite({
    actor: actorMember,
    role,
    permissions,
    laborCostPerHour: hourlyRate,
  });
  if (!vetted.ok) {
    return NextResponse.json({ error: vetted.error }, { status: vetted.status });
  }

  const cleanEmail = String(email).trim().toLowerCase();

  // Refuse duplicates before creating anything. Without this, adding the same
  // person twice produced a second Worker row (so they appeared twice in
  // payroll and timesheets) and a second invitation.
  const [existingMember, existingWorker, pendingInvite] = await Promise.all([
    db.member.findFirst({
      where: { companyId: member.companyId, user: { email: cleanEmail } },
      select: { id: true, active: true },
    }),
    db.worker.findFirst({
      where: { companyId: member.companyId, email: cleanEmail },
      select: { id: true },
    }),
    db.invitation.findFirst({
      where: { organizationId: member.authOrgId, email: cleanEmail, status: "pending" },
      select: { id: true },
    }),
  ]);

  if (existingMember) {
    return NextResponse.json(
      { error: "Someone with that email is already on your team." },
      { status: 409 },
    );
  }
  if (existingWorker) {
    return NextResponse.json(
      { error: "You already have a team member with that email address." },
      { status: 409 },
    );
  }
  if (pendingInvite) {
    return NextResponse.json(
      {
        error:
          "That email already has an invitation waiting. Cancel it on the Team page if you need to send a fresh one.",
      },
      { status: 409 },
    );
  }

  // Same guard as POST /api/settings/members: a company with no authOrgId
  // can't be invited into, and Better Auth's error for organizationId: null is
  // not something to put in front of a person. Checked BEFORE the Worker row
  // exists so there's nothing to roll back.
  if (!member.authOrgId) {
    return NextResponse.json(
      {
        error:
          "This company isn't fully set up for invitations yet. Contact support and quote your company name.",
      },
      { status: 409 },
    );
  }

  const worker = await db.worker.create({
    data: {
      companyId: member.companyId,
      name: fullName,
      email: cleanEmail,
      phone: phone || null,
      address: address || null,
      city: city || null,
      province: province || null,
      type: workerType === "contractor" ? "contractor" : "employee",
      // Clamped the same way — a Worker row's hourlyRate is the number
      // payroll multiplies, whatever table it lives in.
      hourlyRate: vetted.laborCostPerHour,
    },
  });

  let invite = null;
  try {
    // Better Auth only knows admin/member; passing supervisor/employee throws
    // ROLE_NOT_FOUND. Map down for the invitation only — the granular FieldQuo
    // role is carried on PendingTeamProfile.role below and written to
    // Member.role on accept, so `can()` still gates the accepted member by
    // supervisor/employee (writing "member" would be worse: it isn't in the
    // MemberRole enum and isn't in PERMISSIONS). organizationId must be the
    // Better Auth org id, not Company.id.
    invite = await auth.api.createInvitation({
      body: {
        email: cleanEmail,
        role: toBetterAuthRole(role),
        organizationId: member.authOrgId,
      },
      headers: request.headers,
    });
  } catch (err) {
    // The invite is the whole point — a Worker row with no way to sign in is a
    // half-created teammate. Roll it back rather than leaving an orphan that
    // shows up in payroll for someone who can't log in.
    await db.worker.delete({ where: { id: worker.id } }).catch(() => {});
    return NextResponse.json(
      { error: err.message || "Could not send the invitation. Nothing was created." },
      { status: 502 },
    );
  }

  // Carry the granular permission grid to the Member row that gets created on
  // accept — same mechanism /api/settings/members uses. Without this, quick-add
  // produced a member with no permissions saved at all.
  await db.pendingTeamProfile.upsert({
    where: { companyId_email: { companyId: member.companyId, email: cleanEmail } },
    create: {
      companyId: member.companyId,
      email: cleanEmail,
      name: fullName,
      phone: phone || null,
      address: address || null,
      city: city || null,
      province: province || null,
      postalCode: postalCode || null,
      country: country || null,
      laborCostPerHour: vetted.laborCostPerHour,
      permissions: vetted.permissions || presetPermissionsFor(role),
      role,
    },
    update: {
      name: fullName,
      phone: phone || null,
      address: address || null,
      city: city || null,
      province: province || null,
      postalCode: postalCode || null,
      country: country || null,
      laborCostPerHour: vetted.laborCostPerHour,
      permissions: vetted.permissions || presetPermissionsFor(role),
      role,
    },
  });

  // Did the invitation email actually go? Better Auth calls the send hook
  // itself and swallows any error it throws, so asking afterwards is the only
  // way to know — see lib/email/teamInvite.js. Reported rather than assumed:
  // "invite sent" when nothing was sent is the exact bug this route shipped
  // with, and the person waiting by their inbox is the one who pays for it.
  const emailOutcome = takeInviteEmailOutcome(member.authOrgId, cleanEmail);

  return NextResponse.json(
    {
      worker,
      invite,
      emailSent: emailOutcome.sent,
      emailError: emailOutcome.sent ? undefined : emailOutcome.error,
    },
    { status: 201 },
  );
}
