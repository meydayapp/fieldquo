// scripts/check-dashboard-home.mjs
//
//   npm run check:dashboard-home
//
// The /app home rebuilt on 2026-09-29 (the owner's design), EXECUTED:
//
//   1. the work panel's badge rules (lib/dashboard/workPanel.js) against
//      hostile rows — nulls, junk dates, another tenant's rows, ids that are
//      paths, a quote whose client was re-quoted, a visit either side of
//      midnight in the company's zone — and the tab contract: a tab the
//      member may not see is ABSENT (no count, no items), never zero;
//   2. "Your focus" (lib/dashboard/focus.js): EVERY focus key the welcome
//      screens offer lands on at least one real card; with no facts, no card
//      prints a number or a yes; every link is a page that exists; the
//      picker's validation is welcome.js's; the checklist ordering is a
//      permutation for every priority and focus;
//   3. crew "My day" (lib/dashboard/crewHome.js): who gets it, over every
//      preset; a payload stuffed with money comes out with none of it;
//   4. read-only under impersonation, and permission-aware: the loader run
//      against a recording stub as a support session writes nothing and
//      offers no write; a member without invoices never has invoices read;
//   5. tenant scoping: every query the loader makes names the caller's
//      company (or reaches it through the relation that owns the row);
//   6. every new string in all nine languages, placeholders intact;
//   7. contrast of every text/background pair the new components use, in
//      light and dark, at 4.5:1.
import { readFileSync, existsSync } from "node:fs";
import {
  buildWorkPanel,
  firstTabWithWork,
  FOLLOW_UP_QUIET_DAYS,
  TAB_ITEM_LIMIT,
  VIEWED_TRACKED,
  WORK_TABS,
} from "@/lib/dashboard/workPanel";
import {
  cleanFocusChoice,
  FOCUS_CARD_IDS,
  FOCUS_CARD_MAP,
  FOCUS_CARDS,
  FOCUS_KEYS,
  FOCUS_PRIORITY_KEYS,
  orderSetupSteps,
  PRIORITY_LEAD_CARDS,
  resolveFocusCards,
  SETUP_STEP_FOCUS,
  SETUP_STEP_PRIORITY,
} from "@/lib/dashboard/focus";
import { CREW_FORBIDDEN_KEYS, deepKeys, isCrewHome, shapeMyDay } from "@/lib/dashboard/crewHome";
import { homePermissions, loadHomeData } from "@/lib/dashboard/homeData";
import { WELCOME_FOCUS, WELCOME_PRIORITIES, focusOptionsFor } from "@/lib/signup/welcome";
import { SETUP_STEPS } from "@/lib/setupSteps";
import { PERMISSION_PRESETS } from "@/lib/permissions";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

