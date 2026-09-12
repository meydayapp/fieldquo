// Fixture routes for the settings-a screens. See routes.js for the entry shape.
//
// Settings → Account (migration, product updates), Business (company,
// branding, language, activity), Team & scheduling (availability, leave,
// booking page, work areas) and Services & pricing (products, services,
// material costs, cabinet rates, overhead, custom fields), answered from the
// fixture company: a cabinet shop in Laval with a real rate card, a real
// overhead sheet and a real price floor computed from it.
//
// Where a route's server handler derives a figure (depreciation, the price
// floor, labour utilisation, bill status), the same pure helper the handler
// calls is called here, so a number on the photograph is the number the
// product would print for these rows — not one typed to look right.
import { COMPANY, PEOPLE, CLIENT, QUOTE, JOB, INVOICE, day, iso, TODAY } from "./company.js";
import { LANGUAGES } from "@/app/i18n/languages";
import { LEAVE_TEMPLATES, LEAVE_REGIONS } from "@/lib/leave/policyTemplates";
import { getPriceBook, defaultTradeRate } from "@/app/data/tradePriceBooks";
import { resolveServiceContent } from "@/lib/documents/serviceContent";
import { toStoredFields } from "@/app/data/intakeFieldLibrary";
import { getRecipe } from "@/app/data/materialRecipes";
import { normaliseRates, DEFAULT_CABINET_RATES, DOOR_MATERIALS, BOX_MATERIALS } from "@/lib/kitchen/pricing";
import { assetCharge, assetOverhead, doubleCountWarning } from "@/lib/accounting/depreciation";
import { billStatus, summariseBills } from "@/lib/accounting/bills";
import { labourUtilisation } from "@/lib/costing/utilisation";

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// ── Who's who, in the shape /api/settings/members really returns ──────────
// The route includes `user: { id, name, email, image }` on every row; the
// Work Areas and Availability screens read `m.user.name`, not `m.name`.
const MEMBERS = PEOPLE.map((p) => ({
  ...p,
  user: { id: p.userId, name: p.name, email: p.email, image: null },
  lastLoginAt: iso(day(-1, 17)),
}));

// The company's trade, as signup files it. The trade catalogue
// (lib/trades/catalog.js) keeps the three cabinet trades under the "painting"
// industry preset — that is where a cabinet shop lands when it signs up —
// and the Company page prints the preset's label, so this is what the
// fixture company says about itself rather than a slug the catalogue has
// never heard of.
const BUSINESS_INFO = {
  ...COMPANY,
  industries: ["painting"],
  // The scope-of-work text every new quote starts from (Company Settings →
  // "Scope of work and terms"); routes-core.js leaves it blank.
  defaultProcessNotes:
    "We measure on site, then build every box and door in our Laval shop. Doors are sprayed in the booth, never on site. Installation takes two days for a typical kitchen: day one we remove the old cabinets and set the boxes level and plumb; day two we hang doors, fit drawers, adjust hinges and install hardware. Countertops, plumbing and electrical reconnection are not included unless a line above says so.",
  // The booking page's meeting modes are visit | call | video
  // (app/app/settings/booking-page/page.js MODES); the core row carries
  // estimate/consultation, which that screen has no chip for.
  bookingModes: ["visit", "call"],
  // Company.businessHours is stored as lib/company/businessHours.js
  // normaliseHours reads it — one row per weekday, 0 = Sunday — not the
  // mon/tue map company.js carries, which the Opening hours editor renders
  // as seven closed days.
  businessHours: [
    { day: 0, closed: true, open: "09:00", close: "17:00" },
    { day: 1, closed: false, open: "08:00", close: "17:00" },
    { day: 2, closed: false, open: "08:00", close: "17:00" },
    { day: 3, closed: false, open: "08:00", close: "17:00" },
    { day: 4, closed: false, open: "08:00", close: "17:00" },
    { day: 5, closed: false, open: "08:00", close: "16:00" },
    { day: 6, closed: true, open: "09:00", close: "13:00" },
  ],
};

