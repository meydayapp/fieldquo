// lib/me/tabs.js
//
// The employee home's five tabs, and who gets which five. Pure — no React, no
// database — so app/components/me/MeShell.js, app/components/layout/
// MobileTabBar.js and scripts/check-employee-home.mjs all read ONE table and
// the check can execute the role decision against every preset.
//
// ── Two sets, one shell ──────────────────────────────────────────────────────
//
// A worker's week is Home · Clock · Schedule · Messages · More: the next
// shift, the time clock, the crew (Earnings is a row under More). A
// manager's is Home · Schedule · Team · Messages · More: today's coverage,
// the board, the roster. Same bar, same look, same component — only the
// middle two rows differ, because "am I on the clock" is the worker's
// question all day, and "who is on site" is not one a worker can answer.
// A manager clocks in from More (app/app/me/more/page.js), where the clock
// is a row for them.
//
// ── Who is a "manager" here ────────────────────────────────────────────────
//
// The `schedule` dial at edit_all or above — the same level POST /api/shifts
// and the approval routes under /api/shift-requests ask for, so the person
// shown the manager tabs is exactly the person the routes behind them will
// answer. Owners and admins are unrestricted (lib/permissions/enforce.js).
//
// Fails CLOSED, unlike hasLevel(): a member whose grid never mentions
// `schedule` gets the worker set unless their SEAT is one that runs a crew
// (supervisor holds user:manage — lib/permissions.js). hasLevel's fail-open is
// right for a route gate, where a pre-grid account must keep working; it is
// wrong for choosing a home screen, where the cost of guessing "manager" is a
// crew member handed a Team tab and a coverage strip about themselves.
import { PERMISSION_CATEGORIES } from "@/lib/permissions";
import { clockOffered } from "@/lib/timeclock/access";

/** The two tab sets, by href. Labels are i18n keys; icons live in the component. */
//
// ── Why the worker's second tab is the clock (2026-10-03) ──────────────────
//
// The owner: "Crew members don't have the clock in and clock out option in
// their menu." They did not — the clock was a button on the home card and a
// row three levels down under More › Crew, and the bar a crew member reads
// all day had Earnings where the thing they touch every shift should be.
// Earnings moved to More (its row was already there for this set), which
// costs a tap on a weekly question to save one on a daily action. The clock
// route answers every member (app/api/time-clock resolves the person from
// the session), so this is a link to a page that serves them, never one
// that refuses.
export const ME_TABS = Object.freeze({
  worker: Object.freeze([
    { key: "app.me.tab.home", href: "/app/me", icon: "home" },
    { key: "app.me.tab.clock", href: "/app/clock", icon: "clock" },
    { key: "app.me.tab.schedule", href: "/app/me/schedule", icon: "schedule" },
    { key: "app.me.tab.messages", href: "/app/chat", icon: "messages" },
    { key: "app.me.tab.more", href: "/app/me/more", icon: "more" },
  ]),
  manager: Object.freeze([
    { key: "app.me.tab.home", href: "/app/me", icon: "home" },
    { key: "app.me.tab.schedule", href: "/app/scheduler", icon: "schedule" },
    { key: "app.me.tab.team", href: "/app/me/team", icon: "team" },
    { key: "app.me.tab.messages", href: "/app/chat", icon: "messages" },
    { key: "app.me.tab.more", href: "/app/me/more", icon: "more" },
  ]),
});

const SCHEDULE_LEVELS = (PERMISSION_CATEGORIES.schedule?.levels || []).map((l) => l.value);

/**
 * "manager" or "worker" for a caller of the PermissionProvider shape
 * ({ role, permissions }). Null and junk are workers — the set that shows
 * nothing anybody could not have anyway.
 */
export function meTabSetFor(caller) {
  if (!caller || typeof caller.role !== "string") return "worker";
  if (caller.role === "owner" || caller.role === "admin") return "manager";
  const perms = caller.permissions;
  const level = perms && typeof perms === "object" ? perms.schedule : undefined;
  if (level === undefined) {
    // No grid, or a grid silent on the schedule: the seat decides. A
    // supervisor runs a crew; an employee does not.
    return caller.role === "supervisor" ? "manager" : "worker";
  }
  const have = SCHEDULE_LEVELS.indexOf(level);
  const need = SCHEDULE_LEVELS.indexOf("edit_all");
  return have >= 0 && need >= 0 && have >= need ? "manager" : "worker";
}

/** The five tabs for this caller. */
export function meTabsFor(caller) {
  const tabs = ME_TABS[meTabSetFor(caller)];
  // The clock tab follows the grid rung an owner can switch off per person
  // in Edit access (lib/timeclock/access.js) — a tab to a route that refuses
  // them is the dead control AGENTS.md forbids. Unchanged set otherwise.
  return clockOffered(caller) ? tabs : tabs.filter((t) => t.href !== "/app/clock");
}

/** Is this pathname one of the employee home's own screens? */
export function isMePath(pathname) {
  const p = String(pathname || "");
  return p === "/app/me" || p.startsWith("/app/me/");
}

/**
 * Which tab is lit for a pathname. /app/me is exact — it must not light up
 * under /app/me/earnings — and every other href is a prefix. Returns the
 * href, or null when nothing matches (a manager on /app/me/schedule, say).
 */
export function activeMeTab(tabs, pathname) {
  const p = String(pathname || "");
  for (const tab of tabs || []) {
    if (tab.href === "/app/me" ? p === "/app/me" : p === tab.href || p.startsWith(tab.href + "/")) {
      return tab.href;
    }
  }
  return null;
}
