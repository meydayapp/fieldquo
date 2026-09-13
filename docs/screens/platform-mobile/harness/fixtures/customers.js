// Fixtures for the customers group — see index.js for the contract.
//
// Routes answered here: the dashboard (/platform) and everything it and the
// tenant board fetch, the company list and one company's detail page with all
// five of its panels, incomplete signups, signup origins, subscriptions, the
// CSV reports, the migration list and one migration, plans (+ the Connect fee
// ledger), promotions, feature flags and promo codes.
//
// ── One world, many views ───────────────────────────────────────────────────
//
// The twelve companies below are the SAME twelve on every screen: the company
// list, the tenant board, the subscriptions page, the signups page, the
// migration's company, the feature overrides. Where the real route derives its
// answer through a pure helper in lib/ (the revenue outlook, the tenant funnel,
// the company comparison, the dispute evidence, the feature registry) the
// fixture calls that same helper on synthetic rows, so the shape the page gets
// is the shape production would produce rather than a hand-typed imitation
// that drifts the next time the helper changes.
//
// Dates: pinned to September 2026 where a page only prints them; computed
// from Date.now() where a page compares against the clock (trial countdowns,
// "quiet 41d", promotion windows, signup age), so those render as intended
// whenever the frame is taken.
import { COMPANY_ID, MIGRATION_ID } from "./ids.js";
import {
  buildFunnel,
  buildTradeBreakdown,
  buildCompanyHealth,
  buildAdoption,
} from "@/lib/analytics/tenantHealth";
import {
  metricsForCompany,
  compareToCohort,
  talkingPoints,
} from "@/lib/analytics/companyComparison";
import { summariseComposeTimes } from "@/lib/analytics/composeTimer";
import { buildRevenueOutlook } from "@/lib/platform/revenueOutlook";
import { assembleDisputeEvidence } from "@/lib/billing/disputeEvidence";
import { FEATURES, FEATURE_STATES, resolveFeature, normaliseState } from "@/lib/features/registry";
import { SIGNUP_FLAG_LABELS, SIGNUP_VIA_LABELS } from "@/lib/platform/signupFlags";

// ── Time and randomness ─────────────────────────────────────────────────────
const DAY = 86400000;
const NOW = Date.now();
/** ISO timestamp `days` (and `hours`) before now — for anything a page ages. */
const ago = (days, hours = 0) => new Date(NOW - days * DAY - hours * 3600000).toISOString();
/** ISO timestamp `days` after now — trial ends, renewals, promotion windows. */
const ahead = (days) => new Date(NOW + days * DAY).toISOString();

/** Deterministic: the same frame every run, so a diff is a real change. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// ── Plans ───────────────────────────────────────────────────────────────────
const plan = (id, over) => ({
  id,
  name: "Pro",
  priceMonthly: "129",
  priceAnnual: "1290",
  currency: "CAD",
  tierKey: "pro",
  seats: 3,
  crewSeats: 5,
  sortOrder: 1,
  stripePriceId: null,
  stripePriceIdAnnual: null,
  maxUsers: null,
  maxQuotesPerMonth: null,
  aiCopilotEnabled: true,
  aiMonthlyTokenCap: 2000000,
  isPublic: true,
  features: null,
  createdAt: "2026-01-04T16:00:00.000Z",
  updatedAt: "2026-08-19T09:12:44.000Z",
  ...over,
});

export const PLANS = [
  plan("plan_solo_cad", { name: "Solo", tierKey: "solo", priceMonthly: "49", priceAnnual: "490", seats: 1, crewSeats: 2, sortOrder: 0, aiCopilotEnabled: false, aiMonthlyTokenCap: 250000, maxQuotesPerMonth: 60 }),
  plan("plan_solo_usd", { name: "Solo", tierKey: "solo", currency: "USD", priceMonthly: "39", priceAnnual: "390", seats: 1, crewSeats: 2, sortOrder: 0, aiCopilotEnabled: false, aiMonthlyTokenCap: 250000, maxQuotesPerMonth: 60 }),
  plan("plan_pro_cad", { name: "Pro", stripePriceId: "price_1PzQxKAbCdEfGhIjKlMnOpQr" }),
  plan("plan_pro_usd", { name: "Pro", currency: "USD", priceMonthly: "99", priceAnnual: "990" }),
  plan("plan_crew_cad", { name: "Crew", tierKey: "crew", priceMonthly: "249", priceAnnual: "2490", seats: 8, crewSeats: 15, sortOrder: 2, aiMonthlyTokenCap: null }),
  plan("plan_crew_usd", { name: "Crew", tierKey: "crew", currency: "USD", priceMonthly: "199", priceAnnual: "1990", seats: 8, crewSeats: 15, sortOrder: 2, aiMonthlyTokenCap: null }),
  plan("plan_founders", { name: "Founders (free)", tierKey: null, priceMonthly: "0", priceAnnual: null, seats: 2, crewSeats: 3, sortOrder: 9, isPublic: false, aiCopilotEnabled: false, createdAt: "2025-11-02T18:40:00.000Z" }),
  plan("plan_enterprise", { name: "Enterprise — negotiated (Beauchemin & Fils, 40 seats)", tierKey: null, priceMonthly: "599", priceAnnual: null, seats: 40, crewSeats: 60, sortOrder: 10, isPublic: false, aiMonthlyTokenCap: null }),
];
const PLAN_BY_ID = Object.fromEntries(PLANS.map((p) => [p.id, p]));

// ── Companies ───────────────────────────────────────────────────────────────
//
// `sub` is null for a company that never finished Stripe Checkout — the row
// exists, the owner is a member, nothing bills. `profile` drives the synthetic
// quote history the tenant board is computed from.
const TRADE = {
  roofing: ["Roofing", 12400],
  siding: ["Siding", 9100],
  gutters: ["Gutters & eavestrough", 1850],
  painting_interior: ["Interior painting", 3400],
  painting_exterior: ["Exterior painting", 5600],
  cabinetry: ["Custom cabinetry", 18500],
  countertops: ["Countertops", 6400],
  flooring: ["Flooring", 7200],
  landscaping: ["Landscaping", 4900],
  plumbing: ["Plumbing", 1650],
  hvac: ["Heating & cooling", 5400],
  electrical: ["Electrical", 2300],
  decks: ["Decks & fences", 11200],
  pressure_washing: ["Pressure washing", 460],
  tile: ["Tile", 3900],
};

export const COMPANIES = [
  {
    id: COMPANY_ID,
    name: "Easy Roofers & Exterior Renovations of Greater Moncton Ltd.",
    slug: "easyroofers",
    email: "office@easyroofers-exterior-renovations-moncton.ca",
    phone: "+15068551234",
    city: "Moncton", province: "NB", country: "CA",
    onboardingStatus: "active",
    createdAt: "2026-02-11T14:03:11.000Z",
    onboardingCompletedAt: "2026-02-11T14:41:02.000Z",
    trialEndsAt: "2026-03-11T14:03:11.000Z",
    industries: ["roofing", "siding", "gutters"],
    defaultLanguage: "en",
    sendLanguages: ["en", "fr"],
    sub: { plan: "plan_pro_cad", status: "active", stripe: true, since: "2026-03-11T14:05:40.000Z", currentPeriodEnd: ahead(17), trialEndsAt: null },
    members: 6, clients: 84,
    profile: { quotes: 132, first: "2026-02-12T09:10:00.000Z", lastDaysAgo: 1, trades: ["roofing", "siding", "gutters"], instant: true, invoicing: true, seed: 11 },
  },
  {
    id: "cmp_rivesud",
    name: "Les Entreprises de Toiture Rive-Sud Beauchemin & Fils inc.",
    slug: "toiture-rive-sud-beauchemin",
    email: "administration@toiture-rive-sud-beauchemin-et-fils.qc.ca",
    phone: "+14506721188",
    city: "Longueuil", province: "QC", country: "CA",
    onboardingStatus: "active",
    createdAt: "2025-11-18T13:22:09.000Z",
    onboardingCompletedAt: "2025-11-18T13:59:00.000Z",
    trialEndsAt: "2025-12-18T13:22:09.000Z",
    industries: ["roofing", "siding"],
    defaultLanguage: "fr",
    sendLanguages: ["fr", "en"],
    sub: { plan: "plan_enterprise", status: "past_due", stripe: true, since: "2025-12-18T13:30:00.000Z", currentPeriodEnd: ago(6), trialEndsAt: null },
    members: 23, clients: 412,
    profile: { quotes: 310, first: "2025-11-19T08:00:00.000Z", lastDaysAgo: 0, trades: ["roofing", "siding", "gutters"], instant: true, invoicing: true, seed: 22 },
  },
  {
    id: "cmp_northline",
    name: "Northline Painting & Decorating",
    slug: "northline-painting",
    email: "hello@northlinepainting.com",
    phone: "+12065550142",
    city: "Tacoma", province: "WA", country: "US",
    onboardingStatus: "active",
    createdAt: ago(27),
    onboardingCompletedAt: ago(27),
    trialEndsAt: ahead(3),
    industries: ["painting"],
    defaultLanguage: "en",
    sendLanguages: [],
    sub: { plan: "plan_solo_usd", status: "trialing", stripe: true, since: ago(27), currentPeriodEnd: ahead(3), trialEndsAt: ahead(3) },
    members: 1, clients: 9,
    profile: { quotes: 11, first: ago(25), lastDaysAgo: 2, trades: ["painting_interior", "painting_exterior"], instant: true, invoicing: false, seed: 33 },
  },
  {
    id: "cmp_summit",
    name: "Summit Cabinetry and Custom Millwork Company of Colorado, LLC",
    slug: "summit-cabinetry-millwork",
    email: "estimates@summitcabinetryandmillwork.com",
    phone: "+17205550199",
    city: "Golden", province: "CO", country: "US",
    onboardingStatus: "active",
    createdAt: "2026-04-02T19:45:00.000Z",
    onboardingCompletedAt: "2026-04-02T20:12:00.000Z",
    trialEndsAt: "2026-05-02T19:45:00.000Z",
    industries: ["cabinetry", "countertops"],
    defaultLanguage: "en",
    sendLanguages: ["en", "es"],
    // Active in the database, no Stripe subscription id — the row the
    // dashboard's blocked-revenue banner exists to name.
    sub: { plan: "plan_pro_usd", status: "active", stripe: false, since: "2026-05-02T19:50:00.000Z", currentPeriodEnd: ahead(21), trialEndsAt: null },
    members: 4, clients: 37,
    profile: { quotes: 48, first: "2026-04-03T15:00:00.000Z", lastDaysAgo: 4, trades: ["cabinetry", "countertops", "tile"], instant: false, invoicing: true, seed: 44 },
  },
  {
    id: "cmp_verdant",
    name: "Verdant Landscapes — Aménagement paysager Verdant",
    slug: "verdant-landscapes",
    email: "info@verdant-landscapes.ca",
    phone: "+16135550171",
    city: "Gatineau", province: "QC", country: "CA",
    onboardingStatus: "pending",
    createdAt: ago(18),
    onboardingCompletedAt: null,
    trialEndsAt: ahead(12),
    industries: ["landscaping"],
    defaultLanguage: "fr",
    sendLanguages: ["fr", "en"],
    sub: { plan: "plan_pro_cad", status: "trialing", stripe: true, since: ago(18), currentPeriodEnd: ahead(12), trialEndsAt: ahead(12) },
    members: 2, clients: 3,
    profile: { quotes: 2, first: ago(15), lastDaysAgo: 9, trades: ["landscaping"], instant: false, invoicing: false, seed: 55 },
  },
  {
    id: "cmp_prairie",
    name: "Prairie Plumbing & Heating (1987) Ltd.",
    slug: "prairie-plumbing-heating",
    email: "dispatch@prairieplumbingheating1987.ca",
    phone: "+13065550138",
    city: "Regina", province: "SK", country: "CA",
    onboardingStatus: "churned",
    createdAt: "2026-01-09T16:30:00.000Z",
    onboardingCompletedAt: "2026-01-09T17:01:00.000Z",
    trialEndsAt: "2026-02-08T16:30:00.000Z",
    industries: ["plumbing", "hvac"],
    defaultLanguage: "en",
    sendLanguages: [],
    sub: { plan: "plan_crew_cad", status: "canceled", stripe: true, since: "2026-02-08T16:35:00.000Z", currentPeriodEnd: ago(9), trialEndsAt: null },
    members: 9, clients: 156,
    profile: { quotes: 77, first: "2026-01-10T14:00:00.000Z", lastDaysAgo: 41, trades: ["plumbing", "hvac"], instant: false, invoicing: true, seed: 66 },
  },
  {
    id: "cmp_tidewater",
    name: "Tidewater Flooring Installers of Hampton Roads",
    slug: "tidewater-flooring",
    email: "jim.calloway@tidewaterflooringinstallers-hamptonroads.com",
    phone: "+17575550120",
    city: "Norfolk", province: "VA", country: "US",
    onboardingStatus: "active",
    createdAt: "2025-12-01T15:00:00.000Z",
    onboardingCompletedAt: "2025-12-01T15:20:00.000Z",
    trialEndsAt: "2025-12-31T15:00:00.000Z",
    industries: ["flooring", "tile"],
    defaultLanguage: "en",
    sendLanguages: [],
    // A $0 legacy plan: active, linked to Stripe, and cannot raise a charge.
    sub: { plan: "plan_founders", status: "active", stripe: true, since: "2025-12-31T15:00:00.000Z", currentPeriodEnd: ahead(8), trialEndsAt: null },
    members: 3, clients: 61,
    profile: { quotes: 58, first: "2025-12-02T13:00:00.000Z", lastDaysAgo: 36, trades: ["flooring", "tile"], instant: true, invoicing: true, seed: 77 },
  },
  {
    id: "cmp_okanagan",
    name: "Okanagan Valley Deck & Fence Co.",
    slug: "okanagan-deck-fence",
    email: "brad@okanagandeckandfence.ca",
    phone: "+12505550163",
    city: "Kelowna", province: "BC", country: "CA",
    onboardingStatus: "pending",
    createdAt: ago(3, 5),
    onboardingCompletedAt: null,
    trialEndsAt: ahead(27),
    industries: ["decks"],
    defaultLanguage: "en",
    sendLanguages: [],
    sub: null,
    members: 1, clients: 2,
    profile: { quotes: 1, first: ago(2), lastDaysAgo: 2, trades: ["decks"], instant: true, invoicing: false, seed: 88 },
  },
  {
    id: "cmp_maritime",
    name: "Maritime Electrical Services Group Incorporated — Halifax, Dartmouth & Bedford",
    slug: "maritime-electrical-services-group",
    email: "accounts.receivable@maritimeelectricalservicesgroup.ca",
    phone: "+19025550109",
    city: "Dartmouth", province: "NS", country: "CA",
    onboardingStatus: "pending",
    createdAt: ago(11, 2),
    onboardingCompletedAt: null,
    trialEndsAt: ahead(19),
    industries: ["electrical"],
    defaultLanguage: "en",
    sendLanguages: [],
    sub: null,
    members: 1, clients: 0,
    profile: { quotes: 0, first: null, lastDaysAgo: null, trades: ["electrical"], instant: false, invoicing: false, seed: 99 },
  },
  {
    id: "cmp_bluebird",
    name: "Bluebird Home Painters",
    slug: "bluebird-home-painters",
    email: "sam@bluebirdhomepainters.com",
    phone: "+15125550187",
    city: "Austin", province: "TX", country: "US",
    onboardingStatus: "active",
    createdAt: ago(33),
    onboardingCompletedAt: ago(33),
    trialEndsAt: ago(2),
    industries: ["painting"],
    defaultLanguage: "en",
    sendLanguages: ["en", "es"],
    // Trial ended two days ago and Stripe never transitioned it — "lapsed".
    sub: { plan: "plan_pro_usd", status: "trialing", stripe: true, since: ago(33), currentPeriodEnd: ago(2), trialEndsAt: ago(2) },
    members: 2, clients: 14,
    profile: { quotes: 19, first: ago(31), lastDaysAgo: 5, trades: ["painting_interior", "painting_exterior"], instant: true, invoicing: true, seed: 111 },
  },
  {
    id: "cmp_sunset",
    name: "Sunset Pressure Washing",
    slug: "sunset-pressure-washing",
    email: "sunsetpressurewashing@gmail.com",
    phone: null,
    city: "Surrey", province: "BC", country: "CA",
    onboardingStatus: "pending",
    createdAt: ago(22, 7),
    onboardingCompletedAt: null,
    trialEndsAt: ahead(8),
    industries: ["pressure_washing"],
    defaultLanguage: "en",
    sendLanguages: [],
    sub: null,
    members: 1, clients: 0,
    profile: { quotes: 0, first: null, lastDaysAgo: null, trades: [], instant: false, invoicing: false, seed: 122 },
  },
  {
    id: "cmp_granite",
    name: "Granite State Countertops & Tile",
    slug: "granite-state-countertops",
    email: "office@granitestatecountertops.com",
    phone: "+16035550154",
    city: "Manchester", province: "NH", country: "US",
    onboardingStatus: "active",
    createdAt: "2026-03-20T12:00:00.000Z",
    onboardingCompletedAt: "2026-03-20T12:30:00.000Z",
    trialEndsAt: "2026-04-19T12:00:00.000Z",
    industries: ["countertops", "tile"],
    defaultLanguage: "en",
    sendLanguages: [],
    sub: { plan: "plan_crew_usd", status: "active", stripe: true, since: "2026-04-19T12:00:00.000Z", currentPeriodEnd: ahead(5), trialEndsAt: null },
    members: 7, clients: 118,
    profile: { quotes: 96, first: "2026-03-21T14:00:00.000Z", lastDaysAgo: 3, trades: ["countertops", "tile", "cabinetry"], instant: true, invoicing: true, seed: 133 },
  },
];
const COMPANY_BY_ID = Object.fromEntries(COMPANIES.map((c) => [c.id, c]));

/** The Subscription row as Prisma would hand it back, plan included. */
function subscriptionRow(c, { withPlan = true } = {}) {
  if (!c.sub) return null;
  const p = PLAN_BY_ID[c.sub.plan];
  return {
    id: `sub_${c.id.replace("cmp_", "")}`,
    companyId: c.id,
    planId: p.id,
    stripeCustomerId: c.sub.stripe ? `cus_${c.id.replace("cmp_", "").toUpperCase()}7Kq2` : null,
    stripeSubscriptionId: c.sub.stripe ? `sub_1Q${c.id.replace("cmp_", "").slice(0, 6)}ZxYwVuTs` : null,
    status: c.sub.status,
    currentPeriodEnd: c.sub.currentPeriodEnd,
    trialEndsAt: c.sub.trialEndsAt,
    createdAt: c.sub.since,
    updatedAt: ago(1, 3),
    welcomeEmailSentAt: c.sub.since,
    notifiedPlanId: p.id,
    pastDueSince: c.sub.status === "past_due" ? ago(6) : null,
    billingInterval: "month",
    ...(withPlan ? { plan: p } : {}),
  };
}

