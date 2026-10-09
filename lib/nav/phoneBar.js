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
//              Clock · Leads · Quotes · Jobs · Chat · More.
//   crew       isCrewHome (lib/dashboard/crewHome.js) — the same decision that
//              gives them My day on /app: Clock · Today · Chat · More.
//              No money on any of them.
//   estimator  sells but does not run the schedule: Clock · Quotes ·
//              Calendar · Chat · More. Calendar is /app/appointments: site
//              visits and measures are appointments, and that is the
//              estimator's day.
//   dispatch   runs the schedule (meTabSetFor === "manager", i.e. schedule at
//              edit_all or above — Dispatcher, Manager): Clock · Schedule ·
//              Team · Chat · More.
//   marketing  the marketing agency (lib/permissions/marketingAgency.js):
//              Results · Leads · Funnels · More. No clock (their grid has
//              none) and no Chat — the company room is the company's, and
//              the agency is refused it.
//
// The clock is the first tab on every bar since 2026-10-03 — see "Everyone
// has a clock" below for what each set gave up for it, and why.
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
import { isMarketingAgency } from "@/lib/permissions/marketingAgency";
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
// The marketing agency's three places (2026-10-09). Short labels for the same
// reason the employee home's are: a tab has ~70px.
const MARKETING_RESULTS = Object.freeze({ key: "app.nav.marketingResults", label: "app.me.tab.results", href: "/app/marketing/results", icon: "results" });
const MARKETING_LEADS = Object.freeze({ key: "app.nav.marketingLeads", label: "app.me.tab.marketingLeads", href: "/app/marketing/leads", icon: "leads" });
const FUNNELS = Object.freeze({ key: "app.nav.funnels", href: "/app/funnels", icon: "funnels" });
const TEAM = Object.freeze({
  key: "app.nav.timesheets",
  label: "app.me.tab.team",
  href: "/app/settings/team/timesheets",
  icon: "team",
  also: Object.freeze(["app.nav.team"]),
});

// ── Everyone has a clock (the owner, 2026-10-03) ─────────────────────────────
//
// "Everyone should have a clock, even the boss." Until then only crew had it
// on the bar; an estimator, a dispatcher and the owner found it in More. The
// bars keep their size — five slots, the owner's six — so each set gave one
// tab to More, the one with the most other ways in:
//
//   office     Invoices. An invoice is raised from its job (the job page's
//              "Create invoice", app/app/jobs/[id]/JobDetail.js) or from the
//              floating + (QUICK_ADD_ITEMS), and a payment arrives as a
//              notification that opens the invoice. Leads, Quotes and Jobs are
//              where the day's work is looked FOR; Invoices is mostly arrived
//              at from one of them.
//   estimator  Leads. A new lead reaches an estimator as a notification that
//              opens it (lib/notifications/catalog.js "lead.created"), and the
//              lead they act on becomes a site visit on the Calendar — which
//              stays. The board of every lead is the office's triage screen.
//   dispatch   Jobs. The dispatch board opens a job from every booking on it
//              (app/app/scheduler/DayBoard.js, ShiftModal.js), and Team is the
//              one answer to "who is on the clock" — the other daily question.
//   crew       nothing: the clock was already first, with room to spare.
//
// Chat stays on every bar: it has no other door (a message does not ring the
// bell), and the company room is the one thing every role shares.
//
// This is reasoning from the screens, not from counts: the per-role page
// counts that would settle it live in AnalyticsEvent (memberId, viewport),
// and were not read for this change. If they disagree, the swap is one line
// per set below.
//
// The swap is undone for anybody whose clock is switched off (the "No access"
// rung, lib/timeclock/access.js): their bar is the set as it was before, so a
// person without a clock does not lose a tab to a button they cannot have.
export const PHONE_BARS = Object.freeze({
  office: Object.freeze([CLOCK, LEADS, QUOTES, JOBS, CHAT]),
  crew: Object.freeze([CLOCK, TODAY, CHAT]),
  estimator: Object.freeze([CLOCK, QUOTES, CALENDAR, CHAT]),
  dispatch: Object.freeze([CLOCK, BOARD, TEAM, CHAT]),
  marketing: Object.freeze([MARKETING_RESULTS, MARKETING_LEADS, FUNNELS]),
});

/** Each set without the clock — the bar of somebody whose clock is switched off. */
export const PHONE_BARS_NO_CLOCK = Object.freeze({
  office: Object.freeze([LEADS, QUOTES, JOBS, INVOICES, CHAT]),
  crew: Object.freeze([TODAY, CHAT]),
  estimator: Object.freeze([LEADS, QUOTES, CALENDAR, CHAT]),
  dispatch: Object.freeze([BOARD, JOBS, TEAM, CHAT]),
  marketing: Object.freeze([MARKETING_RESULTS, MARKETING_LEADS, FUNNELS]),
});

/** What the last slot opens, per set. */
export const PHONE_MORE = Object.freeze({
  office: Object.freeze({ kind: "sheet" }),
  estimator: Object.freeze({ kind: "sheet" }),
  dispatch: Object.freeze({ kind: "sheet" }),
  crew: Object.freeze({ kind: "page", href: "/app/me/more" }),
  // The sheet, which for them holds only what AGENCY_NAV_ROWS allows.
  marketing: Object.freeze({ kind: "sheet" }),
});

/**
 * Which set a caller of the PermissionProvider shape ({ role, permissions })
 * gets. See the header for the order and the legacy rule.
 */
export function phoneBarSetFor(caller) {
  if (!caller || typeof caller.role !== "string") return "office";
  if (caller.role === "owner" || caller.role === "admin") return "office";
  // Before the crew test: the agency's grid is at the bottom of every ladder,
  // which isCrewHome would read as Crew — My day, the clock, the jobs list.
  if (isMarketingAgency(caller)) return "marketing";
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
  // The clock's own gate decides which list: the set with the clock, or the
  // set as it was before the clock took a slot (see "Everyone has a clock").
  const bars = phoneRowAllowed(CLOCK, caller, flags) ? PHONE_BARS : PHONE_BARS_NO_CLOCK;
  let set = phoneBarSetFor(caller);
  let tabs = bars[set].filter((row) => phoneRowAllowed(row, caller, flags));
  // "Nothing left but Chat" — and the clock, which every set now carries and
  // so says nothing about which set this person's grid actually serves.
  if (set !== "crew" && set !== "marketing" && tabs.filter((row) => row.href !== CHAT.href && row.href !== CLOCK.href).length === 0) {
    set = "crew";
    tabs = bars.crew.filter((row) => phoneRowAllowed(row, caller, flags));
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
// clock under More › Crew. The Time clock row is pinned directly under Home
// (AdminSidebar.js), and the More list drops it so it is in one place.
//
// For every set since 2026-10-03, office included. It used to skip the owner
// and admins ("most owners do not punch a clock"); the owner's answer was
// "everyone should have a clock, even the boss". An owner with no Worker row
// is offered "Set yourself up to clock in" on /app/clock (lib/timeclock/
// selfEnrol.js), which costs no seat and puts nobody on a pay run — owners
// stay off payroll unless "Pay me through payroll" is on (Team › Your own
// rate). Crew do not see the rail at all (lib/nav/crewShell.js).
//
// The one person it is not pinned for is somebody whose clock is switched off
// — the row would be filtered out anyway (navRowAllowed), and saying so here
// keeps the decision readable without React.
export function railPinsClock(caller) {
  return phoneRowAllowed(CLOCK, caller, null);
}
