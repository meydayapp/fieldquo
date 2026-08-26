// lib/schedule/teamScope.js
//
// Who is on MY calendar, and whose calendars am I allowed to see next to it.
//
// ── The two lists, and why they are two ────────────────────────────────────
//
// The Calendar answers two different questions and they must not be merged
// into one colour-coded feed:
//
//   1. "What am I doing?"      — everything assigned to me, whatever kind of
//                                row it is. One amalgamated list.
//   2. "What is my crew doing?" — the people who report to me, listed per
//                                person, so a name has a day under it.
//
// Merging them produces a stream where your own 8am is buried between two
// other people's, which is the opposite of what a calendar is for.
//
// ── The gate ───────────────────────────────────────────────────────────────
//
// List 2 is gated, and the gate is RBAC rather than a job title. Two
// conditions, both required:
//
//   * can(role, "user:view") — the coarse floor. Exactly the gate
//     /api/team/schedules already uses, so nothing here shows a person data
//     they could not already reach at /app/schedule. Owner, admin and
//     supervisor pass; employee does not, which is what "employees only their
//     own" means in permission terms.
//
//   * hasLevel(member, "schedule", "edit_all") — the granular grid. The
//     schedule category's levels are view_own · view_complete_own · edit_own ·
//     edit_all · edit_delete_all, so edit_all is the first level that means
//     "everyone" — the same `_all` convention scopeFilter() reads, and the
//     same test /api/appointments already uses to decide whether a member sees
//     the whole company. A supervisor dialled down to view_own therefore gets
//     no team list, and gets no data behind it either: the check runs before
//     the query, not over its results.
//
// Both are narrowing. Neither grants anything that was not already reachable.
//
// ── Who "reports to me" means ──────────────────────────────────────────────
//
// A real reporting structure exists: Worker.managerId, the self-relation leave
// approval already walks (lib/org/reportingLine.js). This reuses it rather
// than inventing a second notion of seniority — two org charts that can
// disagree is worse than one.
//
// The awkward part is that most companies never draw one; the schema says so
// in as many words. So:
//
//   * Owner and admin always get the whole company. They hold "*", they
//     already see everyone at /app/schedule, and an owner who was simply never
//     added to the org chart must not end up with an empty crew list.
//
//   * A supervisor gets their reports when the company HAS drawn a chart, and
//     the whole company when it has not — which is exactly today's behaviour,
//     preserved rather than quietly removed.
//
// `basis` says which of the two happened, so the screen can label the list
// honestly instead of implying an org chart that does not exist.

import { can } from "@/lib/permissions";
import { hasLevel, UNRESTRICTED_ROLES } from "@/lib/permissions/enforce";
import { reportsUnder } from "@/lib/org/reportingLine";

/** The coarse permission that gates the team list. Named once, asserted in the check. */
export const TEAM_SCHEDULE_PERMISSION = "user:view";

/** The granular schedule level that gates it. Same `_all` rule as scopeFilter. */
export const TEAM_SCHEDULE_LEVEL = "edit_all";

const idOf = (v) => (typeof v === "string" && v ? v : null);

/**
 * May this member see anyone's schedule but their own?
 *
 * @param {{role?:string, permissions?:object}} member
 */
export function canSeeTeamSchedule(member) {
  if (!member || typeof member !== "object") return false;
  if (!can(member.role, TEAM_SCHEDULE_PERMISSION)) return false;
  return hasLevel(member, "schedule", TEAM_SCHEDULE_LEVEL);
}

/**
 * The `where` fragment for LIST 1 — everything assigned to this member.
 *
 * One builder rather than the three near-identical fragments /api/appointments
 * used to carry (one per source). They had already drifted once: the visit
 * query and the appointment query agreed only because someone remembered to
 * copy the edit, and the copy is always the one that rots.
 *
 * Returns `{}` for a member whose schedule level is "everyone's" — the same
 * hasLevel test the team gate uses, so one member cannot be "sees everyone"
 * for one list and not the other.
 *
 * `includeUnassigned` is true by default and is load-bearing: an unclaimed
 * appointment nobody can see is a job nobody does. It is the behaviour the
 * calendar has today and removing it would take a view away.
 *
 * @param field  the column naming the assignee. Appointments and visits use
 *               assignedToId; a booking is owned through EventType.userId, so
 *               the caller names it rather than this guessing.
 */
