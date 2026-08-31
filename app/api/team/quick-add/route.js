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
import { memberOrRefusal } from "@/lib/apiMember";
import {
  requirePermission,
  presetPermissionsFor,
  toBetterAuthRole,
} from "@/lib/permissions";
import { checkUserLimit } from "@/lib/platform/planLimits";
import { seatCheck, seatLimitMessage } from "@/lib/pricing/seatLimit";
import { takeInviteEmailOutcome } from "@/lib/email/teamInvite";
import { validateInvite } from "@/lib/permissions/inviteGuard";
import { validateWorkProfile } from "@/lib/team/workProfile";
import { resolveQuickAddWorker } from "@/lib/team/ensureWorker";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

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
    // Where this person's hours cost the business, and the week they are paid
    // for whether or not work fills it. Validated below, before anything is
    // created. See lib/team/workProfile.js.
    workType,
    scheduledHoursPerWeek,
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

  // ── The seat cap, missing from this route entirely ────────────────────────
  //
  // checkUserLimit() above only counts HEADS against the legacy
  // Plan.maxUsers (seats + free crew, one number — see planLimits.js), so a
  // Solo company at 1/1 seats and 0/5 crew reads as "1 of 6, go ahead" and
  // this route created whoever was asked for: an Estimator, a Dispatcher, a
  // Manager, all seats, none of them checked against the ONE seat the plan
  // actually sells. The full New User page (POST /api/settings/members)
  // already runs this exact check; this route just never got it, which is
  // how the onboarding popup ended up offering — and creating — seats the
  // company had none of.
  //
  // Same rule as there: checked AFTER clamping, against what this invite will
  // actually carry, with pending invitations counted (a sent invite has
  // already committed a seat, accepted or not) and crew never blocked by it.
  const seatRoster = await db.member.findMany({
    where: { companyId: member.companyId, active: true },
    select: { role: true, permissions: true },
  });
  const seatPending = await db.pendingTeamProfile.findMany({
    where: { companyId: member.companyId },
    select: { role: true, permissions: true },
  });
  const seatPlan = await db.subscription.findUnique({
    where: { companyId: member.companyId },
    select: { plan: { select: { seats: true, crewSeats: true, tierKey: true } } },
  });
  const seats = seatCheck({
    roster: [...seatRoster, ...seatPending],
    plan: seatPlan?.plan || null,
    incoming: { role, permissions: vetted.permissions },
  });
  if (!seats.allowed) {
    return NextResponse.json(
      { error: seatLimitMessage(seats), code: "seat_limit", seats },
      { status: 402 },
    );
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
      select: { id: true, active: true },
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
  // An ACTIVE worker record with this email is still a real duplicate to
  // refuse — two rows for one person means two payroll lines. An INACTIVE
  // one is a different fact: this is somebody who was archived, not erased
  // (lib/billing/access.js's rule applied to a person, not just a company),
  // and re-adding them should reattach to that record — see the reactivation
  // below — so their timesheets, pay-run lines and leave balances are theirs
  // again rather than starting a second, empty history.
  if (existingWorker?.active) {
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

  // Rejected before anything is created, so a bad week never reaches a row and
  // a half-made worker never has to be cleaned up.
  const profile = validateWorkProfile({ workType, scheduledHoursPerWeek });
  if (!profile.ok) {
    return NextResponse.json({ error: profile.error }, { status: 400 });
  }

  // ── Reattach to an archived Worker, don't shadow it with a second row ────
  //
  // existingWorker here is only ever the INACTIVE case — active ones already
  // returned 409 above. Their Worker.id is what every TimeEntry, PayRunLine,
  // Payout and LeaveBalance still points at, so bringing them back has to
  // UPDATE that row, not create a new one next to it. Factored into
  // lib/team/ensureWorker.js rather than inlined here so there is exactly one
  // place that decides "reattach or create" for a quick-added worker — the
  // same reasoning ensureWorkerForMember already applies on invite acceptance.
  const workerResult = await resolveQuickAddWorker({
    member,
    existingWorker,
    cleanEmail,
    fullName,
    phone,
    address,
    city,
    province,
    workerType,
    profile,
    hourlyRate: vetted.laborCostPerHour,
  });
  const worker = workerResult.worker;

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
    // half-created teammate. A brand-new row is rolled back rather than left
    // as an orphan that shows up in payroll for someone who can't log in.
    //
    // A REACTIVATED row is different: it is not an orphan, it is somebody's
    // real employment record, and deleting it here would destroy the exact
    // history this route exists to keep. Left active — the invite failed, not
    // the person's standing — so an owner who retries a moment later reattaches
    // again instead of recreating them from nothing.
    if (workerResult.created) {
      await db.worker.delete({ where: { id: worker.id } }).catch(() => {});
    }
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