// ── The synthetic quote history every analytics screen is computed from ─────
//
// Built once. Per company: `profile.quotes` quotes spread between the first
// quote and `lastDaysAgo`, a status mix, a value drawn around the trade's base
// price, jobs for the accepted ones, invoices for the jobs. The helpers in
// lib/analytics then reduce these exactly as production reduces Prisma rows.
function buildWorld() {
  const quotes = [];
  const jobs = [];
  const invoices = [];
  const scopeRows = [];
  const companyRows = [];

  for (const c of COMPANIES) {
    const p = c.profile;
    const r = rng(p.seed);
    const first = p.first ? new Date(p.first).getTime() : null;
    const last = p.lastDaysAgo === null ? null : NOW - p.lastDaysAgo * DAY;
    const own = [];
    for (let i = 0; i < p.quotes; i++) {
      const t = p.quotes === 1 ? first : first + ((last - first) * i) / (p.quotes - 1);
      const createdAt = new Date(t).toISOString();
      const roll = r();
      const status = roll < 0.14 ? "draft" : roll < 0.42 ? "sent" : roll < 0.82 ? "accepted" : "declined";
      const tradeKeys = p.trades.slice(0, 1 + Math.floor(r() * Math.min(2, p.trades.length)));
      const groups = tradeKeys.map((k) => ({ key: k, subtotal: Math.round(TRADE[k][1] * (0.55 + r() * 1.4)) }));
      const total = groups.reduce((n, g) => n + g.subtotal, 0);
      const sentAt = status === "draft" ? null : new Date(t + (0.5 + r() * 30) * 3600000).toISOString();
      const acceptedAt = status === "accepted" ? new Date(new Date(sentAt).getTime() + (0.2 + r() * 9) * DAY).toISOString() : null;
      const declinedAt = status === "declined" ? new Date(new Date(sentAt).getTime() + (1 + r() * 12) * DAY).toISOString() : null;
      const q = {
        id: `q_${c.id.replace("cmp_", "")}_${i + 1}`,
        companyId: c.id,
        status,
        total,
        sentAt,
        acceptedAt,
        declinedAt,
        declineReason:
          status === "declined" && r() < 0.7
            ? ["Went with a cheaper quote", "Timing — postponed to spring", "Chose a neighbour's contractor", "Too expensive for the scope"][Math.floor(r() * 4)]
            : null,
        createdAt,
        autoEstimated: p.instant && r() < 0.4,
        composeSeconds: r() < 0.62 ? Math.round(18 + r() * r() * 520) : null,
      };
      quotes.push(q);
      own.push(q);

      let jobCount = 0;
      let completedJobCount = 0;
      if (status === "accepted") {
        const done = r() < 0.7;
        jobCount = 1;
        completedJobCount = done ? 1 : 0;
        const job = {
          id: `job_${q.id}`,
          companyId: c.id,
          status: done ? "completed" : "scheduled",
          quoteId: q.id,
          completedAt: done ? new Date(new Date(acceptedAt).getTime() + (3 + r() * 20) * DAY).toISOString() : null,
        };
        jobs.push(job);
        if (p.invoicing && done && r() < 0.85) {
          const paid = r() < 0.75;
          invoices.push({
            id: `inv_${q.id}`,
            companyId: c.id,
            status: paid ? "paid" : "sent",
            total,
            sentAt: job.completedAt,
            paidDate: paid ? new Date(new Date(job.completedAt).getTime() + (1 + r() * 14) * DAY).toISOString() : null,
          });
        }
      }
      for (const g of groups) {
        scopeRows.push({
          companyId: c.id,
          categoryKey: g.key,
          categoryLabel: TRADE[g.key][0],
          status,
          sentAt,
          scopeSubtotal: g.subtotal,
          quoteTotal: total,
          jobCount,
          completedJobCount,
        });
      }
    }
    const dates = own.map((q) => q.createdAt).sort();
    companyRows.push({
      id: c.id,
      name: c.name,
      createdAt: c.createdAt,
      quoteCount: own.length,
      firstQuoteAt: dates[0] || null,
      lastQuoteAt: dates[dates.length - 1] || null,
      trades: p.trades.map((k) => TRADE[k][0]),
      usesInstantQuotes: own.some((q) => q.autoEstimated),
      usesInvoicing: invoices.some((i) => i.companyId === c.id),
      usesJobs: jobs.some((j) => j.companyId === c.id),
    });
  }
  return { quotes, jobs, invoices, scopeRows, companyRows };
}
const WORLD = buildWorld();

function tenantAnalytics() {
  const { quotes, jobs, invoices, scopeRows, companyRows } = WORLD;
  const decisionDays = quotes
    .filter((q) => q.sentAt && q.acceptedAt)
    .map((q) => (new Date(q.acceptedAt) - new Date(q.sentAt)) / DAY)
    .filter((d) => d >= 0)
    .sort((a, b) => a - b);
  const declineReasons = quotes.filter((q) => q.declineReason).map((q) => q.declineReason);
  return {
    funnel: buildFunnel(quotes, jobs, invoices),
    trades: buildTradeBreakdown(scopeRows),
    health: buildCompanyHealth(companyRows),
    adoption: buildAdoption(companyRows, {
      totalQuotes: quotes.length,
      instantQuotes: quotes.filter((q) => q.autoEstimated).length,
    }),
    speed: {
      compose: summariseComposeTimes(quotes.map((q) => q.composeSeconds)),
      decision: decisionDays.length
        ? { count: decisionDays.length, medianDays: Math.round(decisionDays[Math.floor(decisionDays.length / 2)] * 10) / 10 }
        : { count: 0, medianDays: null },
    },
    declineReasons: declineReasons.slice(0, 50),
    declineReasonCount: declineReasons.length,
  };
}

