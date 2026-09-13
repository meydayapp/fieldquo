// docs/screens/app-guide/harness/fixtures/routes-help.js
//
// The API surface behind the help centre's figures — the rows of screens.js
// that carry `chapter: "help"`: the detail pages the sidebar rows link to,
// the pages a homeowner opens from a link, and the crew's phone. Consulted
// FIRST in routes.js, so a screen that is the owner's page seen by a Crew
// member (the home page's money tiles answer 403 to Léo, as the real route
// does) can say so here without touching the group file the owner's row
// reads.
//
// Same people, same job, same numbers as company.js and the group files:
// Sophie Dubois's Q-1042 is the quote she approves at /q/…, the deposit on
// INV-2071 is the balance her portal shows, and J-318 is the job on Léo's
// phone. A rep flipping between a figure in "Quotes" and one in "For your
// clients" should see one business.
import { COMPANY, PEOPLE, CLIENT, QUOTE, JOB, INVOICE, day, iso, TODAY } from "./company.js";
import { EVENT_TYPES, SERVICE_CATEGORIES } from "./routes-settings-a.js";
import { JOBS, INVOICES, PLANS, TASKS, J_318, INV_2069, INV_2066, Q_1042, Q_1044, LAVOIE, FORTIN, RIVENORD } from "./routes-work.js";
import { PAY_RUNS, PAY_RUN_LINES } from "./routes-money.js";
import { CAMPAIGNS, PLANS as BILLING_PLANS } from "./routes-grow.js";
import { W, TIME_ENTRIES, POLICIES, TEAM_REQUESTS, TEAM_BALANCES, INCIDENTS, CLOCK } from "./routes-people.js";
import { publicIntakeFields } from "@/app/data/quoteIntakeFields";
import { budgetBands } from "@/lib/estimate/budgetBands";
import { sanitiseFunnelSteps } from "@/app/data/funnelBlocks";
import { parsePaymentSchedule } from "@/lib/documents/paymentSchedule";
import { JOB_PHOTOS as JOB_PHOTO_URLS } from "./public.js";

const [MARC, JULIE, SAM, , LEO, ANA] = PEOPLE;
const who = (m) => ({ id: m.userId, name: m.name });
const SLUG = COMPANY.bookingSlug || COMPANY.slug;
const round2 = (n) => Math.round(n * 100) / 100;
const isCrew = (ctx) => ctx.screen?.member === "crew";
const forbidden = () => new Response(JSON.stringify({ error: "Your access level does not include this." }), { status: 403, headers: { "Content-Type": "application/json" } });

// The client-facing fixtures speak the language of the frame: a French
// figure is the French client's page, because the document's language and
// the covering email's agree (AGENTS.md #6) and the figure must show that.
const docLang = (ctx) => (["en", "fr", "es"].includes(ctx.lang) ? ctx.lang : "fr");

// The public shape of the company, as every client route selects it.
const COMPANY_PUBLIC = {
  name: COMPANY.name,
  logoUrl: COMPANY.logoUrl,
  brandColor: COMPANY.brandColor,
  email: COMPANY.email,
  phone: COMPANY.phone,
  website: COMPANY.website,
  address: `${COMPANY.address}, ${COMPANY.city}, ${COMPANY.province} ${COMPANY.postalCode}`,
  paymentTerms: COMPANY.paymentTerms,
  paymentMethods: COMPANY.paymentMethods,
  currency: COMPANY.currency,
  defaultLanguage: "fr",
  province: COMPANY.province,
  country: COMPANY.country,
  taxIdName: COMPANY.taxIdName,
  taxIdNumber: COMPANY.taxIdNumber,
};

// ── /q/<token> — the quote Sophie opens from her email ──────────────────────
// app/api/public/quotes/[token] present(). Still "sent" here: the figure is
// the moment before she taps Approve, with the add-ons the estimator
// attached still unpicked. (company.js's Q-1042 is the accepted quote the
// back office shows; this is the same document a week earlier.)
export const QUOTE_TOKEN = "qt_8f2c1a7d4e";
const ADD_ONS = [
  { id: "ao1", description: "Under-cabinet LED lighting", detail: "Warm white strip under every upper run, hard-wired to a wall switch", amount: 640, taxable: true, selected: false },
  { id: "ao2", description: "Pull-out waste and recycling", detail: "Two-bin unit in the base beside the sink", amount: 385, taxable: true, selected: false },
  { id: "ao3", description: "Soft-close upgrade on all drawers", detail: "Blum undermount runners", amount: 520, taxable: true, selected: true },
];
const SCOPE_GROUPS = [
  {
    label: "Kitchen cabinets",
    subtotal: 17620,
    accent: null,
    description: "Every box and door built in our Laval shop, sprayed in the booth, installed level and plumb.",
    included: ["Site measure and shop drawings for approval", "Soft-close hinges on every door", "Removal and disposal of the old cabinets", "Two-year workmanship warranty"],
    mayChange: [{ title: "Countertops", body: "Quoted separately once the boxes are set — the template is taken on site." }],
    lineItems: QUOTE.items.slice(0, 3).map((it) => ({ description: `${it.name} — ${it.description}`, quantity: it.quantity, amount: it.total })),
  },
  {
    label: "Installation",
    subtotal: 830,
    accent: null,
    description: "",
    included: ["Two installers, two days", "Hardware fitted and hinges adjusted before we leave"],
    mayChange: [],
    lineItems: [{ description: "Installation — 2 installers, 2 days", quantity: 2, amount: 830 }],
  },
];
const publicQuote = (ctx) => ({
  quoteNumber: QUOTE.quoteNumber,
  status: "sent",
  language: docLang(ctx),
  notes: "Colour: Benjamin Moore OC-17 White Dove on the perimeter; the island stays natural white oak with a matte clear coat.",
  processNotes: COMPANY.defaultProcessNotes,
  validUntil: QUOTE.validUntil,
  sentAt: QUOTE.sentAt,
  subtotal: QUOTE.subtotal,
  discount: 0,
  tax: QUOTE.taxTotal,
  taxKind: "charged",
  taxAssumedRegion: null,
  total: QUOTE.total,
  acceptedTotal: null,
  taxRate: COMPANY.taxRate / 100,
  addOns: ADD_ONS,
  client: { name: CLIENT.name },
  company: COMPANY_PUBLIC,
  financing: null,
  scopeGroups: SCOPE_GROUPS,
  glossary: [
    { term: "Shaker", body: "A flat centre panel framed by four square-edged rails — the plainest door profile, and the one that hides wear best." },
    { term: "Rift sawn", body: "White oak cut so the grain runs straight and tight across the face, with none of the cathedral figure of plain-sawn boards." },
  ],
  processSteps: [
    { num: 1, title: "Measure", body: "We measure on site and draw every elevation for your approval.", timeline: "Week 1" },
    { num: 2, title: "Build", body: "Boxes, doors and the island are built and sprayed in our Laval shop.", timeline: "Weeks 2–5" },
    { num: 3, title: "Install", body: "Day one we remove the old cabinets and set the boxes; day two we hang doors and fit hardware.", timeline: "Week 6" },
  ],
  paymentTerms: COMPANY.paymentTerms,
  paymentSchedule: [
    { pct: "50%", label: "Deposit to book the shop time" },
    { pct: "50%", label: "Balance on installation" },
  ],
});

// ── /portal/<token> — Sophie's portal ───────────────────────────────────────
export const PORTAL_TOKEN = "pt_3a9d7c2f1b";
const portal = (ctx) => ({
  clientName: CLIENT.name,
  language: docLang(ctx),
  company: COMPANY_PUBLIC,
  onlinePayments: true,
  quotes: [
    { id: QUOTE.id, quoteNumber: QUOTE.quoteNumber, total: QUOTE.total, createdAt: QUOTE.createdAt, status: "accepted", shareToken: QUOTE_TOKEN },
    { id: "q_1021", quoteNumber: "Q-1021", total: 2874.52, createdAt: iso(day(-140, 10)), status: "declined", shareToken: "qt_old_1021" },
  ],
  invoices: [
    {
      id: INVOICE.id, invoiceNumber: INVOICE.invoiceNumber, total: INVOICE.total, amountPaid: 0, dueDate: INVOICE.dueDate,
      lineItems: INVOICE.items, notes: null, subtotal: INVOICE.subtotal, discount: 0, tax: INVOICE.taxTotal,
      jobPaymentStages: [], taxKind: "charged", taxAssumedRegion: null,
    },
  ],
});

