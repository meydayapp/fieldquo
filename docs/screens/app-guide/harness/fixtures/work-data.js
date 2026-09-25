// docs/screens/app-guide/harness/fixtures/work-data.js
//
// The work screens' DATA — the fixture company's clients, quotes, jobs,
// invoices, payments, receivables and overview tiles — split out of
// routes-work.js (2026-09-25) so it can be imported without the route
// table. routes-work.js composes every other group's routes, so importing
// anything from it pulled the whole fixture set (~200 KB gzipped) along;
// the /signup side panel renders the real dashboard tiles and list rows
// from these same rows (lib/signup/sampleWorld.js) and must not ship that.
// Nothing here changed on the move: routes-work.js imports every name back.
//
// Where the product computes a figure from rows (receivables, the goal's
// pace) the fixture calls the SAME pure function the API route calls, over
// fixture rows, rather than hand-typing an output shape that would rot the
// day the function changed.
import { COMPANY, PEOPLE, CLIENT, QUOTE, JOB, INVOICE, day, iso, TODAY } from "./company.js";
import { buildReceivables, buildRevenueTrend, TREND_PERIODS } from "@/lib/analytics/receivables";
import { goalProgress } from "@/lib/analytics/goal";

// ── People, as the API returns them on a row ────────────────────────────────
export const who = (m) => ({ id: m.userId, name: m.name });
const [MARC, JULIE, SAM, DAN, LEO, ANA] = PEOPLE;
export { MARC, JULIE, SAM, DAN, LEO, ANA };

// ── The other clients ───────────────────────────────────────────────────────
// Sophie Dubois is company.js's. These are the rest of a small shop's month.
export const person = (id, first, last, email, phone, address, city, postalCode, language = "fr") => ({
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
export const HADDAD = person("cl_haddad", "Nadia", "Haddad", "nadia.haddad@example.com", "+1 514 555 0163", "37 av. des Pins", "Laval", "H7L 2R8");
export const BELANGER = person("cl_belanger", "Chantal", "Bélanger", "cbelanger@example.com", "+1 450 555 0139", "902 boul. des Laurentides", "Laval", "H7G 2V8");
export const BENALI = person("cl_benali", "Karim", "Benali", "karim.benali@example.com", "+1 450 555 0174", "15 rue Lachapelle", "Boisbriand", "J7G 1L2");
export const FORTIN = person("cl_fortin", "Isabelle", "Fortin", "isabelle.fortin@example.com", "+1 514 555 0198", "61 rue de la Sapinière", "Laval", "H7Y 1K6");
export const RIVENORD = person("cl_rivenord", "Groupe Immobilier", "Rive-Nord", "comptes@rivenord.example.com", "+1 450 555 0150", "3000 boul. Le Corbusier, bureau 210", "Laval", "H7L 3W2");

// ── Quotes ──────────────────────────────────────────────────────────────────
// Q-1042 is company.js's accepted quote. The list route sends every column
// plus client / scopeGroups / assignedTo, and the list page reads
// quoteNumber, status, client.name, total, sentAt, createdAt, validUntil,
// autoEstimated, needsReview and pricingHidden.
export const money = (subtotal) => {
  const taxTotal = Math.round(subtotal * COMPANY.taxRate) / 100;
  return { subtotal, taxTotal, tax: taxTotal, total: Math.round((subtotal + taxTotal) * 100) / 100 };
};
export const quote = (id, number, title, status, client, subtotal, dates, extra = {}) => ({
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
export const Q_1045 = quote("q_1045", "Q-1045", "Bathroom vanity — walnut, wall-hung", "draft", BENALI, 4850, {
  created: day(-1, 16, 20),
}, { assignedTo: who(MARC), assignedToId: MARC.userId });
export const Q_1039 = quote("q_1039", "Q-1039", "Walk-in closet — melamine, custom", "declined", HADDAD, 6200, {
  created: day(-33, 11), sent: day(-30, 9), declined: day(-19, 17), validUntil: day(0),
});

// ── The instant estimates waiting on a person ───────────────────────────────
// Quote rows the software priced from a self-quote form (and one from a call
// the receptionist took). /api/quotes/estimate-reviews selects a narrow shape
// and the review card reads estimateData.{measurement,range,unit,materialKey,
// budget,breakdown}, reviewNotes, recordingHref and assignedTo.
export const Q_1046 = {
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
export const Q_1047 = {
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
export const visit = (id, job, at, assignee, status = "scheduled", notes = null) => ({
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
export const J_321 = {
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
export const J_315 = {
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
export const invoice = (id, number, status, client, subtotal, dates, extra = {}) => {
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
export const INV_2071 = { ...INVOICE, version: 1, parentInvoiceId: null, paidDate: null, lastChasedAt: null, chaseCount: 0, payments: [], versions: [], client: { id: CLIENT.id, name: CLIENT.name, email: CLIENT.email } };
export const INV_2069 = invoice("inv_2069", "INV-2069", "paid", FORTIN, 6320, { sent: day(-4, 16), due: day(10), paid: day(-3, 11) }, {
  jobId: J_315.id,
  items: [{ id: "ii2069", name: "Laundry room — cabinets, counter and installation", quantity: 1, unitPrice: 6320, total: 6320 }],
});
// Paid by card through the payment link, so the row carries what Stripe
// reported: the fee it kept and what reached the bank (Payment.
// processingFeeCents / netCents / feeRateLabel — the invoice page prints
// "card processing $… · deposited $…" from exactly these three).
export const FEE_2069 = Math.round(INV_2069.total * 100 * 0.029) + 30;
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
export const monthPay = (offsetMonths, dayOfMonth, amount, i) => {
  const d = new Date(TODAY);
  d.setMonth(d.getMonth() - offsetMonths, dayOfMonth);
  d.setHours(11, 0, 0, 0);
  return { invoiceId: `inv_hist_${offsetMonths}_${i}`, amount, date: iso(d) };
};
export const PAYMENTS = [
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
export const receivablesBody = (months) => ({
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
export const YTD = 301850;
export const OVERVIEW = {
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

// ── The calendar ────────────────────────────────────────────────────────────
// GET /api/appointments returns appointments, job visits and client bookings
// merged and sorted. The fixture week, Mon 14 – Fri 18 September: an estimate
// visit Monday, J-318's two install days, a booking the AI receptionist took
// for Thursday, a callback and a site measure Friday, next Tuesday's install
// on J-321, plus last week's completed visit so the "Completed" chip is not
// a zero.
export const appointment = (id, at, client, assignee, o = {}) => ({
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
export const visitEntry = (v, job) => ({
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
