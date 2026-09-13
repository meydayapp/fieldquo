// lib/me/tabs.js
//
// The employee home's five tabs, and who gets which five. Pure — no React, no
// database — so app/components/me/MeShell.js, app/components/layout/
// MobileTabBar.js and scripts/check-employee-home.mjs all read ONE table and
// the check can execute the role decision against every preset.
//
// ── Two sets, one shell ──────────────────────────────────────────────────────
//
// A worker's week is Home · Schedule · Earnings · Messages · More: the next
// shift, the money, the crew. A manager's is Home · Schedule · Team · Messages
// · More: today's coverage, the board, the roster. Same bar, same look, same
// component — only the middle two rows differ, because "what did I earn" is
// not a question a manager opens the app with, and "who is on site" is not
// one a worker can answer.
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

/** The two tab sets, by href. Labels are i18n keys; icons live in the component. */
export const ME_TABS = Object.freeze({
  worker: Object.freeze([
    { key: "app.me.tab.home", href: "/app/me", icon: "home" },
    { key: "app.me.tab.schedule", href: "/app/me/schedule", icon: "schedule" },
    { key: "app.me.tab.earnings", href: "/app/me/earnings", icon: "earnings" },
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
  return ME_TABS[meTabSetFor(caller)];
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