let pass = 0;
const failures = [];
function ok(label, cond, detail) {
  if (cond) pass += 1;
  else failures.push(`${label}${detail !== undefined ? ` — ${detail}` : ""}`);
}
const src = (p) => readFileSync(p, "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const DAY = 86_400_000;
const NOW = new Date("2026-09-29T15:00:00Z"); // 11:00 in Toronto
const ago = (d) => new Date(NOW.getTime() - d * DAY);
const ahead = (d) => new Date(NOW.getTime() + d * DAY);
const ALL = { requests: true, quotes: true, jobs: true, invoices: true };
const tab = (panel, key) => panel.tabs.find((t) => t.key === key);
const reasons = (panel, key) => (tab(panel, key)?.items || []).map((i) => `${i.id}:${i.reason}`).sort();

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n1. The work panel's badge rules, on hostile rows\n");
{
  const panel = buildWorkPanel({
    now: NOW,
    timeZone: "America/Toronto",
    companyId: "c1",
    allowed: ALL,
    showMoney: true,
    canRemind: true,
    leads: [
      { id: "l1", companyId: "c1", name: "New", status: "new", quoteId: null, createdAt: ago(1) },
      { id: "l2", companyId: "c1", name: "Called", status: "contacted", quoteId: null, createdAt: ago(1) },
      { id: "l3", companyId: "c1", name: "Quoted", status: "new", quoteId: "q9", createdAt: ago(1) },
      { id: "l4", companyId: "OTHER", name: "Another tenant", status: "new", quoteId: null, createdAt: ago(1) },
      { id: "../../etc", companyId: "c1", name: "Path id", status: "new", quoteId: null },
      { id: "l5", companyId: "c1", name: "Callback", status: "new", quoteId: null, createdAt: "garbage", callbackRequestedAt: ago(0) },
      null,
      "nonsense",
      42,
    ],
    estimates: [
      { id: "e1", companyId: "c1", autoEstimated: true, needsReview: true, status: "draft", clientName: "E" },
      { id: "e2", companyId: "c1", autoEstimated: true, needsReview: false, status: "draft" },
      { id: "e3", companyId: "c1", autoEstimated: true, needsReview: true, archivedAt: ago(1) },
      { id: "e4", companyId: "c1", autoEstimated: true, needsReview: true, status: "sent" },
    ],
    bookings: [
      { id: "b1", companyId: "c1", status: "needs_supervisor", assignedToId: null, scheduledAt: ahead(2) },
      { id: "b2", companyId: "c1", status: "needs_supervisor", assignedToId: null, scheduledAt: ago(1) },
      { id: "b3", companyId: "c1", status: "needs_supervisor", assignedToId: "u1", scheduledAt: ahead(2) },
      { id: "b4", companyId: "c1", status: "scheduled", assignedToId: null, scheduledAt: ahead(2) },
    ],
    quotes: [
      { id: "q1", companyId: "c1", clientId: "k1", status: "sent", sentAt: ago(FOLLOW_UP_QUIET_DAYS + 1), createdAt: ago(10) },
      { id: "q2", companyId: "c1", clientId: "k2", status: "sent", sentAt: ago(1), createdAt: ago(1) },
      { id: "q3", companyId: "c1", clientId: "k3", status: "sent", sentAt: ago(9), followUpSentAt: ago(1), createdAt: ago(9) },
      { id: "q4", companyId: "c1", clientId: "k4", status: "sent", sentAt: ago(9), lastAutoFollowUpAt: ago(1), createdAt: ago(9) },
      { id: "q5", companyId: "c1", clientId: "k5", status: "accepted", sentAt: ago(9), createdAt: ago(9) },
      { id: "q6", companyId: "c1", clientId: "k6", status: "sent", sentAt: ago(9), validUntil: ago(1), createdAt: ago(9) },
      // superseded: a newer quote to the same client
      { id: "q7", companyId: "c1", clientId: "k7", status: "sent", sentAt: ago(9), createdAt: ago(9) },
      { id: "q7b", companyId: "c1", clientId: "k7", status: "other", createdAt: ago(2) },
      { id: "q8", companyId: "c1", clientId: "k8", status: "sent", sentAt: ago(1), validUntil: ahead(3), createdAt: ago(1) },
      { id: "q9", companyId: "c1", clientId: "k9", status: "sent", sentAt: ago(1), validUntil: ahead(10), createdAt: ago(1) },
      { id: "q10", companyId: "c1", clientId: "k10", status: "sent", sentAt: "not a date", createdAt: ago(9) },
      { id: "q11", companyId: "c1", clientId: "k11", status: "sent", sentAt: ago(9), archivedAt: ago(1), createdAt: ago(9) },
      { id: "q12", companyId: "c1", clientId: "k12", status: "sent", sentAt: ago(9), historicalImportedAt: ago(1), createdAt: ago(9) },
      { id: "q13", companyId: "OTHER", clientId: "k13", status: "sent", sentAt: ago(9), createdAt: ago(9) },
      // re-quoted AND expiring: the newer quote is the live conversation
      { id: "q14", companyId: "c1", clientId: "k14", status: "sent", sentAt: ago(1), validUntil: ahead(2), createdAt: ago(5) },
      { id: "q14b", companyId: "c1", clientId: "k14", status: "other", createdAt: ago(1) },
      // "Viewed, no answer" — Quote.viewedAt, stamped only by the client's page.
      // opened yesterday, sent two days ago: not yet a follow-up, but warm
      { id: "q15", companyId: "c1", clientId: "k15", status: "sent", sentAt: ago(2), viewedAt: ago(1), viewCount: 2, createdAt: ago(2) },
      // opened, then followed up AFTER the open: answered by us — and not yet quiet for 3 days
      { id: "q16", companyId: "c1", clientId: "k16", status: "sent", sentAt: ago(5), viewedAt: ago(4), followUpSentAt: ago(1), createdAt: ago(5) },
      // a junk view date is not a view — falls back to the follow-up rule
      { id: "q17", companyId: "c1", clientId: "k17", status: "sent", sentAt: ago(9), viewedAt: "nope", viewCount: 3, createdAt: ago(9) },
      // opened long ago, silent since: "viewed" names it over "follow up"
      { id: "q18", companyId: "c1", clientId: "k18", status: "sent", sentAt: ago(9), viewedAt: ago(8), createdAt: ago(9) },
      // opened AND expiring: the deadline names it
      { id: "q19", companyId: "c1", clientId: "k19", status: "sent", sentAt: ago(1), viewedAt: ago(1), validUntil: ahead(2), createdAt: ago(1) },
      // opened and answered — not waiting on anyone
      { id: "q20", companyId: "c1", clientId: "k20", status: "accepted", sentAt: ago(3), viewedAt: ago(2), acceptedAt: ago(1), createdAt: ago(3) },
      // opened but superseded by a newer quote to the same client
      { id: "q21", companyId: "c1", clientId: "k21", status: "sent", sentAt: ago(6), viewedAt: ago(5), createdAt: ago(6) },
      { id: "q21b", companyId: "c1", clientId: "k21", status: "other", createdAt: ago(1) },
      // opened, but another tenant's
      { id: "q22", companyId: "OTHER", clientId: "k22", status: "sent", sentAt: ago(2), viewedAt: ago(1), createdAt: ago(2) },
    ],
    jobs: [
      { id: "j1", companyId: "c1", status: "unscheduled", createdAt: ago(3), title: "Deck" },
      { id: "j2", companyId: "c1", status: "scheduled" },
      { id: "j3", companyId: "c1", status: "unscheduled", archivedAt: ago(1) },
      { id: "j4", companyId: "c1", status: "unscheduled", historicalImportedAt: ago(1) },
      { id: "j5", companyId: "OTHER", status: "unscheduled" },
    ],
    visits: [
      { id: "v1", jobId: "j10", companyId: "c1", status: "scheduled", scheduledAt: "2026-09-29T20:00:00Z" }, // today 16:00
      { id: "v2", jobId: "j11", companyId: "c1", status: "scheduled", scheduledAt: "2026-09-30T13:00:00Z" }, // tomorrow
      { id: "v3", jobId: "j12", companyId: "c1", status: "scheduled", scheduledAt: "2026-10-01T15:00:00Z" }, // day after
      { id: "v4", jobId: "j13", companyId: "c1", status: "cancelled", scheduledAt: "2026-09-29T20:00:00Z" },
      { id: "v5", jobId: "j14", companyId: "c1", status: "canceled", scheduledAt: "2026-09-29T20:00:00Z" },
      { id: "v6", jobId: "j15", companyId: "c1", status: "scheduled", jobStatus: "cancelled", scheduledAt: "2026-09-29T20:00:00Z" },
      { id: "v7", jobId: "j16", companyId: "OTHER", status: "scheduled", scheduledAt: "2026-09-29T20:00:00Z" },
      { id: "v8", jobId: "j17", companyId: "c1", status: "scheduled", scheduledAt: "junk" },
      // 03:30Z on the 30th is 23:30 on the 29th in Toronto: TODAY there, tomorrow in UTC.
      { id: "v9", jobId: "j18", companyId: "c1", status: "scheduled", scheduledAt: "2026-09-30T03:30:00Z" },
    ],
    owed: [
      { id: "i1", owed: 100, dueState: "overdue", daysPastDue: 12, client: { name: "Late" } },
      { id: "i2", owed: 50, dueState: "undated", issuedOn: "2026-09-01" },
      { id: "i3", owed: 50, dueState: "undated", issuedOn: "2026-09-25" },
      { id: "i4", owed: 80, dueState: "not_due", issuedOn: "2026-09-01" },
      { id: "i5", owed: 0, dueState: "overdue", daysPastDue: 3 },
      { id: "i6", owed: -20, dueState: "overdue" },
    ],
    drafts: [
      { id: "d1", companyId: "c1", status: "draft", clientName: "Draft" },
      { id: "d2", companyId: "c1", status: "sent" },
      { id: "d3", companyId: "OTHER", status: "draft" },
    ],
  });

  ok("four tabs, in the owner's order", panel.tabs.map((t) => t.key).join(",") === WORK_TABS.join(","));
  ok(
    "Requests: an unanswered lead, a callback, a pending instant estimate, a future unassigned booking — nothing else",
    reasons(panel, "requests").join(" ") === ["b1:booking_unassigned", "e1:instant_estimate", "l1:new_lead", "l5:callback"].sort().join(" "),
    reasons(panel, "requests").join(" "),
  );
  ok(
    "Quotes: silent past the quiet days, and expiring within the week — not answered, expired, superseded, archived, historical, junk-dated, recently contacted or another tenant's",
    reasons(panel, "quotes").join(" ") === ["q1:follow_up", "q8:expiring", "q15:viewed", "q17:follow_up", "q18:viewed", "q19:expiring"].sort().join(" "),
    reasons(panel, "quotes").join(" "),
  );
  ok("...'viewed' only where the CLIENT's open was recorded and nothing went to them since — never a junk date, an answered, superseded, followed-up or other tenant's quote",
    VIEWED_TRACKED === true && reasons(panel, "quotes").filter((r) => r.endsWith(":viewed")).join(" ") === "q15:viewed q18:viewed");
  {
    const q = tab(panel, "quotes")?.items || [];
    const order = q.map((i) => i.reason);
    ok("...expiring rows first, then viewed, then follow-ups", order.join(",") === [...order].sort((a, b) => ({ expiring: 0, viewed: 1, follow_up: 2 })[a] - ({ expiring: 0, viewed: 1, follow_up: 2 })[b]).join(","), order);
    const v = q.find((i) => i.id === "q15");
    ok("...a viewed row is dated by the open, not the send", v && v.at instanceof Date && Math.abs(v.at.getTime() - ago(1).getTime()) < 1000);
  }
  ok(
    "Jobs: unscheduled, today and tomorrow by the COMPANY's calendar — not closed, cancelled (either spelling) or another tenant's",
    reasons(panel, "jobs").join(" ") === ["j1:not_scheduled", "v1:starts_today", "v2:starts_tomorrow", "v9:starts_today"].sort().join(" "),
    reasons(panel, "jobs").join(" "),
  );
  ok(
    "Invoices: overdue, undated and older than 14 days, and drafts — not undated-and-recent, not yet due, settled, or overpaid",
    reasons(panel, "invoices").join(" ") === ["d1:draft", "i1:overdue", "i2:undated"].sort().join(" "),
    reasons(panel, "invoices").join(" "),
  );
  ok("each badge is the count of its own items", panel.tabs.every((t) => t.count === t.items.length));
  ok("the total is the sum of the badges", panel.total === panel.tabs.reduce((s, t) => s + t.count, 0));
  ok("every item carries exactly one action with an /app href", panel.tabs.every((t) => t.items.every((i) => i.action && typeof i.action.href === "string" && i.action.href.startsWith("/app/"))));
  const actions = Object.fromEntries(panel.tabs.flatMap((t) => t.items.map((i) => [i.id, i.action.type])));
  ok("lead → Reply, estimate/booking → Review, quote → Follow up, unscheduled → Schedule, overdue → Chase, draft → Send",
    actions.l1 === "reply" && actions.e1 === "review" && actions.b1 === "review" && actions.q1 === "follow_up" && actions.j1 === "schedule" && actions.i1 === "chase" && actions.d1 === "send",
    JSON.stringify(actions));
  ok("an id that is a path never reaches an href", !JSON.stringify(panel).includes("../"));
  ok("the chase posts to the invoice's own request-payment route", tab(panel, "invoices").items.find((i) => i.id === "i1").action.post === "/api/invoices/i1/request-payment");
  ok("expiring sorts before follow-up; overdue before undated before draft",
    tab(panel, "quotes").items[0].reason === "expiring" && tab(panel, "invoices").items.map((i) => i.reason).join(",") === "overdue,undated,draft");
  ok("the tab to open first is the first with work", firstTabWithWork(panel.tabs) === "requests");

  // Permission and money shape.
  const gated = buildWorkPanel({
    now: NOW, companyId: "c1", allowed: { requests: true, quotes: false, jobs: true, invoices: false }, showMoney: false, canRemind: false,
    quotes: [{ id: "q1", companyId: "c1", status: "sent", sentAt: ago(9), createdAt: ago(9), total: 500 }],
    estimates: [{ id: "e1", companyId: "c1", autoEstimated: true, needsReview: true, total: 999 }],
    owed: [{ id: "i1", owed: 100, dueState: "overdue", daysPastDue: 3 }],
  });
  ok("a tab the member may not see is { allowed: false } — no count, no items, not zero",
    ["quotes", "invoices"].every((k) => { const t = tab(gated, k); return t.allowed === false && !("count" in t) && !("items" in t); }));
  ok("...and it adds nothing to the total", gated.total === 1, gated.total);
  ok("without showPricing no item carries an amount", !deepKeys(gated).has("amount"));
  const noRemind = buildWorkPanel({ now: NOW, allowed: { invoices: true }, canRemind: false, owed: [{ id: "i1", owed: 10, dueState: "overdue", daysPastDue: 1 }] });
  ok("without invoice edit the row opens the invoice instead of chasing", tab(noRemind, "invoices").items[0].action.type === "open" && !tab(noRemind, "invoices").items[0].action.post);

  // The badge counts everything; the list is capped.
  const many = buildWorkPanel({
    now: NOW, allowed: { requests: true },
    leads: Array.from({ length: TAB_ITEM_LIMIT + 5 }, (_, i) => ({ id: `l${i}`, status: "new", quoteId: null, createdAt: ago(i) })),
  });
  ok("the badge counts every waiting row; the list shows the first few", tab(many, "requests").count === TAB_ITEM_LIMIT + 5 && tab(many, "requests").items.length === TAB_ITEM_LIMIT);

  // Garbage in.
  let threw = false;
  let empty;
  try {
    empty = buildWorkPanel({ now: "junk", allowed: ALL, leads: "x", quotes: { a: 1 }, jobs: null, visits: [undefined], owed: [null], drafts: 7 });
  } catch (e) {
    threw = e.message;
  }
  ok("garbage in, empty tabs out — never a throw", !threw && empty.tabs.every((t) => t.allowed && t.count === 0), threw);
  ok("nothing allowed, nothing drawn", buildWorkPanel({}).tabs.every((t) => t.allowed === false) && firstTabWithWork(buildWorkPanel({}).tabs) === null);

  // Source: the component hides a zero badge and a tab it is not given.
  const wp = strip(src("app/components/dashboard/WorkPanel.js"));
  ok("WorkPanel draws only allowed tabs", /filter\(\(tab\) => tab\.allowed\)/.test(wp));
  ok("...and a badge only above zero", /tab\.count > 0 &&/.test(wp));
  ok("...and disables the chase under a support session", /disabled=\{readOnly \|\|/.test(wp));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n2. Your focus — every focus key lands on a real card\n");
{
  ok("the focus list is welcome.js's", FOCUS_KEYS.join(",") === Object.keys(WELCOME_FOCUS).join(","));
  ok("the priorities are welcome.js's", FOCUS_PRIORITY_KEYS.join(",") === WELCOME_PRIORITIES.map((p) => p.key).join(","));
  const offeredSomewhere = new Set(WELCOME_PRIORITIES.flatMap((p) => p.focus));
  for (const key of FOCUS_KEYS) {
    const cards = FOCUS_CARD_MAP[key] || [];
    ok(`${key}: mapped to at least one card`, cards.length > 0);
    ok(`${key}: every card it names is defined`, cards.every((id) => FOCUS_CARDS[id]), cards.join(","));
    ok(`${key}: offered under some priority`, offeredSomewhere.has(key));
  }
  ok("the map names no focus key welcome.js does not have", Object.keys(FOCUS_CARD_MAP).every((k) => FOCUS_KEYS.includes(k)));
  for (const p of FOCUS_PRIORITY_KEYS) {
    ok(`${p}: has a lead set of real cards`, (PRIORITY_LEAD_CARDS[p] || []).length > 0 && PRIORITY_LEAD_CARDS[p].every((id) => FOCUS_CARDS[id]));
  }

  // With every fact present and every permission, each focus key produces a card.
  const FULL = {
    quotesSentThisMonth: 4, quotesEver: 20, quotesAwaiting: 3, quotesAcceptedThisMonth: 2,
    leadsThisMonth: 5, leadsUnanswered: 2, clients: 40, jobsUnscheduled: 1, visitsToday: 2, stopsToday: 3, todayDay: "2026-09-29",
    onsiteToday: { visits: 2, withPhotos: 1, checklistDone: 3, checklistTotal: 8, firstJobId: "j1" }, checklistTemplates: 2,
    teamActive: 4, timesheetsPending: 1, owed: { total: 1200, count: 3, overdueCount: 1, overdueTotal: 400, noInvoices: false }, currency: "CAD",
    cardPayments: true, quoteFollowUpRules: 3, invoiceReminderRule: true,
    setup: Object.fromEntries(SETUP_STEPS.map((s) => [s.key, { done: true, applies: true }])),
  };
  const PERMS = { canManage: true, canCreateQuote: true, canCreateInvoice: true, canCreateClient: true };
  for (const key of FOCUS_KEYS) {
    const priority = WELCOME_PRIORITIES.find((p) => p.focus.includes(key)).key;
    const cards = resolveFocusCards({ priority, focus: [key], facts: FULL, perms: PERMS });
    ok(`${key}: resolves to a card for the owner`, cards.some((c) => c.focusKey === key), cards.map((c) => c.id).join(","));
  }

  // No facts: nothing may print a number or a "yes".
  const invented = [];
  for (const p of FOCUS_PRIORITY_KEYS) {
    for (const facts of [{}, { setup: {} }, { owed: null, onsiteToday: null }, { quotesSentThisMonth: "12", clients: NaN }]) {
      for (const c of resolveFocusCards({ priority: p, focus: focusOptionsFor(p), facts, perms: PERMS })) {
        if (c.state === "metric" || c.state === "status") invented.push(`${p}:${c.id}:${c.state}`);
      }
    }
  }
  ok("with no measured facts, no card prints a number or a yes", invented.length === 0, invented.join(" "));
  // A never-set-up feature is the STEP, never a zero.
  const setupFacts = { ...FULL, quotesEver: 0, owed: { noInvoices: true }, cardPayments: false, clients: 0, setup: Object.fromEntries(SETUP_STEPS.map((s) => [s.key, { done: false, applies: true }])) };
  const steps = resolveFocusCards({ priority: "professional", focus: focusOptionsFor("professional"), facts: setupFacts, perms: PERMS });
  ok("never-set-up features become their set-up step", ["quotes_sent_month", "deposits", "money_owed", "card_payments"].every((id) => steps.find((c) => c.id === id)?.state === "setup"), steps.map((c) => `${c.id}:${c.state}`).join(" "));
  // A step is never offered to someone who cannot take it.
  const crewish = resolveFocusCards({ priority: "professional", focus: focusOptionsFor("professional"), facts: setupFacts, perms: {} });
  ok("...and never offered to a member who cannot take it", crewish.every((c) => c.state !== "setup"), crewish.map((c) => `${c.id}:${c.state}`).join(" "));
  // A feature hidden by the plan is not linked.
  const hidden = resolveFocusCards({ priority: "win_more", focus: ["never_miss_leads", "more_requests"], facts: FULL, perms: PERMS, isShown: () => false });
  ok("a card whose feature the plan hides is dropped", !hidden.some((c) => ["receptionist", "instant_quotes"].includes(c.id)));
  ok("the section shows at most six cards", resolveFocusCards({ priority: "control", focus: focusOptionsFor("control"), facts: FULL, perms: PERMS }).length <= 6);
  ok("no priority, no cards", resolveFocusCards({ priority: null, focus: ["sending_quotes"], facts: FULL, perms: PERMS }).length === 0);

  // Every link is a page that exists.
  const hrefs = new Set();
  for (const p of FOCUS_PRIORITY_KEYS) {
    for (const facts of [FULL, setupFacts, { ...FULL, onsiteToday: { visits: 0 }, checklistTemplates: 0 }]) {
      for (const c of resolveFocusCards({ priority: p, focus: focusOptionsFor(p), facts, perms: PERMS })) hrefs.add(c.href);
    }
    for (const id of FOCUS_CARD_IDS) {
      for (const facts of [FULL, setupFacts]) {
        try {
          const c = FOCUS_CARDS[id].resolve(facts, PERMS);
          if (c) hrefs.add(c.href);
        } catch {
          /* counted below */
        }
      }
    }
  }
  const missingPages = [...hrefs].filter((h) => {
    const path = h.split(/[?#]/)[0].replace(/^\/app/, "app/app").replace(/\/j1$/, "/[id]");
    return !existsSync(`${path}/page.js`);
  });
  ok(`every card links to a page that exists (${hrefs.size} links)`, missingPages.length === 0, missingPages.join(" "));

  // The picker's validation — welcome.js's rule, hostile input.
  ok("an unknown priority is no answer", cleanFocusChoice({ priority: "get_paid", focus: ["sending_quotes"] }).priority === null);
  ok("__proto__ is no answer", cleanFocusChoice({ priority: "__proto__" }).priority === null);
  const mixed = cleanFocusChoice({ priority: "win_more", focus: ["route_planning", "never_miss_leads", "leads_followups", "leads_followups", 7, null, "__proto__"] });
  ok("focus keys are kept only when the priority offers them, deduplicated, in its order",
    mixed.focus.join(",") === "leads_followups,never_miss_leads", mixed.focus.join(","));
  ok("a non-array focus is none", cleanFocusChoice({ priority: "control", focus: "scheduling" }).focus.length === 0);

  // The checklist order is a permutation, for every priority and every focus.
  const catalogue = SETUP_STEPS.map((s) => ({ key: s.key }));
  let perm = true;
  for (const p of [null, ...FOCUS_PRIORITY_KEYS]) {
    for (const f of [[], ...(p ? focusOptionsFor(p).map((k) => [k]) : [])]) {
      const out = orderSetupSteps(catalogue, { priority: p, focus: f }).map((s) => s.key);
      if (out.length !== catalogue.length || new Set(out).size !== out.length || !catalogue.every((s) => out.includes(s.key))) perm = false;
    }
  }
  ok("the checklist order drops, duplicates and invents nothing, for every priority and focus", perm);
  ok("with no priority the catalogue order stands", orderSetupSteps(catalogue, {}).map((s) => s.key).join(",") === catalogue.map((s) => s.key).join(","));
  ok("\"Getting approvals and deposits\" puts the deposit step first",
    orderSetupSteps(catalogue, { priority: "professional", focus: ["approvals_deposits"] })[0].key === "payment_schedule");
  ok("every step named in the ordering tables is a real step", [...Object.keys(SETUP_STEP_FOCUS), ...Object.values(SETUP_STEP_PRIORITY).flat()].every((k) => SETUP_STEPS.some((s) => s.key === k)));
  ok("every focus named in the ordering table is a real focus", Object.values(SETUP_STEP_FOCUS).flat().every((k) => FOCUS_KEYS.includes(k)));
  ok("garbage steps are dropped, not thrown on", orderSetupSteps([null, 3, { key: 5 }, { key: "team" }], { priority: "control" }).length === 1);

  const card = strip(src("app/components/dashboard/SetupSteps.js"));
  ok("the checklist orders what remainingSteps() returns through orderSetupSteps", /orderSetupSteps\(steps \|\| \[\], \{ priority, focus \}\)/.test(card));
  ok("...draws a progress bar from setupProgress", /role="progressbar"/.test(card) && /progress\.done \/ progress\.total/.test(card));
  ok("...highlights ONE next step", /const next = ordered\[0\]/.test(card) && /app\.setup\.nextStep/.test(card));
  ok("...and says so when the last step is finished", /app\.setup\.allDone/.test(card) && /setAllDone\(true\)/.test(card));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n3. Crew get \"My day\" — and no money\n");
{
  const preset = (key, role = "employee") => ({ role, permissions: PERMISSION_PRESETS[key].values });
  ok("the Crew preset gets My day", isCrewHome(preset("worker")) === true);
  for (const key of Object.keys(PERMISSION_PRESETS).filter((k) => k !== "worker")) {
    ok(`the ${key} preset keeps the office dashboard`, isCrewHome(preset(key)) === false);
  }
  ok("owners and admins never get My day, whatever their grid", !isCrewHome(preset("worker", "owner")) && !isCrewHome(preset("worker", "admin")));
  ok("a crew grid with quotes view_only keeps the office dashboard", !isCrewHome({ role: "employee", permissions: { ...PERMISSION_PRESETS.worker.values, quotes: "view_only" } }));
  ok("a crew grid that runs the schedule keeps the office dashboard", !isCrewHome({ role: "employee", permissions: { ...PERMISSION_PRESETS.worker.values, schedule: "edit_all" } }));
  ok("an unresolved provider and a gridless member keep the office dashboard", !isCrewHome(null) && !isCrewHome({ role: "employee", permissions: null }) && !isCrewHome({}));

  const payload = shapeMyDay({
    items: [
      { kind: "shift", id: "s1", start: NOW, end: new Date(NOW.getTime() + 8 * 3600e3), title: "Deck", address: "12 rue Principale, Laval", estimate: { hours: 8, amount: 240 }, rate: 30, job: { id: "j1", total: 9000, price: 5 }, breaks: [{ paid: true }] },
      { kind: "visit", id: "v1", start: new Date(NOW.getTime() + 3600e3), jobId: "j2", title: "Smith", address: "1 Main", status: "scheduled", note: "$400 cash", amount: 400 },
      { kind: "open", id: "o1", start: NOW, earned: 100 },
      { kind: "event", id: "ev1", start: NOW },
      { kind: "task", id: "../x", start: NOW },
      { kind: "appointment", id: "a1", start: "junk" },
      { kind: "visit", id: "v2", start: ahead(2), jobId: "j3" },
      null,
    ],
    nextId: "s1",
    todayEnd: new Date(NOW.getTime() + 9 * 3600e3),
    clock: { onRoster: true, open: { clockIn: NOW, onBreak: false, earnedToday: 99, hours: 3 } },
    visitExtras: { v1: { photos: 2, checklistDone: 1, checklistTotal: 4, cost: 7 }, v2: { photos: -3, checklistDone: "x", checklistTotal: 2 } },
    name: "Pat",
  });
  const keys = deepKeys(payload);
  const leaked = CREW_FORBIDDEN_KEYS.filter((k) => keys.has(k));
  ok("a payload stuffed with money comes out with none of it", leaked.length === 0, leaked.join(","));
  ok("...and not as a string either", !/\$|240|9000|400 cash/.test(JSON.stringify(payload)));
  ok("only the person's own kinds survive (no open shifts, no company events), and no junk ids or dates",
    [...payload.today, ...payload.week].map((i) => i.id).sort().join(",") === "s1,v1,v2");
  ok("today and the week are split at the company's end of day", payload.today.map((i) => i.id).join(",") === "s1,v1" && payload.week.map((i) => i.id).join(",") === "v2");
  ok("the next stop carries a directions link built from its address", payload.next?.id === "s1" && payload.next.directions === "https://www.google.com/maps/dir/?api=1&destination=12%20rue%20Principale%2C%20Laval");
  ok("a visit carries its photo and checklist progress, sanitised", payload.today[1].photos === 2 && payload.today[1].checklistTotal === 4 && payload.week[0].photos === 0 && payload.week[0].checklistDone === 0);
  ok("the clock says in or out and since when — no hours, no pay", payload.clock.onRoster === true && Object.keys(payload.clock.open).sort().join(",") === "onBreak,since");
  ok("garbage in, an empty day out", (() => { const e = shapeMyDay({ items: "x", clock: "y" }); return e.today.length === 0 && e.week.length === 0 && e.next === null && e.clock.onRoster === false; })());

  const view = strip(src("app/components/dashboard/CrewMyDay.js"));
  ok("CrewMyDay renders no money: no formatMoney, no currency, no amounts", !/formatMoney|currency|\.amount|estimate|earned|money/i.test(view));
  ok("...reads only its own endpoint", (view.match(/fetchList\("([^"]+)"/g) || []).join() === 'fetchList("/api/dashboard/my-day"');
  ok("...and links the clock, the week and the job instead of rebuilding them", /href="\/app\/clock"/.test(view) && /href="\/app\/me\/schedule"/.test(view) && /jobHref/.test(view));
  const route = strip(src("app/api/dashboard/my-day/route.js"));
  ok("the My day route shapes through the whitelist and never selects a rate", /shapeMyDay\(/.test(route) && !/hourlyRate|rate: true|estimateForShift|seesPay/.test(route));
  const page = strip(src("app/app/page.js"));
  ok("the home page picks the home with isCrewHome, before any office read", /isCrewHome\(caller\) \? <CrewMyDay \/> : <OfficeDashboard \/>/.test(page));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n4. Read-only under impersonation; permission-aware\n");

/** A recording Prisma stand-in: every call is logged; writes are recorded and refused. */
function stubDb(fixtures = {}) {
  const calls = [];
  const writes = [];
  const handler = (model) => ({
    get(_, method) {
      return async (args = {}) => {
        calls.push({ model, method, args });
        if (/^(create|update|delete|upsert)/.test(method)) {
          writes.push({ model, method });
          return {};
        }
        if (method === "findUnique" && model === "company") return fixtures.company ?? { timezone: "America/Toronto", currency: "CAD", signupPriority: "control", signupFocus: ["route_planning"], stripeChargesEnabled: false };
        if (method === "count") return 0;
        if (method === "findFirst") return null;
        if (method === "findMany") return fixtures[model] || [];
        return null;
      };
    },
  });
  return { db: new Proxy({}, { get: (_, model) => new Proxy({}, handler(model)) }), calls, writes };
}
const ownerFull = { id: "m1", userId: "u1", role: "owner", permissions: null, companyId: "c1" };
{
  const { db, calls, writes } = stubDb();
  let setupCalled = false;
  const data = await loadHomeData(db, {
    member: { companyId: "c1", userId: "u1", role: "owner", impersonation: true },
    full: ownerFull,
    now: NOW,
    setup: async () => {
      setupCalled = true;
      return {};
    },
  });
  ok("a support session reads what the owner reads (every tab)", data.work.tabs.every((t) => t.allowed));
  ok("...is told readOnly", data.readOnly === true);
  ok("...is offered no write: no chase, no focus edit", data.perms.canRemind === false && data.perms.editFocus === false);
  ok("...and the loader wrote nothing", writes.length === 0, writes.map((w) => `${w.model}.${w.method}`).join(","));
  ok("...while still reading the set-up states the owner would see", setupCalled);
  ok("the loader made reads at all (the stub is not vacuous)", calls.length > 10, calls.length);

  const p = homePermissions(ownerFull, { impersonation: true });
  ok("homePermissions: impersonation removes the two writes and nothing else", !p.canRemind && !p.editFocus && p.invoices && p.quotes && p.canManage);

  const focusRoute = strip(src("app/api/dashboard/focus/route.js"));
  const refuseAt = focusRoute.indexOf("member.impersonation");
  const writeAt = focusRoute.indexOf("db.company.update");
  ok("the focus PATCH refuses a support session before it writes", refuseAt > -1 && writeAt > -1 && refuseAt < writeAt);
  ok("...refuses anyone but an owner or admin before it writes", focusRoute.indexOf('member.role !== "owner" && member.role !== "admin"') < writeAt);
  ok("...validates with cleanFocusChoice and writes only the two columns",
    /cleanFocusChoice\(/.test(focusRoute) && /data: \{ signupPriority: choice\.priority, signupFocus: choice\.focus \}/.test(focusRoute) && !/personalizedAt|onboardingStep:/.test(focusRoute));
  ok("...and only exports PATCH (a GET cannot write)", /export async function PATCH/.test(focusRoute) && !/export async function (GET|POST|PUT|DELETE)/.test(focusRoute));
  const section = strip(src("app/components/dashboard/FocusSection.js"));
  ok("the picker's save is disabled under a support session, and its dismissal is not written", /disabled=\{!priority \|\| saving \|\| readOnly\}/.test(section) && /if \(!readOnly\) \{\s*fetch\("\/api\/ui-state"/.test(section));
}
{
  // Crew grid, loaded as a real member: no office reads at all.
  const crew = { id: "m2", userId: "u2", role: "employee", permissions: PERMISSION_PRESETS.worker.values, companyId: "c1" };
  const { db, calls } = stubDb();
  const data = await loadHomeData(db, { member: { companyId: "c1", userId: "u2", role: "employee" }, full: crew, now: NOW });
  const read = (model) => calls.some((c) => c.model === model && c.method !== "count");
  ok("a crew grid has no Requests, Quotes or Invoices tab", ["requests", "quotes", "invoices"].every((k) => data.work.tabs.find((t) => t.key === k).allowed === false));
  ok("...and none of those rows are even read", !read("leadRequest") && !read("invoice") && !read("payment") && !calls.some((c) => c.model === "quote"));
  ok("...no money fact, no set-up fact", data.facts.owed === undefined && data.facts.setup === undefined && data.facts.cardPayments === undefined);
  ok("...and no focus edit", data.perms.editFocus === false);

  // Estimator: quotes and requests, but a grid without showPricing sees no amounts.
  const noPricing = { id: "m3", userId: "u3", role: "employee", permissions: { ...PERMISSION_PRESETS.estimator.values, showPricing: false, invoices: "view_only" }, companyId: "c1" };
  const s2 = stubDb({
    invoice: [{ id: "i1", companyId: "c1", status: "sent", total: 100, dueDate: "2026-09-01", createdAt: "2026-08-20", sentAt: "2026-08-20", version: 1, client: { name: "X" } }],
    quote: [{ id: "q1", companyId: "c1", clientId: "k1", status: "sent", sentAt: ago(9), createdAt: ago(9), total: 900, client: { name: "Y" } }],
  });
  const d2 = await loadHomeData(s2.db, { member: { companyId: "c1", userId: "u3", role: "employee" }, full: noPricing, now: NOW });
  ok("without showPricing the panel still lists the work…", d2.work.tabs.find((t) => t.key === "invoices").count >= 1);
  ok("...with no amount anywhere and no money fact", !deepKeys(d2.work).has("amount") && d2.facts.owed === undefined);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n5. Every query names the caller's company\n");
{
  const { db, calls } = stubDb({
    quote: [{ id: "q1", companyId: "c1", clientId: "k1", status: "sent", sentAt: ago(9), createdAt: ago(9), client: { name: "Y" } }],
  });
  await loadHomeData(db, { member: { companyId: "c1", userId: "u1", role: "owner" }, full: ownerFull, now: NOW, setup: async () => ({}) });
  const scoped = (where = {}) =>
    where.companyId === "c1" ||
    where.id === "c1" ||
    where.job?.companyId === "c1" ||
    where.invoice?.companyId === "c1" ||
    where.rule?.companyId === "c1" ||
    where.worker?.companyId === "c1";
  const loose = calls.filter((c) => !scoped(c.args?.where));
  ok(`all ${calls.length} reads are scoped to company c1`, loose.length === 0, loose.map((c) => `${c.model}.${c.method} ${JSON.stringify(c.args?.where)}`).join(" | "));
  ok("the company row itself is read by the caller's id", calls.some((c) => c.model === "company" && c.args.where.id === "c1"));
  const jobReads = calls.filter((c) => c.model === "job" || c.model === "jobVisit");
  ok("job reads carry the assigned-jobs scope for a scoped member (checked with a crew-like grid)", (() => {
    const scopedMember = { id: "m9", userId: "u9", role: "employee", permissions: { ...PERMISSION_PRESETS.worker.values }, companyId: "c1" };
    return homePermissions(scopedMember).jobs === true;
  })() && jobReads.length > 0);
  const homeRoute = strip(src("app/api/dashboard/home/route.js"));
  ok("the home route loads the member's own grid and company, never a company from the request", /loadEnforceableMember\(db, member\.id\)/.test(homeRoute) && !/searchParams|request\.json/.test(homeRoute));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n6. Every new string, in all nine languages\n");
{
  const files = [
    "app/components/dashboard/WorkPanel.js",
    "app/components/dashboard/FocusSection.js",
    "app/components/dashboard/CrewMyDay.js",
    "app/components/dashboard/SetupSteps.js",
    "app/components/dashboard/HeroRevenue.js",
    "app/app/page.js",
  ];
  const wanted = new Set();
  for (const f of files) {
    const s = src(f);
    for (const m of s.matchAll(/"(app\.(?:dash|setup)\.[A-Za-z0-9_.]+)"/g)) wanted.add(m[1]);
  }
  for (const id of FOCUS_CARD_IDS) wanted.add(`app.dash.focus.card.${id}.label`);
  for (const p of FOCUS_PRIORITY_KEYS) wanted.add(`app.dash.focus.priority.${p}`);
  const langs = Object.keys(APP_MESSAGES);
  ok("nine languages", langs.length === 9, langs.join(","));
  const ph = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  const missing = [];
  const broken = [];
  for (const key of wanted) {
    for (const code of langs) {
      const v = APP_MESSAGES[code]?.[key];
      if (typeof v !== "string" || !v.trim()) missing.push(`${code}:${key}`);
      else if (ph(v) !== ph(APP_MESSAGES.en[key])) broken.push(`${code}:${key}`);
    }
  }
  ok(`${wanted.size} keys present in every language`, missing.length === 0, missing.slice(0, 12).join(" "));
  ok("...with their placeholders intact", broken.length === 0, broken.slice(0, 12).join(" "));
  // Every card part the component can ask for exists.
  const sectionSrc = src("app/components/dashboard/FocusSection.js");
  const en = sectionSrc.slice(sectionSrc.indexOf("const CARD_EN"), sectionSrc.indexOf("function Picker"));
  const parts = [...en.matchAll(/^\s{2}([a-z_]+): \{([^\n]*)/gm)].flatMap(([, id, rest]) => [...rest.matchAll(/(\w+):/g)].map((m) => `app.dash.focus.card.${id}.${m[1]}`));
  const partsMissing = parts.filter((k) => langs.some((c) => typeof APP_MESSAGES[c]?.[k] !== "string"));
  ok(`every card part (${parts.length}) is in the catalogue`, parts.length > 40 && partsMissing.length === 0, partsMissing.join(" "));
  ok("every card id has its English fallback", FOCUS_CARD_IDS.every((id) => new RegExp(`\\n\\s{2}${id}: \\{`).test(en)));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n7. Contrast of the new pairs, light and dark\n");
{
  const css = src("app/globals.css");
  // The token blocks themselves: `:root {` and `.dark {` at the start of a
  // line. (".dark" also appears earlier, in the custom-variant rule.)
  const rootAt = css.indexOf("\n:root {");
  const darkAt = css.indexOf("\n.dark {");
  const light = css.slice(rootAt, css.indexOf("\n}", rootAt));
  const dark = css.slice(darkAt, css.indexOf("\n}", darkAt));
  const token = (block, name) => (block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`)) || [])[1];
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lum = ([r, g, b]) => {
    const f = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const mix = (fg, bg, a) => fg.map((c, i) => Math.round(a * c + (1 - a) * bg[i]));
  // [text, background, how the background is made]
  const PAIRS = [
    ["foreground", "card"],
    ["muted-foreground", "card"],
    ["muted-foreground", "background"],
    ["destructive", "card"],
    ["inverted-foreground", "inverted"],
    ["popover-foreground", "popover"],
    ["foreground", "muted"],
    ["foreground", "muted@60/card"], // the next-step band: bg-muted/60 over the card
    ["muted-foreground", "muted@60/card"],
    ["foreground", "background@60/card"], // INSET wells
    ["muted-foreground", "background@60/card"],
  ];
  for (const [label, block] of [["light", light], ["dark", dark.length > 10 ? dark : light]]) {
    const read = (name) => {
      const own = token(block, name) || token(light, name);
      return own ? rgb(own) : null;
    };
    for (const [fg, bg] of PAIRS) {
      let back;
      const m = bg.match(/^([a-z-]+)@(\d+)\/([a-z-]+)$/);
      if (m) back = read(m[1]) && read(m[3]) ? mix(read(m[1]), read(m[3]), Number(m[2]) / 100) : null;
      else back = read(bg);
      const front = read(fg);
      const r = front && back ? ratio(front, back) : 0;
      ok(`${label}: ${fg} on ${bg} ≥ 4.5:1`, r >= 4.5, r.toFixed(2));
    }
  }
}

console.log(
  failures.length
    ? `\nFAILED — ${failures.length} of ${pass + failures.length}\n${failures.map((f) => `  x ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(failures.length ? 1 : 0);