// ── Service categories (Settings → Services, and every page that filters by
// quote type) ────────────────────────────────────────────────────────────────
const systemCategory = (key, label, icon, sortOrder, enabled, unit = null) => ({
  id: `sc_${key}`,
  key,
  label,
  icon,
  isSystem: true,
  customFields: null,
  enabled,
  unit,
  inheritedUnit: defaultTradeRate(key)?.unit ?? null,
  defaultRate: null,
  inheritedRate: defaultTradeRate(key)?.rate ?? null,
  priceBook: getPriceBook(key, null) || null,
  rateOverrides: null,
  content: resolveServiceContent(key, null),
  contentOverrides: { includedItems: null, processSteps: null, scopeDescription: null },
  sortOrder,
});
const customCategory = (id, label, fieldKeys, unit, rate) => ({
  id,
  key: id,
  label,
  icon: "Sparkles",
  isSystem: false,
  customFields: toStoredFields(fieldKeys),
  enabled: true,
  unit,
  inheritedUnit: null,
  defaultRate: rate,
  inheritedRate: null,
  priceBook: null,
  rateOverrides: null,
  content: resolveServiceContent(id, null),
  contentOverrides: { includedItems: null, processSteps: null, scopeDescription: null },
});
export const SERVICE_CATEGORIES = [
  customCategory("sc_kitchen_cabinets", "Kitchen cabinets", ["doorCount", "drawerCount", "boxLinearFt"], "linear ft", 610),
  customCategory("sc_bathroom_vanities", "Bathroom vanities", ["doorCount", "drawerCount"], "each", 1850),
  customCategory("sc_builtins_closets", "Built-ins & closets", ["boxLinearFt"], "linear ft", 480),
  systemCategory("cabinet_refinishing", "Cabinet Refinishing", "Paintbrush", 1, true),
  systemCategory("cabinet_refacing", "Cabinet Refacing", "Layers", 2, true),
  systemCategory("countertop", "Countertop Installation", "Square", 3, false),
  systemCategory("flooring", "Flooring", "Grid3x3", 4, false),
  systemCategory("stairs", "Stairs", "TrendingUp", 5, false),
  systemCategory("interior_painting", "Interior Painting", "Paintbrush", 6, false),
  systemCategory("exterior_painting", "Exterior Painting", "Home", 7, false),
];
const cat = (id) => {
  const c = SERVICE_CATEGORIES.find((x) => x.id === id);
  return { id: c.id, label: c.label };
};

// ── Price book (Settings → Products & Services) ───────────────────────────
const PRODUCTS = [
  { id: "pr_upper", name: "Upper cabinets — shaker, painted", description: "Painted MDF shaker doors, soft-close hinges, 30\" or 36\" high", type: "service", unitPrice: 425, costPrice: 262, unit: "lin. ft", active: true, categories: [cat("sc_kitchen_cabinets")] },
  { id: "pr_base", name: "Base cabinets — shaker, painted", description: "Dovetail maple drawer boxes, full-extension soft-close slides", type: "service", unitPrice: 520, costPrice: 318, unit: "lin. ft", active: true, categories: [cat("sc_kitchen_cabinets")] },
  { id: "pr_island", name: "Island — white oak, rift sawn", description: "Up to 7 ft, waterfall end optional, finished all sides", type: "service", unitPrice: 4200, costPrice: 2650, unit: "ea", active: true, categories: [cat("sc_kitchen_cabinets")] },
  { id: "pr_hinge", name: "Soft-close hinge", description: "Blum Clip-top 110°, supplied and fitted", type: "product", unitPrice: 14.5, costPrice: 7.9, unit: "ea", active: true, categories: [cat("sc_kitchen_cabinets"), cat("sc_bathroom_vanities"), cat("sc_cabinet_refacing")] },
  { id: "pr_drawer", name: "Drawer box — dovetail maple", description: "5/8\" solid maple, Baltic birch bottom, clear coat", type: "product", unitPrice: 165, costPrice: 88, unit: "ea", active: true, categories: [cat("sc_kitchen_cabinets"), cat("sc_bathroom_vanities"), cat("sc_builtins_closets")] },
  { id: "pr_install", name: "Installation day", description: "Two installers, one day, levelling and scribing included", type: "service", unitPrice: 830, costPrice: 560, unit: "day", active: true, categories: [] },
].map((p) => ({ ...p, translations: null, companyId: COMPANY.id, createdAt: iso(day(-200)) }));

