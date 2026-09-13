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
// Where the product computes a figure from rows (receivables, the goal's
// pace) the fixture calls the SAME pure function the API route calls, over
// fixture rows, rather than hand-typing an output shape that would rot the
// day the function changed.
import { COMPANY, PEOPLE, CLIENT, QUOTE, JOB, INVOICE, day, iso, TODAY } from "./company.js";
import { buildReceivables, buildRevenueTrend, TREND_PERIODS } from "@/lib/analytics/receivables";
import { goalProgress } from "@/lib/analytics/goal";
import { ROUTES_GROW } from "./routes-grow.js";
import { ROUTES_MONEY } from "./routes-money.js";
import { ROUTES_PEOPLE } from "./routes-people.js";
import { ROUTES_SETTINGS_A } from "./routes-settings-a.js";
import { ROUTES_SETTINGS_B } from "./routes-settings-b.js";

// ── People, as the API returns them on a row ────────────────────────────────
const who = (m) => ({ id: m.userId, name: m.name });
const [MARC, JULIE, SAM, DAN, LEO, ANA] = PEOPLE;

// ── The other clients ───────────────────────────────────────────────────────
// Sophie Dubois is company.js's. These are the rest of a small shop's month.
const person = (id, first, last, email, phone, address, city, postalCode, language = "fr") => ({
  id,
  name: `${first} ${last}`,
  firstName: first,
  lastName: last,
  email,
  phone,
  address,
  city,
  province: "QC",
  postalCode,
  country: "CA",
  language,
});
export const LAVOIE = person("cl_lavoie", "Martin", "Lavoie", "m.lavoie@example.com", "+1 450 555 0122", "214 rue Principale", "Laval", "H7X 1B4");
const HADDAD = person("cl_haddad", "Nadia", "Haddad", "nadia.haddad@example.com", "+1 514 555 0163", "37 av. des Pins", "Laval", "H7L 2R8");
const BELANGER = person("cl_belanger", "Chantal", "Bélanger", "cbelanger@example.com", "+1 450 555 0139", "902 boul. des Laurentides", "Laval", "H7G 2V8");
const BENALI = person("cl_benali", "Karim", "Benali", "karim.benali@example.com", "+1 450 555 0174", "15 rue Lachapelle", "Boisbriand", "J7G 1L2");
export const FORTIN = person("cl_fortin", "Isabelle", "Fortin", "isabelle.fortin@example.com", "+1 514 555 0198", "61 rue de la Sapinière", "Laval", "H7Y 1K6");
export const RIVENORD = person("cl_rivenord", "Groupe Immobilier", "Rive-Nord", "comptes@rivenord.example.com", "+1 450 555 0150", "3000 boul. Le Corbusier, bureau 210", "Laval", "H7L 3W2");

// ── Quotes ──────────────────────────────────────────────────────────────────
// Q-1042 is company.js's accepted quote. The list route sends every column
// plus client / scopeGroups / assignedTo, and the list page reads
// quoteNumber, status, client.name, total, sentAt, createdAt, validUntil,
// autoEstimated, needsReview and pricingHidden.
const money = (subtotal) => {
  const taxTotal = Math.round(subtotal * COMPANY.taxRate) / 100;
  return { subtotal, taxTotal, tax: taxTotal, total: Math.round((subtotal + taxTotal) * 100) / 100 };
};
const quote = (id, number, title, status, client, subtotal, dates, extra = {}) => ({
  id,
  number,
  quoteNumber: number,
  title,
  status,
  clientId: client.id,
  client: { id: client.id, name: client.name, email: client.email },
  clientName: client.name,
  ...money(subtotal),
  currency: "CAD",
  language: client.language,
  autoEstimated: false,
  needsReview: false,
  assignedTo: who(SAM),
  assignedToId: SAM.userId,
  scopeGroups: [],
  createdAt: iso(dates.created),
  updatedAt: iso(dates.updated || dates.sent || dates.created),
  sentAt: dates.sent ? iso(dates.sent) : null,
  approvedAt: dates.approved ? iso(dates.approved) : null,
  acceptedAt: dates.approved ? iso(dates.approved) : null,
  declinedAt: dates.declined ? iso(dates.declined) : null,
  validUntil: dates.validUntil ? iso(dates.validUntil) : null,
  ...extra,
});

