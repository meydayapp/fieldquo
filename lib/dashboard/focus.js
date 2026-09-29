// lib/dashboard/focus.js
//
// "Your focus" — the middle of the home screen, driven by what the owner said
// they want FieldQuo to help with first (Company.signupPriority and every key
// in Company.signupFocus, from the welcome questions in lib/signup/welcome.js).
// Pure: the facts arrive from lib/dashboard/homeData.js, the words from the
// catalogue (app.dash.focus.*), and scripts/check-dashboard-home.mjs proves
// that EVERY focus key the welcome screens offer lands on at least one real
// card, and that a card with no data behind it becomes the step to set it up
// — never a number nobody measured.
//
// ── Three kinds of card, and the one kind that does not exist ──────────────
//
//   metric    a count or amount the loader actually read ("3 quotes waiting")
//   status    a yes/no the database states ("Card payments are on")
//   shortcut  a link to a real screen that does the thing
//   setup     what a metric or status turns into when the thing it measures
//             has never been set up — the step, with its link
//
// There is no "sample" card. A fact the member may not see (null from the
// loader) removes the card; it is not drawn at zero. A setup step is offered
// only to someone who can take it (canManage) — a crew lead told to connect
// Stripe is being handed a door they do not have the key to.
//
// ── The four priorities ───────────────────────────────────────────────────
//
// The keys are welcome.js's: professional, control, win_more, exploring. The
// owner's brief for this screen named "get paid faster" as a priority; the
// signup screens have no such priority (paid-faster lives UNDER control as
// the focus "invoices_paid_faster", and "invoicing_payments" under
// professional). The columns are the source of truth, so the four versions
// here are the four the columns can hold.

import { WELCOME_FOCUS, WELCOME_PRIORITIES, focusOptionsFor } from "@/lib/signup/welcome";

export const FOCUS_PRIORITY_KEYS = Object.freeze(WELCOME_PRIORITIES.map((p) => p.key));
export const FOCUS_KEYS = Object.freeze(Object.keys(WELCOME_FOCUS));

/** How many cards the section shows. More than this and it is a second dashboard. */
export const FOCUS_CARD_LIMIT = 6;

/**
 * Every focus key → the cards that answer it, most useful first. The check
 * holds this table to "every WELCOME_FOCUS key, at least one card, every card
 * defined".
 */
export const FOCUS_CARD_MAP = Object.freeze({
  sending_quotes: ["quotes_sent_month", "new_quote"],
  approvals_deposits: ["quotes_awaiting", "deposits"],
  invoicing_payments: ["money_owed", "card_payments"],
  attracting_clients: ["new_requests_month", "website"],
  client_organization: ["clients"],
  scheduling: ["unscheduled_jobs", "visits_today"],
  onsite_info: ["onsite_today"],
  team_management: ["team", "timesheets_pending"],
  route_planning: ["route_today"],
  automating_admin: ["quote_follow_ups", "auto_reminders"],
  invoices_paid_faster: ["overdue", "auto_reminders"],
  jobs_on_the_go: ["visits_today", "mobile"],
  leads_followups: ["unanswered_leads", "quote_follow_ups"],
  repeat_business: ["reviews", "maintenance_plans"],
  more_requests: ["booking_link", "instant_quotes"],
  winning_quotes: ["conversion", "quotes_awaiting"],
  never_miss_leads: ["unanswered_leads", "receptionist"],
  manage_clients: ["clients"],
  something_else: ["help"],
});

/**
 * What each priority leads with when no focus was picked (a company that
 * chose a priority in the dashboard picker and skipped the chips), and the
 * order the cards take when several were.
 */
export const PRIORITY_LEAD_CARDS = Object.freeze({
  professional: ["quotes_sent_month", "deposits", "website"],
  control: ["visits_today", "unscheduled_jobs", "overdue"],
  win_more: ["unanswered_leads", "new_requests_month", "conversion"],
  exploring: ["new_quote", "clients", "help"],
});

const n = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** A setup step's measured state, or null when the member was not given it. */
function step(facts, key) {
  const s = facts?.setup?.[key];
  if (!s || typeof s !== "object") return null;
  return { done: s.done === true, applies: s.applies !== false };
}

/**
 * The card definitions. `resolve(facts, perms)` returns the card or null.
 * `navKey` ties a shortcut to a feature flag (lib/features/registry.js) so a
 * card never links to a screen the company's plan has hidden.
 */