// ── Booking page ──────────────────────────────────────────────────────────
const EVENT_TYPES = [
  { id: "et_consult", companyId: COMPANY.id, userId: PEOPLE[2].userId, user: { id: PEOPLE[2].userId, name: PEOPLE[2].name }, name: "Kitchen design consultation", slug: "kitchen-design-consultation", durationMinutes: 60, bufferBefore: 0, bufferAfter: 15, location: "At your home", active: true, feeCents: null, promoFeeCents: null, promoActive: false, createdAt: iso(day(-180)) },
  { id: "et_measure", companyId: COMPANY.id, userId: PEOPLE[2].userId, user: { id: PEOPLE[2].userId, name: PEOPLE[2].name }, name: "Measurement visit", slug: "measurement-visit", durationMinutes: 45, bufferBefore: 0, bufferAfter: 15, location: "At your home", active: true, feeCents: 7500, promoFeeCents: 4900, promoActive: true, createdAt: iso(day(-180)) },
];

// ── Work areas ────────────────────────────────────────────────────────────
const assign = (waId, ...people) =>
  people.map((p) => ({ id: `waa_${waId}_${p.userId}`, workAreaId: waId, userId: p.userId, user: { id: p.userId, name: p.name }, assignedAt: iso(day(-100)) }));
const WORK_AREAS = [
  { id: "wa_laval", companyId: COMPANY.id, name: "Laval", description: "Home base — Chomedey, Sainte-Rose, Vimont, Duvernay", createdAt: iso(day(-300)), assignments: assign("wa_laval", PEOPLE[2], PEOPLE[4]), _count: { tasks: 4 } },
  { id: "wa_island", companyId: COMPANY.id, name: "Montréal island", description: "Ahuntsic to Westmount; downtown by appointment", createdAt: iso(day(-300)), assignments: assign("wa_island", PEOPLE[2], PEOPLE[5]), _count: { tasks: 2 } },
  { id: "wa_north", companyId: COMPANY.id, name: "Montréal North Shore", description: "Terrebonne, Blainville, Boisbriand, Saint-Eustache", createdAt: iso(day(-300)), assignments: assign("wa_north", PEOPLE[3], PEOPLE[4]), _count: { tasks: 1 } },
];

// ── Availability (bookable hours) and working hours (the shift) ───────────
// Two tables on purpose — see app/app/settings/availability/page.js. Marc is
// bookable 9–4 inside an 8–5 shift; the crew keep the shift and no booking
// hours, which is what keeps them off the public booking page.
const weekdays = (userId, startTime, endTime, prefix) =>
  [1, 2, 3, 4, 5].map((dayOfWeek) => ({ id: `${prefix}_${userId}_${dayOfWeek}`, userId, dayOfWeek, startTime, endTime, timezone: "America/Toronto", createdAt: iso(day(-300)) }));
const BOOKABLE = {
  [PEOPLE[0].userId]: weekdays(PEOPLE[0].userId, "09:00", "16:00", "av"),
  [PEOPLE[2].userId]: weekdays(PEOPLE[2].userId, "08:30", "16:30", "av"),
};
const WORKING = Object.fromEntries(
  PEOPLE.map((p) => [p.userId, weekdays(p.userId, "08:00", p.userId === PEOPLE[0].userId ? "17:00" : "16:30", "wh")]),
);