function companyInsight(companyId) {
  const c = COMPANY_BY_ID[companyId];
  if (!c) return json({ error: "Not found" }, 404);
  const { quotes, jobs, invoices, scopeRows } = WORLD;
  const rowsFor = (id) => ({
    quotes: quotes.filter((q) => q.companyId === id),
    jobs: jobs.filter((j) => j.companyId === id),
    invoices: invoices.filter((i) => i.companyId === id),
  });
  const subject = metricsForCompany(rowsFor(companyId));
  const otherIds = COMPANIES.map((x) => x.id).filter((id) => id !== companyId && rowsFor(id).quotes.length);
  const comparison = compareToCohort(subject, otherIds.map((id) => metricsForCompany(rowsFor(id))));
  const mine = rowsFor(companyId);
  return {
    company: { id: c.id, name: c.name, createdAt: c.createdAt, isDemo: false },
    comparison,
    talkingPoints: talkingPoints(comparison),
    funnel: buildFunnel(mine.quotes, mine.jobs, mine.invoices),
    trades: buildTradeBreakdown(scopeRows.filter((s) => s.companyId === companyId)),
    cohortSize: otherIds.length,
  };
}

// ── The dashboard's own numbers ─────────────────────────────────────────────
function overview() {
  const subs = COMPANIES.filter((c) => c.sub).map((c) => {
    const p = PLAN_BY_ID[c.sub.plan];
    return {
      status: c.sub.status,
      trialEndsAt: c.sub.trialEndsAt,
      stripeSubscriptionId: c.sub.stripe ? "sub_x" : null,
      company: { name: c.name },
      plan: { name: p.name, currency: p.currency, priceMonthly: p.priceMonthly, stripePriceId: p.stripePriceId },
    };
  });
  const activeOnly = subs.filter((s) => s.status === "active");
  const mrr = activeOnly.reduce((n, s) => n + Number(s.plan.priceMonthly), 0);
  const planMix = {};
  for (const s of activeOnly) {
    const key = `${s.plan.name} (${s.plan.currency})`;
    planMix[key] = (planMix[key] || 0) + 1;
  }

  const r = rng(7);
  const daily = (base, valueBase) =>
    Array.from({ length: 30 }, (_, i) => {
      const d = new Date(NOW - (29 - i) * DAY);
      d.setUTCHours(0, 0, 0, 0);
      const count = Math.max(0, Math.round(base * (0.3 + r() * 1.6) - (d.getUTCDay() % 6 === 0 ? base * 0.6 : 0)));
      return { date: d.toISOString().slice(0, 10), count, value: valueBase ? count * Math.round(valueBase * (0.6 + r())) : 0 };
    });
  const monthly = (start, growth, valueBase) =>
    Array.from({ length: 12 }, (_, i) => {
      const d = new Date(NOW);
      d.setUTCDate(1);
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCMonth(d.getUTCMonth() - (11 - i));
      const count = Math.round(start * Math.pow(growth, i) * (0.8 + r() * 0.4));
      return { month: d.toISOString().slice(0, 7), count, value: valueBase ? count * Math.round(valueBase * (0.7 + r() * 0.6)) : 0 };
    });

  const trialingSubscription = subs.filter((s) => s.status === "trialing").length;
  const awaitingCheckout = COMPANIES.filter((c) => !c.sub && c.onboardingStatus === "pending").length;

  return {
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(mrr * 12 * 100) / 100,
    totalBilled: 473558.4,
    outlook: buildRevenueOutlook(subs),
    quotedValue: WORLD.quotes.reduce((n, q) => n + q.total, 0),
    invoicedValue: WORLD.invoices.reduce((n, i) => n + i.total, 0),
    activeSubscriptionCount: activeOnly.length,
    totalCompanies: subs.length,
    incompleteSignups: COMPANIES.filter((c) => !c.sub).length,
    trialCompanies: trialingSubscription + awaitingCheckout,
    trialBreakdown: { trialingSubscription, awaitingCheckout },
    churnedThisMonth: COMPANIES.filter((c) => c.onboardingStatus === "churned").length,
    quotesThisMonth: 141,
    jobsThisMonth: 58,
    totalQuotes: WORLD.quotes.length,
    totalInvoices: WORLD.invoices.length,
    planMix,
    daily: {
      companies: daily(0.6, 0),
      quotes: daily(9, 6100),
      payments: daily(4, 3900),
    },
    monthly: {
      companies: monthly(1, 1.22, 0),
      quotes: monthly(38, 1.19, 6100),
      payments: monthly(14, 1.21, 3900),
    },
  };
}

const EMAIL_HEALTH = {
  healthy: false,
  configured: true,
  from: "FieldQuo <no-reply@mail.fieldquo.com>",
  domain: "mail.fieldquo.com",
  isSandbox: false,
  platformDomainStatus: "pending",
  onShared: 9,
  withOwnDomain: 3,
  problem:
    "mail.fieldquo.com is on the Resend account but its DNS is still \"pending\" — the DKIM and Return-Path records have not propagated. Every send on the shared domain is being accepted by Resend and dropped before delivery; the three companies sending from their own verified domain are unaffected.",
};

const AI_HEALTH = {
  healthy: false,
  configured: true,
  model: "gpt-4.1-mini-2025-04-14",
  listed: false,
  probe: { ok: false, status: 404, error: "The model `gpt-4.1-mini-2025-04-14` does not exist or you do not have access to it." },
  writing: null,
  usable: ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini"],
  pricingKnown: true,
  recommended: "gpt-4.1-mini",
  problem:
    "\"gpt-4.1-mini-2025-04-14\" isn't available on this key — most likely retired. Quote review, the copilot, digests and website generation are all returning nothing, silently, and every one of them is degrading to its non-AI fallback.",
};

const VOICE_HEALTH = {
  healthy: false,
  configured: true,
  concurrency: { current: 20, limit: 20, base: 20, purchased: 0, burstEnabled: false, burstLimit: null, basis: "read" },
  concurrencyError: null,
  spend: { days: 30, minutes: 6184, cents: 43288, centsPerDay: 1442.9 },
  credit: { basis: "declared", purchasedCents: 50000, remainingCents: 6712, runwayDays: 4.65, costCentsPerMinute: 7 },
  margin: {
    days: 30,
    covered: 1188,
    total: 1301,
    billedCents: 118800,
    providerCostCents: 47190,
    spreadCents: 71610,
    marginRatio: 0.6028,
    costCentsPerRealMinute: 7.6,
    worst: [],
  },
  alerts: [
    { level: "critical", code: "concurrency_full", message: "Every one of the 20 concurrent lines Retell allows is in use right now — the next caller to any tenant's number hears a busy tone." },
    { level: "warn", code: "credit_low", message: "About 4.7 days of declared credit left at the last 30 days' rate (~$14.43/day). Retell exposes no balance endpoint; this is derived from RETELL_PURCHASED_CENTS and our own call records." },
    { level: "warn", code: "meter_rescued", message: "7 call(s) in the last 7 days were billed by the hourly reconciler because Retell's webhook never delivered them. The money was collected, but call events are not reaching /api/voice/webhook — check the agents' webhook_url and the signing key." },
    { level: "warn", code: "companies_overdrawn", message: "4 companies are carrying a negative voice balance — minutes served that FieldQuo paid for and nobody has covered. Their agents are detached until they top up." },
  ],
  meter: {
    rescues7d: 7,
    unknownDuration7d: 0,
    overdrawnEvents7d: 11,
    companiesOverdrawn: 4,
    overdrawnCents: -8630,
    lastCallAt: ago(0, 1),
    lastRejection: { reason: "bad_signature", at: ago(2, 4) },
  },
};

// ── /platform/companies ─────────────────────────────────────────────────────
function companyListRow(c) {
  return {
    ...companyRecord(c),
    subscription: c.sub ? { ...subscriptionRow(c, { withPlan: false }), plan: { name: PLAN_BY_ID[c.sub.plan].name } } : null,
    _count: { members: c.members, quotes: c.profile.quotes },
  };
}

/** The Company row itself — the full record the detail page prints. */
function companyRecord(c) {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    email: c.email,
    phone: c.phone,
    address: c.id === COMPANY_ID ? "1187 Mountain Road, Unit 4" : `${140 + c.members * 3} Main Street`,
    city: c.city,
    province: c.province,
    postalCode: c.country === "CA" ? "E1C 2T5" : "80401",
    country: c.country,
    website: c.sub ? `https://www.${c.slug}.${c.country === "CA" ? "ca" : "com"}` : null,
    logoUrl: c.sub ? `https://res.cloudinary.com/fieldquo/image/upload/v1725000000/companies/${c.slug}/logo.png` : null,
    logoPublicId: c.sub ? `companies/${c.slug}/logo` : null,
    brandColor: c.id === COMPANY_ID ? "#b3261e" : "#06356b",
    brandColors: null,
    defaultLanguage: c.defaultLanguage,
    sendLanguages: c.sendLanguages,
    emailDomain: c.id === COMPANY_ID ? "send.easyroofers.ca" : null,
    emailDomainId: c.id === COMPANY_ID ? "d_9f2a1c7e" : null,
    emailDomainStatus: c.id === COMPANY_ID ? "verified" : "not_started",
    emailFromLocal: "quotes",
    emailDomainRecords: null,
    emailDomainCheckedAt: c.id === COMPANY_ID ? ago(1, 6) : null,
    paymentTerms: "Net 15 — 40% deposit on acceptance, balance on completion",
    payCycle: null,
    taxRate: "15",
    taxIdName: "HST",
    taxIdNumber: c.country === "CA" ? "812345678 RT0001" : null,
    autoApplyLocalTax: true,
    paymentMethods: ["cash", "e_transfer", "cheque", "card"],
    defaultMaterialMarkupPercent: "18",
    bookingSlug: c.sub ? c.slug : null,
    industries: c.industries,
    onboardingStatus: c.onboardingStatus,
    onboardingCompletedAt: c.onboardingCompletedAt,
    trialEndsAt: c.trialEndsAt,
    shareAnonymizedPricing: false,
    discoverable: Boolean(c.sub),
    timezone: c.province === "NB" || c.province === "NS" ? "America/Halifax" : c.country === "CA" ? "America/Toronto" : "America/Denver",
    dateFormat: "YYYY-MM-DD",
    weekStartsOn: 1,
    referralCode: `FQ-${c.slug.slice(0, 6).toUpperCase()}-2026`,
    referredByCode: c.id === COMPANY_ID ? "FQ-TOITUR-2025" : null,
    stripeAccountId: c.sub && c.sub.stripe ? `acct_1Q${c.id.replace("cmp_", "").slice(0, 8)}Rn` : null,
    stripeChargesEnabled: Boolean(c.sub && c.sub.stripe && c.onboardingStatus === "active"),
    signupNudgeSentAt: null,
    isDemo: false,
    accountStatus: "active",
    createdAt: c.createdAt,
    updatedAt: ago(0, 5),
  };
}

const MEMBERS = [
  ["mem_1", "owner", "Dwayne Arsenault", "dwayne.arsenault@easyroofers-exterior-renovations-moncton.ca", "2026-02-11T14:03:11.000Z"],
  ["mem_2", "admin", "Marie-Josée Léger-Cormier", "mj.leger-cormier@easyroofers-exterior-renovations-moncton.ca", "2026-02-13T10:10:00.000Z"],
  ["mem_3", "supervisor", "Kevin O'Sullivan", "kevin@easyroofers-exterior-renovations-moncton.ca", "2026-02-20T15:02:00.000Z"],
  ["mem_4", "employee", "Rajwinder Singh Dhillon", "raj.dhillon@easyroofers-exterior-renovations-moncton.ca", "2026-03-04T12:44:00.000Z"],
  ["mem_5", "employee", "Tomás Herrera-Villanueva", "tomas.herrera.villanueva@gmail.com", "2026-05-19T13:20:00.000Z"],
  ["mem_6", "employee", null, "crew-tablet-2@easyroofers-exterior-renovations-moncton.ca", "2026-07-02T09:00:00.000Z"],
];

function companyDetail(id) {
  const c = COMPANY_BY_ID[id];
  if (!c) return json({ error: "Not found" }, 404);
  const isMain = id === COMPANY_ID;
  return {
    ...companyRecord(c),
    subscription: subscriptionRow(c),
    members: (isMain ? MEMBERS : MEMBERS.slice(0, Math.min(c.members, 2))).map(([mid, role, name, email, createdAt]) => ({
      id: `${mid}_${c.id}`,
      userId: `usr_${mid}`,
      companyId: c.id,
      role,
      active: true,
      createdAt,
      user: { name, email },
    })),
    voiceNumbers: isMain
      ? [
          { id: "vn_1", e164: "+15068557890", source: "purchased", numberType: "local", status: "active", createdAt: "2026-04-14T15:00:00.000Z" },
          { id: "vn_2", e164: "+18339015555", source: "purchased", numberType: "toll_free", status: "failed", createdAt: "2026-08-30T18:22:00.000Z" },
          { id: "vn_3", e164: "+15068551234", source: "forwarded", numberType: "local", status: "porting", createdAt: "2026-09-02T14:00:00.000Z" },
        ]
      : [],
    _count: { quotes: c.profile.quotes, invoices: WORLD.invoices.filter((i) => i.companyId === c.id).length, jobs: WORLD.jobs.filter((j) => j.companyId === c.id).length, clients: c.clients },
    voiceDiagnosis: isMain
      ? { verdict: "unbound", side: "fieldquo", repairable: true, billing: true, boundAgent: null, wantAgent: "agent_7c1d", statusStale: false, source: "purchased", publicNumber: "+1 833 901 5555", existsAtProvider: true, agentEnabled: true, hasCredit: true, balanceCents: 2210 }
      : null,
  };
}

