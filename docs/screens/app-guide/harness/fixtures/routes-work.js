// Fixture routes for the work screens. See routes.js for the entry shape.
//
// Home · FieldQuo AI · Leads · Quotes · Quote reviews · Jobs · Invoices ·
// Service Plans · Calendar · To-do. Every list here is the fixture company's
// week around Q-1042 / J-318 / INV-2071, widened with a few more clients so a
// pipeline board, an aging ladder and a five-day calendar have something on
// them — the same names recur across screens on purpose (Lavoie's quote is
// the one his lead converted into; Fortin's paid invoice is the job that
// finished last week), because a rep flipping between two screenshots should
// see one business, not two fixtures.
//
// The rows themselves — clients, quotes, jobs, invoices, payments, the
// receivables and overview bodies — live in work-data.js since 2026-09-25,
// so the /signup side panel can render the real list rows and dashboard
// tiles from them without importing this route table (which composes every
// other group's routes and so pulls in the whole fixture set).
import { COMPANY, PEOPLE, CLIENT, day, iso, TODAY } from "./company.js";
import {
  who,
  MARC,
  JULIE,
  SAM,
  DAN,
  LEO,
  ANA,
  person,
  LAVOIE,
  HADDAD,
  BELANGER,
  BENALI,
  FORTIN,
  RIVENORD,
  money,
  quote,
  Q_1042,
  Q_1044,
  Q_1045,
  Q_1039,
  Q_1046,
  Q_1047,
  QUOTES,
  visit,
  J_318,
  J_321,
  J_315,
  JOBS,
  invoice,
  INV_2071,
  INV_2069,
  FEE_2069,
  INV_2066,
  INVOICES,
  monthPay,
  PAYMENTS,
  receivablesBody,
  YTD,
  OVERVIEW,
  appointment,
  visitEntry,
  APPOINTMENTS,
} from "./work-data.js";
export {
  APPOINTMENTS,
  LAVOIE,
  FORTIN,
  RIVENORD,
  Q_1042,
  Q_1044,
  Q_1045,
  Q_1046,
  QUOTES,
  J_318,
  JOBS,
  INV_2069,
  INV_2066,
  INVOICES,
} from "./work-data.js";
import { ROUTES_GROW } from "./routes-grow.js";
import { ROUTES_MONEY } from "./routes-money.js";
import { ROUTES_PEOPLE } from "./routes-people.js";
import { ROUTES_SETTINGS_A } from "./routes-settings-a.js";
import { ROUTES_SETTINGS_B } from "./routes-settings-b.js";