// ── Leave policies ────────────────────────────────────────────────────────
const LEAVE_POLICIES = [
  { id: "lp_vacation", companyId: COMPANY.id, name: "Vacation", kind: "vacation", paid: true, accrualMethod: "annual_allotment", annualDays: 15, percentOfGross: null, carryoverMaxDays: 5, requiresApproval: true, active: true, createdAt: iso(day(-250)), updatedAt: iso(day(-250)), _count: { requests: 7 } },
  { id: "lp_sick", companyId: COMPANY.id, name: "Sick leave", kind: "sick", paid: true, accrualMethod: "annual_allotment", annualDays: 5, percentOfGross: null, carryoverMaxDays: 0, requiresApproval: false, active: true, createdAt: iso(day(-250)), updatedAt: iso(day(-250)), _count: { requests: 3 } },
];

// ── Custom fields ─────────────────────────────────────────────────────────
const CUSTOM_FIELDS = [
  { id: "cf_door_style", companyId: COMPANY.id, entityType: "quote", label: "Door style", fieldType: "dropdown", options: ["Shaker", "Slab", "Raised panel", "Beaded shaker"], required: true, sortOrder: 0, createdAt: iso(day(-200)) },
  { id: "cf_finish", companyId: COMPANY.id, entityType: "quote", label: "Finish", fieldType: "dropdown", options: ["Painted", "Stained", "Clear coat", "Thermofoil"], required: true, sortOrder: 1, createdAt: iso(day(-200)) },
  { id: "cf_hardware", companyId: COMPANY.id, entityType: "quote", label: "Hardware finish", fieldType: "text", options: null, required: false, sortOrder: 2, createdAt: iso(day(-200)) },
];

// ── Overhead: the shop's fixed costs, people, loans and assets ────────────
const FIXED_COSTS = [
  { id: "fc_rent", category: "Shop rent — 1420 boul. Curé-Labelle", amount: 3200, frequency: "monthly", notes: "2,400 sq ft shop + spray booth" },
  { id: "fc_insurance", category: "Liability + shop insurance", amount: 4680, frequency: "yearly", notes: null },
  { id: "fc_software", category: "Software and phone", amount: 310, frequency: "monthly", notes: null },
  { id: "fc_utilities", category: "Hydro and heating", amount: 540, frequency: "monthly", notes: null },
];
const SALARIES = [
  { id: "sal_julie", companyId: COMPANY.id, workerId: "w_julie", worker: { id: "w_julie", name: PEOPLE[1].name }, name: "Julie Gagnon — shop manager", amount: 4600, frequency: "monthly", hoursPerWeek: null, active: true, createdAt: iso(day(-300)) },
  { id: "sal_sam", companyId: COMPANY.id, workerId: "w_sam", worker: { id: "w_sam", name: PEOPLE[2].name }, name: "Samuel Roy — estimator", amount: 32, frequency: "hourly", hoursPerWeek: 37.5, active: true, createdAt: iso(day(-220)) },
];
const DEBTS = [
  { id: "debt_van", companyId: COMPANY.id, name: "Ford Transit loan — Desjardins", principal: 48000, interestRate: 6.9, monthlyPayment: 950, startDate: iso(day(-540)), active: true, createdAt: iso(day(-540)) },
];
const ASSET_ROWS = [
  { id: "as_van", companyId: COMPANY.id, name: "2025 Ford Transit 250", cost: 62000, salvageValue: 14000, inServiceDate: iso(day(-540)), usefulLifeMonths: 60, disposedOn: null, active: true, debtId: "debt_van", notes: null, category: "vehicle", debt: { id: "debt_van", name: DEBTS[0].name, monthlyPayment: DEBTS[0].monthlyPayment } },
  { id: "as_cnc", companyId: COMPANY.id, name: "CNC router — 4×8 table", cost: 38500, salvageValue: 6000, inServiceDate: iso(day(-400)), usefulLifeMonths: 84, disposedOn: null, active: true, debtId: null, notes: "Bought outright", category: "power_tool", debt: null },
];
const ASSETS = ASSET_ROWS.map((row) => {
  const charge = assetCharge(row, TODAY);
  return {
    ...row,
    monthlyDepreciation: round2(charge.monthly),
    accumulatedDepreciation: round2(charge.accumulated),
    bookValue: round2(charge.bookValue),
    chargeable: charge.chargeable,
    chargeReason: charge.reason,
  };
});
const BILLS = [
  { id: "bill_lumber", category: "Bois Expert — white oak, rift sawn", amount: 2840.5, dueDate: iso(day(4)), paidAt: null, notes: "Dubois island stock", isOverhead: false },
  { id: "bill_hydro", category: "Hydro-Québec", amount: 512.3, dueDate: iso(day(-3)), paidAt: null, notes: null, isOverhead: true },
  { id: "bill_finish", category: "Sherwin-Williams — 2K lacquer", amount: 690, dueDate: iso(day(11)), paidAt: null, notes: null, isOverhead: false },
  { id: "bill_rent", category: "Shop rent — September", amount: 3200, dueDate: iso(day(-13)), paidAt: iso(day(-14)), notes: null, isOverhead: true },
];
const JOBS_PER_WEEK = 1.5;