export const Q_1042 = { ...QUOTE, autoEstimated: false, needsReview: false, assignedTo: who(SAM), assignedToId: SAM.userId, scopeGroups: [], acceptedAt: QUOTE.approvedAt };
export const Q_1044 = quote("q_1044", "Q-1044", "Kitchen refacing — 22 doors, painted maple", "sent", LAVOIE, 9800, {
  created: day(-5, 14), sent: day(-4, 10), validUntil: day(26),
});
const Q_1045 = quote("q_1045", "Q-1045", "Bathroom vanity — walnut, wall-hung", "draft", BENALI, 4850, {
  created: day(-1, 16, 20),
}, { assignedTo: who(MARC), assignedToId: MARC.userId });
const Q_1039 = quote("q_1039", "Q-1039", "Walk-in closet — melamine, custom", "declined", HADDAD, 6200, {
  created: day(-33, 11), sent: day(-30, 9), declined: day(-19, 17), validUntil: day(0),
});

// ── The instant estimates waiting on a person ───────────────────────────────
// Quote rows the software priced from a self-quote form (and one from a call
// the receptionist took). /api/quotes/estimate-reviews selects a narrow shape
// and the review card reads estimateData.{measurement,range,unit,materialKey,
// budget,breakdown}, reviewNotes, recordingHref and assignedTo.
const Q_1046 = {
  ...quote("q_1046", "Q-1046", "Instant estimate — kitchen, shaker painted", "draft", BELANGER, 14200, {
    created: day(0, 7, 42),
  }, { autoEstimated: true, needsReview: true, assignedTo: null, assignedToId: null, client: { name: BELANGER.name, email: BELANGER.email, phone: BELANGER.phone, address: `${BELANGER.address}, ${BELANGER.city}` } }),
  estimateSource: "manual",
  estimateData: {
    trade: "cabinet_making",
    materialKey: "shaker_painted_mdf",
    measurement: { areaSqft: 168, source: "manual" },
    range: { low: 12800, point: 14200, high: 16900 },
    unit: null,
    breakdown: [
      { label: "Upper cabinets — 11 lin. ft, shaker painted", amount: 4675 },
      { label: "Base cabinets — 14 lin. ft, dovetail drawers", amount: 7280 },
      { label: "Crown, fillers and end panels", amount: 1415 },
      { label: "Installation — 2 installers, 1.5 days", amount: 830 },
    ],
    assumptions: ["Existing layout kept", "No island"],
    budget: { band: "5k_15k", label: "$5,000 – $15,000", exceeded: false },
    capturedAt: iso(day(0, 7, 42)),
  },
  reviewNotes: "A matching floating vanity for the powder room, walnut to match the island.",
  recordingHref: null,
};
const Q_1047 = {
  ...quote("q_1047", "Q-1047", "Instant estimate — pantry built-in", "draft", HADDAD, 3900, {
    created: day(-1, 15, 5),
  }, { autoEstimated: true, needsReview: true, assignedTo: who(SAM), assignedToId: SAM.userId, client: { name: HADDAD.name, email: HADDAD.email, phone: HADDAD.phone, address: `${HADDAD.address}, ${HADDAD.city}` } }),
  estimateSource: "phone_call",
  estimateData: {
    trade: "cabinet_making",
    materialKey: "melamine_white",
    measurement: { source: "phone_call" },
    range: { low: 3400, point: 3900, high: 4600 },
    unit: null,
    breakdown: [
      { label: "Pantry cabinet — 8 ft tall, 4 ft wide, adjustable shelves", amount: 3100 },
      { label: "Installation — half day", amount: 800 },
    ],
    assumptions: ["Standard 24 in. depth"],
    capturedAt: iso(day(-1, 15, 5)),
  },
  reviewNotes: null,
  recordingHref: "/api/voice/calls/vc_0913_1502/recording",
};

export const QUOTES = [Q_1046, Q_1045, Q_1044, Q_1042, Q_1047, Q_1039];