// ── Leads ───────────────────────────────────────────────────────────────────
// The board's four columns are new / contacted / won / lost. Sources are the
// strings the product writes: "website" (the site's form), "self_quote_kitchen"
// (the kitchen self-quote, which asks neither budget nor timeline — the card
// then says "not asked" rather than "not stated"), "phone_agent" (the AI
// receptionist, which does not ask budget), "meta_api" (a Facebook lead form),
// and "referral" (typed by hand on a lead somebody phoned in).
const photo = (id) => ({ url: `https://res.cloudinary.com/demo/image/upload/w_400/${id}.jpg`, kind: "photo" });
const lead = (o) => ({
  email: null,
  phone: null,
  categoryId: null,
  category: null,
  message: null,
  lostReason: null,
  source: null,
  kitchenDesign: null,
  clientPhotos: null,
  photosRequestedAt: null,
  photosRequestedTo: null,
  intake: null,
  budgetBand: null,
  timeline: null,
  language: "fr",
  score: null,
  temperature: null,
  scoreReasons: null,
  assignedToId: null,
  assignedTo: null,
  quoteId: null,
  quote: null,
  doNotCall: false,
  ...o,
  updatedAt: o.updatedAt || o.createdAt,
});
const CAT_KITCHEN = { id: "cat_kitchen", label: "Kitchen cabinets" };
const CAT_BATH = { id: "cat_bath", label: "Bathroom vanities" };
const CAT_CLOSET = { id: "cat_closet", label: "Closets & storage" };
const LEADS = [
  lead({
    id: "ld_bergeron", name: "Amélie Bergeron", email: "amelie.bergeron@example.com", phone: "+1 450 555 0127",
    categoryId: CAT_KITCHEN.id, category: CAT_KITCHEN, status: "new", source: "website",
    message: "Full kitchen — shaker doors, about 14 ft of uppers and 18 ft of base, plus a small island if it fits the budget. Photos attached. We'd like to start after the holidays.",
    clientPhotos: [photo("sample"), photo("sample"), photo("sample")],
    budgetBand: "15k_plus", timeline: "1_3_months", score: 86, temperature: "hot",
    scoreReasons: [{ label: "Budget $15,000+", weight: 30 }, { label: "Wants to start within 3 months", weight: 20 }, { label: "Sent photos", weight: 15 }, { label: "Full kitchen", weight: 12 }, { label: "Left a phone number", weight: 9 }],
    createdAt: iso(day(-1, 20, 12)),
  }),
  lead({
    id: "ld_nguyen", name: "Thomas Nguyen", email: "t.nguyen@example.com", phone: "+1 514 555 0131",
    categoryId: CAT_KITCHEN.id, category: CAT_KITCHEN, status: "new", source: "self_quote_kitchen",
    message: "Kitchen in a 1970s bungalow, L-shaped, keeping the layout. No photos yet — happy to send some or have someone come by.",
    kitchenDesign: { layout: "L", uppersFt: 10, baseFt: 15, finish: "painted_shaker" },
    score: 61, temperature: "warm",
    scoreReasons: [{ label: "Kitchen self-quote completed", weight: 25 }, { label: "Left a phone number", weight: 9 }, { label: "No photos yet", weight: 0 }, { label: "Budget not asked on this form", weight: 0 }],
    assignedToId: SAM.userId, assignedTo: who(SAM),
    createdAt: iso(day(0, 8, 5)),
  }),
  lead({
    id: "ld_lapointe", name: "Geneviève Lapointe", email: "g.lapointe@example.com", phone: "+1 450 555 0158",
    categoryId: CAT_BATH.id, category: CAT_BATH, status: "contacted", source: "phone_agent",
    message: "Called about a double vanity for the ensuite, 60 in., wants it before her in-laws visit in October. Sam called back Thursday; site visit to book.",
    clientPhotos: [photo("sample")],
    timeline: "asap", score: 78, temperature: "hot",
    scoreReasons: [{ label: "Wants it as soon as possible", weight: 28 }, { label: "Sent a photo", weight: 15 }, { label: "Left a phone number", weight: 9 }, { label: "Scored without budget — the phone can't ask", weight: 0 }],
    assignedToId: SAM.userId, assignedTo: who(SAM),
    createdAt: iso(day(-4, 13, 48)), updatedAt: iso(day(-4, 16, 30)),
  }),
  lead({
    id: "ld_lavoie", name: LAVOIE.name, email: LAVOIE.email, phone: LAVOIE.phone,
    categoryId: CAT_KITCHEN.id, category: CAT_KITCHEN, status: "converted", source: "website",
    message: "Refacing rather than replacing — 22 doors and 8 drawer fronts, painted maple, new soft-close hinges.",
    clientPhotos: [photo("sample"), photo("sample")],
    budgetBand: "5k_15k", timeline: "2_weeks", score: 74, temperature: "hot",
    scoreReasons: [{ label: "Budget $5,000 – $15,000", weight: 22 }, { label: "Wants to start within 2 weeks", weight: 24 }, { label: "Sent photos", weight: 15 }, { label: "Left a phone number", weight: 9 }],
    assignedToId: SAM.userId, assignedTo: who(SAM),
    quoteId: Q_1044.id, quote: { id: Q_1044.id, quoteNumber: Q_1044.quoteNumber, status: Q_1044.status },
    createdAt: iso(day(-6, 9, 20)), updatedAt: iso(day(-4, 10)),
  }),
  lead({
    id: "ld_benali", name: BENALI.name, email: BENALI.email, phone: BENALI.phone,
    categoryId: CAT_BATH.id, category: CAT_BATH, status: "converted", source: "referral",
    message: "Referred by Sophie Dubois. Wall-hung walnut vanity, 48 in., two drawers.",
    budgetBand: "5k_15k", timeline: "1_3_months", score: 58, temperature: "warm",
    scoreReasons: [{ label: "Budget $5,000 – $15,000", weight: 22 }, { label: "Wants to start within 3 months", weight: 20 }, { label: "Referred by a client", weight: 10 }, { label: "No photos yet", weight: 0 }],
    assignedToId: MARC.userId, assignedTo: who(MARC),
    quoteId: Q_1045.id, quote: { id: Q_1045.id, quoteNumber: Q_1045.quoteNumber, status: Q_1045.status },
    createdAt: iso(day(-8, 10, 5)), updatedAt: iso(day(-1, 16, 20)),
  }),
  lead({
    id: "ld_simard", name: "Éric Simard", email: "eric.simard@example.com", phone: null,
    categoryId: CAT_CLOSET.id, category: CAT_CLOSET, status: "lost", source: "meta_api", lostReason: "price",
    message: "Reach-in closet organiser, melamine.",
    budgetBand: "under_1k", timeline: "exploring", score: 22, temperature: "cold",
    scoreReasons: [{ label: "Just exploring", weight: 4 }, { label: "Budget under $1,000", weight: 0 }, { label: "No phone number", weight: 0 }],
    assignedToId: JULIE.userId, assignedTo: who(JULIE),
    metaLeadId: "1234567890", metaFormId: "987654321", metaCampaignName: "Fall closets — Laval",
    createdAt: iso(day(-20, 18, 30)), updatedAt: iso(day(-15, 9)),
  }),
];
const sortLeads = (list, sort) =>
  sort === "score"
    ? [...list].sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || new Date(b.createdAt) - new Date(a.createdAt))
    : [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

// ── Service plans ───────────────────────────────────────────────────────────
// /api/service-plans answers summarisePlan() rows. Both plans collect by
// invoice (no card on file to draw a "····4242" from), one open-ended and one
// on a three-year term so the list shows both the cadence and a term total.
const cents = (n) => Math.round(n * 100);
const perOccurrence = (gross, discountPct, taxRatePct) => {
  const grossCents = cents(gross);
  const discountCents = Math.round((grossCents * discountPct) / 100);
  const subtotalCents = grossCents - discountCents;
  const taxCents = taxRatePct == null ? 0 : Math.round((subtotalCents * taxRatePct) / 100);
  const totalCents = subtotalCents + taxCents;
  return {
    grossCents, discountCents, subtotalCents, taxCents, totalCents,
    gross: grossCents / 100, discount: discountCents / 100, subtotal: subtotalCents / 100, tax: taxCents / 100, total: totalCents / 100,
  };
};
const plan = (o) => {
  const one = perOccurrence(o.amountPerOccurrence, o.discountPct, o.taxRatePct);
  const n = o.occurrenceCount;
  const term = n
    ? {
        occurrences: n,
        grossCents: one.grossCents * n, discountCents: one.discountCents * n, subtotalCents: one.subtotalCents * n, taxCents: one.taxCents * n, totalCents: one.totalCents * n,
        gross: (one.grossCents * n) / 100, discount: (one.discountCents * n) / 100, subtotal: (one.subtotalCents * n) / 100, tax: (one.taxCents * n) / 100, total: (one.totalCents * n) / 100,
      }
    : null;
  return {
    status: "active",
    endMode: n ? "count" : "open",
    endDate: null,
    language: "fr",
    collectionMode: "invoice",
    cancelledAt: null,
    completedAt: null,
    perOccurrence: one,
    plannedOccurrences: n || null,
    term,
    blockedReason: null,
    occurrencesIssued: o.occurrencesIssued || 0,
    automatic: { requested: false, blockedReason: "not_requested", acceptedAt: null, revokedAt: null, method: null },
    ...o,
  };
};
export const PLANS = [
  plan({
    id: "sp_dubois", name: "Annual hardware & finish tune-up", serviceName: "Cabinet tune-up visit",
    client: { id: CLIENT.id, name: CLIENT.name, email: CLIENT.email },
    frequency: "annual", startDate: iso(day(365, 9)), occurrenceCount: 3,
    amountPerOccurrence: 245, discountPct: 10, taxRatePct: 14.975,
    nextDueDate: iso(day(365, 9)), createdAt: iso(day(-6, 15, 30)),
  }),
  plan({
    id: "sp_rivenord", name: "Model-home cabinet maintenance", serviceName: "Quarterly site check — hinges, drawer glides, touch-ups",
    client: { id: RIVENORD.id, name: RIVENORD.name, email: RIVENORD.email },
    frequency: "quarterly", startDate: iso(day(-170, 9)), occurrenceCount: null,
    amountPerOccurrence: 380, discountPct: 0, taxRatePct: 14.975,
    nextDueDate: iso(day(13, 9)), occurrencesIssued: 2, createdAt: iso(day(-172, 11)),
  }),
];

// The calendar (APPOINTMENTS and its builders) lives in work-data.js.
const upcomingFor = (member) =>
  APPOINTMENTS.filter((a) => a.assignedToId === member.userId && new Date(a.scheduledAt) >= TODAY)
    .map((a) => ({ ...a }));
const TEAM_SCHEDULE = {
  canSeeTeam: true,
  basis: "company",
  team: [SAM, LEO, ANA, MARC, DAN, JULIE]
    .map((m) => ({ memberId: m.id, userId: m.userId, name: m.name, role: m.role, entries: upcomingFor(m) }))
    .sort((a, b) => b.entries.length - a.entries.length || a.name.localeCompare(b.name)),
};

// ── To-do ───────────────────────────────────────────────────────────────────
const task = (o) => ({
  companyId: COMPANY.id,
  description: null,
  dueDate: null,
  status: "open",
  priority: "normal",
  createdById: MARC.userId,
  assignedToId: null,
  assignedTo: null,
  clientId: null,
  client: null,
  quoteId: null,
  invoiceId: null,
  jobId: null,
  job: null,
  workAreaId: null,
  workArea: null,
  sourceKey: null,
  requiredPhotoCount: null,
  requiresComment: false,
  completionComment: null,
  photos: [],
  createdAt: iso(day(-3, 9)),
  updatedAt: iso(day(-3, 9)),
  ...o,
});
export const TASKS = [
  task({
    id: "tk_1", title: "Order Blum soft-close hinges for Dubois uppers", description: "24 × Blumotion 110°, plus 6 spares. Richelieu — 2-day delivery.",
    dueDate: iso(day(0, 17)), priority: "high", assignedToId: DAN.userId, assignedTo: who(DAN), clientId: CLIENT.id, client: { id: CLIENT.id, name: CLIENT.name }, jobId: J_318.id, job: { id: J_318.id, title: J_318.title, status: J_318.status },
  }),
  task({
    id: "tk_2", title: "Chase INV-2066 — Rive-Nord, 12 days past due", description: "Accounts payable said the cheque run is Thursdays. Ring Josée if nothing by Friday.",
    dueDate: iso(day(-1, 12)), priority: "urgent", assignedToId: JULIE.userId, assignedTo: who(JULIE), clientId: RIVENORD.id, client: { id: RIVENORD.id, name: RIVENORD.name }, invoiceId: INV_2066.id,
  }),
  task({
    id: "tk_3", title: "Send Q-1044 follow-up to Martin Lavoie", description: "Sent 4 days ago, no reply. Offer a Saturday install if it helps.",
    dueDate: iso(day(2, 12)), assignedToId: SAM.userId, assignedTo: who(SAM), clientId: LAVOIE.id, client: { id: LAVOIE.id, name: LAVOIE.name }, quoteId: Q_1044.id,
  }),
  task({
    id: "tk_4", title: "Photograph finished Dubois island before the counter goes on", description: "Two wide shots and one of the waterfall grain match — for the website gallery.",
    dueDate: iso(day(2, 16)), priority: "low", assignedToId: ANA.userId, assignedTo: who(ANA), jobId: J_318.id, job: { id: J_318.id, title: J_318.title, status: J_318.status },
    requiredPhotoCount: 3,
  }),
  task({
    id: "tk_5", title: "Confirm Fortin laundry room is signed off", status: "done", dueDate: iso(day(-3, 12)), assignedToId: ANA.userId, assignedTo: who(ANA), clientId: FORTIN.id, client: { id: FORTIN.id, name: FORTIN.name }, jobId: J_315.id, job: { id: J_315.id, title: J_315.title, status: J_315.status },
    requiresComment: true, completionComment: "Signed on site, paid by e-transfer the next morning.", updatedAt: iso(day(-3, 15)),
  }),
  task({
    id: "tk_6", title: "Book the spray booth for the Dubois doors", status: "done", dueDate: iso(day(-7, 12)), priority: "high", assignedToId: DAN.userId, assignedTo: who(DAN), jobId: J_318.id, job: { id: J_318.id, title: J_318.title, status: J_318.status },
    updatedAt: iso(day(-7, 14)),
  }),
];

// ── Home ────────────────────────────────────────────────────────────────────
// A healthy, fully-set-up shop: every onboarding step done (so the checklist
// card renders itself away), every set-up step done or dismissed (so the
// "Additional set-up steps" card does too), a goal set and slightly ahead of
// pace, and the receptionist's one booking this week counted in "Waiting on
// you" alongside the two estimates to review and the one overdue invoice.
const ONBOARDING = {
  complete: true,
  percent: 100,
  doneCount: 6,
  total: 6,
  seatsUsed: 6,
  seatsRemaining: 0,
  plan: { name: "Shop", maxUsers: 6 },
  steps: [
    { key: "company", label: "Company details", done: true, href: "/app/settings/company" },
    { key: "branding", label: "Logo and brand colour", done: true, href: "/app/settings/branding" },
    { key: "services", label: "Services and prices", done: true, href: "/app/settings/products" },
    { key: "payments", label: "Connect payments", done: true, href: "/app/settings/payments" },
    { key: "team", label: "Add your team", done: true, href: "/app/settings/team" },
    { key: "first_quote", label: "Send your first quote", done: true, href: "/app/quotes/new" },
  ],
};
const SETUP_STEPS = { steps: [] };

const VOICE_CALLS_HOME = {
  pending: 0,
  setup: { hasNumber: true, answering: true },
  canRecover: false,
  aiAvailable: true,
  calls: [
    {
      id: "vc_0913_1502",
      direction: "inbound",
      from: "+1 514 555 0163",
      at: iso(day(-1, 15, 2)),
      durationSec: 254,
      costCents: 21,
      summary: "Nadia Haddad asked for a pantry built-in; the assistant took the dimensions and drafted Q-1047.",
      archived: true,
      needsReview: false,
      reviewedAt: iso(day(-1, 16)),
      quote: { id: Q_1047.id, quoteNumber: Q_1047.quoteNumber, needsReview: true },
      booking: null,
    },
    {
      id: "vc_0911_0912",
      direction: "inbound",
      from: "+1 450 555 0158",
      at: iso(day(-3, 9, 12)),
      durationSec: 187,
      costCents: 16,
      summary: "Geneviève Lapointe booked an estimate visit for Thursday 10:00 for a double vanity.",
      archived: true,
      needsReview: false,
      reviewedAt: iso(day(-3, 9, 40)),
      quote: null,
      booking: { id: "bk_lapointe", at: iso(day(3, 10)), status: "confirmed", appointmentId: "ap_lapointe", mode: "estimate" },
    },
  ],
};

// ── Routes another group's screen also reads ────────────────────────────────
// This file is consulted before every other group file, so a plain entry for
// /api/voice/calls here would shadow the receptionist screen's richer answer
// in routes-grow.js, and /api/migrations here (nothing pending — the healthy
// shop) would blank the Settings › Migration screen. So for these the fixture
// answers on the Work screens and otherwise defers to whichever group file
// answers the same path, falling back to its own answer only when none does.
const WORK_SCREENS = new Set(["home", "ai", "requests", "quotes", "estimate-reviews", "jobs", "invoices", "plans", "calendar", "tasks"]);
const shared = (path, mine) => ({
  path,
  reply: (ctx) => {
    // `screen` is the screens.js row, not its slug.
    if (WORK_SCREENS.has(ctx.screen?.slug ?? ctx.screen)) return mine(ctx);
    const others = [...ROUTES_GROW, ...ROUTES_MONEY, ...ROUTES_PEOPLE, ...ROUTES_SETTINGS_A, ...ROUTES_SETTINGS_B];
    for (const r of others) {
      const m = typeof r.path === "string" ? (r.path === path ? [] : null) : path.match(r.path);
      if (!m || (r.method && r.method !== ctx.method)) continue;
      return r.reply({ ...ctx, params: m });
    }
    return mine(ctx);
  },
});

export const ROUTES_WORK = [
  // Home
  { path: "/api/analytics/overview", reply: () => OVERVIEW },
  { path: "/api/analytics/receivables", reply: ({ search }) => receivablesBody(Number(search.get("months")) || 6) },
  { path: "/api/onboarding-status", reply: () => ONBOARDING },
  { path: "/api/setup-steps", reply: () => SETUP_STEPS },
  { path: "/api/analytics/goal", reply: () => ({ annualGoal: 420000, goal: OVERVIEW.goal }) },
  { path: "/api/bookings/awaiting-payment", reply: () => ({ bookings: [], currency: "CAD", canCheck: true }) },
  shared("/api/migrations", () => ({ requests: [] })),
  shared("/api/voice/calls", () => VOICE_CALLS_HOME),

  // Leads
  { path: "/api/leads", method: "GET", reply: ({ search }) => {
    const q = (search.get("q") || "").toLowerCase();
    const temp = search.get("temperature");
    return sortLeads(
      LEADS.filter((l) => (!temp || l.temperature === temp) && (!q || l.name.toLowerCase().includes(q) || (l.email || "").toLowerCase().includes(q))),
      search.get("sort"),
    );
  } },
  { path: "/api/leads/assignees", reply: () => PEOPLE.map(who).sort((a, b) => a.name.localeCompare(b.name)) },
  { path: /^\/api\/leads\/([^/]+)$/, method: "GET", reply: ({ params }) => LEADS.find((l) => l.id === params[1]) || LEADS[0] },

  // Quotes and the review queue
  { path: "/api/quotes", method: "GET", reply: () => QUOTES },
  { path: "/api/quotes/estimate-reviews", reply: () => ({ quotes: [Q_1046, Q_1047], canApprove: true, currentUserId: MARC.userId }) },

  // Jobs
  { path: "/api/jobs", method: "GET", reply: ({ search }) => (search.get("archived") ? [] : JOBS) },

  // Invoices
  { path: "/api/invoices", method: "GET", reply: () => INVOICES },

  // Service plans
  { path: "/api/service-plans", method: "GET", reply: () => PLANS },

  // Calendar
  { path: "/api/appointments", method: "GET", reply: () => APPOINTMENTS },
  { path: "/api/schedule/team", reply: () => TEAM_SCHEDULE },

  // To-do
  { path: "/api/tasks", method: "GET", reply: () => TASKS },
];