// ── /book/<slug> — the booking page ─────────────────────────────────────────
// app/api/booking/[companySlug]: the public columns plus the two active
// event types Settings › Booking page lists, and the enabled services as
// { key, label }. Two event types, so the flow opens on the menu; the scene
// picks the consultation to reach the calendar.
const bookingCompany = () => ({
  id: COMPANY.id,
  name: COMPANY.name,
  logoUrl: COMPANY.logoUrl,
  brandColor: COMPANY.brandColor,
  phone: COMPANY.phone,
  email: COMPANY.email,
  currency: COMPANY.currency,
  bookingModes: COMPANY.bookingModes,
  defaultLanguage: "fr",
  eventTypes: EVENT_TYPES.map((e) => ({
    id: e.id, name: e.name, slug: e.slug, durationMinutes: e.durationMinutes, location: e.location,
    feeCents: e.promoActive && e.promoFeeCents != null ? e.promoFeeCents : e.feeCents,
    feeStandardCents: e.promoActive && e.promoFeeCents != null ? e.feeCents : null,
  })),
  services: SERVICE_CATEGORIES.filter((c) => c.enabled).map((c) => ({ key: c.key, label: c.label })),
});
// Working days from tomorrow to the end of the month, three starts a day,
// in the company's timezone (Toronto, UTC-4 in September).
const slotsBetween = (from, to) => {
  const out = {};
  const start = new Date(`${from}T00:00:00-04:00`);
  const end = new Date(`${to}T00:00:00-04:00`);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    if (d.getTime() <= TODAY.getTime()) continue;
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
    const k = `${y}-${m}-${dd}`;
    const hours = dow === 5 ? [9, 11] : dow === 3 ? [9, 13, 15] : [9, 11, 14];
    out[k] = hours.map((h) => new Date(`${k}T${String(h).padStart(2, "0")}:00:00-04:00`).toISOString());
  }
  return out;
};

// ── /visit/<token> — manage a booked visit ──────────────────────────────────
// lib/booking/manageVisit.js visitView(): Sophie's design consultation,
// Thursday morning, booked against Q-1042, the promo fee paid.
export const VISIT_TOKEN = "vm_5c1e8b3a2d";
const visitView = (ctx) => ({
  status: "confirmed",
  clientName: CLIENT.name,
  eventTypeName: EVENT_TYPES[0].name,
  startTime: iso(day(3, 9, 30)),
  endTime: iso(day(3, 10, 30)),
  durationMinutes: 60,
  timezone: COMPANY.timezone,
  mode: "visit",
  address: `${CLIENT.address}, ${CLIENT.city}, ${CLIENT.province} ${CLIENT.postalCode}`,
  language: docLang(ctx),
  arrivalWindowMinutes: COMPANY.arrivalWindowMinutes,
  company: { name: COMPANY.name, logoUrl: COMPANY.logoUrl, brandColor: COMPANY.brandColor, phone: COMPANY.phone, currency: COMPANY.currency },
  fee: { paidCents: 4900, currency: "CAD", refundedAt: null, refundedCents: null },
  quoteNumber: QUOTE.quoteNumber,
  policy: { canChange: true, reason: "ok", hoursLeft: 68, noticeHours: COMPANY.bookingChangeNoticeHours },
  refund: { willRefund: true, reason: "before_cutoff", amountCents: 4900, cutoffHours: COMPANY.refundCutoffHours },
});

// ── /quote/<slug> — the self-quote form ─────────────────────────────────────
// app/api/self-quote/[companySlug]: enabled categories with their public
// intake fields (number and select only, three at most — the same helper the
// route calls), never a rate (non-negotiable #4).
const selfQuote = (ctx) => ({
  company: { name: COMPANY.name, logoUrl: COMPANY.logoUrl, brandColor: COMPANY.brandColor, phone: COMPANY.phone, email: COMPANY.email, currency: COMPANY.currency },
  // The first language is the one the form opens in; the frame's language
  // leads so the French figure is the form in French.
  languages: [docLang(ctx), ...["fr", "en"].filter((l) => l !== docLang(ctx))],
  services: SERVICE_CATEGORIES.filter((c) => c.enabled)
    .map((c) => ({ id: c.id, key: c.key, label: c.label, icon: c.icon, fields: publicIntakeFields(c.key) }))
    .sort((a, b) => a.label.localeCompare(b.label)),
  booking: { canBookVisit: true, slug: SLUG },
});

// ── /instant-quote/<slug> — the instant estimator ───────────────────────────
// app/api/instant-quote/[companySlug]: the trades Settings › Instant quotes
// has switched on, as mode names and labels — the range itself only ever
// comes back from POST /measure, which is not on the page at first paint.
const instantQuote = (ctx) => {
  const language = docLang(ctx) === "fr" ? "fr" : "en";
  const bands = budgetBands(null, { currency: COMPANY.currency, language }).map((b) => ({ index: b.index, label: b.label }));
  return {
    company: { name: COMPANY.name, slug: SLUG, logoUrl: COMPANY.logoUrl, brandColor: COMPANY.brandColor },
    mapsKey: null,
    language,
    currency: COMPANY.currency,
    trades: [
      { trade: "cabinet_refinishing", label: "Cabinet refinishing", estimateDisplay: "range", budgetBands: bands, measure: "manual_units", hasMaterials: false, materials: [] },
      {
        trade: "cabinet_refacing", label: "Cabinet refacing", estimateDisplay: "range", budgetBands: bands, measure: "manual_units", hasMaterials: true,
        materials: [
          { key: "shaker_painted_mdf", label: "Shaker, painted MDF" },
          { key: "shaker_maple", label: "Shaker, painted maple" },
          { key: "slab_white_oak", label: "Slab, white oak veneer" },
        ],
      },
    ],
    booking: { canBookVisit: true, slug: SLUG },
  };
};

// ── /f/<slug>/<funnel> — the kitchen landing page ───────────────────────────
// One funnel, shared by the builder (app/app/funnels/[id], GET /api/funnels/
// [id]) and the public runner (GET /api/funnels/public/…): the steps go
// through the same sanitiser the save route and the public route apply, so a
// step this file gets wrong is dropped here the way it would be there.
export const FUNNEL_STEPS = sanitiseFunnelSteps([
  { id: "s_intro", kind: "intro", headline: "A new kitchen, priced in two minutes", subhead: "Answer four quick questions and we'll come back with a range — no visit needed for a first number.", buttonText: "Start" },
  {
    id: "s_style", kind: "question_single", question: "What look are you after?", help: "Pick the closest — we can mix.",
    answers: [
      { id: "a_shaker", label: "Shaker, painted", value: "shaker", weight: 10 },
      { id: "a_slab", label: "Flat slab, wood veneer", value: "slab", weight: 10 },
      { id: "a_mixed", label: "Painted perimeter, wood island", value: "mixed", weight: 20 },
      { id: "a_unsure", label: "Not sure yet", value: "unsure", weight: 0 },
    ],
  },
  {
    id: "s_scope", kind: "question_multi", question: "What's in scope?", buttonText: "Next",
    answers: [
      { id: "b_uppers", label: "Upper cabinets", value: "uppers", weight: 5 },
      { id: "b_bases", label: "Base cabinets", value: "bases", weight: 5 },
      { id: "b_island", label: "An island", value: "island", weight: 15 },
      { id: "b_pantry", label: "A pantry wall", value: "pantry", weight: 10 },
    ],
  },
  {
    id: "s_budget", kind: "question_single", question: "Roughly what budget do you have in mind?", maps: "budget",
    answers: [
      { id: "c_1", label: "Under $15,000", value: "under_15k", weight: 0, maps: "budget" },
      { id: "c_2", label: "$15,000 – $30,000", value: "15_30k", weight: 10, maps: "budget" },
      { id: "c_3", label: "$30,000 – $50,000", value: "30_50k", weight: 20, maps: "budget" },
      { id: "c_4", label: "Over $50,000", value: "over_50k", weight: 25, maps: "budget" },
    ],
  },
  { id: "s_form", kind: "form", headline: "Where should we send your range?", subhead: "We reply within one business day.", buttonText: "Send me my range", fields: ["name", "email", "phone"], consent: "By sending this you agree to be contacted about your kitchen." },
  { id: "s_thanks", kind: "thankyou", headline: "Thanks — your range is on its way.", subhead: "Marc or Samuel will call to talk through it and book a measure if you'd like one." },
]);
export const FUNNEL = {
  id: "fn_kitchen",
  name: "Kitchen quote — landing page",
  slug: "kitchen-quote",
  status: "published",
  channel: "web",
  steps: FUNNEL_STEPS,
  theme: null,
  metaPixelId: null,
  tiktokPixelId: null,
  ga4Id: null,
  createdAt: iso(day(-40, 9)),
  updatedAt: iso(day(-3, 15)),
  publishedAt: iso(day(-30, 11)),
  _count: { responses: 14 },
};
const publicFunnel = () => ({
  company: { name: COMPANY.name, logoUrl: COMPANY.logoUrl, brandColor: COMPANY.brandColor, phone: COMPANY.phone, currency: COMPANY.currency },
  funnel: { id: FUNNEL.id, name: FUNNEL.name, slug: FUNNEL.slug, steps: FUNNEL.steps, theme: null, pixels: { meta: null, tiktok: null, ga4: null } },
});