// ── Jobs ────────────────────────────────────────────────────────────────────
// J-318 is company.js's. The list reads title, status, client.name, visits,
// recurring; the calendar merges each job's visits in as `kind: "visit"`.
const visit = (id, job, at, assignee, status = "scheduled", notes = null) => ({
  id,
  jobId: job.id,
  scheduledAt: iso(at),
  status,
  notes,
  assignedToId: assignee.userId,
  assignedTo: who(assignee),
});
export const J_318 = {
  ...JOB,
  recurring: false,
  visits: [],
};
J_318.visits = [
  visit("v_318a", J_318, day(1, 8), LEO, "scheduled", "Carcasses and base run — Léo + Ana"),
  visit("v_318b", J_318, day(2, 8), ANA, "scheduled", "Uppers, island, hardware"),
];
const J_321 = {
  id: "j_321",
  number: "J-321",
  jobNumber: "J-321",
  title: "Lavoie kitchen refacing — install",
  status: "scheduled",
  clientId: LAVOIE.id,
  client: LAVOIE,
  clientName: LAVOIE.name,
  quoteId: Q_1044.id,
  address: LAVOIE.address,
  city: LAVOIE.city,
  scheduledStart: iso(day(8, 8)),
  scheduledEnd: iso(day(8, 17)),
  startDate: iso(day(8, 8)),
  endDate: iso(day(8, 17)),
  total: Q_1044.total,
  assignedTo: [LEO],
  assignees: [LEO],
  recurring: false,
  createdAt: iso(day(-4, 10)),
  updatedAt: iso(day(-2, 9)),
  visits: [],
};
J_321.visits = [visit("v_321a", J_321, day(8, 8), LEO, "scheduled", "Doors, drawer fronts, new hinges")];
const J_315 = {
  id: "j_315",
  number: "J-315",
  jobNumber: "J-315",
  title: "Fortin laundry room — cabinets & counter",
  status: "completed",
  clientId: FORTIN.id,
  client: FORTIN,
  clientName: FORTIN.name,
  quoteId: "q_1036",
  address: FORTIN.address,
  city: FORTIN.city,
  scheduledStart: iso(day(-4, 8)),
  scheduledEnd: iso(day(-4, 15)),
  startDate: iso(day(-4, 8)),
  endDate: iso(day(-4, 15)),
  completedAt: iso(day(-4, 15, 10)),
  total: 7266.42,
  assignedTo: [ANA],
  assignees: [ANA],
  recurring: false,
  createdAt: iso(day(-16, 9)),
  updatedAt: iso(day(-4, 15, 10)),
  visits: [],
};
J_315.visits = [visit("v_315a", J_315, day(-4, 8), ANA, "completed", null)];
export const JOBS = [J_318, J_321, J_315];

// ── Invoices ────────────────────────────────────────────────────────────────
// INV-2071 is company.js's (sent, due in nine days). One paid last week, one
// a builder client has let slip twelve days past due — so the dashboard has
// a row to chase and the list's Outstanding tile has a past-due line.
const invoice = (id, number, status, client, subtotal, dates, extra = {}) => {
  const m = money(subtotal);
  const paid = status === "paid" ? m.total : 0;
  return {
    id,
    number,
    invoiceNumber: number,
    version: 1,
    parentInvoiceId: null,
    status,
    clientId: client.id,
    client: { id: client.id, name: client.name, email: client.email },
    clientName: client.name,
    ...m,
    amountPaid: paid,
    amountDue: Math.round((m.total - paid) * 100) / 100,
    balanceDue: Math.round((m.total - paid) * 100) / 100,
    currency: "CAD",
    language: client.language,
    issuedAt: iso(dates.sent),
    sentAt: iso(dates.sent),
    dueAt: iso(dates.due),
    dueDate: iso(dates.due),
    paidDate: dates.paid ? iso(dates.paid) : null,
    createdAt: iso(dates.sent),
    updatedAt: iso(dates.paid || dates.sent),
    lastChasedAt: dates.chased ? iso(dates.chased) : null,
    chaseCount: dates.chased ? 1 : 0,
    payments: [],
    versions: [],
    ...extra,
  };
};
const INV_2071 = { ...INVOICE, version: 1, parentInvoiceId: null, paidDate: null, lastChasedAt: null, chaseCount: 0, payments: [], versions: [], client: { id: CLIENT.id, name: CLIENT.name, email: CLIENT.email } };
export const INV_2069 = invoice("inv_2069", "INV-2069", "paid", FORTIN, 6320, { sent: day(-4, 16), due: day(10), paid: day(-3, 11) }, {
  jobId: J_315.id,
  items: [{ id: "ii2069", name: "Laundry room — cabinets, counter and installation", quantity: 1, unitPrice: 6320, total: 6320 }],
});
// Paid by card through the payment link, so the row carries what Stripe
// reported: the fee it kept and what reached the bank (Payment.
// processingFeeCents / netCents / feeRateLabel — the invoice page prints
// "card processing $… · deposited $…" from exactly these three).
const FEE_2069 = Math.round(INV_2069.total * 100 * 0.029) + 30;
INV_2069.payments = [{
  id: "pay_2069", invoiceId: "inv_2069", amount: INV_2069.total, method: "stripe", date: iso(day(-3, 11)), notes: null, createdAt: iso(day(-3, 11)),
  refundedAmount: 0, refundedAt: null, disputeStatus: null, disputedAt: null,
  processingFeeCents: FEE_2069, netCents: Math.round(INV_2069.total * 100) - FEE_2069, feeRateLabel: "card", estimatedFeeCents: FEE_2069, stripeFeeCents: FEE_2069,
  accountFeeRecoveredCents: 0, accountFeePeriod: null, disputeHeldCents: null, disputeFeeCents: null, disputeReturnedCents: null,
}];
export const INV_2066 = invoice("inv_2066", "INV-2066", "overdue", RIVENORD, 3450, { sent: day(-42, 9), due: day(-12), chased: day(-5, 14, 41) }, {
  jobId: null,
  items: [{ id: "ii2066", name: "Model-home vanities — 3 units, delivered", quantity: 3, unitPrice: 1150, total: 3450 }],
});
export const INVOICES = [INV_2071, INV_2069, INV_2066];

