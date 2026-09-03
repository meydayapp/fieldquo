// lib/fleet/access.js
//
// Who may see the vans, and who may see what the vans cost. Two different
// questions, deliberately gated on two different axes.
//
// ══ The axis this feature sits on ══════════════════════════════════════════
//
// A plate, an odometer reading and an insurance renewal date are OPERATIONS.
// They are the same class of company record as the roster and the marketing
// campaigns, which is `user:manage` — owner, admin, supervisor
// (lib/permissions.js). A dispatcher deciding which van goes where needs to
// know one of them is off the road on Thursday.
//
// A van's purchase price, its book value and its monthly depreciation are the
// COST BASIS. That is lib/permissions/costBasis.js's `fixedCosts` resource,
// already the gate on the asset register these rows hang off, and the reason
// it exists is that a Dispatcher was found reading the truck loan off the
// Overhead screen.
//
// So: one gate to open the screen, a second to reveal the money on it. The
// alternative — one gate at the stricter level — would have hidden an expired
// insurance certificate from the person whose job is to send the van out,
// which is the wrong failure to choose.
//
// A crew member holds neither and does not get the screen. That is the brief's
// "a crew member probably should not see what the van cost", taken at its word
// and then some: they do not see the register at all today, and this feature
// does not open a second door onto it.
import { can } from "@/lib/permissions";
import { canReadCostBasis } from "@/lib/permissions/costBasis";

/** The coarse authority the fleet screen sits behind. */
export const FLEET_PERMISSION = "user:manage";

/** May this member open the fleet screen at all? */
export function canReadFleet(member) {
  return !!member && can(member.role, FLEET_PERMISSION);
}

/**
 * May this member change a van's record?
 *
 * The same rule as the read, on purpose. A write that succeeds where the read
 * refuses is the exact bug costBasis.js was written to fix, and repeating it
 * one feature later would be a poor look.
 */
export function canWriteFleet(member) {
  return canReadFleet(member);
}

/**
 * May this member see what the van cost?
 *
 * Delegated whole to the cost-basis gate rather than restated, so a change to
 * who may read the company's cost basis reaches this screen the same day.
 */
export function canSeeVehicleCost(member) {
  return canReadFleet(member) && canReadCostBasis(member, "fixedCosts");
}

const FLEET_DENIAL =
  "Only an owner, admin or supervisor can see or change the company's vehicles.";

function refuse(message) {
  const err = new Error(message);
  err.status = 403;
  return err;
}

/** Throws a 403-shaped error, matching requireLevel/requireCostBasisRead. */
export function requireFleetRead(member) {
  if (!canReadFleet(member)) throw refuse(FLEET_DENIAL);
}

export function requireFleetWrite(member) {
  if (!canWriteFleet(member)) throw refuse(FLEET_DENIAL);
}
