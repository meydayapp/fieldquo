// app/api/settings/members/route.js
//
// IMPORTANT: GET's response shape is unchanged on purpose — still a plain
// array. app/app/settings/work-areas/page.js and the appointments page both
// already call this endpoint expecting `Array.isArray(data)`; wrapping the
// response in `{ members, seats }` would silently break both of those. The
// new lastLoginAt/profile fields are just extra properties on each member
// object, which those pages already ignore harmlessly. Seat usage and
// pending (invited-not-accepted) invites now live at
// GET /api/settings/members/pending instead — called only by the new
// Manage Team page.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission, toBetterAuthRole } from "@/lib/permissions";
import { checkUserLimit } from "@/lib/platform/planLimits";
import { recordError } from "@/lib/platform/errorLog";
import { auth } from "@/lib/auth";
import { reconcilePendingProfiles } from "@/lib/team/reconcilePendingProfile";
import { ensureWorkersForCompany } from "@/lib/team/ensureWorker";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Best-effort, idempotent — see lib/team/reconcilePendingProfile.js.
  await reconcilePendingProfiles(member.companyId).catch((err) =>
    console.error("[settings/members] reconcile failed", err),
  );

  // Same pattern, same reason: people accepted invitations before Worker rows
  // were created on acceptance, and without one they have no timesheets, no
  // payslips and no leave. Idempotent — see lib/team/ensureWorker.js.
  await ensureWorkersForCompany(member.companyId).catch((err) =>
    console.error("[settings/members] worker backfill failed", err?.message),
  );

  const members = await db.member.findMany({
    where: { companyId: member.companyId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Last login = most recent Session.createdAt per user. One query per
  // member is fine at team-roster scale; revisit with a groupBy if rosters
  // get into the hundreds.
  const withLastLogin = await Promise.all(
    members.map(async (m) => {
      const lastSession = await db.session.findFirst({
        where: { userId: m.userId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      return { ...m, lastLoginAt: lastSession?.createdAt || null };
    }),
  );

  return NextResponse.json(withLastLogin);
}

// Invites a new team member via Better Auth's organization plugin — this sends the
// actual invite email; the user becomes a Member once they accept.
//
// Now also accepts the New User page's extended profile (phone, address,
// labor cost, granular permissions) and stashes it in PendingTeamProfile so
// it's there to reconcile onto the real Member row once the invite is
// accepted — see reconcilePendingProfiles above.
export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can invite team members" },
      { status: 403 },
    );
  }

  const limitCheck = await checkUserLimit(member.companyId);
  if (!limitCheck.allowed) {
    // Structured, not just a sentence: the New User form keys off `code` to
    // show an in-place "Add licenses" upgrade link, and `used`/`limit` let it
    // say exactly how many seats are in use without a second round-trip.
    return NextResponse.json(
      {
        error: `Plan limit reached: ${limitCheck.currentCount}/${limitCheck.limit} users. Upgrade to invite more.`,
        code: "seat_limit",
        used: limitCheck.currentCount,
        limit: limitCheck.limit,
      },
      { status: 402 },
    );
  }

  const {
    email,
    role,
    name,
    phone,
    address,
    city,
    province,
    postalCode,
    country,
    imageUrl,
    laborCostPerHour,
    permissions,
    invitationLanguage,
  } = await request.json();

  if (!email)
    return NextResponse.json({ error: "email is required" }, { status: 400 });

  if (!["admin", "supervisor", "employee"].includes(role)) {
    return NextResponse.json(
      { error: "role must be admin, supervisor, or employee" },
      { status: 400 },
    );
  }

  const cleanEmail = String(email).trim().toLowerCase();

  // Same duplicate guard as quick-add. Inviting someone already on the team
  // used to create a second pending invitation and, on accept, race the Member
  // upsert — cheaper to refuse clearly than to reconcile afterwards.
  const [dupMember, dupInvite] = await Promise.all([
    db.member.findFirst({
      where: { companyId: member.companyId, user: { email: cleanEmail } },
      select: { id: true },
    }),
    db.invitation.findFirst({
      where: { organizationId: member.authOrgId, email: cleanEmail, status: "pending" },
      select: { id: true },
    }),
  ]);
  if (dupMember) {
    return NextResponse.json(
      { error: "Someone with that email is already on your team." },
      { status: 409 },
    );
  }
  if (dupInvite) {
    return NextResponse.json(
      { error: "That email already has an invitation waiting." },
      { status: 409 },
    );
  }

  // A company with no authOrgId cannot be invited into, and Better Auth's error
  // for organizationId: null is not something to show a person. Six companies in
  // the database are in this state.
  if (!member.authOrgId) {
    return NextResponse.json(
      {
        error:
          "This company isn't fully set up for invitations yet. Contact support and quote your company name.",
      },
      { status: 409 },
    );
  }

  // ── Wrapped, because an unhandled throw here is unreadable ────────────────
  //
  // Better Auth's organizationId is the Organization row's id (Company.authOrgId),
  // NOT Company.id — getCurrentMember exposes both. Passing companyId here meant
  // the invite pointed at a non-existent org.
  //
  // This call was NOT wrapped. When it throws, Next returns an HTML error page,
  // the browser tries to JSON.parse it, and the person sees the parser's
  // complaint — in Safari, literally "The string did not match the expected
  // pattern." That is the reported bug: a real failure, rendered as gibberish,
  // with the actual reason nowhere.
  let invite;
  try {
    // Better Auth only knows admin/member — supervisor/employee throw
    // ROLE_NOT_FOUND. Map down for the invitation; the granular `role` is
    // stashed on PendingTeamProfile below and becomes Member.role on accept.
    invite = await auth.api.createInvitation({
      body: {
        email: cleanEmail,
        role: toBetterAuthRole(role),
        organizationId: member.authOrgId,
      },
      headers: request.headers,
    });
  } catch (err) {
    // Recorded so the cause is visible in /platform/errors next time, and
    // returned as JSON so the page can print something true.
    await recordError({
      area: "team-invite",
      code: err?.status || err?.body?.code || err?.name || null,
      message: `createInvitation failed for ${cleanEmail}: ${err?.message}`,
      companyId: member.companyId,
      detail: { role, authOrgId: member.authOrgId, body: err?.body ?? null },
    });
    return NextResponse.json(
      {
        error:
          err?.body?.message ||
          err?.message ||
          "Couldn't create the invitation. Nothing was saved.",
      },
      { status: 502 },
    );
  }

  // cleanEmail, not the raw input. The duplicate guard above lowercases, so
  // storing the profile under whatever case was typed let one person hold two
  // PendingTeamProfile rows and made the guard and the store disagree.
  await db.pendingTeamProfile.upsert({
    where: { companyId_email: { companyId: member.companyId, email: cleanEmail } },
    create: {
      companyId: member.companyId,
      email: cleanEmail,
      name: name || null,
      phone: phone || null,
      address: address || null,
      city: city || null,
      province: province || null,
      postalCode: postalCode || null,
      country: country || null,
      imageUrl: imageUrl || null,
      laborCostPerHour: laborCostPerHour ?? null,
      permissions: permissions || null,
      role,
      invitationLanguage: invitationLanguage || "en",
    },
    update: {
      name: name || null,
      phone: phone || null,
      address: address || null,
      city: city || null,
      province: province || null,
      postalCode: postalCode || null,
      country: country || null,
      imageUrl: imageUrl || null,
      laborCostPerHour: laborCostPerHour ?? null,
      permissions: permissions || null,
      role,
      invitationLanguage: invitationLanguage || "en",
    },
  });

  return NextResponse.json(invite, { status: 201 });
}

// Change an existing member's role, active status, or the extended profile
// fields (labor cost, permissions, contact info).
export async function PATCH(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can manage team members" },
      { status: 403 },
    );
  }

  const {
    userId,
    role,
    active,
    phone,
    address,
    city,
    province,
    postalCode,
    country,
    imageUrl,
    laborCostPerHour,
    permissions,
  } = await request.json();

  if (!userId)
    return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const target = await db.member.findUnique({
    where: { userId_companyId: { userId, companyId: member.companyId } },
  });
  if (!target)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (target.role === "owner" && role && role !== "owner") {
    return NextResponse.json(
      { error: "The owner's role can't be changed here" },
      { status: 400 },
    );
  }

  const updated = await db.member.update({
    where: { userId_companyId: { userId, companyId: member.companyId } },
    data: {
      ...(role !== undefined && { role }),
      ...(active !== undefined && { active }),
      ...(phone !== undefined && { phone }),
      ...(address !== undefined && { address }),
      ...(city !== undefined && { city }),
      ...(province !== undefined && { province }),
      ...(postalCode !== undefined && { postalCode }),
      ...(country !== undefined && { country }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(laborCostPerHour !== undefined && { laborCostPerHour }),
      ...(permissions !== undefined && { permissions }),
    },
  });

  return NextResponse.json(updated);
}
