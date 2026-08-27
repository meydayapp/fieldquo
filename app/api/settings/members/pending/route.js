// app/api/settings/members/pending/route.js
//
// Invited-but-not-yet-accepted rows + seat usage, for the Manage Team page.
// Kept separate from GET /api/settings/members so that endpoint's response
// shape stays the plain array other pages already depend on.
//
// ── Why the payload is filtered now ────────────────────────────────────────
//
// GET /api/settings/members went to real trouble to keep laborCostPerHour and
// the permission grid away from people who shouldn't see them. This endpoint
// did a `findMany` with no `select` and no permission check at all, so the
// same data walked out through the invitations list — plus the phone number
// and home address every new hire types into the invite form. A pending hire's
// record is not less private than an accepted one; it is the same person,
// one click earlier.
//
// The rules below are deliberately the same ones the members route applies,
// because a second endpoint over the same fields with its own idea of who may
// read them is how the first gap opened.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { countSeats } from "@/lib/pricing/ladder";
import { describeAccess } from "@/lib/permissions/accessPresets";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { can } from "@/lib/permissions";
import { rankOf } from "@/lib/permissions/roleManagement";
import {
  loadEnforceableMember,
  redactPay,
  UNRESTRICTED_ROLES,
} from "@/lib/permissions/enforce";
import { checkUserLimit } from "@/lib/platform/planLimits";

// What a caller WITHOUT "user:view" gets: exactly the four fields the Team
// page renders for a pending row — the name, the address the invite went to,
// the role badge (ROLE_LABELS[p.role]) and the id the cancel button posts to.
// Everything else on PendingTeamProfile is the invite form's captured profile:
// pay rate, permission grid, phone, street address, city, postcode. None of it
// is on screen, so none of it needs to be in the response.
const PENDING_ROSTER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
};

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Same test as the members route, including the impersonation clause: the
  // platform console's contract is "view everything, edit nothing", and role
  // "viewer" holds no PERMISSIONS entry, so without this a support session
  // would see less than the customer does.
  const seesFullRecord = member.impersonation || can(member.role, "user:view");

  const [pending, activeMembers, limitCheck] = await Promise.all([
    db.pendingTeamProfile.findMany({
      where: { companyId: member.companyId },
      orderBy: { createdAt: "desc" },
      ...(seesFullRecord ? {} : { select: PENDING_ROSTER_SELECT }),
    }),
    // The grid, not a count. A seat is what somebody can DO — see
    // isBillableSeat — and counting rows would bill the crew.
    db.member.findMany({
      where: { companyId: member.companyId, active: true },
      select: { role: true, permissions: true },
    }),
    checkUserLimit(member.companyId),
  ]);

  // Seat usage is not restricted — /app/settings/team/new reads it to warn
  // before someone fills in a form they can't submit, and it says nothing
  // about any individual. The roster is the same either way, so the two
  // branches can't disagree about how many licences are in use.
  //
  // ── Seats and crew are counted apart, because they are billed apart ───────
  //
  // This was `activeCount + pending.length` — every row a seat, crew included.
  // Under the seat ladder crew are free, so that number billed a shop for the
  // whole van, and would have told an owner they were out of licences while
  // every person supposedly consuming one cost nothing.
  //
  // Pending invitations count on the side they will land on: an invitation
  // carries the role and grid it was issued with, so an owner who invites three
  // estimators sees three seats go before anybody accepts, which is the only
  // reason to show the number in advance.
  //
  // Note the narrow branch above drops `permissions` from pending rows on
  // purpose. isBillableSeat falls back to the ROLE when a grid is absent, which
  // is exactly right here and is why this needs no widening of that select.
  const roster = [
    ...activeMembers,
    ...pending.map((p) => ({ role: p.role, permissions: p.permissions ?? null })),
  ];
  const counted = countSeats(roster);

  // What people actually ARE, so "3 of 3 seats" reads as an owner, a manager
  // and a dispatcher rather than leaving somebody to count the list by hand.
  const breakdown = {
    administrator: 0,
    manager: 0,
    dispatcher: 0,
    worker: 0,
    crew: 0,
    custom: 0,
  };
  for (const m of roster) {
    const a = describeAccess(m);
    const kind = a?.presetKey || a?.kind || "custom";
    const bucket =
      kind === "administrator"
        ? "administrator"
        : kind === "manager"
          ? "manager"
          : kind === "dispatcher"
            ? "dispatcher"
            : kind === "workerFullView"
              ? "worker"
              : kind === "worker"
                ? "crew"
                : "custom";
    breakdown[bucket] += 1;
  }

  const seats = {
    used: counted.seats,
    limit: limitCheck.limit ?? null,
    // Crew carry no limit here. How many crew a tier allows is a PLAN question
    // and belongs with the plan; this is a roster count that predates it.
    crew: counted.crew,
    breakdown,
  };

  if (!seesFullRecord) {
    return NextResponse.json({ pending, seats });
  }

  // ── Pay and the permission grid, for the people who do hold user:view ────
  //
  // A supervisor passes the check above and still must not read either. No
  // `ownUserId` here, unlike the members route: a pending profile belongs to
  // someone who has no account yet, so there is no "your own row" case to
  // preserve — and passing an id that could never match would read as though
  // there were.
  const full = await loadEnforceableMember(db, member.id);

  return NextResponse.json({
    pending: pending.map((p) => {
      const out = redactPay(full, p, { fields: ["laborCostPerHour"] });

      // The grid follows the same rule as editing it: anyone ranked below you.
      // Not `can(role, "user:manage")` — supervisors hold that, and an invite
      // pending for an Administrator would hand them exactly which dials that
      // account will have. Own-row doesn't arise, for the reason above.
      //
      // PendingTeamProfile.role is nullable (older rows predate it), and
      // rankOf returns -1 for anything it doesn't know. Ranking below you is
      // asserted rather than inferred from that -1: "we don't know what this
      // invite is for" must not read as "junior to everyone".
      //
      // Owners and admins are exempt from that caution, because they are
      // exempt from the grid entirely (UNRESTRICTED_ROLES) — hiding a legacy
      // invite's permissions from the owner who set them would be a
      // regression, not a boundary.
      const targetRank = rankOf(p.role);
      const managesThem =
        UNRESTRICTED_ROLES.has(member.role) ||
        (targetRank >= 0 && rankOf(member.role) > targetRank);
      if (!managesThem) delete out.permissions;
      return out;
    }),
    seats,
  });
}
