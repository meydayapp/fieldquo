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
//
// GET now returns one of TWO payloads, both still plain arrays: the full
// Member row for callers holding "user:view", and ROSTER_SELECT (names, ids,
// role, active) for everyone else. The array-ness is what the five consumer
// pages depend on, so that contract is intact; what changed is that an
// employee opening the tasks page no longer receives the whole team's pay
// rates, home addresses and phone numbers.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { can, requirePermission, toBetterAuthRole } from "@/lib/permissions";
import { rankOf, canRevokeAccess } from "@/lib/permissions/roleManagement";
import { checkUserLimit } from "@/lib/platform/planLimits";
import { recordError } from "@/lib/platform/errorLog";
import { auth } from "@/lib/auth";
import { takeInviteEmailOutcome } from "@/lib/email/teamInvite";
import { reconcilePendingProfiles } from "@/lib/team/reconcilePendingProfile";
import { ensureWorkersForCompany } from "@/lib/team/ensureWorker";

// What a caller WITHOUT "user:view" gets back. Deliberately not the Member row:
// the full row carries laborCostPerHour, home address, phone number and the
// permission grid, and this endpoint is the roster source for the work-areas,
// availability, tasks, appointments and marketing pages — all of which need
// nothing but a name to put in a dropdown. One employee reading another's pay
// rate is a real incident, not a UI nit (see the payroll note in
// lib/permissions.js), and it was one unauthenticated-by-role fetch away.
const ROSTER_SELECT = {
  id: true,
  userId: true,
  role: true,
  active: true,
  user: { select: { id: true, name: true, email: true, image: true } },
};

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Impersonation reads the full record on purpose — the platform console's
  // contract is "view everything, edit nothing", and the writes below are
  // blocked for it separately. Role "viewer" holds no PERMISSIONS entry, so
  // without this line a support session would silently see less than the
  // customer does.
  const seesFullRecord = member.impersonation || can(member.role, "user:view");

  // Backfills, not reads. They were unconditional, which meant a read-only
  // support session mutated the customer's data just by loading the page —
  // and an employee's dropdown triggered a company-wide Worker sweep. Gated on
  // "user:manage" (the people who could have caused the gap) and explicitly
  // never under impersonation: `impersonation` implies role "viewer", which
  // already fails `can()`, but this is the one GET in the codebase that writes
  // and it should say so out loud rather than lean on that.
  if (!member.impersonation && can(member.role, "user:manage")) {
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
  }

  if (!seesFullRecord) {
    const roster = await db.member.findMany({
      where: { companyId: member.companyId },
      select: ROSTER_SELECT,
      orderBy: { createdAt: "asc" },
    });
    // Still a plain array, and still carrying `user`, `userId` and `active` —
    // the five pages listed above key off exactly those.
    return NextResponse.json(roster);
  }

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

  // Whether the email went out is not something to assume. Better Auth calls
  // the send hook and swallows its errors, so the answer is left behind by
  // lib/email/teamInvite.js and collected here. `emailSent: false` still means
  // the invitation row exists — the New User page says so and points at the
  // Team page, where the invite can be cancelled and re-sent.
  const emailOutcome = takeInviteEmailOutcome(member.authOrgId, cleanEmail);

  return NextResponse.json(
    {
      ...invite,
      emailSent: emailOutcome.sent,
      emailError: emailOutcome.sent ? undefined : emailOutcome.error,
    },
    { status: 201 },
  );
}