// ── /design/<token> — the kitchen Sophie can move around ────────────────────
// app/api/kitchen-design/[token] GET, prices stripped: a U-shaped kitchen on
// walls A, B and D with the white-oak island in the middle. Inches, the way
// lib/kitchen/geometry.js measures.
export const DESIGN_TOKEN = QUOTE_TOKEN;
const el = (id, kind, wall, pos, width, height, depth, config = {}) => ({ id, kind, wall, pos, width, height, depth, config });
const KITCHEN = {
  serviceType: "kitchen",
  room: { width: 168, depth: 144, ceiling: 96, walls: { A: { length: 168, ceiling: 96 }, B: { length: 144, ceiling: 96 }, C: { length: 168, ceiling: 96 }, D: { length: 144, ceiling: 96 } } },
  elements: [
    el("e1", "sinkBase", "A", 60, 36, 34.5, 24, { doors: 2, doorMaterial: "shaker_painted", boxMaterial: "plywood" }),
    el("e2", "drawerBase", "A", 24, 36, 34.5, 24, { doorMaterial: "shaker_painted", boxMaterial: "plywood" }),
    el("e3", "dishwasher", "A", 96, 24, 34.5, 24),
    el("e4", "base", "A", 120, 30, 34.5, 24, { doors: 2, doorMaterial: "shaker_painted", boxMaterial: "plywood" }),
    el("e5", "wall", "A", 24, 36, 30, 12, { doors: 2, doorMaterial: "shaker_painted", boxMaterial: "plywood" }),
    el("e6", "wall", "A", 60, 36, 30, 12, { doors: 2, doorMaterial: "shaker_painted", boxMaterial: "plywood" }),
    el("e7", "wall", "A", 120, 30, 30, 12, { doors: 2, doorMaterial: "shaker_painted", boxMaterial: "plywood" }),
    el("e8", "window", "A", 62, 36, 42, 4),
    el("e9", "stove", "B", 36, 30, 36, 25),
    el("e10", "hoodCabinet", "B", 36, 30, 24, 12, { doorMaterial: "shaker_painted", boxMaterial: "plywood" }),
    el("e11", "base", "B", 66, 30, 34.5, 24, { doors: 2, doorMaterial: "shaker_painted", boxMaterial: "plywood" }),
    el("e12", "wall", "B", 66, 30, 30, 12, { doors: 2, doorMaterial: "shaker_painted", boxMaterial: "plywood" }),
    el("e13", "fridge", "D", 24, 36, 70, 30),
    el("e14", "fridgeSurround", "D", 24, 36, 96, 24, { doorMaterial: "shaker_painted", boxMaterial: "plywood" }),
    el("e15", "tall", "D", 60, 24, 84, 24, { doors: 2, doorMaterial: "shaker_painted", boxMaterial: "plywood" }),
    el("e16", "island", "C", 48, 84, 36, 36, { doors: 4, doorMaterial: "slab_white_oak", boxMaterial: "plywood" }),
  ],
  finish: { doorMaterial: "shaker_painted", colour: "OC-17 White Dove", islandMaterial: "slab_white_oak" },
  modules: null,
  accessories: [{ id: "soft_close", quantity: 1 }, { id: "pullout_waste", quantity: 1 }],
};
const kitchenDesign = () => ({
  quoteNumber: QUOTE.quoteNumber,
  clientName: CLIENT.name,
  companyName: COMPANY.name,
  companyLogoUrl: COMPANY.logoUrl,
  companyBrandColor: COMPANY.brandColor,
  locked: false,
  kitchenConfig: KITCHEN,
});


// ═══════════════════════════════════════════════════════════════════════════
// The back office's detail pages
// ═══════════════════════════════════════════════════════════════════════════

// ── /app/quotes/q_1042 ──────────────────────────────────────────────────────
// app/api/quotes/[id]: the row with client, company, assignedTo, invoices,
// scopeGroups (category + lineItems + takeoff) and addOns. Accepted, and
// converted into INV-2071's deposit, so the page shows the "already
// converted" band the sales rep is asked about most.
const CAT_KITCHEN = SERVICE_CATEGORIES[0];
const QUOTE_DETAIL = {
  ...Q_1042,
  discount: 0,
  tax: QUOTE.taxTotal,
  taxEnabled: true,
  acceptedTotal: null,
  notes: "Colour: Benjamin Moore OC-17 White Dove on the perimeter; the island stays natural white oak with a matte clear coat.",
  processNotes: null,
  clientPhotos: [],
  historicalImportedAt: null,
  clientDesignAt: iso(day(-8, 20, 15)),
  sentToEmail: CLIENT.email,
  followUpSentAt: iso(day(-10, 9)),
  followUpCount: 1,
  canOpenKitchenDesigner: true,
  importedGroupIds: [],
  client: { id: CLIENT.id, name: CLIENT.name, contactName: null, email: CLIENT.email, phone: CLIENT.phone, address: CLIENT.address, city: CLIENT.city, province: CLIENT.province, country: CLIENT.country, language: CLIENT.language },
  company: { currency: COMPANY.currency, outboundCallsEnabled: true },
  invoices: [{ id: INVOICE.id, invoiceNumber: INVOICE.invoiceNumber, status: INVOICE.status }],
  scopeGroups: [
    {
      id: "sg_1042a", label: "Kitchen cabinets", subtotal: 17620, sortOrder: 0, categoryId: CAT_KITCHEN.id,
      category: { id: CAT_KITCHEN.id, key: CAT_KITCHEN.key, label: CAT_KITCHEN.label, icon: CAT_KITCHEN.icon },
      lineItems: [
        { description: "Upper cabinets — shaker, painted", detail: "12 lin. ft, soft-close hinges", quantity: 12, unit: "lin. ft", rate: 425, amount: 5100 },
        { description: "Base cabinets — shaker, painted", detail: "16 lin. ft, dovetail drawers", quantity: 16, unit: "lin. ft", rate: 520, amount: 8320 },
        { description: "Island — white oak, rift sawn", detail: "7 ft × 3 ft, waterfall end", quantity: 1, unit: "ea", rate: 4200, amount: 4200, meta: { complexityLevel: "high", baseUnitPrice: 3600, complexityReasons: ["waterfall_end", "rift_sawn"] } },
      ],
      takeoff: { doorCount: 26, drawerCount: 9, boxLinearFt: 28 },
      intakeValues: { doorCount: 26, drawerCount: 9, boxLinearFt: 28 },
    },
    {
      id: "sg_1042b", label: "Installation", subtotal: 830, sortOrder: 1, categoryId: CAT_KITCHEN.id,
      category: { id: CAT_KITCHEN.id, key: CAT_KITCHEN.key, label: CAT_KITCHEN.label, icon: CAT_KITCHEN.icon },
      lineItems: [{ description: "Installation", detail: "2 installers, 2 days", quantity: 2, unit: "day", rate: 415, amount: 830 }],
      takeoff: null,
      intakeValues: null,
    },
  ],
  addOns: ADD_ONS.map((a, i) => ({ ...a, sortOrder: i, source: "estimator", selected: a.selected, selectedAt: a.selected ? QUOTE.approvedAt : null })),
};
const QUOTE_DOCUMENT = {
  groups: QUOTE_DETAIL.scopeGroups.map((g, i) => ({
    id: g.id, categoryKey: g.category.key, label: g.label, subtotal: g.subtotal, accent: null,
    description: SCOPE_GROUPS[i].description, included: SCOPE_GROUPS[i].included, mayChange: SCOPE_GROUPS[i].mayChange,
  })),
  processSteps: publicQuote({ lang: "en" }).processSteps,
  glossary: publicQuote({ lang: "en" }).glossary.map((g) => ({ title: g.term, body: g.body })),
  processNotes: COMPANY.defaultProcessNotes,
  processNotesSource: "company",
  paymentTerms: COMPANY.paymentTerms,
  paymentSchedule: parsePaymentSchedule(COMPANY.paymentTerms),
};
// app/api/quotes/[id]/costing — what the shop expects the job to cost against
// the price, from the crew's rates and the material recipes.
const QUOTE_COSTING = {
  saved: true,
  labourHours: 96,
  labourCost: 3552,
  materialTotal: 6840,
  unpricedMaterials: 0,
  overhead: 1845,
  overheadBasis: "pct_of_price",
  overheadPct: 10,
  estimatedCost: 12237,
  price: QUOTE.subtotal,
  profit: 6213,
  marginPct: 33.7,
  marginTargetPct: 30,
  signal: "green",
  costIncomplete: false,
  crew: [
    { name: LEO.name, hourlyRate: 34, hours: 48, cost: 1632 },
    { name: ANA.name, hourlyRate: 40, hours: 48, cost: 1920 },
  ],
  blendedRate: 37,
  groups: [
    {
      label: "Kitchen cabinets", categoryKey: CAT_KITCHEN.key, labourHours: 80, materialTotal: 6840,
      materials: [
        { name: "Maple plywood 3/4\" — boxes", qty: 22, unit: "sheet", unitCost: 96, cost: 2112, unpriced: false },
        { name: "MDF shaker doors — 26", qty: 26, unit: "ea", unitCost: 68, cost: 1768, unpriced: false },
        { name: "White oak, rift sawn — island", qty: 1, unit: "lot", unitCost: 1890, cost: 1890, unpriced: false },
        { name: "Blum soft-close hinges", qty: 52, unit: "ea", unitCost: 6.5, cost: 338, unpriced: false },
        { name: "Primer, lacquer, tint", qty: 1, unit: "lot", unitCost: 732, cost: 732, unpriced: false },
      ],
    },
    { label: "Installation", categoryKey: CAT_KITCHEN.key, labourHours: 16, materialTotal: 0, materials: [] },
  ],
  addedLabourHours: 0,
  addedMaterialCost: 0,
  labourRate: 37,
  note: "Island oak priced from Langevin's July quote.",
};
const EMAIL_SECTIONS = {
  quoteId: QUOTE.id,
  sections: [
    { key: "references", included: true, inherited: true, source: "company", items: [{ name: "Isabelle Fortin", city: "Sainte-Rose" }, { name: "Karim Bensaïd", city: "Vimont" }], companyDefault: true, companyItemCount: 2, blocksSend: false },
    { key: "beforeAfter", included: false, inherited: true, source: "company", items: [], companyDefault: false, companyItemCount: 0, blocksSend: false },
  ],
  blocked: [],
  blockedDetail: [],
};