const UA_CHROME_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";
const UA_ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const UA_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15";

const DEVICES = [
  { id: "dev_1", userId: "usr_mem_1", who: "Dwayne Arsenault", userAgent: UA_IPHONE, network: "142.167", firstSeenAt: "2026-02-11T14:05:00.000Z", lastSeenAt: ago(0, 2) },
  { id: "dev_2", userId: "usr_mem_1", who: "Dwayne Arsenault", userAgent: UA_CHROME_WIN, network: "142.167", firstSeenAt: "2026-02-11T14:03:11.000Z", lastSeenAt: ago(0, 9) },
  { id: "dev_3", userId: "usr_mem_2", who: "Marie-Josée Léger-Cormier", userAgent: UA_MAC, network: "142.167", firstSeenAt: "2026-02-13T10:12:00.000Z", lastSeenAt: ago(1, 1) },
  { id: "dev_4", userId: "usr_mem_3", who: "Kevin O'Sullivan", userAgent: UA_ANDROID, network: "174.89", firstSeenAt: "2026-02-20T15:05:00.000Z", lastSeenAt: ago(0, 6) },
  { id: "dev_5", userId: "usr_mem_4", who: "Rajwinder Singh Dhillon", userAgent: UA_ANDROID, network: "99.240", firstSeenAt: "2026-03-04T12:50:00.000Z", lastSeenAt: ago(2, 3) },
  { id: "dev_6", userId: "usr_mem_1", who: "Dwayne Arsenault", userAgent: UA_ANDROID, network: "45.44", firstSeenAt: ago(5, 2), lastSeenAt: ago(4, 20) },
  { id: "dev_7", userId: "usr_mem_1", who: "Dwayne Arsenault", userAgent: UA_CHROME_WIN, network: "104.28", firstSeenAt: ago(3, 1), lastSeenAt: ago(3, 0) },
  { id: "dev_8", userId: "usr_mem_6", who: null, userAgent: UA_ANDROID, network: "142.167", firstSeenAt: "2026-07-02T09:05:00.000Z", lastSeenAt: ago(0, 4) },
];

const ACTIVITY = [
  ["act_1", "quote.sent", "quote", "Sent quote Q-2026-0132 to Hélène Bourque-Thériault (roofing, $14,880.00)", "Dwayne Arsenault", "owner", false, ago(0, 2)],
  ["act_2", "payment.recorded", "payment", "Recorded e-transfer of $6,200.00 against INV-2026-0071", "Marie-Josée Léger-Cormier", "admin", false, ago(0, 5)],
  ["act_3", "quote.accepted", "quote", "Client accepted quote Q-2026-0129 ($9,340.00)", null, null, false, ago(0, 7)],
  ["act_4", "invoice.sent", "invoice", "Sent invoice INV-2026-0071 to Pierre-Luc Gaudet-LeBlanc", "Marie-Josée Léger-Cormier", "admin", false, ago(1, 3)],
  ["act_5", "settings.branding.updated", "settings", "Changed brand colour from #06356b to #b3261e", "Dwayne Arsenault", "owner", false, ago(1, 8)],
  ["act_6", "client.created", "client", "Added client Golden Years Retirement Residences of Riverview Inc.", "Kevin O'Sullivan", "supervisor", false, ago(2, 1)],
  ["act_7", "job.completed", "job", "Marked job Steeple re-shingle, 44 Botsford St complete", "Rajwinder Singh Dhillon", "employee", false, ago(2, 6)],
  ["act_8", "quote.sent", "quote", "Sent quote Q-2026-0130 to Golden Years Retirement Residences of Riverview Inc. (siding + gutters, $31,270.00)", "Kevin O'Sullivan", "supervisor", false, ago(2, 9)],
  ["act_9", "settings.voice.number_requested", "settings", "Requested toll-free number +1 833 901 5555", "Dwayne Arsenault", "owner", false, ago(3, 2)],
  ["act_10", "client.deleted", "client", "Deleted client Test Testerson", "Marie-Josée Léger-Cormier", "admin", false, ago(4, 4)],
  ["act_11", "settings.company.viewed", "settings", "Opened Settings → Company", "Emilio Boves (FieldQuo support)", "support", true, ago(6, 2)],
  ["act_12", "payment.recorded", "payment", "Recorded card payment of $2,970.00 against INV-2026-0068 (Stripe)", null, null, false, ago(7, 1)],
  ["act_13", "quote.declined", "quote", "Client declined quote Q-2026-0124 — \"Went with a cheaper quote\"", null, null, false, ago(8, 5)],
  ["act_14", "member.invited", "settings", "Invited crew-tablet-2@easyroofers-exterior-renovations-moncton.ca as employee", "Dwayne Arsenault", "owner", false, ago(9, 3)],
];

function companyHealth(id) {
  const c = COMPANY_BY_ID[id];
  if (!c) return json({ error: "Not found" }, 404);
  const isMain = id === COMPANY_ID;
  const ageDays = Math.floor((NOW - new Date(c.createdAt).getTime()) / DAY);
  const signals = isMain
    ? [
        { ok: true, label: "23 quotes sent in 30 days" },
        { ok: true, label: "14 invoices created in 30 days" },
        { ok: true, label: "11 payments recorded" },
        { ok: true, label: "Active in the last 2 days" },
        { ok: true, label: "Can take card payments" },
        { ok: true, label: "Branding set up" },
        { ok: false, label: "No opening hours set" },
        { ok: true, label: "6 active team members" },
      ]
    : [
        { ok: false, label: "No quotes sent in 30 days" },
        { ok: false, label: "No invoices in 30 days" },
        { ok: false, label: "No payments recorded in 30 days" },
        { ok: false, label: "Last active 41 days ago" },
        { ok: false, label: "Stripe not connected — can't take cards" },
        { ok: false, label: "No logo uploaded" },
        { ok: false, label: "No opening hours set" },
        { ok: false, label: "Single-user account" },
      ];
  return {
    score: isMain ? 86 : 12,
    band: isMain ? "healthy" : "dormant",
    brandNew: false,
    ageDays,
    signals,
    standing: {
      status: isMain ? "under_review" : "active",
      reviewedAt: isMain ? ago(3, 0) : null,
      reason: isMain
        ? "One login (dwayne.arsenault@…) seen on 4 devices across 3 networks inside 7 days — consistent with a shared owner password rather than a bought seat. Confirm with the customer before anything else."
        : null,
      strikes30: isMain ? 2 : 0,
      strikes: isMain
        ? [
            { id: "strike_1", kind: "distinct_devices", detail: { distinctDevices: 4, windowDays: 7, limit: 3 }, createdAt: ago(3, 0), userId: "usr_mem_1" },
            { id: "strike_2", kind: "concurrent_networks", detail: { networks: 3, windowMinutes: 30, limit: 2, prefixes: ["142.167", "45.44", "104.28"] }, createdAt: ago(3, 1), userId: "usr_mem_1" },
          ]
        : [],
      devices: isMain ? DEVICES : [],
    },
    metrics: {
      quotes30: isMain ? 27 : 0,
      quotesSent30: isMain ? 23 : 0,
      invoices30: isMain ? 14 : 0,
      payments30: isMain ? 11 : 0,
      activeMembers: c.members,
      jobsOpen: isMain ? 9 : 0,
      lastSeenDays: isMain ? 0 : 41,
      lastActivity: isMain ? { createdAt: ACTIVITY[0][7], summary: ACTIVITY[0][3], actorName: ACTIVITY[0][4] } : null,
      aiCalls30: isMain ? 212 : 0,
      aiCostUsd30: isMain ? 3.8741 : 0,
      subscriptionStatus: c.sub ? c.sub.status : null,
      onboardingStatus: c.onboardingStatus,
      trialEndsAt: c.trialEndsAt,
    },
  };
}

const CLIENT_NAMES = [
  "Hélène Bourque-Thériault",
  "Golden Years Retirement Residences of Riverview Inc.",
  "Pierre-Luc Gaudet-LeBlanc",
  "Moncton Wesleyan Celebration Centre",
  "Sandra & Michael Okonkwo-Fitzgerald",
  "Dieppe Condominium Corporation No. 38 (Les Jardins du Ruisseau)",
  "Jean-Guy Melanson",
  "Riverview Heights Property Management Ltd.",
  "Abigail Cormier",
  "Shediac Bay Marina & Yacht Club",
  "Northrup Family Trust c/o Stewart McKelvey LLP",
  "Tanvir & Priya Bhattacharya",
  "St. Bernard's Parish Hall Committee",
  "Kaitlyn Doucet-Richard",
  "Brookside Rentals (Unit 12–18, Elmwood Drive)",
];

function companyHistory(id) {
  const c = COMPANY_BY_ID[id];
  if (!c) return json({ error: "Not found" }, 404);
  const sub = subscriptionRow(c);
  const r = rng(c.profile.seed + 500);
  const invoices = Array.from({ length: 18 }, (_, i) => {
    const n = 71 - i;
    const total = Math.round(1800 + r() * 21000);
    const status = i === 0 ? "sent" : i === 2 ? "overdue" : i === 5 ? "partially_paid" : r() < 0.85 ? "paid" : "sent";
    return {
      id: `inv_h_${n}`,
      invoiceNumber: `INV-2026-${String(n).padStart(4, "0")}`,
      status,
      total,
      dueDate: ago(i * 6 - 12),
      createdAt: ago(i * 6 + 1, 3),
      client: { name: CLIENT_NAMES[i % CLIENT_NAMES.length] },
      clientName: CLIENT_NAMES[i % CLIENT_NAMES.length],
    };
  });
  const payments = Array.from({ length: 16 }, (_, i) => ({
    id: `pay_h_${i + 1}`,
    amount: Math.round(900 + r() * 9000),
    method: ["e_transfer", "card", "cheque", "cash", "bank_transfer"][i % 5],
    date: ago(i * 5, 4),
    invoiceNumber: `INV-2026-${String(70 - i).padStart(4, "0")}`,
    clientName: CLIENT_NAMES[(i + 3) % CLIENT_NAMES.length],
  }));
  return {
    billing: {
      subscription: sub
        ? {
            status: sub.status,
            planName: sub.plan.name,
            priceMonthly: sub.plan.priceMonthly,
            currentPeriodEnd: sub.currentPeriodEnd,
            trialEndsAt: sub.trialEndsAt,
            stripeCustomerId: sub.stripeCustomerId,
            stripeSubscriptionId: sub.stripeSubscriptionId,
            since: sub.createdAt,
          }
        : null,
      changes: [
        { id: "aud_1", action: "subscription_changed", at: "2026-06-01T14:10:00.000Z", by: "emilio@fieldquo.com", details: { from: "Solo", to: "Pro", reason: "Added two estimators; owner asked on the phone" } },
        { id: "aud_2", action: "company_updated", at: "2026-04-22T18:40:00.000Z", by: "support@fieldquo.com", details: { name: "Easy Roofers & Exterior Renovations of Greater Moncton Ltd.", previousName: "Easy Roofers Inc." } },
        { id: "aud_3", action: "plan_updated", at: "2026-03-11T14:05:40.000Z", by: "system", details: { planId: "plan_pro_cad", stripeSubscriptionId: sub?.stripeSubscriptionId || null } },
      ],
    },
    activity: {
      invoicedTotal: 418_902.5,
      invoiceCount: 71,
      collectedTotal: 361_440.0,
      invoices,
      payments,
    },
  };
}

function companyActivity(id) {
  if (!COMPANY_BY_ID[id]) return json({ error: "Not found" }, 404);
  if (id !== COMPANY_ID) return { entries: [] };
  return {
    entries: ACTIVITY.map(([aid, action, entityType, summary, actorName, actorRole, viaImpersonation, createdAt]) => ({
      id: aid,
      action,
      entityType,
      entityId: `${entityType}_${aid}`,
      summary,
      actorName,
      actorRole,
      viaImpersonation,
      createdAt,
    })),
  };
}