// ── Money received, month by month ──────────────────────────────────────────
// Payment rows for the trend chart: a shop billing roughly $35k a month, with
// the deposit-heavy summer it actually has. The current month holds only
// what has landed by the 14th, so the last bar is drawn partial, as it is on
// the real screen.
const monthPay = (offsetMonths, dayOfMonth, amount, i) => {
  const d = new Date(TODAY);
  d.setMonth(d.getMonth() - offsetMonths, dayOfMonth);
  d.setHours(11, 0, 0, 0);
  return { invoiceId: `inv_hist_${offsetMonths}_${i}`, amount, date: iso(d) };
};
const PAYMENTS = [
  ...[[11, 9225], [3, 8120], [8, 7545.5]].map(([dd, a], i) => monthPay(0, dd, a, i)),
  ...[[4, 12400], [12, 9875.5], [19, 7266.42], [27, 6900]].map(([dd, a], i) => monthPay(1, dd, a, i)),
  ...[[2, 15600], [11, 8240], [22, 11480], [29, 4300]].map(([dd, a], i) => monthPay(2, dd, a, i)),
  ...[[6, 9180], [15, 13350], [24, 10120]].map(([dd, a], i) => monthPay(3, dd, a, i)),
  ...[[3, 7420], [14, 12980], [21, 6640], [28, 3980]].map(([dd, a], i) => monthPay(4, dd, a, i)),
  ...[[5, 8860], [16, 9740], [25, 5310]].map(([dd, a], i) => monthPay(5, dd, a, i)),
  ...[[8, 11210], [20, 7150]].map(([dd, a], i) => monthPay(6, dd, a, i)),
  ...[[4, 6980], [18, 10420], [27, 5560]].map(([dd, a], i) => monthPay(7, dd, a, i)),
  ...[[9, 9930], [23, 8470]].map(([dd, a], i) => monthPay(8, dd, a, i)),
  ...[[2, 12650], [15, 7080], [26, 6190]].map(([dd, a], i) => monthPay(9, dd, a, i)),
  ...[[6, 8310], [19, 9560]].map(([dd, a], i) => monthPay(10, dd, a, i)),
  ...[[3, 5420], [17, 11870], [28, 6730]].map(([dd, a], i) => monthPay(11, dd, a, i)),
  INV_2069.payments[0],
];
// Only the open families feed the ledger; the historical invoices behind the
// trend's payments are long settled and would be skipped by buildReceivables
// anyway (a payment against an unknown invoice id is simply not owed).
const receivablesBody = (months) => ({
  currency: "CAD",
  receivables: buildReceivables({
    invoices: INVOICES.map((inv) => ({ ...inv, client: { ...inv.client, phone: (inv.clientId === CLIENT.id ? CLIENT : inv.clientId === FORTIN.id ? FORTIN : RIVENORD).phone, address: (inv.clientId === CLIENT.id ? CLIENT : inv.clientId === FORTIN.id ? FORTIN : RIVENORD).address, city: "Laval" } })),
    payments: PAYMENTS,
    followUpLogs: [{ entityId: INV_2066.id, sentAt: iso(day(-9, 8)) }],
    asOf: TODAY,
  }),
  revenue: buildRevenueTrend({ payments: PAYMENTS, months, everRecorded: true, asOf: TODAY }),
  periods: TREND_PERIODS,
  canRemind: true,
  automaticReminder: { name: "Overdue invoice — 3 days", delayValue: 3, delayUnit: "days" },
});