// Lavoie's refacing quote, sent last Thursday and still open — the page
// with Send again, Follow up and Get approved on it, which the accepted
// Q-1042 above no longer shows.
const CAT_REFACING = SERVICE_CATEGORIES.find((c) => c.key === "cabinet_refacing");
const QUOTE_1044_DETAIL = {
  ...Q_1044,
  discount: 0,
  tax: Q_1044.taxTotal,
  taxEnabled: true,
  acceptedTotal: null,
  notes: null,
  processNotes: null,
  clientPhotos: [],
  historicalImportedAt: null,
  clientDesignAt: null,
  sentToEmail: LAVOIE.email,
  followUpSentAt: null,
  followUpCount: 0,
  canOpenKitchenDesigner: false,
  importedGroupIds: [],
  client: { id: LAVOIE.id, name: LAVOIE.name, contactName: null, email: LAVOIE.email, phone: LAVOIE.phone, address: LAVOIE.address, city: LAVOIE.city, province: LAVOIE.province, country: LAVOIE.country, language: LAVOIE.language },
  company: { currency: COMPANY.currency, outboundCallsEnabled: true },
  invoices: [],
  scopeGroups: [{
    id: "sg_1044a", label: "Kitchen refacing", subtotal: 9800, sortOrder: 0, categoryId: CAT_REFACING.id,
    category: { id: CAT_REFACING.id, key: CAT_REFACING.key, label: CAT_REFACING.label, icon: CAT_REFACING.icon },
    lineItems: [
      { description: "New doors and drawer fronts — painted maple, shaker", detail: "22 doors, 8 drawer fronts", quantity: 30, unit: "ea", rate: 210, amount: 6300 },
      { description: "Box veneer and end panels", detail: "Matching painted finish", quantity: 1, unit: "lot", rate: 1900, amount: 1900 },
      { description: "Hinges, pulls and installation", detail: "Soft-close, 1 day", quantity: 1, unit: "lot", rate: 1600, amount: 1600 },
    ],
    takeoff: { doorCount: 22, drawerCount: 8 },
    intakeValues: { doorCount: 22, drawerCount: 8 },
  }],
  addOns: [
    { id: "ao_1044a", description: "Soft-close upgrade on all drawers", detail: "Blum undermount runners", amount: 380, taxable: true, sortOrder: 0, source: "estimator", selected: false, selectedAt: null },
    { id: "ao_1044b", description: "Under-cabinet LED lighting", detail: "Warm white strip, hard-wired", amount: 540, taxable: true, sortOrder: 1, source: "estimator", selected: false, selectedAt: null },
  ],
};
const QUOTE_1044_DOCUMENT = {
  groups: [{ id: "sg_1044a", categoryKey: CAT_REFACING.key, label: "Kitchen refacing", subtotal: 9800, accent: null, description: "Your boxes stay; every door, drawer front and visible surface is replaced and finished to match.", included: ["Removal and disposal of the old doors", "Soft-close hinges on every door", "Two-year workmanship warranty"], mayChange: [{ title: "Box condition", body: "Water-damaged boxes found on removal are repaired at cost, agreed before we continue." }] }],
  processSteps: [
    { num: 1, title: "Measure", body: "We measure every opening and confirm the colour sample.", timeline: "Week 1" },
    { num: 2, title: "Build", body: "Doors are made and sprayed in our Laval shop.", timeline: "Weeks 2–4" },
    { num: 3, title: "Install", body: "One day on site: veneer, doors, hardware.", timeline: "Week 5" },
  ],
  glossary: [{ title: "Refacing", body: "New doors and fronts on your existing cabinet boxes — the layout stays, the look changes." }],
  processNotes: COMPANY.defaultProcessNotes,
  processNotesSource: "company",
  paymentTerms: COMPANY.paymentTerms,
  paymentSchedule: parsePaymentSchedule(COMPANY.paymentTerms),
};

// ── /app/jobs/j_318 ─────────────────────────────────────────────────────────
// app/api/jobs/[id]: the row with quote, client, visits (assignee, checklist,
// location stamps), payment stages and change orders. Day one of the
// install is tomorrow; the deposit stage was requested through INV-2071.
const CHECKLIST = [
  { label: "Photograph the kitchen before removal", done: true, phase: "pre", photoRequired: true },
  { label: "Confirm water and power are shut off", done: true, phase: "pre", critical: true },
  { label: "Remove old cabinets, protect floors", done: false, phase: "during" },
  { label: "Set base boxes level and plumb", done: false, phase: "during", responseType: "measure", unit: "mm", expectedMin: 0, expectedMax: 2, criteria: "Out of level across the run" },
  { label: "Walk the client through hinge adjustment", done: false, phase: "post" },
  { label: "Finished photos, every elevation", done: false, phase: "post", photoRequired: true },
];
const JOB_DETAIL = {
  ...J_318,
  siteAddress: `${CLIENT.address}, ${CLIENT.city}, ${CLIENT.province} ${CLIENT.postalCode}`,
  latitude: 45.5901,
  longitude: -73.7175,
  archivedAt: null,
  historicalImportedAt: null,
  costReviewedAt: null,
  callbackReason: null,
  originalJob: null,
  callbackJobs: [],
  quote: { id: QUOTE.id, quoteNumber: QUOTE.quoteNumber },
  client: { id: CLIENT.id, name: CLIENT.name, phone: CLIENT.phone, email: CLIENT.email, address: CLIENT.address, city: CLIENT.city, province: CLIENT.province },
  paymentStages: [
    { id: "ps_1", seq: 1, label: "Deposit to book", percentage: 50, status: "requested", dueDate: iso(day(-5, 9)), blockedReason: null, amountCents: Math.round(INVOICE.total * 100) },
    { id: "ps_2", seq: 2, label: "Balance on installation", percentage: 50, status: "pending", dueDate: iso(day(2, 17)), blockedReason: null, amountCents: Math.round(INVOICE.total * 100) },
  ],
  changeOrders: [
    { id: "co_1", description: "Add pull-out waste and recycling in the sink base", priceDelta: 385, status: "approved", invoiceId: null, invoice: null, createdBy: { name: SAM.name }, createdAt: iso(day(-3, 14, 10)) },
  ],
  visits: [
    {
      id: "v_318a", scheduledAt: iso(day(1, 8)), status: "scheduled", assignedToId: LEO.userId, assignedTo: who(LEO),
      checklistItems: CHECKLIST, notes: "Carcasses and base run — Léo + Ana", returnReason: null, returnNotes: null, locationStamps: [],
    },
    {
      id: "v_318b", scheduledAt: iso(day(2, 8)), status: "scheduled", assignedToId: ANA.userId, assignedTo: who(ANA),
      checklistItems: CHECKLIST.map((c) => ({ ...c, done: false })), notes: "Uppers, island, hardware", returnReason: null, returnNotes: null, locationStamps: [],
    },
  ],
};
const JOB_COSTING = {
  actual: {
    expenses: { total: 6412.5, byCategory: [{ category: "Materials", amount: 5980 }, { category: "Fuel & Vehicle", amount: 432.5 }] },
    labour: { approvedHours: 64, pendingHours: 3, cost: 2368, unratedHours: 0, workers: 2 },
    overhead: { amount: 1845, basis: "pct_of_price" },
    equipment: null,
    subcontracts: null,
    total: 10625.5,
    incomplete: true,
  },
  unattributed: null,
  comparison: { estimatedCost: 12237, actualCost: 10625.5, revenue: QUOTE.subtotal + 385, variance: -1611.5, variancePct: -13.2, profit: 8209.5, marginPct: 43.6, overBudget: false },
  contract: { quotedTotal: QUOTE.subtotal, quotedTotalKnown: true, approvedChanges: 385, currentContractValue: QUOTE.subtotal + 385 },
  estimatedHours: 96,
  revision: { thresholdPct: 15, decision: null, decidedAt: null, ask: false },
  estimatedAt: iso(day(-6, 15)),
  currency: COMPANY.currency,
};
const JOB_MATERIALS = {
  materials: [
    { id: "jm_1", name: "Maple plywood 3/4\" — boxes", qty: 22, actualQty: 22, unit: "sheet", materialKey: "plywood_maple_34", categoryKey: CAT_KITCHEN.key, estUnitCost: 96, actualCost: 2068, supplier: "Langevin Bois", purchasedAt: iso(day(-12, 10)), addedByHand: false, sortOrder: 0 },
    { id: "jm_2", name: "MDF shaker doors — 26", qty: 26, actualQty: 26, unit: "ea", materialKey: "door_shaker_mdf", categoryKey: CAT_KITCHEN.key, estUnitCost: 68, actualCost: 1742, supplier: "Portes Lacroix", purchasedAt: iso(day(-9, 14)), addedByHand: false, sortOrder: 1 },
    { id: "jm_3", name: "White oak, rift sawn — island", qty: 1, actualQty: 1, unit: "lot", materialKey: "oak_rift", categoryKey: CAT_KITCHEN.key, estUnitCost: 1890, actualCost: 1890, supplier: "Langevin Bois", purchasedAt: iso(day(-12, 10)), addedByHand: false, sortOrder: 2 },
    { id: "jm_4", name: "Blum soft-close hinges", qty: 52, actualQty: null, unit: "ea", materialKey: "hinge_blum", categoryKey: CAT_KITCHEN.key, estUnitCost: 6.5, actualCost: null, supplier: "Richelieu", purchasedAt: null, addedByHand: false, sortOrder: 3 },
    { id: "jm_5", name: "Pull-out waste unit — 2 bins", qty: 1, actualQty: null, unit: "ea", materialKey: null, categoryKey: null, estUnitCost: 148, actualCost: null, supplier: "Richelieu", purchasedAt: null, addedByHand: true, sortOrder: 4 },
  ],
  progress: { total: 5, bought: 3, outstanding: 2, complete: false, estimatedTotal: 6338, actualTotal: 5700 },
};
const JOB_PHOTOS = {
  photos: [
    { id: "jp_1", url: JOB_PHOTO_URLS[0], stage: "start", featured: false, caption: "Existing kitchen — before removal", createdAt: iso(day(-18, 10, 30)), annotationJson: null, annotationWidth: null, annotationHeight: null, flattenedUrl: null, annotationUpdatedAt: null, tags: [{ id: "pt_before", name: "Before", color: "#6b7280", active: true }] },
    { id: "jp_2", url: JOB_PHOTO_URLS[1], stage: "progress", featured: true, caption: "Island top — rift sawn oak, first coat", createdAt: iso(day(-2, 15, 5)), annotationJson: null, annotationWidth: null, annotationHeight: null, flattenedUrl: null, annotationUpdatedAt: null, tags: [{ id: "pt_shop", name: "In the shop", color: "#1f4e3d", active: true }] },
    { id: "jp_3", url: JOB_PHOTO_URLS[3], stage: "progress", featured: false, caption: "Doors out of the booth", createdAt: iso(day(-1, 16, 40)), annotationJson: null, annotationWidth: null, annotationHeight: null, flattenedUrl: null, annotationUpdatedAt: null, tags: [{ id: "pt_shop", name: "In the shop", color: "#1f4e3d", active: true }] },
  ],
  stages: [{ key: "start", label: "Before / start" }, { key: "progress", label: "In progress" }, { key: "finish", label: "Finished" }, { key: "issue", label: "Issue / snag" }],
  tags: [{ id: "pt_before", name: "Before", color: "#6b7280" }, { id: "pt_shop", name: "In the shop", color: "#1f4e3d" }, { id: "pt_after", name: "After", color: "#2f855a" }],
};
const JOB_TASKS = TASKS.filter((t) => t.job?.id === JOB.id);
const DAILY_LOG = {
  id: "dl_1", logDate: iso(day(-1, 17)), day: "2026-09-13", body: [{ content: [{ text: "Doors and drawer fronts sprayed and racked. Island top glued up; final sanding tomorrow morning before loading." }] }],
  bodyText: "Doors and drawer fronts sprayed and racked. Island top glued up; final sanding tomorrow morning before loading.",
  weather: null, crewCount: 2, hoursOnSite: 0, delays: null, authorUserId: LEO.userId, authorName: LEO.name, createdAt: iso(day(-1, 17)), updatedAt: iso(day(-1, 17)),
};