// The price floor, the way /api/analytics/minimum-price computes it:
// lib/analytics/burnRate.js combineBurnRate + lib/analytics/minimumPrice.js
// priceFromBurn. Both import the database module, so their arithmetic is
// restated here line for line (monthly factors from FREQUENCY_TO_MONTHLY,
// 4.33 weeks a month) on top of the depreciation helper they share.
function minimumPrice() {
  const factor = { one_time: 0, weekly: 4.33, monthly: 1, yearly: 1 / 12, hourly: 0 };
  const monthlyOverhead = FIXED_COSTS.reduce((s, e) => s + e.amount * (factor[e.frequency] || 0), 0);
  const monthlySalaries = SALARIES.reduce(
    (s, r) => s + (r.frequency === "hourly" ? r.amount * (r.hoursPerWeek || 0) * 4.33 : r.amount * (factor[r.frequency] || 0)),
    0,
  );
  const monthlyDebt = DEBTS.reduce((s, d) => s + d.monthlyPayment, 0);
  const capital = assetOverhead({ assets: ASSET_ROWS, debts: DEBTS, asOf: TODAY });
  const totalMonthlyBurn = monthlyOverhead + monthlySalaries + monthlyDebt;
  const totalMonthlyCost = monthlyOverhead + monthlySalaries + capital.monthlyCost;
  const jobsPerMonth = JOBS_PER_WEEK * 4.33;
  const targetMargin = 0.2;
  const costPerJob = totalMonthlyCost / jobsPerMonth;
  return {
    monthlyFixedCosts: round2(totalMonthlyCost),
    monthlyCashOut: round2(totalMonthlyBurn),
    doubleCountRisk: doubleCountWarning(capital, DEBTS),
    interestOnlyDebtIds: capital.interestOnlyDebtIds,
    jobsPerMonth: Math.round(jobsPerMonth * 10) / 10,
    costPerJob: round2(costPerJob),
    targetMargin,
    minimumPrice: round2(costPerJob / (1 - targetMargin)),
    breakdown: {
      overhead: round2(monthlyOverhead),
      salaries: round2(monthlySalaries),
      debt: round2(monthlyDebt),
      debtInterest: capital.debtInterest,
      debtChargedInFull: capital.debtPrincipalCharged,
      depreciation: capital.depreciation,
    },
  };
}