function disputeEvidence(id) {
  const c = COMPANY_BY_ID[id];
  if (!c) return json({ error: "Not found" }, 404);
  const sub = subscriptionRow(c);
  const r = rng(c.profile.seed + 900);
  const quotesSent = WORLD.quotes
    .filter((q) => q.companyId === id && q.sentAt)
    .slice(-25)
    .map((q, i) => ({ sentAt: q.sentAt, quoteNumber: `Q-2026-${String(108 + i).padStart(4, "0")}`, sentToEmail: `${CLIENT_NAMES[i % CLIENT_NAMES.length].split(" ")[0].toLowerCase().replace(/[^a-z]/g, "")}@example.com` }));
  const invoicesSent = WORLD.invoices
    .filter((i) => i.companyId === id)
    .slice(-25)
    .map((inv, i) => ({ sentAt: inv.sentAt, invoiceNumber: `INV-2026-${String(47 + i).padStart(4, "0")}`, sentToEmail: `billing+${i}@example.com` }));
  const jobs = WORLD.jobs
    .filter((j) => j.companyId === id)
    .slice(-25)
    .map((j, i) => ({ createdAt: ago(60 - i * 2), title: ["Steeple re-shingle, 44 Botsford St", "Full tear-off and re-roof, 12 Killam Dr", "Gutter guard install, 210 Salisbury Rd", "Vinyl siding, north and west elevations", "Ice-dam repair and flashing", "Chimney cricket and step flashing"][i % 6], completedAt: j.completedAt }));
  const payments = WORLD.invoices
    .filter((i) => i.companyId === id && i.paidDate)
    .slice(-25)
    .map((i) => ({ date: i.paidDate, amount: i.total, method: r() < 0.5 ? "e_transfer" : "card" }));
  const assembled = assembleDisputeEvidence({
    company: { id: c.id, name: c.name, email: c.email, phone: c.phone, address: "1187 Mountain Road, Unit 4", city: c.city, province: c.province, country: c.country, createdAt: c.createdAt },
    subscription: sub ? { status: sub.status, billingInterval: "month", createdAt: sub.createdAt, currentPeriodEnd: sub.currentPeriodEnd, canceledAt: null, planName: sub.plan.name } : null,
    owner: { name: MEMBERS[0][2], email: MEMBERS[0][3] },
    quotesSent,
    invoicesSent,
    jobs,
    payments,
    devices: DEVICES.map((d) => ({ firstSeenAt: d.firstSeenAt, lastSeenAt: d.lastSeenAt, network: d.network, userAgent: d.userAgent, who: d.who })),
    activity: ACTIVITY.map(([, action, , summary, actorName, , , createdAt]) => ({ createdAt, action, summary, actorName })),
    totals: { quotesSent: 121, invoicesSent: 66, jobsCreated: 64, paymentsCollected: 58, devicesSeen: 8, activityEvents: 2_417 },
    servicePeriod: { start: new Date(NOW - 36 * DAY), end: new Date(NOW - 6 * DAY) },
  });
  return {
    ...assembled,
    standing: sub
      ? { refundedAt: ago(4, 2), refundedAmountCents: 12900, currency: sub.plan.currency, disputeStatus: "needs_response", disputedAt: ago(4, 3) }
      : null,
  };
}

// ── /platform/signups ───────────────────────────────────────────────────────
function signups() {
  const rows = COMPANIES.filter((c) => !c.sub);
  const extra = [
    { id: "cmp_lakeshore", name: "Lakeshore Basement Waterproofing & Foundation Repair Specialists", email: "info@lakeshorebasementwaterproofing.ca", phone: "+19055550117", city: "Oakville", province: "ON", country: "CA", industries: ["waterproofing", "foundations"], defaultLanguage: "en", createdAt: ago(0, 7), trialEndsAt: ahead(30), ownerName: "Anthony Papadopoulos-Whitmore", quotes: 0, clients: 0, nudgeSentAt: null, nudgeState: "too_early" },
    { id: "cmp_desert", name: "Desert Rose Landscaping", email: "desertroselandscaping.az@gmail.com", phone: null, city: "Mesa", province: "AZ", country: "US", industries: ["landscaping", "irrigation"], defaultLanguage: "es", createdAt: ago(38), trialEndsAt: ago(8), ownerName: "Guadalupe Ramírez de la Cruz", quotes: 3, clients: 4, nudgeSentAt: ago(36, 20), nudgeState: "already_nudged" },
    { id: "cmp_fraser", name: "Fraser Valley Drywall & Taping", email: null, phone: "+16045550133", city: "Abbotsford", province: "BC", country: "CA", industries: ["drywall"], defaultLanguage: "en", createdAt: ago(6, 3), trialEndsAt: ahead(24), ownerName: null, quotes: 0, clients: 0, nudgeSentAt: null, nudgeState: "no_recipient" },
    { id: "cmp_sunset2", name: "Sunset Pressure Washing — Langley", email: "sunsetpressurewashing@gmail.com", phone: null, city: "Langley", province: "BC", country: "CA", industries: ["pressure_washing"], defaultLanguage: "en", createdAt: ago(23, 4), trialEndsAt: ahead(9), ownerName: "Devon Sunset", quotes: 0, clients: 0, nudgeSentAt: null, nudgeState: "address_already_nudged" },
    { id: "cmp_console", name: "Acme Test Co (created from console)", email: "qa+acme@fieldquo.com", phone: null, city: null, province: null, country: null, industries: [], defaultLanguage: "en", createdAt: "2026-08-02T16:00:00.000Z", trialEndsAt: "2026-09-01T16:00:00.000Z", ownerName: null, quotes: 0, clients: 0, nudgeSentAt: null, nudgeState: "no_owner" },
  ];
  const nudgeFor = { cmp_okanagan: ["due", null], cmp_maritime: ["already_nudged", ago(10, 2)], cmp_sunset: ["suppressed", null] };
  const shaped = [
    ...rows.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      ownerName: c.id === "cmp_okanagan" ? "Brad Neufeld" : c.id === "cmp_maritime" ? "Catherine MacIsaac-Boudreau" : "Devon Sunset",
      ownerEmail: c.email,
      where: [c.city, c.province, c.country].filter(Boolean).join(", "),
      industries: c.industries,
      language: c.defaultLanguage,
      createdAt: c.createdAt,
      trialEndsAt: c.trialEndsAt,
      members: c.members,
      quotes: c.profile.quotes,
      clients: c.clients,
      nudgeSentAt: nudgeFor[c.id][1],
      doNotContact: c.id === "cmp_sunset",
      doNotContactReason: c.id === "cmp_sunset" ? "Unsubscribed from the recovery email on 2026-08-29 (\"stop emailing me\")." : null,
      nudgeState: nudgeFor[c.id][0],
    })),
    ...extra.map((e) => ({
      id: e.id,
      name: e.name,
      email: e.email,
      phone: e.phone,
      ownerName: e.ownerName,
      ownerEmail: e.email,
      where: [e.city, e.province, e.country].filter(Boolean).join(", "),
      industries: e.industries,
      language: e.defaultLanguage,
      createdAt: e.createdAt,
      trialEndsAt: e.trialEndsAt,
      members: e.ownerName ? 1 : 0,
      quotes: e.quotes,
      clients: e.clients,
      nudgeSentAt: e.nudgeSentAt,
      doNotContact: false,
      doNotContactReason: null,
      nudgeState: e.nudgeState,
    })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { signups: shaped, policy: { delayHours: 24, windowDays: 30 } };
}