// ── /app/invoices/inv_2069 ──────────────────────────────────────────────────
// The Fortin laundry room, paid by card last Thursday — the page's payment
// row prints the fee Stripe kept and what was deposited (routes-work.js
// FEE_2069). app/api/invoices/[id] adds the family-wide payments list and
// chaseTrail; /lifecycle is the banner strip and the job link.
const INVOICE_DETAIL = {
  ...INV_2069,
  discount: 0,
  tax: INV_2069.taxTotal,
  taxEnabled: true,
  amountRefunded: 0,
  notes: "Thank you for choosing Érable Design. Payment by e-transfer to hello@erabledesign.ca, or by card through the link in your email.",
  clientPhotos: [],
  historicalImportedAt: null,
  sentToEmail: FORTIN.email,
  client: { id: FORTIN.id, name: FORTIN.name, contactName: null, email: FORTIN.email, phone: FORTIN.phone, country: FORTIN.country, province: FORTIN.province },
  lineItems: [
    { description: "Laundry room cabinets — 9 lin. ft, painted shaker", quantity: 9, amount: 4230 },
    { description: "Laminate counter with backsplash", quantity: 1, amount: 1260 },
    { description: "Installation", quantity: 1, amount: 830 },
  ],
  chaseTrail: { lastChasedAt: null, chaseCount: 0, automated: [] },
};
const INVOICE_LIFECYCLE = {
  job: { id: "j_315", title: "Fortin laundry room — cabinets & counter", status: "completed", completedAt: iso(day(-4, 15, 10)), quoteId: "q_1036", startDate: iso(day(-4, 8)), endDate: iso(day(-4, 15)), visits: [{ id: "v_315a", scheduledAt: iso(day(-4, 8)), status: "completed", assignedToId: ANA.userId, assignedTo: who(ANA) }], linkSource: "invoice" },
  chaseTask: null,
  banners: [{ id: "paid", tone: "success", data: { paid: INV_2069.total, paidDate: INV_2069.paidDate } }],
  money: { total: INV_2069.total, paid: INV_2069.total, due: 0 },
  canLinkJob: false,
  costing: {
    estimatedCost: 3980, estimatedAt: iso(day(-16, 9)), estimatedBasis: "saved", revenue: 6320,
    actual: { expenses: { total: 2214, byCategory: [{ category: "Materials", amount: 2214 }] }, labour: { approvedHours: 30, pendingHours: 0, cost: 1200, unratedHours: 0, workers: 1 }, total: 3414, incomplete: false },
    comparison: { estimatedCost: 3980, actualCost: 3414, revenue: 6320, variance: -566, variancePct: -14.2, profit: 2906, marginPct: 46, overBudget: false },
  },
  payroll: { periods: [{ id: "run_0913", periodStart: "2026-08-31T00:00:00.000Z", periodEnd: "2026-09-13T00:00:00.000Z", status: "approved", paidAt: null, hours: 30 }], hoursNotInAnyRun: 0, crew: [{ workerId: W.u_ana.id, userId: ANA.userId, name: ANA.name, hours: 30, hourlyRate: 40, rateHidden: false }] },
};
const INVOICE_DOCUMENT = {
  groups: [{
    id: "sg_1036a", categoryKey: CAT_KITCHEN.key, label: "Laundry room", subtotal: 6320, accent: null,
    lineItems: INVOICE_DETAIL.lineItems,
    description: "Painted shaker cabinets over and under a laminate counter, built in our Laval shop.",
    included: ["Soft-close hinges on every door", "Removal and disposal of the old cabinet", "Two-year workmanship warranty"],
    mayChange: [],
  }],
  hasTradeContent: true,
  quote: { id: "q_1036", quoteNumber: "Q-1036" },
  processSteps: [],
  glossary: [],
  processNotes: COMPANY.defaultProcessNotes,
  processNotesSource: "company",
  paymentTerms: COMPANY.paymentTerms,
  paymentSchedule: parsePaymentSchedule(COMPANY.paymentTerms),
};

// The builder client's invoice, twelve days past due and chased once — the
// page the Chase (request payment) dialog opens on.
const INVOICE_2066_DETAIL = {
  ...INV_2066,
  discount: 0,
  tax: INV_2066.taxTotal,
  taxEnabled: true,
  amountRefunded: 0,
  notes: "Net 30. Please reference INV-2066 on the transfer.",
  clientPhotos: [],
  historicalImportedAt: null,
  sentToEmail: RIVENORD.email,
  client: { id: RIVENORD.id, name: RIVENORD.name, contactName: "Louis Archambault", email: RIVENORD.email, phone: RIVENORD.phone, country: RIVENORD.country, province: RIVENORD.province },
  lineItems: [{ description: "Model-home vanities — 3 units, delivered", quantity: 3, amount: 3450 }],
  chaseTrail: { lastChasedAt: INV_2066.lastChasedAt, chaseCount: 1, automated: [{ sentAt: iso(day(-9, 8)), ruleName: "7 days past due" }] },
};
const INVOICE_2066_LIFECYCLE = {
  job: null,
  chaseTask: { id: "task_chase_2066", status: "open", dueDate: iso(day(2, 9)), title: "Chase INV-2066 — Groupe Immobilier Rive-Nord" },
  banners: [
    { id: "overdue", tone: "critical", data: { days: 12, due: INV_2066.amountDue, dueDate: INV_2066.dueDate } },
    { id: "chaseDue", tone: "warning", action: "chase", data: { dueDate: iso(day(2, 9)), due: INV_2066.amountDue } },
  ],
  money: { total: INV_2066.total, paid: 0, due: INV_2066.amountDue },
  canLinkJob: false,
  costing: null,
  payroll: null,
};
const INVOICE_2066_DOCUMENT = {
  groups: [{ id: "sg_2066", categoryKey: SERVICE_CATEGORIES[1].key, label: "Bathroom vanities", subtotal: 3450, accent: null, lineItems: INVOICE_2066_DETAIL.lineItems, description: "", included: [], mayChange: [] }],
  hasTradeContent: false,
  quote: null,
  processSteps: [],
  glossary: [],
  processNotes: null,
  processNotesSource: null,
  paymentTerms: "Net 30.",
  paymentSchedule: null,
};

