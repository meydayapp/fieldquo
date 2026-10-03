// lib/nav/phoneBar.js
//
// The phone's bottom bar, per role — which four or five destinations sit
// under a person's thumb, and what "More" opens for them. Pure: no React, no
// database, no icons (the component maps the icon names), so
// app/components/layout/MobileTabBar.js, the More sheet and
// scripts/check-rbac-nav.mjs all read ONE table and the check can run the
// decision over every preset with the real navRowAllowed.
//
// ── Why per role (the owner, 2026-10-03) ─────────────────────────────────────
//
// "The menu should be simple and easy to access. On mobile there are 6
// buttons at the bottom for the main account holder: Leads, Quotes, Jobs,
// Invoices, Chat, More. The core things of the other employees should be
// easily accessed there."
//
// One bar, the pipeline, filtered by the grid, gave everybody else whatever
// survived the filter: an Estimator got Jobs and Invoices they can only read
// and no calendar; a Dispatcher got the office pipeline and no board; a crew
// member, before the 2026-10-03 clock work, got Jobs · Chat · More. Filtering
// can only take rows AWAY from the owner's bar — it can never put the
// Dispatcher's board on it. So each role has its own short list of the things
// it does every day, and the grid still filters that list: a row on a role's
// bar that the grid refuses is dropped exactly as before (navRowAllowed), so a
// custom grid can never be handed a tab that leads to a refusal.
//
//   office     owner, admin — and any member the rules below don't place:
//              Leads · Quotes · Jobs · Invoices · Chat · More (unchanged).
//   crew       isCrewHome (lib/dashboard/crewHome.js) — the same decision that
//              gives them My day on /app: Clock · Today · Chat · More.
//              No money on any of them.
//   estimator  sells but does not run the schedule: Leads · Quotes ·
//              Calendar · Chat · More. The clock is a row in More (and pinned
//              on the desktop rail) — see the note on ESTIMATOR below.
//              Calendar is /app/appointments: site visits and measures are
//              appointments, and that is the estimator's day.
//   dispatch   runs the schedule (meTabSetFor === "manager", i.e. schedule at
//              edit_all or above — Dispatcher, Manager): Schedule · Jobs ·
//              Team · Chat · More.
//
// ── What "More" is ───────────────────────────────────────────────────────────
//
// For office, estimator and dispatch it is the More SHEET (MoreMenu.js): the
// rest of the rail, minus whatever is already on THIS person's bar — a row
// is in one place, never two. For crew it is /app/me/more, the employee
// home's own More page, which already carries their jobs list, earnings,
// time off and supplies behind the same navRowAllowed gates; the sheet's
// forty office rows are not a crew member's menu.
//
// ── Legacy and unresolved callers ─────────────────────────────────────────────
//
// A null caller (provider not resolved yet) and a member with no grid at all
// (pre-grid accounts, hasLevel's fail-open case) get the office bar they had
// before this file existed. A bar that changes shape while a lookup is slow,
// or that moves a long-standing member's tabs because their row predates the
// grid, is worse than one that waits.
import { navRowAllowed } from "@/lib/permissions/nav";
import { navRowState } from "@/lib/features/nav";
import { hasLevel } from "@/lib/permissions/enforce";
import { isCrewHome } from "@/lib/dashboard/crewHome";
import { meTabSetFor } from "@/lib/me/tabs";

// ── The rows ────────────────────────────────────────────────────────────────
//
// `key` is the row's NAV key — the one NAV_REQUIREMENTS and the feature
// registry are keyed on, so the gates below are the rail's gates and not a
// restatement of them. `label` is the i18n key printed under the icon when it
// differs (a tab has ~70px; "Assign shifts" and "Time clock" do not fit, the
// employee home's "Schedule" and "Clock" do). `also` names further nav keys
// that must ALSO allow the row: the Team tab opens the timesheets screen,
// which is gated on timeTracking AND on user:manage (the page's own
// NoAccessPanel), so both rules must pass or the tab is not drawn.
const LEADS = Object.freeze({ key: "app.nav.requests", href: "/app/leads", icon: "leads" });
const QUOTES = Object.freeze({ key: "app.nav.quotes", href: "/app/quotes", icon: "quotes" });
const JOBS = Object.freeze({ key: "app.nav.jobs", href: "/app/jobs", icon: "jobs" });
const INVOICES = Object.freeze({ key: "app.nav.invoices", href: "/app/invoices", icon: "invoices" });
const CHAT = Object.freeze({ key: "app.nav.chat", href: "/app/chat", icon: "chat" });
const CALENDAR = Object.freeze({ key: "app.nav.calendar", href: "/app/appointments", icon: "calendar" });
const CLOCK = Object.freeze({ key: "app.nav.clock", label: "app.me.tab.clock", href: "/app/clock", icon: "clock" });
// "Where am I going today": My day on /app (CrewMyDay) — today's visits with
// the address, directions, the job's photos and checklist, then the rest of
// the week. It is the screen that answers the question; the week view
// (/app/me/schedule) answers "when do I work", which is a weekly question and
// is one tap from My day. `exact` because every /app screen starts with /app.
const TODAY = Object.freeze({ key: "app.nav.home", label: "app.nav.today", href: "/app", icon: "today", exact: true });
const BOARD = Object.freeze({ key: "app.nav.scheduler", label: "app.me.tab.schedule", href: "/app/scheduler", icon: "schedule" });
// Who is on the clock, who is late, whose hours wait for approval — the
// dispatcher's "team" question, answered by the timesheets screen (live
// attendance chips, the approval queue). The roster itself is one tap from
// there (the Team tabs) and in More.
const TEAM = Object.freeze({
  key: "app.nav.timesheets",
  label: "app.me.tab.team",
  href: "/app/settings/team/timesheets",
  icon: "team",
  also: Object.freeze(["app.nav.team"]),
});

