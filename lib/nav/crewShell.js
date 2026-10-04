// lib/nav/crewShell.js
//
// The crew's back office from `lg` up: no rail, no accordion — a slim header,
// one big clock button under it, and their few places as big plain buttons.
// Pure (no React, no icons — the component maps the icon names), so
// app/components/layout/CrewShell.js, AdminSidebar.js, TopBar.js and
// scripts/check-rbac-nav.mjs all read ONE decision.
//
// ── Why (the owner, 2026-10-03) ──────────────────────────────────────────────
//
// "Some workers are old and need to have simple UI like what we had been
// building. For crews I don't think we need the accordion because there is
// almost no menus for them — just a little header with the button under it."
//
// A crew grid leaves a dozen rows on a rail built for forty, folded into five
// groups that open one at a time. For somebody whose day is "clock in, see
// where I'm going, talk to the office", that is a filing cabinet with three
// drawers worth opening. So crew get no rail and no phone drawer (the same
// accordion behind the hamburger); the phone keeps its bottom bar (Clock ·
// Today · Chat · More, lib/nav/phoneBar.js), and from `lg` up the bar's rows
// become the big buttons below.
//
// ── Nothing that was reachable stops being reachable ─────────────────────────
//
// Every other row the rail and the drawer offered a crew member — after the
// same feature, permission and trade filters — is listed as a big row on
// their More page (/app/me/more, "Everything else"), which is the last button
// here and the last tab on their phone. A page, not a hidden menu.
// scripts/check-rbac-nav.mjs walks the Crew preset through the real gates and
// fails if a row the rail would show is in neither place.
//
// ── Who ──────────────────────────────────────────────────────────────────────
//
// Exactly the people the phone gives the crew bar to (phoneBarFor(...).set ===
// "crew"), including a custom grid that filters down to it. A null caller (the
// provider not resolved) and a pre-grid member keep the rail they had — the
// same "a shell that changes shape while a lookup is slow is worse than one
// that waits" rule as the phone bar.
import { phoneBarFor, phoneRowAllowed } from "@/lib/nav/phoneBar";

/** Does this caller get the crew shell instead of the rail? */
export function usesCrewShell(caller, flags = null) {
  if (!caller || typeof caller.role !== "string") return false;
  return phoneBarFor(caller, flags).set === "crew";
}

// The big buttons under the clock, in reading order. `key` is the nav key the
// gates are keyed on; `label` the short word printed (a nav key whose own
// label is longer, like "Time clock", gets the employee home's short one).
// Today is My day on /app (CrewMyDay) — where to be, how to get there; My
// schedule is the week; Jobs is the crew's own jobs list (assigned jobs only,
// lib/permissions/enforce.js); More is the page that holds everything else.
export const CREW_BUTTONS = Object.freeze([
  Object.freeze({ key: "app.nav.home", label: "app.nav.today", href: "/app", icon: "today", exact: true }),
  Object.freeze({ key: "app.nav.mySchedule", href: "/app/me/schedule", icon: "schedule" }),
  Object.freeze({ key: "app.nav.chat", href: "/app/chat", icon: "chat" }),
  Object.freeze({ key: "app.nav.jobs", href: "/app/jobs", icon: "jobs" }),
  Object.freeze({ key: "app.nav.more", href: "/app/me/more", icon: "more" }),
]);

/** The clock button's destination — the clock screen does the punching (activity, job, GPS, offline queue). */
export const CREW_CLOCK_HREF = "/app/clock";

/** The buttons this caller is offered, through the rail's own two gates. */
export function crewButtonsFor(caller, flags = null) {
  return CREW_BUTTONS.filter((row) => row.href === "/app/me/more" || phoneRowAllowed(row, caller, flags));
}

/** Is a button lit for this pathname? Today exactly; More on every employee-home screen it lists; the rest by prefix. */
export function crewButtonActive(row, pathname) {
  const p = String(pathname || "");
  if (row.exact) return p === row.href;
  if (row.href === "/app/me/more") return p === row.href;
  return p === row.href || p.startsWith(row.href + "/");
}

/**
 * What the big clock button says, from GET /api/time-clock's answer.
 * `null` (not loaded, failed, refused) is the neutral "Time clock" — never a
 * guess at "Clock in" for somebody who is in fact clocked in.
 *
 * @returns {"in"|"out"|"break"|"open"} in = offer Clock in; out = offer Clock
 *          out; break = on a break; open = state unknown, just open the clock
 */
export function crewClockState(answer) {
  if (!answer || typeof answer !== "object" || !answer.worker) return "open";
  const open = answer.open;
  if (!open || typeof open !== "object") return "in";
  const breaks = Array.isArray(open.breaks) ? open.breaks : [];
  return breaks.some((b) => b && b.end == null) ? "break" : "out";
}
