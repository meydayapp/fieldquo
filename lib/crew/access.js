// lib/crew/access.js
//
// Who may set the crew inbox up, and whose messages each person may read.
//
// Both questions were answered by accident before this file existed, and both
// answers were wrong in a way the screen could not show.
//
// ══ 1. Setup: why a ROLE check cannot express the rule ═════════════════════
//
// The rule from the owner is: owner, admin or MANAGER may set crew texting up.
// Not a dispatcher, not an estimator, not crew.
//
// app/api/crew/line/route.js asked `requirePermission(role, "user:manage")`,
// and PERMISSIONS.supervisor holds user:manage. Manager and Dispatcher BOTH map
// to `supervisor` (PRESET_TO_ROLE) — two presets, one Postgres enum value — so
// that check cannot tell them apart and let both through. Executed, not read:
//
//   worker      role=employee    user:manage=false  jobCosting=false
//   estimator   role=employee    user:manage=false  jobCosting=false
//   dispatcher  role=supervisor  user:manage=TRUE   jobCosting=false
//   manager     role=supervisor  user:manage=true   jobCosting=true
//
// The refusal string was "Only an owner or admin can set up crew texting",
// which was false in BOTH directions at once: it excluded the Manager the spec
// includes, and it excluded the Dispatcher the code was actually admitting.
// A refusal that misdescribes the gate is the read-only half of the dead-control
// rule in AGENTS.md — the sentence appears to state the policy and doesn't.
//
// ── Why jobCosting is the discriminator ────────────────────────────────────
//
// Discriminating on the GRID rather than the tier is established here:
// lib/permissions/costBasis.js does it for the cost basis, lib/pricing/ladder.js
// does it for what a seat is. `jobCosting` is the only toggle whose value
// differs between the Manager and Dispatcher presets, so it is the only thing
// that CAN separate them without inventing a new column — but it is also the
// honest one. Setting up crew texting buys a phone number on a monthly rental
// and opens a metered tap on the company's credit balance (CREW_SMS_CENTS,
// CREW_MMS_CENTS, CREW_LINE_MONTHLY_CENTS, and an overdraft floor). jobCosting
// is already the "may see and affect the company's money" switch — it is what
// gates the cost basis, the margin and the price floor. Spending the balance
// belongs on the same side of it.
//
// `payments` was the alternative and is worse: it is about taking money from
// clients (Stripe), not spending the company's own, and it would read as "may
// process a payment" on a screen that buys a phone number.
//
// ── What the set actually is ───────────────────────────────────────────────
//
//   owner, admin                     UNRESTRICTED_ROLES — the grid never
//                                    applies to them, here as everywhere.
//   supervisor holding jobCosting    the Manager preset, and any custom grid
//                                    deliberately given the money toggle.
//
// A supervisor with NO grid stored also passes, because hasToggle falls back to
// the coarse role for members who predate the grid — the codebase-wide
// convention (see enforce.js). ROLE_LABELS.supervisor is literally "Manager",
// so "owner, admin or manager" describes that person correctly too.
//
// ══ 2. Reading: whose messages are "theirs" ════════════════════════════════
//
// CrewInboundMessage.senderUserId is the association, resolved from the sender's
// phone against the Worker roster (lib/crew/inbox.js resolveSender). It is the
// only per-person handle a message has:
//
//   * CrewInboxNumber is keyed `companyId @unique` — ONE line per company. There
//     is no per-worker number, so "the number assigned to them" is not a filter
//     that exists today; it would resolve to "the whole company's inbox".
//   * senderPhone is a string, not an identity — Worker.phone isn't unique and
//     `From` is forgeable (see the note on tenantKeyFromInbound).
//
// So "theirs" is senderUserId === their own userId, and nothing else. Messages
// from a number NOT on the roster (senderUserId null) are nobody's: they are the
// "who is this?" queue, which is office work, and they stay out of a scoped
// view rather than being shown to everybody.
//
// ── Why the SCHEDULE ladder decides who sees everyone's ────────────────────
//
// Not a new toggle. A crew message is attributed against the sender's own
// scheduled visits for the day (candidatesFor) — a crew message IS a message
// about somebody's schedule — so the dial that already says "their own" vs
// "everyone's" for schedules is the one that should say it here. scopeFilter
// is the existing machinery for exactly this shape of question, and reusing it
// means a company that moves someone to "edit everyone's schedule" doesn't also
// have to discover a second, differently-named dial.
//
//   Crew           schedule: view_complete_own   → only their own messages
//   Estimator      schedule: view_complete_own   → only their own messages
//   Dispatcher     schedule: edit_all            → everyone's
//   Manager        schedule: edit_delete_all     → everyone's
//   owner/admin    unrestricted                  → everyone's
//
// The platform console sees everything and edits nothing (non-negotiable #3),
// so an impersonating viewer is never narrowed.