export function ownScheduleFilter(
  member,
  userId,
  { field = "assignedToId", includeUnassigned = true } = {},
) {
  if (hasLevel(member, "schedule", TEAM_SCHEDULE_LEVEL)) return {};
  const mine = { [field]: idOf(userId) };
  return includeUnassigned ? { OR: [mine, { [field]: null }] } : mine;
}

/** Everyone active in the company except the caller. */
function everyoneElse(members, selfUserId) {
  return members.filter((m) => m.userId !== selfUserId);
}

/**
 * The caller's team list.
 *
 * `members` and `workers` MUST already be scoped to the caller's company — a
 * row from another tenant simply cannot be in the input, which is what makes
 * "a foreign member id is refused" true by construction rather than by a
 * comparison somebody might forget to write.
 *
 * @returns {{allowed:boolean, basis:"none"|"company"|"reporting_line", team:object[]}}
 *   `allowed:false` means the list must not be rendered at all — not rendered
 *   empty. A heading over nothing is a control that appears to work.
 */
export function resolveTeamScope({ member, members = [], workers = [] } = {}) {
  const denied = { allowed: false, basis: "none", team: [] };
  if (!member || typeof member !== "object") return denied;
  if (!canSeeTeamSchedule(member)) return denied;

  const selfUserId = idOf(member.userId);
  const list = (Array.isArray(members) ? members : []).filter(
    (m) => m && typeof m === "object" && idOf(m.userId) && idOf(m.id),
  );
  const crew = (Array.isArray(workers) ? workers : []).filter(
    (w) => w && typeof w === "object" && idOf(w.id),
  );

  // Owner and admin: the whole company, always. See the header — being absent
  // from the org chart must not blank an owner's crew list.
  if (UNRESTRICTED_ROLES.has(member.role)) {
    return { allowed: true, basis: "company", team: everyoneElse(list, selfUserId) };
  }

  // No chart drawn anywhere in the company — fall back to what a supervisor
  // sees today. Deliberately "has anyone got a manager", not "have I got one":
  // a company mid-way through drawing its chart should not flip a supervisor
  // between two answers depending on their own row.
  const orgChartDrawn = crew.some((w) => idOf(w.managerId));
  if (!orgChartDrawn) {
    return { allowed: true, basis: "company", team: everyoneElse(list, selfUserId) };
  }

  const self = crew.find((w) => idOf(w.userId) && w.userId === selfUserId);
  // In a company that HAS a chart, a supervisor who is not on it has no
  // reports. Empty is the honest answer, and it is narrower than today — they
  // lose nothing, because /app/schedule is untouched.
  if (!self) return { allowed: true, basis: "reporting_line", team: [] };

  // reportsUnder walks transitively and is cycle-guarded. A supervisor's peers
  // are not under them, so they are not in this set — which is the whole point.
  const under = new Set(reportsUnder(self.id, crew));
  const reportUserIds = new Set(
    crew.filter((w) => under.has(w.id) && idOf(w.userId)).map((w) => w.userId),
  );

  return {
    allowed: true,
    basis: "reporting_line",
    team: list.filter((m) => m.userId !== selfUserId && reportUserIds.has(m.userId)),
  };
}

/**
 * May the caller open ONE named member's schedule?
 *
 * The list endpoint returns the team in bulk, but any per-person drill-down
 * takes an id off the wire, and an id off the wire is hostile until proved
 * otherwise. Answers with a reason rather than a bare boolean so the route can
 * tell "not allowed to see anyone" from "allowed, but not that person".
 *
 * @returns {{ok:boolean, reason:string}}
 */
export function canViewMemberSchedule({
  member,
  targetMemberId,
  members = [],
  workers = [],
} = {}) {
  const target = idOf(targetMemberId);
  // Not a string, empty, null, a number — there is no member here to check.
  if (!target) return { ok: false, reason: "unknown_member" };

  const selfId = idOf(member?.id);
  if (selfId && target === selfId) return { ok: true, reason: "self" };

  const scope = resolveTeamScope({ member, members, workers });
  if (!scope.allowed) return { ok: false, reason: "forbidden" };

  // `.some` over the resolved team, never a lookup on an object keyed by id:
  // "__proto__" and "constructor" are ordinary strings to an array search and
  // inherited properties to a bracket access.
  const inTeam = scope.team.some((m) => m.id === target);
  return inTeam
    ? { ok: true, reason: scope.basis }
    : { ok: false, reason: "not_in_team" };
}