// ── The overview tiles ──────────────────────────────────────────────────────
// Sixteen quotes went out this month, so the conversion tile is over the
// ten-quote floor and prints a percentage; last month is over it too, so the
// comparison is allowed. Revenue is invoices MARKED PAID this month.
const YTD = 301850;
const OVERVIEW = {
  period: iso(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1)),
  revenue: 24890.5,
  revenueInvoiceCount: 3,
  expenses: 6412.8,
  margin: (24890.5 - 6412.8) / 24890.5,
  quotesCreated: 19,
  quotesSent: 16,
  quotesAccepted: 6,
  conversionRate: 6 / 16,
  priorConversionRate: 4 / 14,
  priorRevenue: 22410,
  priorQuotesSent: 14,
  goal: goalProgress({ annualGoal: 420000, revenueYtd: YTD, now: TODAY }),
  canEditGoal: true,
};

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

// ── The calendar ────────────────────────────────────────────────────────────
// GET /api/appointments returns appointments, job visits and client bookings
// merged and sorted. The fixture week, Mon 14 – Fri 18 September: an estimate
// visit Monday, J-318's two install days, a booking the AI receptionist took
// for Thursday, a callback and a site measure Friday, next Tuesday's install
// on J-321, plus last week's completed visit so the "Completed" chip is not
// a zero.
const appointment = (id, at, client, assignee, o = {}) => ({
  kind: "appointment",
  id,
  companyId: COMPANY.id,
  scheduledAt: iso(at),
  status: "scheduled",
  notes: null,
  location: client.address ? `${client.address}, ${client.city}` : null,
  clientId: client.id,
  client: { ...client, restricted: false },
  assignedToId: assignee ? assignee.userId : null,
  assignedTo: assignee ? who(assignee) : null,
  requiresSupervisor: false,
  latitude: null,
  longitude: null,
  booking: null,
  createdAt: iso(day(-3, 10)),
  updatedAt: iso(day(-3, 10)),
  ...o,
});
const visitEntry = (v, job) => ({
  kind: "visit",
  id: v.id,
  jobId: job.id,
  scheduledAt: v.scheduledAt,
  status: v.status || "scheduled",
  notes: v.notes || null,
  title: job.title,
  client: job.client,
  location: job.client?.address || null,
  assignedTo: v.assignedTo || null,
  assignedToId: v.assignedToId || null,
  booking: null,
  requiresSupervisor: false,
  latitude: null,
  longitude: null,
});
export const APPOINTMENTS = [
  visitEntry(J_315.visits[0], J_315),
  appointment("ap_bergeron", day(0, 14), person("cl_bergeron", "Amélie", "Bergeron", "amelie.bergeron@example.com", "+1 450 555 0127", "48 rue des Cèdres", "Laval", "H7W 3K1"), SAM, {
    notes: "Estimate visit — full kitchen, bring the shaker door samples and the white-oak island sample.",
  }),
  visitEntry(J_318.visits[0], J_318),
  visitEntry(J_318.visits[1], J_318),
  appointment("ap_lapointe", day(3, 10), person("cl_lapointe", "Geneviève", "Lapointe", "g.lapointe@example.com", "+1 450 555 0158", "12 rue Bellerive", "Laval", "H7N 1T3"), SAM, {
    notes: "Double vanity, 60 in. — ensuite measure.",
    booking: { endTime: iso(day(3, 11)), source: "phone_assistant", mode: "estimate" },
  }),
  appointment("ap_haddad", day(4, 9, 30), { ...HADDAD }, MARC, {
    notes: "Callback about the pantry estimate Q-1047 — confirm the 24 in. depth and the ceiling height.",
    location: null,
    booking: { endTime: iso(day(4, 9, 45)), source: "web", mode: "consultation" },
  }),
  appointment("ap_benali", day(4, 13), { ...BENALI }, MARC, {
    notes: "Site measure for the walnut vanity — check the plumbing rough-in before drawing Q-1045.",
  }),
  visitEntry(J_321.visits[0], J_321),
];
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