// Change an existing member's active status or extended profile fields (labor
// cost, contact info).
//
// NOT role, and NOT the permission grid. Both used to be writable here behind
// nothing but "user:manage" — which supervisors hold — so a supervisor could
// PATCH their own userId to role "owner" and take the company. The hierarchy
// rules (no self-promotion, only roles below your own, last owner protected,
// grants clamped to what you hold yourself) live in
// PATCH /api/settings/members/[id]/role and are worth nothing if a second
// endpoint writes the same column without them. There is one door now.
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

  const body = await request.json();
  const {
    userId,
    active,
    phone,
    address,
    city,
    province,
    postalCode,
    country,
    imageUrl,
    laborCostPerHour,
  } = body;

  if (!userId)
    return NextResponse.json({ error: "userId is required" }, { status: 400 });

  // Refused rather than ignored. A stale client that still sends `role` here
  // would otherwise get a 200 and a member whose role never changed, which is
  // the "control that appears to work and doesn't" failure this codebase keeps
  // getting swept for.
  if (body.role !== undefined || body.permissions !== undefined) {
    return NextResponse.json(
      {
        error:
          "Role and permission changes go through PATCH /api/settings/members/[id]/role, which enforces the role hierarchy.",
      },
      { status: 400 },
    );
  }

  const target = await db.member.findUnique({
    where: { userId_companyId: { userId, companyId: member.companyId } },
  });
  if (!target)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── Switching off someone's access is not a "manage people" action ──────
  //
  // This route was gated on requirePermission(role, "user:manage"), which
  // supervisors hold — it means "may run a crew": invite an estimator, set
  // their phone number, fix their address. Nothing about that implies the
  // authority to revoke somebody's login.
  //
  // Deactivation is the most consequential thing on this screen. It ends a
  // person's access to their employer's system, it drops a licensed seat, and
  // as QA demonstrated it can lock the account out entirely. The owner's call:
  // it belongs to the people who own the company's account, not to whoever can
  // edit a roster.
  //
  // Scoped to the `active` flag ONLY. A Manager can still invite, still edit
  // contact details, still set a labour rate — everything the permission was
  // actually for. Creating access stays where it was; removing it moves up.
  if (active !== undefined && !canRevokeAccess(member.role)) {
    return NextResponse.json(
      {
        error:
          "Only an owner or administrator can activate or deactivate a team " +
          "member. Ask one of them to make the change.",
      },
      { status: 403 },
    );
  }

  // ── You cannot switch off your own access ───────────────────────────────
  //
  // The UI disables this checkbox for yourself. The API did not, so a single
  // PATCH locked the caller out permanently — and the response was 401,
  // because the write landed and THEN the session check ran against the
  // now-inactive member. QA reproduced it and locked themselves out of a live
  // tenant; recovery needed another owner.
  //
  // Mirrors the guard the /role endpoint already has ("You can't change your
  // own role"). Same reasoning, same door, different flag — which is exactly
  // the shape of gap a second endpoint leaves when only the first gets the
  // rule.
  if (active === false && userId === member.userId) {
    return NextResponse.json(
      {
        error:
          "You can't deactivate your own account — you'd lock yourself out. " +
          "Ask an owner or another admin to do it.",
      },
      { status: 400 },
    );
  }

  // Rank, not just self. An admin deactivating an OWNER is the same
  // escalation the role endpoint refuses; without this, the active flag is a
  // way around it.
  if (active === false && rankOf(target.role) >= rankOf(member.role)) {
    return NextResponse.json(
      {
        error:
          "You can only deactivate team members below your own role.",
      },
      { status: 403 },
    );
  }

  // ── Never leave the company with nobody who can administer it ───────────
  //
  // The owner guard below covers the last OWNER. It did not cover the case
  // where the last owner is already inactive and an admin switches off the
  // only remaining admin — which orphans the tenant just as completely, with
  // no in-app route back.
  if (active === false && ["owner", "admin"].includes(target.role)) {
    const remaining = await db.member.count({
      where: {
        companyId: member.companyId,
        role: { in: ["owner", "admin"] },
        active: true,
        userId: { not: userId },
      },
    });
    if (remaining === 0) {
      return NextResponse.json(
        {
          error:
            "That's the last active owner or admin. Someone has to be able to " +
            "manage the account — promote or reactivate somebody first.",
        },
        { status: 400 },
      );
    }
  }

  // Deactivating the last active owner locks the company out of its own
  // billing, invitations and role management with no way back in from the app.
  // The role endpoint protects the owner seat on demotion; this is the same
  // seat via the other door.
  if (target.role === "owner" && active === false) {
    const activeOwners = await db.member.count({
      where: { companyId: member.companyId, role: "owner", active: true },
    });
    if (activeOwners <= 1) {
      return NextResponse.json(
        { error: "You can't deactivate the last owner." },
        { status: 400 },
      );
    }
  }

  const updated = await db.member.update({
    where: { userId_companyId: { userId, companyId: member.companyId } },
    data: {
      ...(active !== undefined && { active }),
      ...(phone !== undefined && { phone }),
      ...(address !== undefined && { address }),
      ...(city !== undefined && { city }),
      ...(province !== undefined && { province }),
      ...(postalCode !== undefined && { postalCode }),
      ...(country !== undefined && { country }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(laborCostPerHour !== undefined && { laborCostPerHour }),
    },
  });

  return NextResponse.json(updated);
}