function utilisation(days) {
  const weeks = days / 7;
  const workers = [
    { id: "w_leo", name: PEOPLE[4].name, workType: "field", scheduledHoursPerWeek: 40, hourlyRate: 28 },
    { id: "w_ana", name: PEOPLE[5].name, workType: "field", scheduledHoursPerWeek: 40, hourlyRate: 26 },
    { id: "w_sam", name: PEOPLE[2].name, workType: "field", scheduledHoursPerWeek: 37.5, hourlyRate: 32 },
  ];
  const jobHoursById = { w_leo: 152, w_ana: 141.5, w_sam: 96 };
  const to = TODAY;
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { ...labourUtilisation({ workers, jobHoursById, weeks }), days, from: iso(from), to: iso(to), currency: COMPANY.currency };
}

// ── The paid data-migration service, quoted and waiting on the company ────
// Quoted rather than requested or paid: the price, the accept/decline pair,
// the cancel control and the documents card are all on screen at once, which
// is the most of this page a single frame can show honestly.
const MIGRATION = {
  id: "mig_1",
  companyId: COMPANY.id,
  status: "quoted",
  sourceSystems: "QuickBooks Online + a Jobber CSV export",
  description: "About 6 years of invoices and 340 clients in QuickBooks; quotes from the last 2 years are in Jobber. We'd like the clients and the open quotes brought over, plus the last 2 years of invoices for history.",
  requestedById: PEOPLE[0].id,
  hostAdminId: "pa_1",
  scheduledAt: iso(day(-8, 14)),
  priceCents: 45000,
  currency: "CAD",
  quoteNote: "340 clients, 61 open or recently accepted quotes and 2 years of invoices (about 410). Two working days; clients first so nothing on your side has to wait.",
  quotedAt: iso(day(-6, 11)),
  createdAt: iso(day(-12, 9)),
  updatedAt: iso(day(-6, 11)),
  documents: [
    { id: "md_2", migrationRequestId: "mig_1", filename: "jobber-quotes-2024-2026.csv", createdAt: iso(day(-9, 16)) },
    { id: "md_1", migrationRequestId: "mig_1", filename: "quickbooks-customers.xlsx", createdAt: iso(day(-11, 10)) },
  ],
  writes: [],
};

// ── The audit trail ───────────────────────────────────────────────────────
const owner = { actorName: PEOPLE[0].name, actorRole: "owner" };
const manager = { actorName: PEOPLE[1].name, actorRole: "supervisor" };
const estimator = { actorName: PEOPLE[2].name, actorRole: "employee" };
const ACTIVITY = [
  { id: "act_10", action: "invoice.chased", entityType: "invoice", entityId: INVOICE.id, summary: `Sent a reminder for invoice ${INVOICE.invoiceNumber} to ${CLIENT.email}`, createdAt: iso(day(0, 8, 40)), ...manager },
  { id: "act_9", action: "settings.cabinet_rates_updated", entityType: "settings", entityId: null, summary: "Updated cabinet pricing", createdAt: iso(day(-1, 16, 5)), ...owner },
  { id: "act_8", action: "member.invited", entityType: "member", entityId: PEOPLE[5].id, summary: `Invited ${PEOPLE[5].name} (${PEOPLE[5].email}) as Crew`, createdAt: iso(day(-2, 11, 20)), ...owner },
  { id: "act_7", action: "job.scheduled", entityType: "job", entityId: JOB.id, summary: `Scheduled ${JOB.jobNumber} ${JOB.title} for ${PEOPLE[4].name} and ${PEOPLE[5].name}`, createdAt: iso(day(-3, 9, 15)), actorName: PEOPLE[3].name, actorRole: "supervisor" },
  { id: "act_6", action: "invoice.sent", entityType: "invoice", entityId: INVOICE.id, summary: `Sent invoice ${INVOICE.invoiceNumber} to ${CLIENT.email}`, createdAt: iso(day(-5, 9, 2)), ...manager },
  { id: "act_5", action: "quote.accepted", entityType: "quote", entityId: QUOTE.id, summary: `Quote ${QUOTE.quoteNumber} marked accepted — job created, ready to schedule, invoice ${INVOICE.invoiceNumber} drafted`, createdAt: iso(day(-6, 15, 12)), ...estimator },
  { id: "act_4", action: "quote.followed_up", entityType: "quote", entityId: QUOTE.id, summary: `Sent a follow-up for quote ${QUOTE.quoteNumber} to ${CLIENT.email}`, createdAt: iso(day(-10, 10, 30)), ...estimator },
  { id: "act_3", action: "quote.sent", entityType: "quote", entityId: QUOTE.id, summary: `Sent quote ${QUOTE.quoteNumber} to ${CLIENT.email}`, createdAt: iso(day(-15, 11, 0)), ...estimator },
  { id: "act_2", action: "quote.created", entityType: "quote", entityId: QUOTE.id, summary: `Created quote ${QUOTE.quoteNumber} for ${CLIENT.name}`, createdAt: iso(day(-18, 10, 5)), ...estimator },
  { id: "act_1", action: "client.created", entityType: "client", entityId: CLIENT.id, summary: `Added client ${CLIENT.name}`, summaryKey: "app.activity.event.clientAdded", summaryParams: { name: CLIENT.name }, createdAt: iso(day(-21, 14, 40)), ...manager },
].map((e) => ({ viaImpersonation: false, ...e }));

