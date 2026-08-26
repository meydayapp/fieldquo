// app/api/schedule/team/route.js
//
// The second list on the Calendar: what the people who report to you are doing.
//
// Separate from GET /api/appointments on purpose. That route answers "what am
// I doing" and returns one flat stream; this one answers "what is my crew
// doing" and returns it grouped per person, because a crew list with no names
// in it is just a longer version of your own day.
//
// ── The gate ───────────────────────────────────────────────────────────────
//
// lib/schedule/teamScope.js decides, and it decides BEFORE the query runs.
// Nothing here is filtered out of a result set that was already fetched, so a
// caller who may not see the team never causes their rows to be read at all —
// which is the difference between a permission check and a redaction.
//
// A caller without the permission gets `team: null` and a 200, not a 403.
// There is no data in that response, and an employee opening their own
// calendar has done nothing wrong; a red error banner would be telling them
// off for a feature that was never theirs. A NAMED member id they may not see
// is a different matter and does get refused — see below.
//
// ── The window ─────────────────────────────────────────────────────────────
//
// Fourteen days, matching /app/schedule exactly. Not a design choice so much
// as a promise not to widen anything: that is the horizon a manager can
// already see there, and this list must not quietly become a longer one.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember } from "@/lib/permissions/enforce";
import {
  resolveTeamScope,
  canViewMemberSchedule,
} from "@/lib/schedule/teamScope";
import {
  VISIT_INCLUDE,
  toCalendarEntry,
  bookingToCalendarEntry,
  appointmentToCalendarEntry,
} from "@/lib/schedule/jobVisits";

const HORIZON_DAYS = 14;

export async function GET(request) {
  const { member: session, response } = await memberOrRefusal(request);
  if (response) return response;

  // The grid lives on the Member row, and getCurrentMember's shape does not
  // carry it. Without this the scope resolver would see no `permissions` and
  // fall through to "role only" — which is precisely the parallel notion of
  // seniority this is supposed to avoid.
  const full = await loadEnforceableMember(db, session.id);
  const member = {
    id: session.id,
    userId: session.userId,
    companyId: session.companyId,
    role: full?.role ?? session.role,
    permissions: full?.permissions ?? null,
  };

  // Both lists are scoped to the caller's company in the QUERY, which is what
  // makes "a member id from another tenant is refused" structural: a foreign
  // row is not in the input the resolver searches, so there is nothing for a
  // forged id to match.
  const [members, workers] = await Promise.all([
    db.member.findMany({
      where: { companyId: member.companyId, active: true },
      select: {
        id: true,
        userId: true,
        role: true,
        user: { select: { id: true, name: true } },
      },
    }),
    db.worker.findMany({
      where: { companyId: member.companyId, active: true },
      select: { id: true, userId: true, managerId: true, name: true },
    }),
  ]);

  const scope = resolveTeamScope({ member, members, workers });

  // A single named person, for a drill-down. Checked against the resolved team
  // rather than against a role, so the answer is the same one the list gives.
  const url = new URL(request.url);
  const rawTarget = url.searchParams.get("memberId");
  let people = scope.team;

  if (rawTarget !== null) {
    const verdict = canViewMemberSchedule({
      member,
      targetMemberId: rawTarget,
      members,
      workers,
    });
    if (!verdict.ok) {
      // One sentence for every refusal reason. "That person isn't on your
      // team" and "that person doesn't exist" would let a caller enumerate
      // which member ids are real by reading the wording.
      return NextResponse.json(
        { error: "You don't have access to that person's schedule." },
        { status: 403 },
      );
    }
    people =
      verdict.reason === "self"
        ? members.filter((m) => m.id === member.id)
        : scope.team.filter((m) => m.id === rawTarget);
  }

  // `canSeeTeam` reports the caller's STANDING, never what this particular
  // request happened to ask for. An employee is allowed to fetch their own
  // schedule by id; that must not come back saying they may see a team.
  const canSeeTeam = scope.allowed;

  if (!canSeeTeam && rawTarget === null) {
    return NextResponse.json({ canSeeTeam: false, basis: null, team: null });
  }

  const userIds = people.map((m) => m.userId).filter(Boolean);
  if (userIds.length === 0) {
    // Allowed, but nobody reports to them. An empty array rather than null:
    // "you may see your team and it is empty" is a different statement from
    // "you may not see a team", and the screen renders neither a heading nor
    // an error for either.
    return NextResponse.json({ canSeeTeam, basis: scope.basis, team: [] });
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000);

  // Three queries total, not three per person. /api/team/schedules loops and
  // issues 3N — fine at four members, a page-load stall at forty.
  const [appointments, visits, bookings] = await Promise.all([
    db.appointment.findMany({
      where: {
        companyId: member.companyId,
        assignedToId: { in: userIds },
        scheduledAt: { gte: now, lte: horizon },
      },
      include: {
        client: { select: { id: true, name: true, address: true } },
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    db.jobVisit.findMany({
      where: {
        // Archived jobs are filed away; their visits leave the calendar with
        // them, exactly as on /api/appointments.
        job: { companyId: member.companyId, archivedAt: null },
        assignedToId: { in: userIds },
        scheduledAt: { gte: now, lte: horizon },
      },
      include: VISIT_INCLUDE,
      orderBy: { scheduledAt: "asc" },
    }),
    db.booking.findMany({
      where: {
        // Already-converted bookings are in `appointments` above. Same
        // one-row-per-real-thing rule as /api/appointments.
        appointmentId: null,
        status: { in: ["confirmed", "completed"] },
        eventType: { companyId: member.companyId, userId: { in: userIds } },
        startTime: { gte: now, lte: horizon },
      },
      include: {
        eventType: {
          select: {
            name: true,
            userId: true,
            user: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { startTime: "asc" },
    }),
  ]);

  const byUser = new Map(userIds.map((id) => [id, []]));
  const push = (userId, entry) => {
    if (!entry || !userId) return;
    byUser.get(userId)?.push(entry);
  };

  for (const a of appointments) {
    push(a.assignedToId, {
      ...appointmentToCalendarEntry(a),
      assignedToId: a.assignedToId,
    });
  }
  for (const v of visits) push(v.assignedToId, toCalendarEntry(v));
  for (const b of bookings) push(b.eventType?.userId, bookingToCalendarEntry(b));

  const team = people
    .map((m) => ({
      memberId: m.id,
      userId: m.userId,
      name: m.user?.name || "Team member",
      role: m.role,
      entries: (byUser.get(m.userId) || []).sort(
        (x, y) => new Date(x.scheduledAt) - new Date(y.scheduledAt),
      ),
    }))
    // Busiest first: a manager opens this to find the person who is
    // double-booked, not the one with an empty fortnight.
    .sort((a, b) => b.entries.length - a.entries.length || a.name.localeCompare(b.name));

  return NextResponse.json({ canSeeTeam, basis: scope.basis, team });
}