import { can } from "@/lib/permissions";
import { hasToggle, scopeFilter, UNRESTRICTED_ROLES } from "@/lib/permissions/enforce";

/**
 * May this member set up, buy, wire, test or release the company's crew line?
 *
 * @param {{role?: string|null, permissions?: object|null}} member
 *        Needs the GRID. getCurrentMember doesn't carry it — pass a member
 *        merged with loadEnforceableMember's `permissions`, or leave it
 *        null/undefined to fall back to the coarse role, which is what
 *        hasToggle does for members who predate the grid.
 */
export function canSetUpCrewTexting(member) {
  if (!member) return false;
  // Two halves, and both must hold. `user:manage` is the authority half and is
  // NOT relaxed — it is the check that was already there, kept so nobody below
  // a supervisor gains anything from this file. `jobCosting` is added on top and
  // is what separates the Manager from the Dispatcher.
  return can(member.role, "user:manage") && hasToggle(member, "jobCosting");
}

// What a refused caller is told. It names the set the predicate above actually
// enforces — the previous sentence named a narrower set than the code allowed,
// which is how a Dispatcher came to hold a control the copy said he didn't.
//
// The second clause is the reason, not decoration: "ask an owner" is useless to
// a dispatcher who cannot see why he was refused, and the reason is also the
// argument for the toggle that gates it.
export const CREW_SETUP_DENIAL =
  "Only an owner, an admin or a manager can set up crew texting — it spends the company's credit balance.";

/** Throws a 403-shaped error, matching requirePermission/requireToggle. */
export function requireCrewSetup(member) {
  if (!canSetUpCrewTexting(member)) {
    const err = new Error(CREW_SETUP_DENIAL);
    err.status = 403;
    throw err;
  }
}

/**
 * The Prisma `where` fragment narrowing the crew inbox to what this member may
 * read: `{}` for everyone's, or `{ senderUserId }` for their own.
 *
 * Used by the READ and by the manual-file WRITE, from one place, because a
 * write that succeeds on a row whose read 403s is the sharpest version of this
 * bug (costBasis.js has the same note, for the same reason).
 *
 * @param {{role?, permissions?, userId?, impersonation?}} member
 */
export function crewMessageScope(member) {
  if (!member) return { senderUserId: "__none__" };

  // Non-negotiable #3: the platform console views everything. It also edits
  // nothing, which is enforced upstream — `viewer` holds no permission at all,
  // so the PATCH that shares this scope is refused before it gets here.
  if (member.impersonation) return {};

  const scope = scopeFilter(member, "schedule", "senderUserId", member.userId);

  // A narrowed scope with no userId to narrow BY would become
  // `{ senderUserId: null }`, which is not "nothing" — it is a positive match on
  // every message from a number that isn't on the roster, i.e. exactly the
  // unknown-sender queue a scoped member should never see. Absence of an
  // identity is not an identity.
  if (scope.senderUserId !== undefined && !scope.senderUserId) {
    return { senderUserId: "__none__" };
  }
  return scope;
}

/** True when this member sees the whole company's crew inbox. */
export function seesAllCrewMessages(member) {
  return Object.keys(crewMessageScope(member)).length === 0;
}

// Re-exported so a caller doesn't have to import from two permission modules to
// ask one question. UNRESTRICTED_ROLES is referenced in the reasoning above.
export { UNRESTRICTED_ROLES };