// ── /accept-invitation/<id> and /signup — a stranger at the door ─────────────
// app/api/invitations/[id]: Julie invited a new installer against the
// company's licensed seats (non-negotiable #1: joining is invite-only).
export const INVITE_ID = "inv_k7d2m9";
const INVITATION = { id: INVITE_ID, email: "thomas.lefebvre@example.com", role: "employee", roleLabel: "Employee", status: "pending", orgName: COMPANY.name, expired: false, hasAccount: false };
const isSignup = (ctx) => ctx.screen?.slug === "signup";

// ── /app/clients/cl_dubois ──────────────────────────────────────────────────
const CLIENT_DETAIL = {
  ...CLIENT,
  type: "individual",
  contactName: null,
  quotes: [Q_1042],
  invoices: INVOICES.filter((i) => i.clientId === CLIENT.id),
  jobs: JOBS.filter((j) => j.clientId === CLIENT.id).map((j) => ({ id: j.id, title: j.title, jobNumber: j.jobNumber, status: j.status })),
};
const CLIENT_EQUIPMENT = {
  equipment: [
    {
      id: "eq_dubois_hinges", clientId: CLIENT.id, name: "Blum Clip-top soft-close hinges", manufacturer: "Blum", modelNumber: "71B3550", serialNumber: null, siteAddress: CLIENT.address,
      installedAt: null, warrantyEndsAt: iso(day(365 * 2)), warrantyProvider: "Érable Design (workmanship)", warrantyNotes: "Two-year workmanship warranty from installation.", installedByJobId: JOB.id, notes: null,
      createdAt: iso(day(-6)), updatedAt: iso(day(-6)),
      warranty: { state: "ok", daysRemaining: 730, endsAt: iso(day(365 * 2)) },
      services: [],
      history: { count: 0, underWarranty: 0, last: null },
    },
  ],
  tally: { expired: 0, dueSoon: 0, ok: 1, unknown: 0, total: 1 },
};

// ── /app/plans/sp_dubois ────────────────────────────────────────────────────
const PLAN_DETAIL = {
  ...PLANS[0],
  occurrences: [1, 2, 3].map((seq) => ({ id: `po_dubois_${seq}`, seq, dueDate: iso(day(365 * seq, 9)), status: "pending", total: PLANS[0].perOccurrence.total, invoiceId: null, chargeFailureMessage: null })),
};

// ── /app/payroll/run_0913 ───────────────────────────────────────────────────
// The fortnight that closed yesterday, approved this morning, paid Thursday.
// Lines and totals are routes-money.js's, so this page and the Payroll list
// agree to the cent.
const PAY_RUN_DETAIL = {
  ...PAY_RUNS[0],
  companyId: COMPANY.id,
  notes: null,
  approvedById: MARC.userId,
  createdById: MARC.userId,
  createdAt: iso(day(0, 8, 12)),
  updatedAt: iso(day(0, 8, 40)),
  canRun: true,
  lines: PAY_RUN_LINES.map((l) => ({ ...l, workerId: W[PEOPLE.find((p) => p.name === l.workerName).userId].id })),
};

// ── /app/funnels/fn_kitchen ─────────────────────────────────────────────────
const FUNNEL_DETAIL = { ...FUNNEL, companyId: COMPANY.id, createdById: JULIE.userId, company: { name: COMPANY.name, slug: SLUG, logoUrl: COMPANY.logoUrl, brandColor: COMPANY.brandColor } };
const FUNNEL_ANALYTICS = {
  starts: 212,
  completions: 14,
  conversionRate: 7,
  steps: FUNNEL_STEPS.map((s, i) => ({ id: s.id, kind: s.kind, label: s.headline || s.question || s.kind, views: [212, 148, 121, 96, 41, 14][i] ?? 0, retention: i === 0 ? null : Math.round(([212, 148, 121, 96, 41, 14][i] / [212, 148, 121, 96, 41, 14][i - 1]) * 100) })),
};

// ── /app/marketing/mc_flyers ────────────────────────────────────────────────
// The flyer route through Sainte-Rose, 40 doors; Samuel has walked 26. No
// coordinates on the stops, so the page draws its "add addresses" map
// placeholder rather than asking Google for a static map.
const STOP_STATUS = ["delivered", "delivered", "spoke", "delivered", "not_home", "delivered", "spoke", "delivered", "delivered", "not_home"];
const CAMPAIGN_DETAIL = {
  ...CAMPAIGNS[0],
  companyId: COMPANY.id,
  assignedToId: SAM.userId,
  templateId: null,
  updatedAt: iso(day(-1, 17)),
  stops: Array.from({ length: 40 }, (_, i) => ({
    id: `st_${i + 1}`, campaignId: "mc_flyers", address: `${120 + i * 4} rue de la Sapinière, Laval, QC`, latitude: null, longitude: null, sortOrder: i,
    status: i < 26 ? STOP_STATUS[i % STOP_STATUS.length] : "pending",
    spokeToOwner: i < 26 && STOP_STATUS[i % STOP_STATUS.length] === "spoke",
    notes: i === 2 ? "Wants a vanity quote — call after the 20th." : i === 6 ? "Neighbour of the Fortins; saw the laundry room." : null,
    assignedToId: SAM.userId, assignedTo: who(SAM),
    clientId: i === 6 ? FORTIN.id : null, client: i === 6 ? { id: FORTIN.id, name: FORTIN.name } : null,
    appointmentId: null, quoteId: null, createdAt: iso(day(-12, 9)), updatedAt: iso(day(-1, 17)),
  })),
};

