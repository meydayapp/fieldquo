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
import { requirePermission } from "@/lib/permissions";
import { checkUserLimit } from "@/lib/platform/planLimits";
import { auth } from "@/lib/auth";
import { reconcilePendingProfiles } from "@/lib/team/reconcilePendingProfile";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Best-effort, idempotent — see lib/team/reconcilePendingProfile.js.
  await reconcilePendingProfiles(member.companyId).catch((err) =>
    console.error("[settings/members] reconcile failed", err),
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
    return NextResponse.json(
      {
        error: `Plan limit reached: ${limitCheck.currentCount}/${limitCheck.limit} users. Upgrade to invite more.`,
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

  // Better Auth's organizationId is the Organization row's id (Company.authOrgId),
  // NOT Company.id — getCurrentMember exposes both. Passing companyId here meant
  // the invite pointed at a non-existent org.
  const invite = await auth.api.createInvitation({
    body: { email, role, organizationId: member.authOrgId },
    headers: request.headers,
  });

  await db.pendingTeamProfile.upsert({
    where: { companyId_email: { companyId: member.companyId, email } },
    create: {
      companyId: member.companyId,
      email,
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