// ── /platform/signup-origins ────────────────────────────────────────────────
const ORIGIN_ROWS = [
  { id: "so_1", companyId: "cmp_lakeshore", companyName: "Lakeshore Basement Waterproofing & Foundation Repair Specialists", companyCountry: "CA", ip: "99.244.118.207", ipCountry: "CA", ipRegion: "ON", ipCity: "Oakville", statedCountry: "CA", userAgent: UA_CHROME_WIN, acceptLanguage: "en-CA,en;q=0.9,fr;q=0.8", via: "direct", rep: null, referralCode: null, flag: "none", flagReason: null, reviewedAt: null, reviewedBy: null, reviewNote: null, createdAt: ago(0, 7) },
  { id: "so_2", companyId: "cmp_okanagan", companyName: "Okanagan Valley Deck & Fence Co.", companyCountry: "CA", ip: "24.69.201.44", ipCountry: "CA", ipRegion: "BC", ipCity: "Kelowna", statedCountry: "CA", userAgent: UA_IPHONE, acceptLanguage: "en-US,en;q=0.9", via: "sales_link", rep: { id: "rep_ana", name: "Ana Lucía Restrepo Cárdenas", code: "ANA-BC" }, referralCode: null, flag: "none", flagReason: null, reviewedAt: null, reviewedBy: null, reviewNote: null, createdAt: ago(3, 5) },
  { id: "so_3", companyId: "cmp_fraser", companyName: "Fraser Valley Drywall & Taping", companyCountry: "CA", ip: "185.220.101.47", ipCountry: "DE", ipRegion: "HE", ipCity: "Frankfurt am Main", statedCountry: "CA", userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0", acceptLanguage: "en-US,en;q=0.5", via: "direct", rep: null, referralCode: null, flag: "outside_ca_us", flagReason: "Edge placed the request in DE; the company said CA. Also: the address is in a known hosting range (vpn_or_hosting).", reviewedAt: null, reviewedBy: null, reviewNote: null, createdAt: ago(6, 3) },
  { id: "so_4", companyId: "cmp_maritime", companyName: "Maritime Electrical Services Group Incorporated — Halifax, Dartmouth & Bedford", companyCountry: "CA", ip: "142.177.62.10", ipCountry: "CA", ipRegion: "NS", ipCity: "Dartmouth", statedCountry: "US", userAgent: UA_MAC, acceptLanguage: "en-CA,en;q=0.9", via: "referral", rep: null, referralCode: "FQ-EASYRO-2026", flag: "country_mismatch", flagReason: "Edge placed the request in CA; the company stated US at signup.", reviewedAt: ago(9, 6), reviewedBy: "emilio@fieldquo.com", reviewNote: "Picked the wrong country in the dropdown — they are in Dartmouth NS, confirmed by phone.", createdAt: ago(11, 2) },
  { id: "so_5", companyId: "cmp_verdant", companyName: "Verdant Landscapes — Aménagement paysager Verdant", companyCountry: "CA", ip: "70.81.150.9", ipCountry: "CA", ipRegion: "QC", ipCity: "Gatineau", statedCountry: "CA", userAgent: UA_ANDROID, acceptLanguage: "fr-CA,fr;q=0.9,en-CA;q=0.8,en;q=0.7", via: "sales_link", rep: null, referralCode: "JB-QC-OLD", flag: "none", flagReason: null, reviewedAt: null, reviewedBy: null, reviewNote: null, createdAt: ago(18) },
  { id: "so_6", companyId: "cmp_sunset", companyName: "Sunset Pressure Washing", companyCountry: "CA", ip: "50.64.33.201", ipCountry: "CA", ipRegion: "BC", ipCity: "Surrey", statedCountry: "CA", userAgent: UA_ANDROID, acceptLanguage: "en-US,en;q=0.9", via: "direct", rep: null, referralCode: null, flag: "repeat_ip", flagReason: "Second signup from 50.64.33.201 in 30 days (first: Sunset Pressure Washing — Langley, 1 day earlier).", reviewedAt: null, reviewedBy: null, reviewNote: null, createdAt: ago(22, 7) },
  { id: "so_7", companyId: "cmp_sunset2", companyName: "Sunset Pressure Washing — Langley", companyCountry: "CA", ip: "50.64.33.201", ipCountry: "CA", ipRegion: "BC", ipCity: "Surrey", statedCountry: "CA", userAgent: UA_ANDROID, acceptLanguage: "en-US,en;q=0.9", via: "direct", rep: null, referralCode: null, flag: "none", flagReason: null, reviewedAt: null, reviewedBy: null, reviewNote: null, createdAt: ago(23, 4) },
  { id: "so_8", companyId: "cmp_northline", companyName: "Northline Painting & Decorating", companyCountry: "US", ip: "2601:602:9a00:1f3b:a1c4:88ff:fe32:9d1e", ipCountry: "US", ipRegion: "WA", ipCity: "Tacoma", statedCountry: "US", userAgent: UA_CHROME_WIN, acceptLanguage: "en-US,en;q=0.9", via: "sales_link", rep: { id: "rep_marcus", name: "Marcus Thibodeaux-Washington", code: "MTW-PNW" }, referralCode: null, flag: "none", flagReason: null, reviewedAt: null, reviewedBy: null, reviewNote: null, createdAt: ago(27) },
  { id: "so_9", companyId: "cmp_desert", companyName: "Desert Rose Landscaping", companyCountry: "US", ip: "187.190.44.128", ipCountry: "MX", ipRegion: "SON", ipCity: "Hermosillo", statedCountry: "US", userAgent: UA_IPHONE, acceptLanguage: "es-MX,es;q=0.9,en;q=0.8", via: "other", rep: null, referralCode: "INFLU-ROSA-3M", flag: "outside_ca_us", flagReason: "Edge placed the request in MX; the company said US.", reviewedAt: null, reviewedBy: null, reviewNote: null, createdAt: ago(38) },
  { id: "so_10", companyId: "cmp_bluebird", companyName: "Bluebird Home Painters", companyCountry: "US", ip: "104.28.210.77", ipCountry: "US", ipRegion: "TX", ipCity: "Austin", statedCountry: "US", userAgent: UA_MAC, acceptLanguage: "en-US,en;q=0.9,es;q=0.8", via: "referral", rep: null, referralCode: "FQ-GRANIT-2026", flag: "vpn_or_hosting", flagReason: "104.28.0.0/16 is a Cloudflare WARP egress range — the real location is unknown.", reviewedAt: null, reviewedBy: null, reviewNote: null, createdAt: ago(33) },
  { id: "so_11", companyId: "cmp_console", companyName: "Acme Test Co (created from console)", companyCountry: null, ip: null, ipCountry: null, ipRegion: null, ipCity: null, statedCountry: null, userAgent: null, acceptLanguage: null, via: "other", rep: null, referralCode: null, flag: "none", flagReason: null, reviewedAt: null, reviewedBy: null, reviewNote: null, createdAt: "2026-08-02T16:00:00.000Z", isDemo: true },
];
const originsState = ORIGIN_ROWS.map((o) => ({
  ...o,
  isDemo: Boolean(o.isDemo),
  viaLabel: SIGNUP_VIA_LABELS[o.via] || o.via,
  flagLabel: SIGNUP_FLAG_LABELS[o.flag] || o.flag,
  needsReview: o.flag !== "none" && !o.reviewedAt,
}));

function signupOrigins(flaggedOnly) {
  const rows = flaggedOnly ? originsState.filter((o) => o.needsReview) : originsState;
  return {
    origins: rows,
    flaggedCount: originsState.filter((o) => o.needsReview).length,
    total: originsState.length,
    truncated: false,
    canReview: true,
  };
}

function reviewOrigin(id, note) {
  const row = originsState.find((o) => o.id === id);
  if (!row) return json({ error: "Not found" }, 404);
  if (row.flag === "none") return json({ error: "This signup is not flagged — nothing to review." }, 409);
  if (row.reviewedAt) return json({ error: "This signup was already reviewed." }, 409);
  row.reviewedAt = new Date().toISOString();
  row.reviewedBy = "emilio@fieldquo.com";
  row.reviewNote = typeof note === "string" && note.trim() ? note.trim().slice(0, 1000) : null;
  row.needsReview = false;
  return { ok: true, origin: { ...row } };
}

// ── /platform/billing/subscriptions ─────────────────────────────────────────
function subscriptions(status) {
  const rows = COMPANIES.filter((c) => c.sub && (!status || c.sub.status === status))
    .sort((a, b) => new Date(b.sub.since) - new Date(a.sub.since))
    .map((c) => {
      const s = subscriptionRow(c);
      const trialEnds = s.trialEndsAt ? new Date(s.trialEndsAt).getTime() : null;
      return {
        id: s.id,
        status: s.status,
        planName: s.plan.name,
        priceMonthly: Number(s.plan.priceMonthly),
        companyId: c.id,
        companyName: c.name,
        companyEmail: c.email,
        onboardingStatus: c.onboardingStatus,
        currentPeriodEnd: s.currentPeriodEnd,
        trialEndsAt: s.trialEndsAt,
        trialDaysLeft: trialEnds === null ? null : Math.ceil((trialEnds - NOW) / DAY),
        since: s.createdAt,
        billable: Boolean(s.stripeSubscriptionId),
      };
    });
  return {
    rows,
    summary: {
      total: rows.length,
      active: rows.filter((r) => r.status === "active").length,
      trialing: rows.filter((r) => r.status === "trialing").length,
      mrr: rows.filter((r) => r.status === "active").reduce((n, r) => n + r.priceMonthly, 0),
      expiringSoon: rows.filter((r) => r.trialDaysLeft !== null && r.trialDaysLeft >= 0 && r.trialDaysLeft <= 7).length,
      unbillable: rows.filter((r) => r.status === "active" && !r.billable).length,
    },
  };
}

// ── /platform/reports — CSV, not JSON ───────────────────────────────────────
function reportCsv(report) {
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  let headers;
  let rows;
  if (report === "companies") {
    headers = ["Company", "Status", "Signed up", "Plan", "Members", "Clients", "Quotes", "Invoices"];
    rows = COMPANIES.map((c) => [c.name, c.onboardingStatus, c.createdAt.slice(0, 10), c.sub ? PLAN_BY_ID[c.sub.plan].name : "", c.members, c.clients, c.profile.quotes, WORLD.invoices.filter((i) => i.companyId === c.id).length]);
  } else if (report === "subscriptions") {
    headers = ["Company", "Plan", "Monthly", "Status", "Started", "Renews", "Stripe linked"];
    rows = COMPANIES.filter((c) => c.sub).map((c) => [c.name, PLAN_BY_ID[c.sub.plan].name, PLAN_BY_ID[c.sub.plan].priceMonthly, c.sub.status, c.sub.since.slice(0, 10), c.sub.currentPeriodEnd.slice(0, 10), c.sub.stripe ? "yes" : "no"]);
  } else if (report === "growth") {
    headers = ["Month", "New companies", "Cumulative", "Quotes", "Quoted value", "Payments", "Payment value"];
    rows = overview().monthly.companies.map((m, i, all) => [m.month, m.count, all.slice(0, i + 1).reduce((n, x) => n + x.count, 0), 0, 0, 0, 0]);
  } else {
    return json({ error: "Unknown report" }, 400);
  }
  const csv = [headers.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))].join("\n");
  return new Response(csv, {
    status: 200,
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="fieldquo-${report}-2026-09-13.csv"` },
  });
}

// ── /platform/migrations ────────────────────────────────────────────────────
const migration = (id, companyId, status, over) => ({
  id,
  companyId,
  status,
  sourceSystems: "Jobber (2019–2024) + a QuickBooks Online customer list + a shared Google Sheet of open quotes",
  description: null,
  requestedById: "usr_mem_1",
  hostAdminId: null,
  scheduledAt: null,
  consultationNotes: null,
  priceCents: null,
  currency: "CAD",
  quoteNote: null,
  quotedById: null,
  quotedAt: null,
  respondedAt: null,
  respondedById: null,
  declineReason: null,
  stripeCheckoutSessionId: null,
  stripePaymentIntentId: null,
  paidAt: null,
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
  cancelledById: null,
  cancelReason: null,
  createdAt: "2026-08-20T13:00:00.000Z",
  updatedAt: "2026-09-10T15:00:00.000Z",
  ...over,
});

const MIGRATIONS = [
  migration(MIGRATION_ID, COMPANY_ID, "in_progress", {
    description:
      "About 400 customers and ~1,100 historical quotes in Jobber, going back to 2019. We only need the customers and the quotes that are still open or were accepted in the last 18 months — the rest can stay in the export. The QuickBooks list has better phone numbers than Jobber does; please prefer it where the two disagree.\n\nThere is also a Google Sheet Marie-Josée keeps of quotes we sent by email before we had software; it has ~60 rows.",
    hostAdminId: "adm1",
    scheduledAt: "2026-08-25T17:30:00.000Z",
    consultationNotes: "Jobber export is clean CSV. QBO list has duplicate customers with trailing spaces — dedupe on phone. The Google Sheet has no dates on 14 rows; Marie-Josée will fill them in before we start. Quoted 2 days of work.",
    priceCents: 89000,
    currency: "CAD",
    quoteNote: "Covers importing the Jobber customer list (deduplicated against QuickBooks), every open quote and every accepted quote since March 2025, and the 60-row Google Sheet. Historical declined quotes are not included.",
    quotedById: "adm1",
    quotedAt: "2026-08-26T14:12:00.000Z",
    respondedAt: "2026-08-27T09:40:00.000Z",
    respondedById: "usr_mem_1",
    stripeCheckoutSessionId: "cs_live_a1B2c3D4e5F6g7H8i9J0kLmNoPqRsTuVwXyZ",
    stripePaymentIntentId: "pi_3Q1x2y3z4A5b6C7d8E9f0G1h",
    paidAt: "2026-08-27T09:52:11.000Z",
    startedAt: "2026-09-02T13:05:00.000Z",
    createdAt: "2026-08-20T13:00:00.000Z",
    updatedAt: ago(0, 3),
  }),
  migration("mig_2", "cmp_rivesud", "quoted", {
    sourceSystems: "Un vieux système Access (2008) + 3 classeurs Excel + des soumissions papier numérisées (PDF)",
    description: "Environ 2 400 clients et 9 000 soumissions depuis 2008. On veut tout, si possible, incluant l'historique de prix par pied carré.",
    requestedById: "usr_rivesud_owner",
    hostAdminId: "adm1",
    scheduledAt: "2026-09-04T19:00:00.000Z",
    priceCents: 420000,
    quoteNote: "Access export, Excel cleanup, and OCR of the scanned PDFs where the totals are legible. Priced at 9 days; the paper quotes with unreadable totals are listed, not priced.",
    quotedById: "adm1",
    quotedAt: "2026-09-05T15:30:00.000Z",
    createdAt: "2026-08-29T14:20:00.000Z",
  }),
  migration("mig_3", "cmp_granite", "paid", {
    sourceSystems: "Housecall Pro export (CSV)",
    priceCents: 45000, currency: "USD",
    quoteNote: "Customers and open estimates only.",
    quotedById: "adm1", quotedAt: "2026-09-01T16:00:00.000Z",
    respondedAt: "2026-09-02T12:00:00.000Z", respondedById: "usr_granite_owner",
    stripeCheckoutSessionId: "cs_live_9zY8xW7vU6tS5rQ4pO3nM2lK1jI0hG", stripePaymentIntentId: "pi_3Q9a8b7c6D5e4F3g2H1i0J9k",
    paidAt: "2026-09-02T12:03:40.000Z",
    createdAt: "2026-08-30T19:00:00.000Z",
  }),
  migration("mig_4", "cmp_summit", "scheduled", {
    sourceSystems: "Cabinet Vision job files + a Filemaker database nobody has the password to",
    hostAdminId: "adm1",
    scheduledAt: ahead(2),
    createdAt: ago(5),
  }),
  migration("mig_5", "cmp_prairie", "cancelled", {
    sourceSystems: "ServiceTitan",
    priceCents: 160000, quotedById: "adm1", quotedAt: "2026-01-20T16:00:00.000Z",
    respondedAt: "2026-01-22T14:00:00.000Z", respondedById: "usr_prairie_owner",
    paidAt: "2026-01-22T14:02:00.000Z",
    startedAt: "2026-01-27T15:00:00.000Z",
    cancelledAt: "2026-02-03T18:10:00.000Z", cancelledById: "usr_prairie_owner",
    cancelReason: "Company churned before the import finished; refunded in full.",
    createdAt: "2026-01-15T17:00:00.000Z",
  }),
  migration("mig_6", "cmp_tidewater", "completed", {
    sourceSystems: "Paper + a Square customer list",
    priceCents: 30000, currency: "USD", quotedById: "adm1", quotedAt: "2026-02-10T15:00:00.000Z",
    respondedAt: "2026-02-11T13:00:00.000Z", respondedById: "usr_tidewater_owner",
    paidAt: "2026-02-11T13:04:00.000Z", startedAt: "2026-02-14T14:00:00.000Z", completedAt: "2026-02-16T21:30:00.000Z",
    createdAt: "2026-02-06T16:00:00.000Z",
  }),
  migration("mig_7", "cmp_northline", "requested", {
    sourceSystems: null,
    description: "I have everything in my phone's notes app and a box of carbon-copy invoice books. Is that something you can do?",
    requestedById: "usr_northline_owner",
    createdAt: ago(1, 4),
  }),
  migration("mig_8", "cmp_bluebird", "declined", {
    sourceSystems: "Joist",
    priceCents: 25000, currency: "USD", quotedById: "adm1", quotedAt: ago(12),
    respondedAt: ago(10), respondedById: "usr_bluebird_owner",
    declineReason: "We'll just re-enter the 30 open ones ourselves.",
    createdAt: ago(14),
  }),
  migration("mig_9", "cmp_verdant", "accepted", {
    sourceSystems: "Excel + Google Contacts",
    priceCents: 35000, quotedById: "adm1", quotedAt: ago(4),
    respondedAt: ago(2), respondedById: "usr_verdant_owner",
    createdAt: ago(7),
  }),
];

const MIGRATION_WRITES = [
  { id: "mw_1", migrationRequestId: MIGRATION_ID, platformAdminId: "adm1", entityType: "Client", entityId: "cli_m_1", snapshot: { name: "Golden Years Retirement Residences of Riverview Inc.", email: "facilities@goldenyearsriverview.ca", phone: "+15068559900" }, createdAt: ago(0, 1) },
  { id: "mw_2", migrationRequestId: MIGRATION_ID, platformAdminId: "adm1", entityType: "Quote", entityId: "q_m_1", snapshot: { quoteNumber: "Q-2024-0871 (imported)", total: 31270, clientId: "cli_m_1" }, createdAt: ago(0, 1) },
  { id: "mw_3", migrationRequestId: MIGRATION_ID, platformAdminId: "adm1", entityType: "Client", entityId: "cli_m_2", snapshot: { name: "Dieppe Condominium Corporation No. 38 (Les Jardins du Ruisseau)", email: "syndic@lesjardinsduruisseau.ca", phone: "+15068550038" }, createdAt: ago(0, 2) },
  { id: "mw_4", migrationRequestId: MIGRATION_ID, platformAdminId: "adm1", entityType: "Client", entityId: "cli_m_3", snapshot: { name: "Shediac Bay Marina & Yacht Club", email: "harbourmaster@shediacbaymarina.ca", phone: "+15065320077" }, createdAt: ago(1, 2) },
  { id: "mw_5", migrationRequestId: MIGRATION_ID, platformAdminId: "adm1", entityType: "Quote", entityId: "q_m_2", snapshot: { quoteNumber: "Q-2025-0114 (imported)", total: 8640, clientId: "cli_m_3" }, createdAt: ago(1, 2) },
  { id: "mw_6", migrationRequestId: MIGRATION_ID, platformAdminId: "adm_support2", entityType: "Client", entityId: "cli_m_4", snapshot: { name: "Northrup Family Trust c/o Stewart McKelvey LLP", email: null, phone: "+15068551190" }, createdAt: ago(3, 5) },
];

const MIGRATION_DOCS = [
  { id: "md_1", migrationRequestId: MIGRATION_ID, url: "https://res.cloudinary.com/fieldquo/raw/upload/v1756300000/migrations/mig_1/jobber-clients-export-2026-08-21.csv", publicId: "migrations/mig_1/jobber-clients-export", filename: "jobber-clients-export-2026-08-21.csv", resourceType: "raw", bytes: 418337, uploadedById: "usr_mem_1", createdAt: "2026-08-21T15:10:00.000Z" },
  { id: "md_2", migrationRequestId: MIGRATION_ID, url: "https://res.cloudinary.com/fieldquo/raw/upload/v1756300100/migrations/mig_1/jobber-quotes-2019-2024.csv", publicId: "migrations/mig_1/jobber-quotes", filename: "jobber-quotes-2019-2024-FULL-EXPORT-with-line-items-and-notes.csv", resourceType: "raw", bytes: 9_120_442, uploadedById: "usr_mem_1", createdAt: "2026-08-21T15:14:00.000Z" },
  { id: "md_3", migrationRequestId: MIGRATION_ID, url: "https://res.cloudinary.com/fieldquo/raw/upload/v1756300200/migrations/mig_1/qbo-customers.xlsx", publicId: "migrations/mig_1/qbo-customers", filename: "Customer Contact List — QuickBooks Online (Easy Roofers) 2026-08-22.xlsx", resourceType: "raw", bytes: 77_902, uploadedById: "usr_mem_2", createdAt: "2026-08-22T12:01:00.000Z" },
  { id: "md_4", migrationRequestId: MIGRATION_ID, url: "https://res.cloudinary.com/fieldquo/raw/upload/v1756300300/migrations/mig_1/old-quotes-sheet.csv", publicId: "migrations/mig_1/old-quotes-sheet", filename: null, resourceType: "raw", bytes: 12_004, uploadedById: "usr_mem_2", createdAt: "2026-08-28T18:45:00.000Z" },
];

function migrationDetail(id) {
  const m = MIGRATIONS.find((x) => x.id === id);
  if (!m) return json({ error: "Not found" }, 404);
  const c = COMPANY_BY_ID[m.companyId];
  return {
    request: {
      ...m,
      documents: id === MIGRATION_ID ? MIGRATION_DOCS : [],
      writes: MIGRATION_WRITES.filter((w) => w.migrationRequestId === id),
    },
    company: c ? { id: c.id, name: c.name, slug: c.slug, email: c.email, phone: c.phone, currency: c.country === "CA" ? "CAD" : "USD" } : null,
    people: {
      users: {
        usr_mem_1: { id: "usr_mem_1", name: MEMBERS[0][2], email: MEMBERS[0][3] },
        usr_mem_2: { id: "usr_mem_2", name: MEMBERS[1][2], email: MEMBERS[1][3] },
      },
      admins: {
        adm1: { id: "adm1", email: "emilio@fieldquo.com" },
        adm_support2: { id: "adm_support2", email: "support@fieldquo.com" },
      },
    },
  };
}

function migrationClients(id) {
  const m = MIGRATIONS.find((x) => x.id === id);
  if (!m) return json({ error: "Not found" }, 404);
  return {
    clients: CLIENT_NAMES.map((name, i) => ({ id: `cli_${i + 1}`, name, email: i % 3 === 0 ? null : `${name.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "")}@example.com` })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// ── Plans, fees, promotions ─────────────────────────────────────────────────
const CONNECT_FEES = {
  month: new Date(NOW).toISOString().slice(0, 7),
  totals: {
    cad: { billedThisMonthCents: 4187, recoveredThisMonthCents: 2950, outstandingCents: 6612 },
    usd: { billedThisMonthCents: 2410, recoveredThisMonthCents: 2410, outstandingCents: 0 },
  },
};

const PROMOTIONS = [
  { id: "promo_1", label: "Fall 2026 — 3 months at 25% off Pro & Crew", notes: "Announced in the September newsletter and on the pricing page. Not stackable with a promo code.", active: true, startsAt: ago(9), endsAt: ahead(37), discountKind: "percent", discountValue: "25", durationMonths: 3, tierKeys: ["pro", "crew"], currencies: ["CAD", "USD"], createdByAdminId: "adm1", createdAt: ago(12), updatedAt: ago(9) },
  { id: "promo_2", label: "Québec launch — 20 $ de rabais le premier mois (Solo, CAD seulement)", notes: null, active: true, startsAt: null, endsAt: ahead(4), discountKind: "amount", discountValue: "20", durationMonths: 1, tierKeys: ["solo"], currencies: ["CAD"], createdByAdminId: "adm1", createdAt: ago(40), updatedAt: ago(40) },
  { id: "promo_3", label: "Home show — Halifax Fall Home Show booth offer", notes: "Only for the QR code on the booth banner. Turn on the morning of the show.", active: false, startsAt: ahead(18), endsAt: ahead(22), discountKind: "percent", discountValue: "40", durationMonths: 2, tierKeys: ["solo", "pro"], currencies: ["CAD"], createdByAdminId: "adm_support2", createdAt: ago(3), updatedAt: ago(3) },
  { id: "promo_4", label: "Summer 2026 — first month free on everything", notes: "Ran June through August.", active: true, startsAt: "2026-06-01T04:00:00.000Z", endsAt: "2026-09-01T03:59:59.000Z", discountKind: "percent", discountValue: "100", durationMonths: 1, tierKeys: null, currencies: null, createdByAdminId: "adm1", createdAt: "2026-05-28T15:00:00.000Z", updatedAt: "2026-05-28T15:00:00.000Z" },
  { id: "promo_5", label: "Spring 2026 — Crew at Pro price for 6 months", notes: "Switched off early: three companies downgraded the day it ended.", active: false, startsAt: "2026-03-01T05:00:00.000Z", endsAt: "2026-05-31T03:59:59.000Z", discountKind: "amount", discountValue: "120", durationMonths: 6, tierKeys: ["crew"], currencies: ["CAD", "USD"], createdByAdminId: "adm1", createdAt: "2026-02-20T15:00:00.000Z", updatedAt: "2026-05-14T15:00:00.000Z" },
  { id: "promo_6", label: "Referral partner — Maritime Roofing Contractors Association members (15% for a year)", notes: "MRCA sends a member list quarterly; the discount is applied at checkout by tier, not by code.", active: true, startsAt: ago(60), endsAt: ahead(305), discountKind: "percent", discountValue: "15", durationMonths: 12, tierKeys: ["solo", "pro", "crew"], currencies: ["CAD"], createdByAdminId: "adm1", createdAt: ago(62), updatedAt: ago(60) },
  { id: "promo_7", label: "Broken row — imported with no end date", notes: "Came from the old promotions sheet; nobody has set an end.", active: true, startsAt: "2026-01-01T05:00:00.000Z", endsAt: null, discountKind: "percent", discountValue: "10", durationMonths: 3, tierKeys: null, currencies: ["USD"], createdByAdminId: null, createdAt: "2026-01-01T05:00:00.000Z", updatedAt: "2026-01-01T05:00:00.000Z" },
];

// ── Feature flags ───────────────────────────────────────────────────────────
const FEATURE_GLOBALS = {
  voice_receptionist: { state: "preview", note: null, updatedAt: "2026-08-14T15:20:00.000Z" },
  whatsapp_messaging: { state: "locked", note: "WhatsApp Business verification is still pending with Meta — back in October.", updatedAt: "2026-09-01T14:00:00.000Z" },
  ai_employee: { state: "hidden", note: null, updatedAt: "2026-07-30T16:00:00.000Z" },
  marketing_designer: { state: "locked", note: "Rolling out trade by trade; ask support to switch it on for you.", updatedAt: "2026-08-22T13:10:00.000Z" },
};
const FEATURE_OVERRIDES = [
  { id: "fo_1", key: "voice_receptionist", companyId: COMPANY_ID, state: "on", note: "Design partner — first company on the receptionist.", updatedAt: "2026-04-14T15:00:00.000Z" },
  { id: "fo_2", key: "voice_receptionist", companyId: "cmp_rivesud", state: "on", note: null, updatedAt: "2026-06-03T14:00:00.000Z" },
  { id: "fo_3", key: "voice_receptionist", companyId: "cmp_prairie", state: "hidden", note: "Churned; number released.", updatedAt: ago(9) },
  { id: "fo_4", key: "whatsapp_messaging", companyId: "cmp_summit", state: "preview", note: "Testing the Spanish-language flow with their Denver crew.", updatedAt: ago(4) },
  { id: "fo_5", key: "ai_employee", companyId: COMPANY_ID, state: "preview", note: null, updatedAt: ago(2) },
  { id: "fo_6", key: "marketing_designer", companyId: "cmp_granite", state: "on", note: null, updatedAt: ago(15) },
  { id: "fo_7", key: "marketing_designer", companyId: "cmp_rivesud", state: "enabled", note: "Written by the old console before the enum existed.", updatedAt: "2026-02-02T15:00:00.000Z" },
  { id: "fo_8", key: "team_chat", companyId: "cmp_tidewater", state: "locked", note: "Owner asked to hide it — crew were using it instead of the job notes.", updatedAt: ago(20) },
];

function features() {
  return {
    states: FEATURE_STATES,
    features: FEATURES.map((f) => {
      const globalRow = FEATURE_GLOBALS[f.key] || null;
      const resolvedGlobal = resolveFeature({ key: f.key, globalRow });
      return {
        key: f.key,
        label: f.label,
        blurb: f.blurb,
        defaultState: f.defaultState,
        adoptionField: f.adoptionField,
        spends: f.spends,
        gates: { nav: f.navKeys.length, pages: f.routePrefixes, apis: f.apiPrefixes, crons: f.cronPaths },
        global: { state: resolvedGlobal.state, source: resolvedGlobal.source, note: resolvedGlobal.note, updatedAt: globalRow?.updatedAt || null },
        overrides: FEATURE_OVERRIDES.filter((o) => o.key === f.key).map((o) => {
          const c = COMPANY_BY_ID[o.companyId];
          return {
            id: o.id,
            companyId: o.companyId,
            company: c ? { id: c.id, name: c.name, slug: c.slug } : null,
            state: normaliseState(o.state) || o.state,
            malformed: normaliseState(o.state) === null,
            note: o.note,
            updatedAt: o.updatedAt,
          };
        }),
      };
    }),
    companies: COMPANIES.map((c) => ({ id: c.id, name: c.name, slug: c.slug })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// ── Promo codes ─────────────────────────────────────────────────────────────
const PROMO_CODES = [
  { id: "pc_1", code: "ROSA-JARDINES-3M", label: "@rosa.jardines (Instagram, 41k) — landscaping, ES", notes: "Three free months for her followers; she posts a story a month through November.", kind: "influencer", rewardMonths: 3, maxRedemptions: 50, redeemedCount: 7, active: true, expiresAt: ahead(78), createdAt: ago(30), redemptions: [
    { companyName: "Desert Rose Landscaping", monthsGranted: 3, redeemedAt: ago(38) },
    { companyName: "Jardines del Valle Landscaping & Irrigation LLC", monthsGranted: 3, redeemedAt: ago(26) },
    { companyName: "Verde Vivo Paisajismo", monthsGranted: 3, redeemedAt: ago(19) },
    { companyName: "Sonoran Stone & Succulent Co.", monthsGranted: 3, redeemedAt: ago(14) },
    { companyName: "Los Hermanos Ochoa — Jardinería", monthsGranted: 3, redeemedAt: ago(11) },
    { companyName: "Mesa Verde Lawn Care", monthsGranted: 3, redeemedAt: ago(6) },
    { companyName: "Cactus Flower Landscape Design Studio of Scottsdale", monthsGranted: 3, redeemedAt: ago(1) },
  ] },
  { id: "pc_2", code: "ROOFTALK-PODCAST", label: "The Roof Talk Podcast (ep. 112 read)", notes: null, kind: "influencer", rewardMonths: 2, maxRedemptions: 100, redeemedCount: 23, active: true, expiresAt: ahead(140), createdAt: ago(55), redemptions: [
    { companyName: "Easy Roofers & Exterior Renovations of Greater Moncton Ltd.", monthsGranted: 2, redeemedAt: "2026-03-11T14:05:40.000Z" },
    { companyName: "Peak Performance Roofing", monthsGranted: 2, redeemedAt: ago(50) },
    { companyName: "Two Brothers Roofing & Sheet Metal", monthsGranted: 2, redeemedAt: ago(44) },
  ] },
  { id: "pc_3", code: "BETA-CREW-TESTER", label: "Crew-app beta testers (Rajwinder's list)", notes: "One month each while they test the crew inbox.", kind: "tester", rewardMonths: 1, maxRedemptions: 12, redeemedCount: 12, active: true, expiresAt: null, createdAt: ago(70), redemptions: Array.from({ length: 12 }, (_, i) => ({ companyName: ["Northline Painting & Decorating", "Granite State Countertops & Tile", "Bluebird Home Painters", "Summit Cabinetry and Custom Millwork Company of Colorado, LLC"][i % 4], monthsGranted: 1, redeemedAt: ago(65 - i * 4) })) },
  { id: "pc_4", code: "HALIFAXHOMESHOW26", label: "Halifax Fall Home Show — booth QR", notes: "Print run of 500 cards.", kind: "influencer", rewardMonths: 1, maxRedemptions: 500, redeemedCount: 0, active: true, expiresAt: ahead(25), createdAt: ago(3), redemptions: [] },
  { id: "pc_5", code: "TIKTOK-DRYWALLDAN", label: "@drywalldan (TikTok) — pulled after the sponsorship dispute", notes: "Revoked 2026-08-30.", kind: "influencer", rewardMonths: 3, maxRedemptions: 200, redeemedCount: 41, active: false, expiresAt: ahead(60), createdAt: ago(90), redemptions: [
    { companyName: "Fraser Valley Drywall & Taping", monthsGranted: 3, redeemedAt: ago(6, 3) },
    { companyName: "Dan's Drywall & Taping Ltd. (a different Dan)", monthsGranted: 3, redeemedAt: ago(31) },
  ] },
  { id: "pc_6", code: "WELCOME-BACK-1M", label: "Win-back — churned accounts called by Marcus", notes: null, kind: "tester", rewardMonths: 1, maxRedemptions: 20, redeemedCount: 1, active: true, expiresAt: ago(2), createdAt: ago(45), redemptions: [
    { companyName: "Prairie Plumbing & Heating (1987) Ltd.", monthsGranted: 1, redeemedAt: ago(20) },
  ] },
  { id: "pc_7", code: "MRCA-MEMBER-2026", label: "Maritime Roofing Contractors Association newsletter", notes: "Backup for members who don't get the automatic tier discount.", kind: "influencer", rewardMonths: 2, maxRedemptions: 60, redeemedCount: 9, active: true, expiresAt: ahead(300), createdAt: ago(62), redemptions: [] },
  { id: "pc_8", code: "QA-DO-NOT-SHARE", label: "Internal QA (Emilio) — DO NOT SHARE OUTSIDE FIELDQUO", notes: "Twenty-four months so test accounts never lapse mid-test.", kind: "tester", rewardMonths: 24, maxRedemptions: 5, redeemedCount: 2, active: true, expiresAt: null, createdAt: "2026-01-04T16:00:00.000Z", redemptions: [
    { companyName: "Acme Test Co (created from console)", monthsGranted: 24, redeemedAt: "2026-08-02T16:01:00.000Z" },
    { companyName: "Test Roofers Do Not Bill", monthsGranted: 24, redeemedAt: "2026-02-15T16:01:00.000Z" },
  ] },
];

// ── Scenes ──────────────────────────────────────────────────────────────────
//
// Only what a control on the shipped page can open.
const buttonByText = (text) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent.trim().startsWith(text));

export const scenes = {
  "/platform": {
    // The tenant board sits behind the "Our customers" tab — the two boards
    // are never on screen together, by design (see app/platform/page.js).
    tenants: async ({ until, wait, settled }) => {
      (await until('[role="tab"]:nth-of-type(2)')).click();
      await settled();
      await until("h2");
      await wait(200);
    },
    // …and one company's drill-down, the panel opened before a phone call.
    insight: async ({ until, wait, settled }) => {
      (await until('[role="tab"]:nth-of-type(2)')).click();
      await settled();
      const row = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("quote(s)"));
      if (!row) throw new Error("scene: no company row on the tenant board");
      row.click();
      await settled();
      await wait(200);
    },
  },
  [`/platform/companies/${COMPANY_ID}`]: {
    // The chargeback evidence is assembled on demand and the device table
    // sits in a <details>; the client-billing history is the second tab.
    open: async ({ until, wait, settled }) => {
      await until("summary");
      for (const d of document.querySelectorAll("details")) d.open = true;
      const tab = buttonByText("Their client billing");
      if (tab) tab.click();
      const assemble = buttonByText("Assemble evidence");
      if (!assemble) throw new Error("scene: no Assemble evidence button");
      assemble.click();
      await settled();
      await wait(200);
    },
  },
};

// ── The answer ──────────────────────────────────────────────────────────────
export default function answer({ method, path, url, body }) {
  // Dashboard
  if (path === "/api/platform/analytics/overview") return overview();
  if (path === "/api/platform/analytics/tenants") return tenantAnalytics();
  {
    const m = path.match(/^\/api\/platform\/analytics\/tenants\/([^/]+)$/);
    if (m) return companyInsight(m[1]);
  }
  if (path === "/api/platform/email-health") return EMAIL_HEALTH;
  if (path === "/api/platform/ai-health") return AI_HEALTH;
  if (path === "/api/platform/voice-health") return VOICE_HEALTH;

  // Companies
  if (path === "/api/platform/companies" && method === "GET") {
    const q = (url.searchParams.get("q") || "").toLowerCase();
    const status = url.searchParams.get("status") || "";
    return COMPANIES.filter((c) => (!q || c.name.toLowerCase().includes(q)) && (!status || (status === "incomplete" ? !c.sub : c.onboardingStatus === status)))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(companyListRow);
  }
  {
    const m = path.match(/^\/api\/platform\/companies\/([^/]+)(?:\/([^/]+))?$/);
    if (m) {
      const [, id, sub] = m;
      if (!sub) {
        if (method === "PATCH") {
          const c = COMPANY_BY_ID[id];
          if (!c) return json({ error: "Not found" }, 404);
          if (body?.onboardingStatus) c.onboardingStatus = body.onboardingStatus;
          return companyRecord(c);
        }
        return companyDetail(id);
      }
      if (sub === "health") return companyHealth(id);
      if (sub === "history") return companyHistory(id);
      if (sub === "activity") return companyActivity(id);
      if (sub === "dispute-evidence") return disputeEvidence(id);
      if (sub === "extend-trial") return { ok: true, trialEndsAt: ahead(Number(body?.days) || 14) };
      if (sub === "impersonate") return { success: true, redirect: "/app", expiresAt: new Date(NOW + 30 * 60000).toISOString() };
    }
  }

  // Signups and their origins
  if (path === "/api/platform/signups") return signups();
  if (path === "/api/platform/signup-origins") return signupOrigins(url.searchParams.get("flagged") === "1");
  {
    const m = path.match(/^\/api\/platform\/signup-origins\/([^/]+)\/review$/);
    if (m && method === "POST") return reviewOrigin(m[1], body?.note);
  }

  // Billing
  if (path === "/api/platform/billing/subscriptions") return subscriptions(url.searchParams.get("status") || "");
  if (path === "/api/platform/billing/plans" && method === "GET") return PLANS;
  if (path === "/api/platform/billing/plans" && method === "POST") return json({ ...plan(`plan_new_${Date.now()}`, body || {}) }, 201);
  {
    const m = path.match(/^\/api\/platform\/billing\/plans\/([^/]+)$/);
    if (m) return method === "DELETE" ? { ok: true } : { ...PLAN_BY_ID[m[1]], ...(body || {}) };
  }
  if (path === "/api/platform/billing/connect-fees") return CONNECT_FEES;
  if (path === "/api/platform/billing/promotions" && method === "GET") return PROMOTIONS;
  if (path === "/api/platform/billing/promotions" && method === "POST") return json({ id: `promo_new_${Date.now()}`, ...(body || {}) }, 201);
  {
    const m = path.match(/^\/api\/platform\/billing\/promotions\/([^/]+)$/);
    if (m) return method === "DELETE" ? { ok: true } : { ...PROMOTIONS.find((p) => p.id === m[1]), ...(body || {}) };
  }

  // Reports — a CSV body with a Content-Disposition, the way the route sends it.
  if (path === "/api/platform/reports") return reportCsv(url.searchParams.get("report"));

  // Migrations
  if (path === "/api/platform/migrations") {
    const status = url.searchParams.get("status");
    return {
      requests: MIGRATIONS.filter((m) => !status || m.status === status)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map((m) => ({ ...m, company: COMPANY_BY_ID[m.companyId] ? { id: m.companyId, name: COMPANY_BY_ID[m.companyId].name, slug: COMPANY_BY_ID[m.companyId].slug } : null })),
    };
  }
  {
    const m = path.match(/^\/api\/platform\/migrations\/([^/]+)(?:\/(.+))?$/);
    if (m) {
      const [, id, rest] = m;
      if (!rest) return migrationDetail(id);
      if (rest === "clients") return migrationClients(id);
      if (rest === "quote") return { ...MIGRATIONS.find((x) => x.id === id), priceCents: Math.round(Number(body?.amount || 0) * 100), status: "quoted", quotedAt: new Date().toISOString() };
      if (rest === "writes/clients") return { ok: true, client: { id: `cli_new_${Date.now()}`, ...(body || {}) } };
      if (rest === "writes/quotes") return { ok: true, quote: { id: `q_new_${Date.now()}`, quoteNumber: "Q-2026-0133 (imported)" } };
      if (rest === "cancel" || rest === "complete" || rest === "schedule") return { ok: true };
    }
  }

  // Feature flags and promo codes
  if (path === "/api/platform/features") return method === "GET" ? features() : { ok: true };
  if (path === "/api/platform/promo-codes" && method === "GET") return PROMO_CODES;
  if (path === "/api/platform/promo-codes" && method === "POST") return json({ id: `pc_new_${Date.now()}`, code: "NEW-CODE-XXXX", redeemedCount: 0, active: true, redemptions: [], createdAt: new Date().toISOString(), ...(body || {}) }, 201);
  {
    const m = path.match(/^\/api\/platform\/promo-codes\/([^/]+)$/);
    if (m) return { ...PROMO_CODES.find((c) => c.id === m[1]), ...(body || {}) };
  }

  return undefined;
}
