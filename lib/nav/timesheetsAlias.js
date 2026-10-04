// lib/nav/timesheetsAlias.js
//
// Where /app/timesheets sends somebody.
//
// The live test (2026-10-04) typed /app/timesheets and got a 404: Timesheets
// lives at /app/settings/team/timesheets, under the Team tabs, because the
// roster and the hours are one screen family. Moving it would break every
// link and bookmark that already points there (the rail's More › Crew row,
// the dispatcher's Team tab, the manager home's "Timesheets to approve"), so
// the short address is an alias instead.
//
// For whom: the timesheets screen refuses below user:manage (its own
// NoAccessPanel, and the routes behind it). Sending somebody there only to be
// refused would be a dead link wearing an address, so a person without it —
// crew, an estimator — goes to their OWN hours, the Time log on the clock,
// which is the same question asked about themselves. An unresolved caller
// (the provider still loading) goes to Timesheets, which then answers for
// itself: the same fall-open every nav rule here follows.
//
// Pure — the page and scripts/check-nav-audit.mjs both run it.
import { can } from "@/lib/permissions";

export const TIMESHEETS_HREF = "/app/settings/team/timesheets";
export const OWN_HOURS_HREF = "/app/clock?tab=log";

/** @param caller { role } from PermissionProvider, or null while unresolved */
export function timesheetsAliasTarget(caller) {
  if (!caller) return TIMESHEETS_HREF;
  return can(caller.role, "user:manage") ? TIMESHEETS_HREF : OWN_HOURS_HREF;
}