export const FOCUS_CARDS = Object.freeze({
  quotes_sent_month: {
    resolve: (f, p) => {
      const v = n(f.quotesSentThisMonth);
      if (v == null) return null;
      if (n(f.quotesEver) === 0) return p.canCreateQuote ? { state: "setup", href: "/app/quotes/new" } : null;
      return { state: "metric", value: v, href: "/app/quotes" };
    },
  },
  new_quote: {
    resolve: (f, p) => (p.canCreateQuote ? { state: "shortcut", href: "/app/quotes/new" } : null),
  },
  quotes_awaiting: {
    resolve: (f) => {
      const v = n(f.quotesAwaiting);
      return v == null ? null : { state: "metric", value: v, href: "/app/quotes" };
    },
  },
  deposits: {
    resolve: (f, p) => {
      const s = step(f, "payment_schedule");
      if (!s || !p.canManage) return null;
      return s.done
        ? { state: "status", on: true, href: "/app/settings/company#payment-schedule" }
        : { state: "setup", href: "/app/settings/company#payment-schedule" };
    },
  },
  money_owed: {
    resolve: (f, p) => {
      const o = f.owed;
      if (!o || typeof o !== "object") return null;
      if (o.noInvoices) return p.canCreateInvoice ? { state: "setup", href: "/app/invoices/new" } : null;
      return { state: "metric", value: n(o.count) ?? 0, amount: n(o.total) ?? 0, currency: f.currency ?? null, href: "/app/invoices" };
    },
  },
  card_payments: {
    resolve: (f, p) => {
      if (typeof f.cardPayments !== "boolean" || !p.canManage) return null;
      return f.cardPayments
        ? { state: "status", on: true, href: "/app/settings/payments" }
        : { state: "setup", href: "/app/settings/payments" };
    },
  },
  overdue: {
    resolve: (f) => {
      const o = f.owed;
      if (!o || typeof o !== "object" || o.noInvoices) return null;
      return {
        state: "metric",
        value: n(o.overdueCount) ?? 0,
        amount: n(o.overdueTotal) ?? 0,
        currency: f.currency ?? null,
        href: "/app/invoices",
      };
    },
  },
  auto_reminders: {
    resolve: (f, p) => {
      if (typeof f.invoiceReminderRule !== "boolean" || !p.canManage) return null;
      return f.invoiceReminderRule
        ? { state: "status", on: true, href: "/app/settings/follow-ups" }
        : { state: "setup", href: "/app/settings/follow-ups" };
    },
  },
  quote_follow_ups: {
    resolve: (f, p) => {
      const v = n(f.quoteFollowUpRules);
      if (v == null || !p.canManage) return null;
      return v > 0
        ? { state: "status", on: true, value: v, href: "/app/settings/follow-ups" }
        : { state: "setup", href: "/app/settings/follow-ups" };
    },
  },
  new_requests_month: {
    resolve: (f) => {
      const v = n(f.leadsThisMonth);
      return v == null ? null : { state: "metric", value: v, href: "/app/leads" };
    },
  },
  unanswered_leads: {
    resolve: (f) => {
      const v = n(f.leadsUnanswered);
      return v == null ? null : { state: "metric", value: v, href: "/app/leads" };
    },
  },
  website: {
    navKey: "app.settings.website",
    resolve: (f, p) => {
      const s = step(f, "website");
      if (!s || !p.canManage) return null;
      // A company with its own site (the step "does not apply") has a website:
      // that is a yes, not a to-do.
      return s.done || !s.applies
        ? { state: "status", on: true, href: "/app/settings/website" }
        : { state: "setup", href: "/app/settings/website" };
    },
  },
  booking_link: {
    resolve: (f, p) => {
      const s = step(f, "availability");
      if (!s || !p.canManage || !s.applies) return null;
      return s.done
        ? { state: "status", on: true, href: "/app/settings/booking-page" }
        : { state: "setup", href: "/app/settings/availability#bookable" };
    },
  },
  instant_quotes: {
    navKey: "app.settings.instantQuotes",
    resolve: (f, p) => {
      const s = step(f, "instant_quotes");
      if (!s || !p.canManage || !s.applies) return null;
      return s.done
        ? { state: "status", on: true, href: "/app/settings/instant-quotes" }
        : { state: "setup", href: "/app/settings/instant-quotes#trades" };
    },
  },
  reviews: {
    resolve: (f, p) => {
      const s = step(f, "google_reviews");
      if (!s || !p.canManage) return null;
      return s.done
        ? { state: "status", on: true, href: "/app/settings/reviews" }
        : { state: "setup", href: "/app/settings/reviews#google-business" };
    },
  },
  maintenance_plans: {
    resolve: (f, p) => (p.canManage ? { state: "shortcut", href: "/app/settings/maintenance-plans" } : null),
  },
  clients: {
    resolve: (f, p) => {
      const v = n(f.clients);
      if (v == null) return null;
      if (v === 0) return p.canCreateClient ? { state: "setup", href: "/app/clients/new" } : null;
      return { state: "metric", value: v, href: "/app/clients" };
    },
  },
  unscheduled_jobs: {
    resolve: (f) => {
      const v = n(f.jobsUnscheduled);
      return v == null ? null : { state: "metric", value: v, href: "/app/jobs" };
    },
  },
  visits_today: {
    resolve: (f) => {
      const v = n(f.visitsToday);
      return v == null ? null : { state: "metric", value: v, href: "/app/appointments" };
    },
  },
  route_today: {
    resolve: (f) => {
      const v = n(f.stopsToday);
      if (v == null) return null;
      const day = typeof f.todayDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f.todayDay) ? f.todayDay : null;
      return { state: "metric", value: v, href: day ? `/app/appointments?view=map&day=${day}` : "/app/appointments?view=map" };
    },
  },
  onsite_today: {
    resolve: (f, p) => {
      const o = f.onsiteToday;
      if (!o || typeof o !== "object") return null;
      const visits = n(o.visits) ?? 0;
      if (visits === 0) {
        // Nothing on site today. The useful thing left is the checklist the
        // crew will fill in — offered only when none exists and only to someone
        // who can write one.
        if (n(f.checklistTemplates) === 0 && p.canManage) return { state: "setup", href: "/app/settings/checklists" };
        return { state: "metric", value: 0, href: "/app/appointments" };
      }
      const jobId = typeof o.firstJobId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(o.firstJobId) ? o.firstJobId : null;
      return {
        state: "metric",
        value: visits,
        photos: n(o.withPhotos) ?? 0,
        checklistDone: n(o.checklistDone) ?? 0,
        checklistTotal: n(o.checklistTotal) ?? 0,
        href: jobId ? `/app/jobs/${jobId}` : "/app/appointments",
      };
    },
  },
  team: {
    resolve: (f, p) => {
      const v = n(f.teamActive);
      if (v == null) return null;
      const s = step(f, "team");
      if (s && s.applies && !s.done && p.canManage) return { state: "setup", href: "/app/settings/team" };
      return { state: "metric", value: v, href: p.canManage ? "/app/settings/team" : "/app/me/team" };
    },
  },
  timesheets_pending: {
    resolve: (f) => {
      const v = n(f.timesheetsPending);
      return v == null ? null : { state: "metric", value: v, href: "/app/settings/team/timesheets" };
    },
  },
  mobile: {
    resolve: () => ({ state: "shortcut", href: "/app/me" }),
  },
  conversion: {
    resolve: (f) => {
      const sent = n(f.quotesSentThisMonth);
      const won = n(f.quotesAcceptedThisMonth);
      if (sent == null || won == null) return null;
      // Counts, never a percentage: this month's handful of quotes is below
      // the sample floor the win-loss screen keeps (lib/dashboard/rank.js).
      return { state: "metric", value: won, of: sent, href: "/app/analytics/win-loss" };
    },
  },
  receptionist: {
    navKey: "app.nav.receptionist",
    resolve: (f, p) => (p.canManage ? { state: "shortcut", href: "/app/receptionist" } : null),
  },
  help: {
    resolve: () => ({ state: "shortcut", href: "/app/help" }),
  },
});