// ── /app/messages/review ────────────────────────────────────────────────────
// lib/messaging/monthlyReview.js over the month the page asks for (it opens
// on the current one — September, two weeks in): eleven conversations,
// three won, and the two nobody answered — the figure the "reply faster"
// article hangs on. The scores' reasons carry real signal keys
// (app.messages.signal.*). Day numbers stay within the first thirteen so the
// month reads as "so far" on the 14th.
let REVIEW_YM = { year: 2026, month: 9 };
const AUG = (d, h = 10) => new Date(`${REVIEW_YM.year}-${String(REVIEW_YM.month).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:00:00-04:00`).toISOString();
const reason = (id, weight, quote, direction = "inbound") => ({ id, labelKey: `app.messages.signal.${id}`, weight, quote, direction, detail: null });
const thread = (id, name, platform, outcome, d, msgs, inbound, answered, firstMin, score) => ({
  id, participantName: name, platform, channelName: platform === "instagram" ? "@erabledesign" : platform === "facebook" ? "Érable Design Cabinetry" : "+1 450 555 0190",
  outcome, createdAt: AUG(d), lastMessageAt: AUG(Math.min(13, d + 1), 15), messageCount: msgs, inboundCount: inbound, source: platform,
  answered, firstResponseMinutes: firstMin, noInbound: false, score,
});
const reviewThreads = () => [
  thread("th_a", "Marie-Ève Lapointe", "instagram", "won", 3, 14, 7, true, 8, { temperature: "hot", score: 82, confidence: "clear", reasons: [reason("budget_stated", 25, "we've set aside about 30k for the kitchen"), reason("logistics_initiated", 20, "when could you come measure?"), reason("schedule_accommodation", 15, "we can do evenings")], disqualified: null, messageCount: 14, ai: false, scoredAt: AUG(7) }),
  thread("th_b", "Jonathan Pelletier", "facebook", "won", 5, 9, 4, true, 22, { temperature: "hot", score: 71, confidence: "clear", reasons: [reason("product_questions", 15, "is the island solid oak or veneer?"), reason("logistics_initiated", 20, "can you do the install before Thanksgiving?")], disqualified: null, messageCount: 9, ai: false, scoredAt: AUG(9) }),
  thread("th_c", "Amélie Gauthier", "sms", "won", 11, 6, 3, true, 5, { temperature: "warm", score: 58, confidence: "thin", reasons: [reason("scope_growth", 15, "and maybe the pantry too")], disqualified: null, messageCount: 6, ai: false, scoredAt: AUG(14) }),
  thread("th_d", "Éric Boisvert", "instagram", "lost", 6, 8, 4, true, 190, { temperature: "warm", score: 44, confidence: "clear", reasons: [reason("comparison_shopping", -10, "getting three quotes"), reason("budget_stated", 25, "under 20k ideally")], disqualified: null, messageCount: 8, ai: false, scoredAt: AUG(10) }),
  thread("th_e", "Sandra Nguyen", "facebook", "lost", 12, 5, 3, true, 1440, { temperature: "cold", score: 22, confidence: "clear", reasons: [reason("silence_after_quote", -20, null, "outbound"), reason("price_tier_rejection", -15, "that's more than we expected")], disqualified: null, messageCount: 5, ai: false, scoredAt: AUG(18) }),
  thread("th_f", "Patrick Morin", "sms", "no_reply", 9, 3, 2, true, 46, { temperature: "warm", score: 40, confidence: "thin", reasons: [reason("product_questions", 15, "do you do walnut?")], disqualified: null, messageCount: 3, ai: false, scoredAt: AUG(16) }),
  thread("th_g", "Geneviève Tremblay", "instagram", "no_reply", 10, 2, 2, false, null, { temperature: "warm", score: 38, confidence: "thin", reasons: [reason("logistics_initiated", 20, "are you taking new projects this fall?")], disqualified: null, messageCount: 2, ai: false, scoredAt: AUG(21) }),
  thread("th_h", "Mathieu Roy", "facebook", "no_reply", 13, 1, 1, false, null, { temperature: "cold", score: 18, confidence: "thin", reasons: [], disqualified: null, messageCount: 1, ai: false, scoredAt: AUG(25) }),
  thread("th_i", "Louise Bergeron", "sms", "not_a_job", 8, 4, 2, true, 12, { temperature: "cold", score: 5, confidence: "clear", reasons: [], disqualified: { labelKey: "app.messages.signal.out_of_area", quote: "we're in Sherbrooke" }, messageCount: 4, ai: false, scoredAt: AUG(9) }),
  thread("th_j", "Simon Lavallée", "instagram", null, 12, 6, 3, true, 15, { temperature: "warm", score: 52, confidence: "thin", reasons: [reason("budget_stated", 25, "around 25k"), reason("polite_pre_decline", -10, "we'll think about it")], disqualified: null, messageCount: 6, ai: false, scoredAt: AUG(29) }),
  thread("th_k", "Caroline Dubé", "facebook", null, 13, 4, 2, true, 31, { temperature: "warm", score: 47, confidence: "thin", reasons: [reason("product_questions", 15, "what paint do you use on the doors?")], disqualified: null, messageCount: 4, ai: false, scoredAt: AUG(30) }),
];
const median = (xs) => { const a = xs.filter((x) => Number.isFinite(x)).sort((x, y) => x - y); if (!a.length) return null; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const OUTCOMES = ["won", "lost", "no_reply", "not_a_job", "unset"];
const monthlyReview = (year, month) => {
  REVIEW_YM = { year, month };
  const REVIEW_THREADS = reviewThreads();
  const judged = REVIEW_THREADS.filter((r) => r.outcome).length;
  return {
  ok: true,
  month: `${year}-${String(month).padStart(2, "0")}`,
  range: { start: AUG(1, 0), end: new Date(Date.UTC(year, month, 1) - 1).toISOString() },
  totals: { started: REVIEW_THREADS.length, answered: REVIEW_THREADS.filter((r) => r.answered).length, neverAnswered: REVIEW_THREADS.filter((r) => !r.answered).length, noInbound: 0, judged },
  byOutcome: Object.fromEntries(OUTCOMES.map((o) => [o, REVIEW_THREADS.filter((r) => (r.outcome || "unset") === o).length])),
  // A fraction: the page multiplies by a hundred.
  wonRate: 3 / judged,
  medianFirstResponseMinutes: median(REVIEW_THREADS.filter((r) => r.answered).map((r) => r.firstResponseMinutes)),
  responseByOutcome: Object.fromEntries(OUTCOMES.map((o) => {
    const rows = REVIEW_THREADS.filter((r) => (r.outcome || "unset") === o);
    return [o, { answered: rows.filter((r) => r.answered).length, unanswered: rows.filter((r) => !r.answered).length, medianMinutes: median(rows.filter((r) => r.answered).map((r) => r.firstResponseMinutes)) }];
  })),
  neverAnswered: REVIEW_THREADS.filter((r) => !r.answered),
  threads: REVIEW_THREADS,
  ranked: [...REVIEW_THREADS].sort((a, b) => (b.score?.score || 0) - (a.score?.score || 0)),
  };
};
const REVIEW_AI = {
  connection: { connected: true },
  review: null,
  available: true,
  price: { estimatedTokens: 18400, estimated: 0.06, remaining: 412000, cap: 500000, allowed: true },
  sample: { sampled: 11, won: 3, unmatched: 0 },
};

// ═══════════════════════════════════════════════════════════════════════════
// The crew's phone — Léo Bouchard, Crew preset
// ═══════════════════════════════════════════════════════════════════════════
// What the same routes answer when the caller is Léo: the money routes
// refuse (the real ones 403 a Crew member — lib/permissions/apiGate.js), the
// clock and the leave routes resolve the worker from the session and answer
// HIS punches and HIS balances, and the safety list is the incident he
// filed.
const LEO_OPEN = TIME_ENTRIES.find((e) => e.id === "te_20");
const CREW_CLOCK = {
  worker: { id: W.u_leo.id, name: LEO.name },
  open: { id: LEO_OPEN.id, clockIn: LEO_OPEN.clockIn, jobId: JOB.id, job: { id: JOB.id, title: JOB.title } },
  today: [{ ...LEO_OPEN, clockOut: null, hours: null, status: "pending" }],
  todayHours: 5.5,
  jobOptions: CLOCK.jobOptions,
  todayCount: 1,
  suggestedJobId: JOB.id,
  truncated: false,
};
const CREW_LEAVE = {
  scope: "self",
  worker: { id: W.u_leo.id, name: LEO.name },
  policies: POLICIES,
  requests: TEAM_REQUESTS.filter((r) => r.workerId === W.u_leo.id),
  balances: TEAM_BALANCES.filter((b) => b.workerId === W.u_leo.id),
};
const CREW_TIME_ENTRIES = TIME_ENTRIES.filter((e) => e.workerId === W.u_leo.id);
// The job as the crew sees it: their visits and the address, no client
// contact details beyond the name (clientsProperties: name_address_only),
// no money — redactJob strips the quote link and the stage amounts.
const CREW_JOB = {
  ...JOB_DETAIL,
  total: undefined,
  quote: null,
  client: { name: CLIENT.name, address: CLIENT.address, city: CLIENT.city, province: CLIENT.province, restricted: true },
  paymentStages: [],
  changeOrders: [],
};
const crewOr = (mine, theirs) => (ctx) => (isCrew(ctx) ? mine(ctx) : theirs(ctx));

export const ROUTES_HELP = [
  // ── The crew's phone: the same routes, Léo's answers ────────────────────
  { path: "/api/settings/members/self/role", reply: crewOr(() => ({ assignableRoles: [], canGrantAccess: false, yourRole: "employee", role: "employee" }), () => ({ assignableRoles: ["admin", "supervisor", "employee"], canGrantAccess: true, yourRole: "owner", role: "owner" })) },
  { path: "/api/analytics/overview", reply: crewOr(forbidden, (ctx) => ctx.next()) },
  { path: "/api/analytics/receivables", reply: crewOr(forbidden, (ctx) => ctx.next()) },
  { path: "/api/analytics/goal", reply: crewOr(forbidden, (ctx) => ctx.next()) },
  { path: "/api/quotes", method: "GET", reply: crewOr(forbidden, (ctx) => ctx.next()) },
  { path: "/api/invoices", method: "GET", reply: crewOr(forbidden, (ctx) => ctx.next()) },
  { path: "/api/leads", method: "GET", reply: crewOr(forbidden, (ctx) => ctx.next()) },
  { path: "/api/bookings/awaiting-payment", reply: crewOr(forbidden, (ctx) => ctx.next()) },
  { path: "/api/quotes/estimate-reviews", reply: crewOr(forbidden, (ctx) => ctx.next()) },
  { path: "/api/voice/calls", reply: crewOr(forbidden, (ctx) => ctx.next()) },
  { path: "/api/migrations", reply: crewOr(forbidden, (ctx) => ctx.next()) },
  { path: "/api/time-clock", method: "GET", reply: crewOr(() => CREW_CLOCK, () => CLOCK) },
  { path: "/api/time-entries", method: "GET", reply: crewOr(() => CREW_TIME_ENTRIES, () => TIME_ENTRIES) },
  { path: "/api/leave", method: "GET", reply: crewOr((ctx) => (ctx.search.get("scope") === "team" ? forbidden() : CREW_LEAVE), (ctx) => ctx.next()) },
  { path: "/api/safety-incidents", method: "GET", reply: crewOr(() => ({ incidents: INCIDENTS.filter((i) => i.reportedByMemberId === LEO.id) }), (ctx) => ctx.next()) },

  // ── The back office's detail pages ──────────────────────────────────────
  { path: `/api/quotes/${QUOTE.id}`, method: "GET", reply: () => QUOTE_DETAIL },
  { path: `/api/quotes/${QUOTE.id}/document`, method: "GET", reply: () => QUOTE_DOCUMENT },
  { path: `/api/quotes/${QUOTE.id}/costing`, method: "GET", reply: () => QUOTE_COSTING },
  { path: `/api/quotes/${QUOTE.id}/email-sections`, method: "GET", reply: () => EMAIL_SECTIONS },
  { path: `/api/quotes/${QUOTE.id}/imports`, method: "GET", reply: () => ({ asSource: [], asImporter: [] }) },
  { path: `/api/quotes/${Q_1044.id}`, method: "GET", reply: () => QUOTE_1044_DETAIL },
  { path: `/api/quotes/${Q_1044.id}/document`, method: "GET", reply: () => QUOTE_1044_DOCUMENT },
  { path: `/api/quotes/${Q_1044.id}/costing`, method: "GET", reply: forbidden },
  { path: `/api/quotes/${Q_1044.id}/email-sections`, method: "GET", reply: () => ({ ...EMAIL_SECTIONS, quoteId: Q_1044.id }) },
  { path: `/api/quotes/${Q_1044.id}/imports`, method: "GET", reply: () => ({ asSource: [], asImporter: [] }) },
  { path: `/api/jobs/${JOB.id}`, method: "GET", reply: crewOr(() => CREW_JOB, () => JOB_DETAIL) },
  { path: `/api/jobs/${JOB.id}/costing`, method: "GET", reply: crewOr(forbidden, () => JOB_COSTING) },
  { path: `/api/jobs/${JOB.id}/subcontractors`, method: "GET", reply: crewOr(forbidden, () => ({ rows: [], roster: [], visits: JOB_DETAIL.visits.map((v) => ({ id: v.id, scheduledAt: v.scheduledAt })), imports: [], canManage: true, canSeeMoney: true })) },
  { path: `/api/jobs/${JOB.id}/change-orders/bill`, method: "GET", reply: crewOr(forbidden, () => ({ canBill: true, reason: null, unbilled: { count: 1, total: 385 }, invoice: { id: INVOICE.id, invoiceNumber: INVOICE.invoiceNumber, status: INVOICE.status }, preview: { added: 442.65, newTotal: round2(INVOICE.total + 442.65) } })) },
  { path: `/api/jobs/${JOB.id}/materials`, method: "GET", reply: crewOr(() => ({ materials: JOB_MATERIALS.materials.map(({ estUnitCost, actualCost, ...m }) => ({ ...m, costHidden: true })), progress: { total: 5, bought: 3, outstanding: 2, complete: false, costHidden: true } }), () => JOB_MATERIALS) },
  { path: `/api/jobs/${JOB.id}/asset-use`, method: "GET", reply: () => ({ logs: [], assets: [] }) },
  { path: `/api/jobs/${JOB.id}/documents`, method: "GET", reply: crewOr(() => ({ chains: [], hiddenCount: 0, canUpload: false, canSeeMoney: false }), () => ({ chains: [{ id: "doc_1", current: { id: "doc_1", name: "Dubois — shop drawings v2.pdf", kind: "plan", url: "#", sizeBytes: 1843200, mimeType: "application/pdf", supersedesId: "doc_0", uploadedById: SAM.userId, uploadedAt: iso(day(-9, 11)), updatedAt: iso(day(-9, 11)) }, history: [{ id: "doc_0", name: "Dubois — shop drawings v1.pdf", kind: "plan", url: "#", sizeBytes: 1790000, mimeType: "application/pdf", supersedesId: null, uploadedById: SAM.userId, uploadedAt: iso(day(-14, 16)), updatedAt: iso(day(-14, 16)) }] }], hiddenCount: 0, canUpload: true, canSeeMoney: true })) },
  { path: `/api/jobs/${JOB.id}/daily-logs`, method: "GET", reply: () => ({ logs: [DAILY_LOG], day: { key: "2026-09-14", log: null, photoCount: 0, taskLines: [] } }) },
  { path: `/api/jobs/${JOB.id}/photos`, method: "GET", reply: () => JOB_PHOTOS },
  { path: "/api/tasks", method: "GET", reply: (ctx) => (ctx.search.get("jobId") === JOB.id ? JOB_TASKS : ctx.next()) },
  { path: `/api/invoices/${INV_2069.id}`, method: "GET", reply: () => INVOICE_DETAIL },
  { path: `/api/invoices/${INV_2069.id}/lifecycle`, method: "GET", reply: () => INVOICE_LIFECYCLE },
  { path: `/api/invoices/${INV_2069.id}/document`, method: "GET", reply: () => INVOICE_DOCUMENT },
  { path: `/api/invoices/${INV_2066.id}`, method: "GET", reply: () => INVOICE_2066_DETAIL },
  { path: `/api/invoices/${INV_2066.id}/lifecycle`, method: "GET", reply: () => INVOICE_2066_LIFECYCLE },
  { path: `/api/invoices/${INV_2066.id}/document`, method: "GET", reply: () => INVOICE_2066_DOCUMENT },
  { path: /^\/api\/invoices\/[^/]+\/credit-visit-fee$/, method: "GET", reply: () => ({ eligible: [], applied: [] }) },
  // A stranger on /signup has no company: business-info refuses and there is
  // no session, which is what puts the page on its first step.
  { path: "/api/settings/business-info", method: "GET", reply: (ctx) => (isSignup(ctx) ? new Response(JSON.stringify({ error: "Not signed in" }), { status: 401, headers: { "Content-Type": "application/json" } }) : ctx.next()) },
  { path: "/api/signup/resume", method: "GET", reply: () => ({ resume: false, company: null }) },
  { path: "/api/auth/get-session", method: "GET", reply: () => new Response("null", { status: 200, headers: { "Content-Type": "application/json" } }) },
  { path: `/api/invitations/${INVITE_ID}`, method: "GET", reply: () => INVITATION },
  // /signup: the sellable plans (app/api/marketing/plans) and the trade
  // catalogue (app/api/service-categories/public) — the same rows Settings ›
  // Account & billing and Settings › Services draw.
  { path: "/api/marketing/plans", method: "GET", reply: () => ({ plans: BILLING_PLANS.map(({ isPublic, stripePriceId, stripePriceIdAnnual, ...plan }) => plan), unavailable: false }) },
  { path: "/api/service-categories/public", method: "GET", reply: () => SERVICE_CATEGORIES.filter((c) => c.isSystem).map((c) => ({ id: c.id, key: c.key, label: c.label, icon: c.icon })) },
  // /app/jobs/import asks what an empty batch would default to.
  { path: "/api/jobs/import/preview", method: "POST", reply: () => ({ rows: [], summary: { total: 0, ready: 0, blocked: 0, duplicates: 0, defaultTaxApplied: true } }) },
  { path: "/api/invoices/costing", method: "GET", reply: () => ({ saved: null }) },
  { path: `/api/clients/${CLIENT.id}`, method: "GET", reply: () => CLIENT_DETAIL },
  { path: `/api/clients/${CLIENT.id}/equipment`, method: "GET", reply: () => CLIENT_EQUIPMENT },
  { path: `/api/service-plans/${PLANS[0].id}`, method: "GET", reply: () => PLAN_DETAIL },
  { path: `/api/payroll/runs/${PAY_RUNS[0].id}`, method: "GET", reply: () => PAY_RUN_DETAIL },
  { path: `/api/funnels/${FUNNEL.id}`, method: "GET", reply: () => FUNNEL_DETAIL },
  { path: `/api/funnels/${FUNNEL.id}/analytics`, method: "GET", reply: () => FUNNEL_ANALYTICS },
  { path: `/api/marketing/campaigns/${CAMPAIGNS[0].id}`, method: "GET", reply: () => CAMPAIGN_DETAIL },
  { path: "/api/messaging/review", method: "GET", reply: ({ search }) => ({ connection: { connected: true }, review: monthlyReview(Number(search.get("year")) || 2026, Number(search.get("month")) || 9) }) },
  { path: "/api/messaging/review/ai", method: "GET", reply: () => REVIEW_AI },

  // Client-facing
  { path: `/api/public/quotes/${QUOTE_TOKEN}`, method: "GET", reply: (ctx) => publicQuote(ctx) },
  { path: `/api/quotes/received/${QUOTE_TOKEN}`, method: "GET", status: 404, reply: () => ({ error: "Not a contractor's quote" }) },
  { path: `/api/portal/${PORTAL_TOKEN}`, method: "GET", reply: (ctx) => portal(ctx) },
  { path: `/api/booking/${SLUG}`, method: "GET", reply: () => bookingCompany() },
  { path: `/api/booking/${SLUG}/members`, method: "GET", reply: () => ({ company: { name: COMPANY.name, logoUrl: COMPANY.logoUrl, brandColor: COMPANY.brandColor }, members: [] }) },
  { path: `/api/booking/${SLUG}/availability`, method: "GET", reply: ({ search }) => {
    const et = EVENT_TYPES.find((e) => e.slug === search.get("eventTypeSlug")) || EVENT_TYPES[0];
    return { eventType: { name: et.name, durationMinutes: et.durationMinutes, location: et.location }, slots: slotsBetween(search.get("from") || "2026-09-14", search.get("to") || "2026-09-30"), travel: null };
  } },
  { path: `/api/visit/${VISIT_TOKEN}`, method: "GET", reply: (ctx) => visitView(ctx) },
  { path: `/api/visit/${VISIT_TOKEN}/reschedule`, method: "GET", reply: ({ search }) => ({ slots: slotsBetween(search.get("from") || "2026-09-14", search.get("to") || "2026-09-30") }) },
  { path: `/api/self-quote/${SLUG}`, method: "GET", reply: (ctx) => selfQuote(ctx) },
  { path: `/api/instant-quote/${SLUG}`, method: "GET", reply: (ctx) => instantQuote(ctx) },
  { path: `/api/funnels/public/${SLUG}/${FUNNEL.slug}`, method: "GET", reply: () => publicFunnel() },
  { path: `/api/funnels/public/${SLUG}/${FUNNEL.slug}/event`, method: "POST", reply: () => ({ ok: true }) },
  { path: `/api/kitchen-design/${DESIGN_TOKEN}`, method: "GET", reply: () => kitchenDesign() },
];
