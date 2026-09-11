// lib/subcontractors/access.js
//
// Who may see the subs, and who may see what the subs are owed. Two
// different questions, gated on two different axes — the same split
// lib/fleet/access.js makes for the vans, and for the same reason.
//
// ══ The axis the roster sits on ════════════════════════════════════════════
//
// A sub's name, trade, phone number and whether their certificate of
// insurance is still valid are OPERATIONS. They are the same class of company
// record as the employee roster and the vans, which is `user:manage` — owner,
// admin, supervisor (lib/permissions.js). The dispatcher putting the
// electrician on Thursday's visit needs to know their WSIB clearance lapsed.
//
// ══ The axis the money sits on ═════════════════════════════════════════════
//
// What was agreed with the sub on a job, what has been paid, and the
// year-to-date total that becomes the T5018 are the job's COST. That is the
// `jobCosting` toggle: the one gate app/api/jobs/[id]/costing/route.js already
// reads, and the brief's own instruction — "a member who cannot see job cost
// must not see agreedAmount". A supervisor whose grid says jobCosting:false
// opens the roster, sees the lapsed insurance, and sees no figures.
//
// So: one gate to open the screen, a second to reveal the money on it. One
// stricter gate would have hidden an expired COI from the person whose job is
// to decide whether that sub goes on site tomorrow, which is the wrong
// failure to choose.
//
// The sidebar row (lib/permissions/nav.js, "app.nav.subcontractors") is gated
// on exactly the roles `user:manage` resolves to. scripts/check-subcontractors.mjs
// executes both against every preset and fails if they ever disagree.
import { can } from "@/lib/permissions";
import { hasToggle } from "@/lib/permissions/enforce";

/** The coarse authority the subcontractor roster sits behind. */
export const SUBCONTRACTOR_PERMISSION = "user:manage";

/** The toggle that reveals agreed amounts, payments and year-to-date totals. */
export const SUBCONTRACTOR_MONEY_TOGGLE = "jobCosting";

/** May this member open the roster at all? */
export function canReadSubcontractors(member) {
  return !!member && can(member.role, SUBCONTRACTOR_PERMISSION);
}

/**
 * May this member change a sub's record — add one, edit it, file a document?
 *
 * The same rule as the read, on purpose: a write that succeeds where the read
 * refuses is the bug lib/permissions/costBasis.js was written to fix.
 */
export function canWriteSubcontractors(member) {
  return canReadSubcontractors(member);
}

/**
 * May this member see what a sub is owed and what they were paid?
 *
 * Requires the roster gate too: jobCosting on its own answers for somebody
 * who may not open the roster the figures belong to.
 */
export function canSeeSubcontractorMoney(member) {
  return canReadSubcontractors(member) && hasToggle(member, SUBCONTRACTOR_MONEY_TOGGLE);
}

const ROSTER_DENIAL =
  "Only an owner, admin or supervisor can see or change the company's subcontractors.";
const MONEY_DENIAL =
  "Your access level doesn't include job costing, so what subcontractors are owed and paid isn't shown.";

function refuse(message) {
  const err = new Error(message);
  err.status = 403;
  return err;
}

/** Throws a 403-shaped error, matching requireLevel / requireFleetRead. */
export function requireSubcontractorRead(member) {
  if (!canReadSubcontractors(member)) throw refuse(ROSTER_DENIAL);
}

export function requireSubcontractorWrite(member) {
  if (!canWriteSubcontractors(member)) throw refuse(ROSTER_DENIAL);
}

export function requireSubcontractorMoney(member) {
  if (!canSeeSubcontractorMoney(member)) throw refuse(MONEY_DENIAL);
}