export const FOCUS_CARD_IDS = Object.freeze(Object.keys(FOCUS_CARDS));

/**
 * The stored choice, cleaned: an unknown priority is none, and focus keys
 * are kept only when the priority offers them, in the order it lists them —
 * the same rule readWelcomeAnswer applies, so the picker and the welcome
 * screens can never store two different shapes.
 */
export function cleanFocusChoice({ priority, focus } = {}) {
  const p = FOCUS_PRIORITY_KEYS.includes(priority) ? priority : null;
  if (!p) return { priority: null, focus: [] };
  const offered = focusOptionsFor(p);
  const picked = new Set(Array.isArray(focus) ? focus.filter((f) => typeof f === "string") : []);
  return { priority: p, focus: offered.filter((f) => picked.has(f)) };
}

/** Card ids in the order the section draws them, before resolution. */
export function focusCardOrder({ priority, focus } = {}) {
  const choice = cleanFocusChoice({ priority, focus });
  if (!choice.priority) return [];
  const ids = [];
  const add = (id) => {
    if (FOCUS_CARDS[id] && !ids.includes(id)) ids.push(id);
  };
  for (const key of choice.focus) for (const id of FOCUS_CARD_MAP[key] || []) add(id);
  for (const id of PRIORITY_LEAD_CARDS[choice.priority] || []) add(id);
  return ids;
}