// ── Cabinet rate card: the shop's own numbers, not the starting defaults ──
const CABINET_RATES = normaliseRates({
  cabinetPricingMode: "perLinearFt",
  lfBase: 520,
  lfUpper: 425,
  lfTall: 690,
  lfIsland: 600,
  lfVanity: 560,
  lfCloset: 380,
  drawerSurcharge: 65,
  installIncludedInLf: false,
  installMode: "perLinearFt",
  installPerLinearFt: 30,
  refinishPerDoor: 140,
  refinishPerDrawer: 95,
  deliveryFlat: 275,
  removalPerBox: 30,
  materialMarkup: 0.22,
});

const SETTINGS_A_SLUGS = new Set([
  "settings", "settings-migration", "settings-product-updates", "settings-company", "settings-branding", "settings-language",
  "settings-activity", "settings-availability", "settings-leave", "settings-booking-page", "settings-work-areas",
  "settings-products", "settings-services", "settings-material-costs", "settings-cabinet-rates", "settings-overhead",
  "settings-custom-fields",
]);

export const ROUTES_SETTINGS_A = [
  // Richer than the core row: `user` on every member, and the industry
  // preset the Company and Services screens read.
  { path: "/api/settings/members", method: "GET", reply: () => MEMBERS },
  // Scoped to this group's own screens so another group's frame keeps the
  // company exactly as routes-core.js states it.
  { path: "/api/settings/business-info", method: "GET", reply: ({ screen }) => (SETTINGS_A_SLUGS.has(screen?.slug) ? BUSINESS_INFO : COMPANY) },

  // Account
  { path: "/api/migrations", method: "GET", reply: () => ({ requests: [MIGRATION] }) },
  { path: "/api/migrations/slots", reply: () => ({ days: [1, 2, 3].map((d) => ({ day: day(d).toISOString().slice(0, 10), slots: ["10:00", "14:00"].map((t) => ({ at: iso(day(d, Number(t.slice(0, 2)))), label: t })) })) }) },
  { path: /^\/api\/migrations\/([^/]+)$/, method: "GET", reply: () => ({ request: MIGRATION }) },

  // Business
  { path: "/api/availability", method: "GET", reply: ({ search }) => BOOKABLE[search.get("userId") || PEOPLE[0].userId] || [] },
  { path: "/api/working-hours", method: "GET", reply: ({ search }) => { const userId = search.get("userId") || PEOPLE[0].userId; return { userId, workingHours: WORKING[userId] || [] }; } },
  { path: "/api/settings/payment-schedule", method: "GET", reply: () => ({ stages: [
    { id: "ps_1", seq: 0, label: "Deposit to book", trigger: "on_invoice_created", percentage: 50 },
    { id: "ps_2", seq: 1, label: "Balance on installation", trigger: "job_end", percentage: 50 },
  ] }) },
  { path: "/api/settings/service-categories", method: "GET", reply: () => SERVICE_CATEGORIES },
  { path: "/api/settings/tax-rate", method: "GET", reply: () => COMPANY.taxRates },
  { path: "/api/settings/language", method: "GET", reply: ({ lang }) => ({ language: lang, defaultLanguage: "fr", supported: LANGUAGES }) },
  { path: "/api/activity", method: "GET", reply: () => ({ entries: ACTIVITY }) },

  // Team & scheduling
  { path: "/api/settings/leave-policies", method: "GET", reply: () => ({
    policies: LEAVE_POLICIES,
    workerCount: 5,
    year: TODAY.getUTCFullYear(),
    home: { country: "CA", source: "column", templateKey: "CA" },
    templates: LEAVE_REGIONS.map((key) => ({ key, label: LEAVE_TEMPLATES[key].label, sourceYear: LEAVE_TEMPLATES[key].sourceYear, note: LEAVE_TEMPLATES[key].note, policies: LEAVE_TEMPLATES[key].policies })),
  }) },
  { path: "/api/event-types", method: "GET", reply: () => EVENT_TYPES },
  { path: "/api/work-areas", method: "GET", reply: () => WORK_AREAS },

  // Services & pricing
  { path: "/api/products", method: "GET", reply: ({ search }) => {
    const q = (search.get("q") || "").trim().toLowerCase();
    return q ? PRODUCTS.filter((p) => p.name.toLowerCase().includes(q)) : PRODUCTS;
  } },
  { path: "/api/settings/instant-quote", method: "GET", reply: () => ({ trades: [
    { trade: "cabinet_refinishing", enabled: true, readiness: { ok: true, missing: [] } },
    { trade: "cabinet_refacing", enabled: false, readiness: { ok: true, missing: [] } },
    { trade: "countertop", enabled: false, readiness: { ok: false, missing: ["rates"] } },
  ], financing: { enabled: false } }) },
  { path: "/api/settings/material-recipes", method: "GET", reply: () => ({
    cabinet_refinishing: { ...getRecipe("cabinet_refinishing", { primerCostPerGal: 165, topCoatCostPerGal: 172, labourMinutesPerDoor: 40 }), _hasOverrides: true },
  }) },
  { path: "/api/settings/cost-revision", method: "GET", reply: () => ({ thresholdPct: 10, defaultPct: 10 }) },
  { path: "/api/settings/cabinet-rates", method: "GET", reply: () => ({ rates: CABINET_RATES, defaults: DEFAULT_CABINET_RATES, usingDefaults: false, doorMaterials: DOOR_MATERIALS, boxMaterials: BOX_MATERIALS }) },
  { path: "/api/overhead/fixed-costs", method: "GET", reply: () => FIXED_COSTS },
  { path: "/api/salaries", method: "GET", reply: () => SALARIES },
  { path: "/api/debt", method: "GET", reply: () => DEBTS },
  { path: "/api/assets", method: "GET", reply: () => ASSETS },
  // Unpaid rows only unless ?settled=1, the way the route selects them.
  { path: "/api/bills", method: "GET", reply: ({ search }) => {
    const rows = search.get("settled") ? BILLS : BILLS.filter((b) => !b.paidAt);
    return { bills: rows.map((b) => ({ ...b, status: billStatus(b, TODAY) })), summary: summariseBills(rows, TODAY) };
  } },
  { path: "/api/settings/forecast", method: "GET", reply: () => ({ jobsPerWeekCapacity: JOBS_PER_WEEK }) },
  { path: "/api/analytics/minimum-price", method: "GET", reply: () => minimumPrice() },
  { path: "/api/analytics/utilisation", method: "GET", reply: ({ search }) => utilisation(Number(search.get("days")) || 30) },
  { path: "/api/custom-fields", method: "GET", reply: () => CUSTOM_FIELDS },
];