// ── ESTIMATOR and the clock ──────────────────────────────────────────────────
//
// Not on the bar. An estimator clocks in and out once a day; leads, quotes and
// the calendar are what they open all day, and a fifth slot spent on a
// twice-a-day action pushes Chat or a pipeline tab into More. The clock is a
// row in the More sheet (MORE_GROUPS, "Crew"), pinned under Home on the
// desktop rail (railPinsClock below), and the clock button is on their own
// home, /app/me (More › My home). The office dashboard on /app has none.
// Crew get it on the bar because for them it IS the daily core: the clock is
// how their day starts, and there is no pipeline competing for the slot.
export const PHONE_BARS = Object.freeze({
  office: Object.freeze([LEADS, QUOTES, JOBS, INVOICES, CHAT]),
  crew: Object.freeze([CLOCK, TODAY, CHAT]),
  estimator: Object.freeze([LEADS, QUOTES, CALENDAR, CHAT]),
  dispatch: Object.freeze([BOARD, JOBS, TEAM, CHAT]),
});

/** What the last slot opens, per set. */
export const PHONE_MORE = Object.freeze({
  office: Object.freeze({ kind: "sheet" }),
  estimator: Object.freeze({ kind: "sheet" }),
  dispatch: Object.freeze({ kind: "sheet" }),
  crew: Object.freeze({ kind: "page", href: "/app/me/more" }),
});

/**
 * Which set a caller of the PermissionProvider shape ({ role, permissions })
 * gets. See the header for the order and the legacy rule.
 */
export function phoneBarSetFor(caller) {
  if (!caller || typeof caller.role !== "string") return "office";
  if (caller.role === "owner" || caller.role === "admin") return "office";
  const perms = caller.permissions;
  if (!perms || typeof perms !== "object" || Array.isArray(perms)) return "office";
  if (isCrewHome(caller)) return "crew";
  if (meTabSetFor(caller) === "manager") return "dispatch";
  if (hasLevel(caller, "requests", "view_only") || hasLevel(caller, "quotes", "view_only")) return "estimator";
  return "office";
}

/** Every nav key a row needs to pass, its own first. */
export function rowGateKeys(row) {
  return [row.key, ...(Array.isArray(row.also) ? row.also : [])];
}

/** Does this row survive the feature flags and the grid — the rail's two filters? */
export function phoneRowAllowed(row, caller, flags) {
  return rowGateKeys(row).every((k) => navRowState(k, flags).show && navRowAllowed(k, caller));
}

/**
 * The bar for this caller: { set, tabs, more }.
 *
 * `tabs` is the set's rows after the same feature-flag and permission filters
 * the rail runs. If filtering leaves nothing but Chat on a non-crew bar — a
 * custom grid at `none` on everything the set carries — the crew set is used
 * instead: the old "Chat · More" bar was the docs/MOBILE-TABBAR.md edge case,
 * and the person it happens to is, by their grid, somebody whose day is the
 * clock and their visits.
 */
export function phoneBarFor(caller, flags = null) {
  let set = phoneBarSetFor(caller);
  let tabs = PHONE_BARS[set].filter((row) => phoneRowAllowed(row, caller, flags));
  if (set !== "crew" && tabs.filter((row) => row.href !== CHAT.href).length === 0) {
    set = "crew";
    tabs = PHONE_BARS.crew.filter((row) => phoneRowAllowed(row, caller, flags));
  }
  return { set, tabs, more: PHONE_MORE[set] };
}

/** Which of a bar's rows is lit for a pathname: exact rows exactly, the rest by prefix. */
export function phoneTabActive(row, pathname) {
  const p = String(pathname || "");
  if (row.exact) return p === row.href;
  return p === row.href || p.startsWith(row.href + "/");
}

/**
 * Is the More slot lit? The sheet: while it is open, or on /app/more. The
 * crew's More page: on any employee-home screen, because that is where every
 * row of it lands (earnings, requests, supplies, team).
 */
export function phoneMoreActive(more, pathname, sheetOpen = false) {
  const p = String(pathname || "");
  if (more?.kind === "page") return p === "/app/me" || p.startsWith("/app/me/");
  return Boolean(sheetOpen) || p === "/app/more" || p.startsWith("/app/more/");
}

// ── The desktop rail ─────────────────────────────────────────────────────────
//
// Same principle above `lg`: the rail is the owner's map of the business and
// stays as it is, but somebody who clocks in every day should not dig for the
// clock under More › Crew. Every set except office pins the Time clock row
// directly under Home (AdminSidebar.js), and the More list drops it so it is
// in one place. The owner and admins keep it where it was — most owners do
// not punch a clock, and those who do find it in More.
export function railPinsClock(caller) {
  return phoneBarSetFor(caller) !== "office";
}