/**
 * The cards, resolved against real facts. `perms` = { canManage,
 * canCreateQuote, canCreateInvoice, canCreateClient }; `isShown(navKey)`
 * answers the feature flag (defaults to shown, as the nav does). Each card
 * carries the focus key that asked for it, so the heading can say why it is
 * there.
 */
export function resolveFocusCards({ priority, focus, facts = {}, perms = {}, isShown = () => true } = {}) {
  const choice = cleanFocusChoice({ priority, focus });
  const f = facts && typeof facts === "object" ? facts : {};
  const p = perms && typeof perms === "object" ? perms : {};
  const reasonFor = (id) => choice.focus.find((k) => (FOCUS_CARD_MAP[k] || []).includes(id)) || null;
  const out = [];
  for (const id of focusCardOrder(choice)) {
    const def = FOCUS_CARDS[id];
    if (def.navKey && !isShown(def.navKey)) continue;
    let card = null;
    try {
      card = def.resolve(f, p);
    } catch {
      card = null; // a malformed fact removes the card; it never guesses one
    }
    if (!card) continue;
    out.push({ id, focusKey: reasonFor(id), ...card });
    if (out.length >= FOCUS_CARD_LIMIT) break;
  }
  return out;
}

// ── The set-up checklist, ordered by what they said matters ─────────────────
//
// Which of lib/setupSteps.js's steps serve which focus. A step not named here
// keeps its catalogue position after the ones that are; nothing is hidden or
// invented — this only changes the ORDER, so the "one clear next step" is the
// one that moves the thing they asked for.
export const SETUP_STEP_FOCUS = Object.freeze({
  team: ["team_management", "scheduling", "jobs_on_the_go"],
  confirm_services: ["sending_quotes", "winning_quotes", "more_requests"],
  overhead: ["winning_quotes", "automating_admin"],
  payment_schedule: ["approvals_deposits", "invoicing_payments", "invoices_paid_faster"],
  story: ["attracting_clients", "sending_quotes"],
  gallery: ["attracting_clients", "winning_quotes", "repeat_business"],
  documents: ["sending_quotes", "approvals_deposits"],
  google_reviews: ["attracting_clients", "repeat_business", "more_requests"],
  quote_process: ["sending_quotes", "winning_quotes"],
  ai_credits: ["automating_admin", "sending_quotes"],
  instant_quotes: ["more_requests", "never_miss_leads", "leads_followups"],
  availability: ["more_requests", "scheduling", "never_miss_leads"],
  materials: ["winning_quotes", "onsite_info"],
  add_ons: ["winning_quotes", "sending_quotes"],
  import_jobs: ["client_organization", "manage_clients", "repeat_business"],
  website: ["attracting_clients", "more_requests", "never_miss_leads"],
});

/** The steps each priority leans on when no focus key names one. */
export const SETUP_STEP_PRIORITY = Object.freeze({
  professional: ["documents", "story", "gallery", "payment_schedule", "website"],
  control: ["team", "availability", "payment_schedule", "import_jobs"],
  win_more: ["instant_quotes", "website", "google_reviews", "availability"],
  exploring: ["confirm_services", "team", "documents"],
});

/**
 * Steps reordered for this company: first those that serve a chosen focus
 * (by the earliest focus they serve), then those the priority leans on, then
 * the rest in catalogue order. Stable, and a permutation — the check proves
 * no step is dropped, duplicated or invented.
 */
export function orderSetupSteps(steps, { priority, focus } = {}) {
  const list = Array.isArray(steps) ? steps.filter((s) => s && typeof s.key === "string") : [];
  const choice = cleanFocusChoice({ priority, focus });
  const leaning = SETUP_STEP_PRIORITY[choice.priority] || [];
  const rank = (s) => {
    const serves = SETUP_STEP_FOCUS[s.key] || [];
    const byFocus = choice.focus.findIndex((f) => serves.includes(f));
    if (byFocus >= 0) return byFocus;
    const byPriority = leaning.indexOf(s.key);
    if (byPriority >= 0) return 100 + byPriority;
    return 1000;
  };
  return list
    .map((s, i) => ({ s, i, r: rank(s) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.s);
}
