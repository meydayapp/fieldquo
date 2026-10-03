// lib/timeclock/access.js
//
// Who may use the time clock — ONE rule, read by the routes that serve it,
// the rail row that links to it and every card that offers "Clock in".
//
// The owner, 2026-10-03: the clock should be on the menu for the roles that
// use it by default, and every default must be switchable per person in
// Manage Team → Edit access. So it is a rung of the grid, not a role test:
// the Time Tracking & Timesheets dial gained a bottom rung, `none` ("No
// access"), the same way the document dials did. Every preset sits above it
// (Crew and Estimator at "their own", Dispatcher and Manager at "everyone's"),
// so nothing changes for anybody until an owner deliberately turns a person
// down to "No access" — and then the row, the cards AND the routes all say
// no together. Hiding the row alone would be the cosmetic half AGENTS.md
// forbids.
//
// A member with no grid at all keeps hasLevel's fail-open: pre-grid members
// must not be locked out on deploy (lib/permissions/enforce.js says why).
import { hasLevel } from "@/lib/permissions/enforce";

/** The rung the clock needs — the bottom one above "No access". */
export const CLOCK_CATEGORY = "timeTracking";
export const CLOCK_LEVEL = "view_record_own";

/** May this member ({ role, permissions }) use the time clock? */
export function canUseTimeClock(member) {
  return hasLevel(member, CLOCK_CATEGORY, CLOCK_LEVEL);
}

/** The sentence every refusing route returns, so the screen says one thing. */
export const CLOCK_REFUSAL =
  "The time clock is switched off for you. An owner or admin can turn it on under Manage Team → Edit access.";
