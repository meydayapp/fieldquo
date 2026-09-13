// Fixture routes for the money screens. See routes.js for the entry shape.
//
// Payroll, Expense tracking, Purchasing, Vehicles, Insights (the benchmark
// hub) and the KPI dashboard. One ledger of payments and one of expenses,
// Apr–Sep 2026, feeds every figure below — the Expense-tracking month view,
// its six-month trend, the KPI page's money-flow tiles, its daily chart and
// its revenue sparkline are all derived from the same rows, so no two screens
// in the guide can disagree about what September cost.
import { PEOPLE, JOB, INVOICE, day, iso, TODAY } from "./company.js";
import {
  resolvePayCycle,
  currentPayPeriod,
  describePayCycle,
  reviewDays,
  isoDay,
  PAY_FREQUENCIES,
} from "@/lib/payroll/payCycle";

const round2 = (n) => Math.round(n * 100) / 100;
const round1 = (n) => Math.round(n * 10) / 10;
// "YYYY-MM-DD" in Montreal time — the fixture's calendar, not UTC's.
const dayKey = (d) => {
  const x = new Date(d);
  const local = new Date(x.getTime() - 4 * 3600 * 1000); // EDT all summer
  return local.toISOString().slice(0, 10);
};
const at = (y, m, d, h = 10) => new Date(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:00:00-04:00`);
const TODAY_KEY = dayKey(TODAY); // 2026-09-14

// ── The ledgers ─────────────────────────────────────────────────────────────

// Payments received, Apr–Sep 2026. Deposits and balances on kitchens,
// vanities and built-ins; September is the month in progress.
const PAYMENTS = [
  [at(2026, 4, 3), 12500], [at(2026, 4, 9), 9225], [at(2026, 4, 17), 6480], [at(2026, 4, 28), 10215],
  [at(2026, 5, 5), 14900], [at(2026, 5, 12), 8350], [at(2026, 5, 19), 11760], [at(2026, 5, 22), 5400], [at(2026, 5, 29), 6500],
  [at(2026, 6, 2), 9875], [at(2026, 6, 10), 13200], [at(2026, 6, 18), 7400], [at(2026, 6, 26), 10800],
  [at(2026, 7, 3), 15600], [at(2026, 7, 9), 8940], [at(2026, 7, 16), 12300], [at(2026, 7, 23), 6200], [at(2026, 7, 30), 9600],
  [at(2026, 8, 4), 11400], [at(2026, 8, 11), 16250], [at(2026, 8, 14), 7860], [at(2026, 8, 21), 13300], [at(2026, 8, 27), 9500],
  [at(2026, 9, 2), 9225], [at(2026, 9, 8), 6825], [at(2026, 9, 11), 5400],
].map(([date, amount], i) => ({ id: `pay_${i + 1}`, date: iso(date), amount }));

const VAN1 = "as_van_transit";
const VAN2 = "as_van_sprinter";

// Expenses, Apr–Sep 2026. Shop rent and the CAD subscription recur as
// overhead; plywood and hardwood are job-linked when a job is known; fuel is
// keyed to the van it went into so the fleet screen can cost it.
const exp = (date, category, amount, notes, extra = {}) => ({
  date: iso(date), category, amount, notes,
  projectId: null, isOverhead: false, recurring: false, frequency: "one_time",
  assetId: null, vendorName: null, ...extra,
});
const rent = (y, m) => exp(at(y, m, 1, 8), "Rent & Utilities", 2400, "Shop rent — 1420 boul. Curé-Labelle", { isOverhead: true, recurring: true, frequency: "monthly" });
const cad = (y, m) => exp(at(y, m, 1, 8), "Software & Subscriptions", 89, "Cabinet Vision — monthly", { isOverhead: true, recurring: true, frequency: "monthly" });
const ins = (y, m) => exp(at(y, m, 1, 8), "Insurance", 410, "Commercial liability — monthly", { isOverhead: true, recurring: true, frequency: "monthly" });
const fuel = (y, m, d, amount, van) => exp(at(y, m, d, 17), "Fuel & Vehicle", amount, van === VAN1 ? "Fuel — Transit" : "Fuel — Sprinter", { assetId: van, vendorName: "Ultramar" });

const EXPENSES = [
  rent(2026, 4), cad(2026, 4), ins(2026, 4),
  fuel(2026, 4, 7, 102.3, VAN1),
  exp(at(2026, 4, 8), "Materials", 1640.25, "Baltic birch 3/4 — 20 sheets", { vendorName: "Bois Laurentides" }),
  exp(at(2026, 4, 15), "Tools & Equipment", 512.4, "Blum hinges, 60 pr", { vendorName: "Richelieu" }),
  fuel(2026, 4, 21, 94.6, VAN2),
  exp(at(2026, 4, 24), "Materials", 610.75, "Conversion varnish, 2 × 5 gal", { vendorName: "Finitions Pro" }),

  rent(2026, 5), cad(2026, 5), ins(2026, 5),
  fuel(2026, 5, 6, 98.75, VAN1),
  exp(at(2026, 5, 8), "Materials", 2280, "White oak, rift sawn — 140 bf", { vendorName: "Bois Laurentides" }),
  exp(at(2026, 5, 13), "Tools & Equipment", 736.9, "Drawer slides, 40 pr", { vendorName: "Richelieu" }),
  fuel(2026, 5, 20, 91.2, VAN2),
  exp(at(2026, 5, 27), "Tools & Equipment", 245.6, "CNC compression bits", { vendorName: "Amana" }),
  exp(at(2026, 5, 29), "Materials", 388.4, "Lacquer, thinner", { vendorName: "Finitions Pro" }),

  rent(2026, 6), cad(2026, 6), ins(2026, 6),
  fuel(2026, 6, 3, 105.1, VAN1),
  exp(at(2026, 6, 9), "Materials", 1495.3, "Hard maple — 110 bf", { vendorName: "Bois Laurentides" }),
  exp(at(2026, 6, 12), "Materials", 168.45, "Abrasives, 120–220 grit"),
  fuel(2026, 6, 17, 89.9, VAN2),
  exp(at(2026, 6, 19), "Fuel & Vehicle", 189.99, "Oil change — Sprinter", { assetId: VAN2, vendorName: "Garage Lachapelle" }),
  exp(at(2026, 6, 24), "Tools & Equipment", 402.2, "Pulls and knobs, 48", { vendorName: "Richelieu" }),

  rent(2026, 7), cad(2026, 7), ins(2026, 7),
  fuel(2026, 7, 2, 112.4, VAN1),
  exp(at(2026, 7, 7), "Materials", 1978.6, "Baltic birch 3/4 — 24 sheets", { vendorName: "Bois Laurentides" }),
  exp(at(2026, 7, 10), "Materials", 350, "Quartz template fee — Lavoie", { vendorName: "Comptoirs Nord" }),
  fuel(2026, 7, 16, 97.85, VAN2),
  exp(at(2026, 7, 21), "Tools & Equipment", 688.5, "Soft-close slides, 36 pr", { vendorName: "Richelieu" }),
  exp(at(2026, 7, 24), "Tools & Equipment", 214.3, "Spray booth filters"),
  fuel(2026, 7, 30, 101.15, VAN1),

  rent(2026, 8), cad(2026, 8), ins(2026, 8),
  fuel(2026, 8, 5, 108.6, VAN1),
  exp(at(2026, 8, 11), "Materials", 2640, "White oak, rift sawn — 160 bf", { vendorName: "Bois Laurentides" }),
  exp(at(2026, 8, 13), "Tools & Equipment", 574.25, "Blum hinges, 72 pr", { vendorName: "Richelieu" }),
  fuel(2026, 8, 19, 95.3, VAN2),
  exp(at(2026, 8, 22), "Meals & Travel", 186.4, "Woodworking show — Montréal"),
  fuel(2026, 8, 27, 99.7, VAN1),

  // September: the month the Expense-tracking screen opens on.
  rent(2026, 9), cad(2026, 9),
  fuel(2026, 9, 3, 88.15, VAN2),
  exp(at(2026, 9, 9), "Materials", 1842.5, "Baltic birch 3/4 — 24 sheets, Dubois kitchen", { projectId: JOB.id, vendorName: "Bois Laurentides" }),
  exp(at(2026, 9, 10), "Tools & Equipment", 624.3, "Blum hinges and slides", { vendorName: "Richelieu" }),
  fuel(2026, 9, 11, 96.4, VAN1),
].map((row, i) => ({
  id: `exp_${i + 1}`,
  companyId: "c_erable",
  materialId: null,
  material: null,
  createdById: PEOPLE[1].userId,
  createdAt: row.date,
  ...row,
}));

const inMonth = (rows, y, m) =>
  rows.filter((r) => { const k = dayKey(r.date); return k.startsWith(`${y}-${String(m).padStart(2, "0")}`); });
const sum = (rows) => round2(rows.reduce((s, r) => s + Number(r.amount), 0));
const between = (rows, from, to) => rows.filter((r) => { const k = dayKey(r.date); return k >= from && k <= to; });
const byCategory = (rows) => {
  const m = new Map();
  for (const r of rows) m.set(r.category, (m.get(r.category) || 0) + Number(r.amount));
  return [...m.entries()].map(([category, total]) => ({ category, total: round2(total) })).sort((a, b) => b.total - a.total);
};

// ── Payroll ─────────────────────────────────────────────────────────────────

// The company's real cadence, from the shipped policy maths: fortnights
// closing Sunday, paid the Thursday after. Anchored so 13 Sept 2026 is a
// period end — the run that is due this week.
const PAY_CYCLE = { frequency: "biweekly", periodEndDayOfWeek: 0, payDayOfWeek: 4, anchorDate: "2026-01-04" };
function payCycleShape() {
  const cycle = resolvePayCycle(PAY_CYCLE);
  // A day KEY, not TODAY itself: guide.jsx swaps window.Date for a pinned
  // subclass after the fixtures have been evaluated, so a Date built in
  // company.js fails the lib's `instanceof Date` and would resolve to null.
  const periods = currentPayPeriod(cycle, TODAY_KEY);
  return {
    cycle,
    configured: true,
    describe: describePayCycle(cycle),
    reviewDays: reviewDays(cycle),
    frequencies: Object.entries(PAY_FREQUENCIES).map(([key, m]) => ({ key, label: m.label, alignsToWeeks: m.alignsToWeeks })),
    current: periods && {
      start: isoDay(periods.current.start), end: isoDay(periods.current.end),
      payDate: isoDay(periods.current.payDate), alignsToWeeks: periods.current.alignsToWeeks,
    },
    previous: periods && {
      start: isoDay(periods.previous.start), end: isoDay(periods.previous.end), payDate: isoDay(periods.previous.payDate),
    },
    canEdit: true,
  };
}

// Pay period boundaries are calendar days stored at midnight UTC (see the
// page's own note on formatCalendarDay).
const utcDay = (key) => `${key}T00:00:00.000Z`;
// The lines of the run that closed yesterday — one per person on the
// roster, hours from the fortnight's timesheets, the statutory deductions
// Settings › Payroll lists (routes-settings-b.js PAYROLL_COMPONENTS) at the
// first bracket. The run's totals are summed from these, so the list row
// and the run page (app/app/payroll/[id]) show the same money.
const [, JULIE_, SAM_, DAN_, LEO_, ANA_] = PEOPLE;
const payLine = (id, p, hours, ot, rate) => {
  const regular = round2(hours * rate);
  const overtime = round2(ot * rate * 1.5);
  const gross = round2(regular + overtime);
  const deductions = [
    { kind: "deduction", label: "Federal income tax", amount: round2(gross * 0.15) },
    { kind: "deduction", label: "Québec income tax", amount: round2(gross * 0.14) },
    { kind: "deduction", label: "QPP", amount: round2(gross * 0.064) },
    { kind: "deduction", label: "EI (Québec rate)", amount: round2(gross * 0.0132) },
    { kind: "deduction", label: "QPIP", amount: round2(gross * 0.00494) },
  ];
  const ded = round2(deductions.reduce((t, d) => t + d.amount, 0));
  return {
    id, payRunId: "run_0913", workerId: `w_${p.userId.slice(2)}`, workerName: p.name, workerType: "employee", hourlyRate: rate, regularHours: hours, overtimeHours: ot,
    items: [{ kind: "earning", label: "Regular hours", amount: regular }, ...(ot ? [{ kind: "earning", label: "Overtime (1.5×)", amount: overtime }] : []), ...deductions],
    gross, deductions: ded, net: round2(gross - ded), paidAt: null, payoutId: null, createdAt: iso(day(0, 8, 40)),
  };
};
export const PAY_RUN_LINES = [
  payLine("pl_1", JULIE_, 80, 0, 42),
  payLine("pl_2", SAM_, 80, 0, 36),
  payLine("pl_3", DAN_, 76, 2, 34),
  payLine("pl_4", LEO_, 80, 6, 34),
  payLine("pl_5", ANA_, 72, 0, 40),
];
const RUN_GROSS = round2(PAY_RUN_LINES.reduce((t, l) => t + l.gross, 0));
const RUN_DED = round2(PAY_RUN_LINES.reduce((t, l) => t + l.deductions, 0));
export const PAY_RUNS = [
  { id: "run_0913", periodStart: utcDay("2026-08-31"), periodEnd: utcDay("2026-09-13"), status: "approved", grossTotal: RUN_GROSS, deductionTotal: RUN_DED, netTotal: round2(RUN_GROSS - RUN_DED), region: "CA", approvedAt: iso(day(0, 8, 40)), paidAt: null, _count: { lines: 5 } },
  { id: "run_0830", periodStart: utcDay("2026-08-17"), periodEnd: utcDay("2026-08-30"), status: "paid", grossTotal: 11812, deductionTotal: 2486.5, netTotal: 9325.5, region: "CA", approvedAt: iso(day(-13, 9)), paidAt: iso(day(-11, 10)), _count: { lines: 5 } },
  { id: "run_0816", periodStart: utcDay("2026-08-03"), periodEnd: utcDay("2026-08-16"), status: "paid", grossTotal: 10944, deductionTotal: 2298.2, netTotal: 8645.8, region: "CA", approvedAt: iso(day(-27, 9)), paidAt: iso(day(-25, 10)), _count: { lines: 5 } },
];

// ── Fleet ───────────────────────────────────────────────────────────────────

const dated = (kind, endsAt) => {
  if (!endsAt) return { kind, state: "unknown", endsAt: null, daysRemaining: null };
  const days = Math.round((new Date(endsAt).getTime() - TODAY.getTime()) / 86400000);
  const state = days < 0 ? "expired" : days <= 30 ? "due_soon" : "ok";
  return { kind, state, endsAt: iso(endsAt), daysRemaining: days };
};
const byKm = (odometerKm, dueKm) => {
  if (odometerKm == null || dueKm == null) return { kind: "serviceKm", state: "unknown", remainingKm: null, dueKm: dueKm ?? null, odometerKm: odometerKm ?? null };
  const remainingKm = dueKm - odometerKm;
  const state = remainingKm < 0 ? "expired" : remainingKm <= 500 ? "due_soon" : "ok";
  return { kind: "serviceKm", state, remainingKm, dueKm, odometerKm };
};
const worst = (states) => (states.includes("expired") ? "expired" : states.includes("due_soon") ? "due_soon" : states.includes("ok") ? "ok" : "unknown");
const needsAttention = (s) => s === "expired" || s === "due_soon";

function vehicle({ id, assetId, name, cost, inServiceDate, plate, makeModel, year, vin, odometerKm, odometerAt, driver, insurance, registration, serviceAt, serviceKm, bookValue, monthlyDepreciation }) {
  const expiries = [
    dated("insurance", insurance),
    dated("registration", registration),
    dated("service", serviceAt),
    byKm(odometerKm, serviceKm),
  ];
  const state = worst(expiries.map((e) => e.state));
  const since = at(2026, 1, 1, 0);
  const own = EXPENSES.filter((e) => e.assetId === assetId && new Date(e.date) >= since);
  return {
    id,
    assetId,
    asset: {
      id: assetId, name, category: "vehicle", cost, salvageValue: Math.round(cost * 0.2), inServiceDate: iso(inServiceDate),
      usefulLifeMonths: 84, disposedOn: null, active: true, debtId: null,
      monthlyDepreciation, bookValue, chargeable: true, chargeReason: null,
    },
    assetMissing: false,
    hasDetail: true,
    vin, plate, makeModel, year,
    odometerKm, odometerAtUtc: iso(odometerAt),
    assignedToUserId: driver.userId,
    assignedToName: driver.name,
    insuranceExpiresAt: insurance ? iso(insurance) : null,
    registrationExpiresAt: registration ? iso(registration) : null,
    nextServiceDueKm: serviceKm,
    nextServiceDueAt: serviceAt ? iso(serviceAt) : null,
    name,
    expenses: own.map((e) => ({ id: e.id, category: e.category, amount: e.amount, date: e.date, notes: e.notes, vendorName: e.vendorName })),
    attention: { state, expiries, reasons: expiries.filter((e) => needsAttention(e.state)) },
  };
}

const VEHICLES = [
  vehicle({
    id: "vh_transit", assetId: VAN1, name: "Ford Transit 250 — 2022", cost: 52000, inServiceDate: at(2024, 3, 1),
    plate: "FLK 402", makeModel: "Ford Transit 250", year: 2022, vin: "1FTBR1C86NKA30417",
    odometerKm: 61240, odometerAt: day(-3, 17), driver: PEOPLE[4],
    // Insurance renews in 18 days and the service window closes in nine: the
    // van the "Due or expiring" panel exists for.
    insurance: day(18), registration: day(140), serviceAt: day(9), serviceKm: 65000,
    bookValue: 36480, monthlyDepreciation: 495.24,
  }),
  vehicle({
    id: "vh_sprinter", assetId: VAN2, name: "Mercedes Sprinter 2500 — 2019", cost: 38500, inServiceDate: at(2021, 6, 15),
    plate: "GHT 118", makeModel: "Mercedes-Benz Sprinter 2500", year: 2019, vin: "WD3PE7CD5KP101284",
    odometerKm: 128400, odometerAt: day(-1, 16), driver: PEOPLE[5],
    insurance: day(200), registration: day(75), serviceAt: day(60), serviceKm: 133000,
    bookValue: 15470, monthlyDepreciation: 366.67,
  }),
];

function fleetPayload() {
  const tally = { expired: 0, dueSoon: 0, ok: 0, unknown: 0, total: VEHICLES.length };
  for (const v of VEHICLES) {
    if (v.attention.state === "expired") tally.expired++;
    else if (v.attention.state === "due_soon") tally.dueSoon++;
    else if (v.attention.state === "ok") tally.ok++;
    else tally.unknown++;
  }
  return {
    vehicles: VEHICLES,
    dueSoon: VEHICLES.filter((v) => needsAttention(v.attention.state)).map((v) => ({
      vehicleId: v.id, assetId: v.assetId, name: v.name, plate: v.plate, state: v.attention.state, reasons: v.attention.reasons,
    })),
    tally,
    drivers: PEOPLE.map((p) => ({ userId: p.userId, name: p.name, active: p.active })),
    canSeeCost: true,
    canEdit: true,
    canManageAssets: true,
  };
}

// ── Purchasing ──────────────────────────────────────────────────────────────

const SUPPLIERS = [
  { id: "sup_bois", name: "Bois Laurentides", accountRef: "ERA-2210", contactName: "Pierre Lavallée", email: "commandes@boislaurentides.ca", phone: "+1 450 555 0230", address: "3400 rue Industrielle, Boisbriand QC", notes: "Plywood and hardwood. Delivers Tuesdays and Thursdays.", active: true, createdAt: iso(day(-380)) },
  { id: "sup_richelieu", name: "Richelieu Hardware", accountRef: "C-118457", contactName: "Nadia Béland", email: "nadia.beland@richelieu.com", phone: "+1 514 555 0118", address: "7900 boul. Henri-Bourassa O, Montréal QC", notes: "Hinges, slides, pulls. Net 30.", active: true, createdAt: iso(day(-360)) },
];

const PURCHASE_ORDERS = [
  {
    id: "po_014", number: "PO-014", status: "sent", supplierId: "sup_bois", supplierName: "Bois Laurentides", jobId: JOB.id,
    expectedTotal: 2814.4, currency: "CAD", orderedAt: iso(day(-2, 11)), expectedAt: iso(day(3, 9)), receivedAt: null,
    notes: "Dubois island — deliver to the shop, not the site.", createdAt: iso(day(-2, 11)),
    lines: [
      { id: "pol_1", materialId: "mat_oak", description: "White oak, rift sawn, 5/4 — S2S", quantity: 120, unit: "bf", unitCost: 18.9, quantityReceived: 0 },
      { id: "pol_2", materialId: "mat_birch", description: "Baltic birch 3/4 — 5 × 5", quantity: 8, unit: "sheet", unitCost: 68.3, quantityReceived: 0 },
    ],
  },
  {
    id: "po_013", number: "PO-013", status: "received", supplierId: "sup_richelieu", supplierName: "Richelieu Hardware", jobId: null,
    expectedTotal: 1188.5, currency: "CAD", orderedAt: iso(day(-9, 10)), expectedAt: iso(day(-4, 9)), receivedAt: iso(day(-4, 14)),
    notes: null, createdAt: iso(day(-9, 10)),
    lines: [
      { id: "pol_3", materialId: "mat_hinge", description: "Blum Clip-top soft-close hinges, 110°", quantity: 100, unit: "each", unitCost: 6.45, quantityReceived: 100 },
      { id: "pol_4", materialId: "mat_slide", description: "Blum Tandem 21\" undermount slides", quantity: 20, unit: "pair", unitCost: 27.2, quantityReceived: 20 },
    ],
  },
];

const STOCK = [
  { materialId: "mat_birch", name: "Baltic birch 3/4 — 5 × 5", unit: "sheet", movements: 6, level: 14, levelText: "14", threshold: 10, belowThreshold: false },
  { materialId: "mat_hinge", name: "Blum Clip-top soft-close hinges, 110°", unit: "each", movements: 9, level: 68, levelText: "68", threshold: 80, belowThreshold: true },
  { materialId: "mat_slide", name: "Blum Tandem 21\" undermount slides", unit: "pair", movements: 5, level: 26, levelText: "26", threshold: 12, belowThreshold: false },
  { materialId: "mat_oak", name: "White oak, rift sawn, 5/4", unit: "bf", movements: 4, level: 42, levelText: "42", threshold: null, belowThreshold: null },
];

const STOCK_MOVEMENTS = [
  { id: "mv_1", materialId: "mat_birch", materialName: "Baltic birch 3/4 — 5 × 5", quantity: -6, kind: "used", jobId: JOB.id, purchaseOrderId: null, note: "Dubois carcasses", occurredAt: iso(day(-1, 15)) },
  { id: "mv_2", materialId: "mat_hinge", materialName: "Blum Clip-top soft-close hinges, 110°", quantity: 100, kind: "received", jobId: null, purchaseOrderId: "po_013", note: "PO-013", occurredAt: iso(day(-4, 14)) },
  { id: "mv_3", materialId: "mat_slide", materialName: "Blum Tandem 21\" undermount slides", quantity: 20, kind: "received", jobId: null, purchaseOrderId: "po_013", note: "PO-013", occurredAt: iso(day(-4, 14)) },
  { id: "mv_4", materialId: "mat_hinge", materialName: "Blum Clip-top soft-close hinges, 110°", quantity: -32, kind: "used", jobId: JOB.id, purchaseOrderId: null, note: "Dubois uppers", occurredAt: iso(day(-1, 15)) },
];

// ── Benchmark ───────────────────────────────────────────────────────────────

const BENCHMARK = {
  shareAnonymizedPricing: true,
  categories: [
    { categoryId: "cat_kitchen", label: "Kitchen cabinets", yourAvgPrice: 17840, platformAvgPrice: 16420, sampleSize: 61 },
    { categoryId: "cat_vanity", label: "Bathroom vanities", yourAvgPrice: 3290, platformAvgPrice: 3410, sampleSize: 44 },
    { categoryId: "cat_builtins", label: "Closets and built-ins", yourAvgPrice: 6150, platformAvgPrice: 5480, sampleSize: 27 },
    { categoryId: "cat_refacing", label: "Cabinet refacing", yourAvgPrice: 7920, platformAvgPrice: 8060, sampleSize: 19 },
  ],
};

// ── KPIs ────────────────────────────────────────────────────────────────────

const kpi = ({ value = null, sampleSize = 0, incomplete = false, reason = null, reasonText = null, ...extra }) =>
  ({ value, sampleSize, incomplete, reason, reasonText, ...extra });

const compare = (current, prior) => {
  const deltaAbs = round2(current - prior);
  const deltaPct = prior === 0 ? null : deltaAbs / prior;
  let direction = "flat";
  if (prior === 0) direction = current > 0 ? "up" : "flat";
  else if (Math.abs(deltaAbs) / Math.abs(prior) > 0.02) direction = deltaAbs > 0 ? "up" : "down";
  return { direction, deltaAbs, deltaPct, prior, current };
};
const figure = ({ value, available = true, reason = null, reasonText = null, incomplete = false }) =>
  ({ value: available ? value : null, available, reason: available ? null : reason, reasonText: available ? null : reasonText, incomplete });

// The eleven jobs completed this quarter, for the on-time strip. Two ran
// past their last scheduled visit — 9 of 11 is the 81.8% the tile shows.
const COMPLETED_JOBS = [
  ["j_301", "Lavoie kitchen — shaker maple", "2026-09-01", "2026-09-04", "2026-09-04", true],
  ["j_299", "Nguyen bathroom vanity", "2026-08-27", "2026-08-27", "2026-08-27", true],
  ["j_296", "Bergeron walk-in closet", "2026-08-18", "2026-08-20", "2026-08-24", false],
  ["j_294", "Fortin kitchen refacing", "2026-08-10", "2026-08-13", "2026-08-13", true],
  ["j_291", "Girard pantry and mudroom", "2026-08-03", "2026-08-05", "2026-08-05", true],
  ["j_288", "Roy home-office built-ins", "2026-07-27", "2026-07-28", "2026-07-28", true],
  ["j_285", "Martel kitchen island", "2026-07-20", "2026-07-21", "2026-07-21", true],
  ["j_283", "Simard laundry cabinets", "2026-07-14", "2026-07-14", "2026-07-16", false],
  ["j_280", "Pelletier kitchen — white oak", "2026-07-06", "2026-07-10", "2026-07-10", true],
  ["j_278", "Côté ensuite vanities", "2026-07-02", "2026-07-02", "2026-07-02", true],
  ["j_276", "Beaulieu media wall", "2026-06-29", "2026-07-01", "2026-07-01", true],
].map(([jobId, title, scheduledStart, scheduledEnd, completedAt, onTime]) => ({
  // ONLY what lib/analytics/kpis.js emits — `jobId`/`title`. The KPIs page
  // maps them to GanttStrip's `id`/`label`; the fixture stays the API's
  // shape so a regression in that mapping shows up in the figure.
  jobId, title, scheduledStart, scheduledEnd, completedAt, onTime,
}));

function kpisPayload(from, to) {
  const weeksInPeriod = round1((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / (7 * 86400000) + 1 / 7);
  const periodRevenue = 163850;
  const backlogValue = 71240;
  const throughputWeekly = periodRevenue / weeksInPeriod;
  const monthKeys = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(2026, 8 - i, 1));
    monthKeys.push(d.toISOString().slice(0, 7));
  }
  const series = monthKeys.map((month) => {
    const rows = PAYMENTS.filter((p) => dayKey(p.date).startsWith(month));
    const amount = sum(rows);
    // ONLY what lib/analytics/receivables.js emits — `month`/`amount`. The
    // KPIs page maps them to Sparkline's `label`/`value`; same rule as the
    // Gantt rows above, the fixture is the API's shape.
    return { month, amount, count: rows.length, partial: month === "2026-09" };
  });
  const complete = series.filter((s) => !s.partial);
  const latest = complete[complete.length - 1];
  const prior = complete[complete.length - 2];
  const dims = [
    ["labourHours", "Labour hours", 6.5, 11],
    ["labourCost", "Labour cost", 4.8, 11],
    ["materials", "Materials and other job costs", -2.1, 11],
  ];
  const dimensions = {};
  for (const [key, label, medianPct, sample] of dims) {
    dimensions[key] = { key, label, unit: key === "labourHours" ? "hours" : "money", sample, reportable: true, medianPct, meanPct: round1(medianPct + 0.7), excluded: [], segments: {} };
  }
  const arAging = [
    { id: "not_due", overdue: false, count: 1, amount: INVOICE.balanceDue },
    { id: "days_1_30", overdue: true, count: 1, amount: 4200 },
    { id: "days_31_60", overdue: true, count: 1, amount: 3600 },
    { id: "days_61_90", overdue: true, count: 0, amount: 0 },
    { id: "days_90_plus", overdue: true, count: 0, amount: 0 },
  ];
  const arTotal = round2(arAging.reduce((s, b) => s + b.amount, 0));
  const csatCounts = { 1: 0, 2: 0, 3: 1, 4: 2, 5: 6 };
  return {
    range: { from, to },
    currency: "CAD",
    weeksInPeriod,
    sales: {
      winRate: kpi({ value: 41.7, sampleSize: 24 }),
      avgJobValue: kpi({ value: 14860, sampleSize: 10 }),
      leadToQuoteConversion: kpi({ value: 68.4, sampleSize: 19 }),
      backlogWeeks: kpi({
        value: round1(backlogValue / throughputWeekly),
        sampleSize: 5,
        raw: { backlogValue, backlogJobCount: 5, excludedNoQuote: 1, excludedNotAccepted: 0, throughputTotal: periodRevenue, throughputJobCount: 11, weeksInPeriod },
      }),
      winLossCounts: { won: 10, lost: 14, undecided: 6, undated: 0 },
    },
    profit: {
      grossMarginPct: kpi({ value: 38.4, sampleSize: 11 }),
      netMarginPct: kpi({ value: 21.6, sampleSize: 11 }),
      labourCostPctOfRevenue: kpi({ value: 31.2, sampleSize: 11 }),
      revenuePerEmployee: kpi({ value: round2(periodRevenue / 6), sampleSize: 6 }),
      materialsTrap: { triggered: false, buyListTotal: 0, expenseTotal: sum(between(EXPENSES, from, to).filter((e) => e.category === "Materials")) },
    },
    execution: {
      estimateAccuracy: { range: { from, to }, currency: "CAD", floor: 5, sample: 11, dimensions },
      onTimeCompletion: kpi({ value: 81.8, sampleSize: 11, jobs: COMPLETED_JOBS, raw: { onTime: 9, late: 2, excludedNoSchedule: 0, jobsInRange: 11 } }),
      utilisation: kpi({ value: 78.5, sampleSize: 3, raw: { scheduledHours: 1560, jobHours: 1224.6 } }),
    },
    quality: {
      reworkCallbackRate: kpi({ value: 9.1, sampleSize: 11 }),
      changeOrderRate: kpi({ value: 18.2, sampleSize: 11 }),
    },
    cash: {
      arAging: kpi({
        value: arTotal, sampleSize: 3, aging: arAging,
        overdueTotal: 7800, overdueCount: 2, undatedTotal: 0, undatedCount: 0, nothingOutstanding: false, noInvoices: false,
      }),
      revenueTrend: {
        available: true,
        months: 6,
        series,
        headline: { month: latest.month, priorMonth: prior.month, ...compare(latest.amount, prior.amount) },
        total: sum(PAYMENTS.filter((p) => monthKeys.some((m) => dayKey(p.date).startsWith(m)))),
      },
    },
    customer: {
      csat: kpi({ value: 4.6, sampleSize: 9, raw: { counts: csatCounts, lowScoreCount: 0 } }),
    },
    safety: {
      incidentRate: kpi({ value: 0, sampleSize: 0, raw: { incidents: 0, approvedHours: 1224.6 } }),
    },
    // lib/analytics/kpis.js's NOT_TRACKED, as the screen prints it.
    notTracked: [
      {
        key: "costPerLead",
        label: "Cost per lead",
        reason: "MarketingSpend.leads is typed in by hand, and outside Meta lead forms no lead — LeadRequest — carries a campaign id or a UTM value. A per-channel cost-per-lead built on a hand-typed denominator and no source attribution would look precise and mean nothing. The per-campaign figure that IS honest lives on the Spend page, for Meta lead-form leads only.",
      },
      {
        key: "equipmentUtilisation",
        label: "Equipment utilisation",
        reason: "AssetUseLog now records which asset was on which job, and GET /api/assets/utilisation reports it — but as its own screen at Settings → Assets, next to the depreciation register it explains, not rolled into this KPI period. A yard's utilisation isn't naturally a per-period rate the way the figures on this page are, and forcing it into one (\"held 62% of days this month\") would invent a claim about how many days it SHOULD have been in use that nothing in the product states.",
      },
    ],
  };
}

const shiftDays = (key, n) => new Date(new Date(`${key}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
const spanDays = (from, to) => Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000) + 1;

function moneyFlowPayload(from, to) {
  const payments = between(PAYMENTS, from, to);
  const expenses = between(EXPENSES, from, to);
  const incomeTotal = sum(payments);
  const expenseTotal = sum(expenses);
  // The comparison is like-for-like: the days that have happened, against
  // the same number of days before the period started.
  const elapsedTo = TODAY_KEY < to ? TODAY_KEY : to;
  const elapsedDays = spanDays(from, elapsedTo);
  const priorFrom = shiftDays(from, -elapsedDays);
  const priorTo = shiftDays(from, -1);
  const cmpIncome = sum(between(PAYMENTS, from, elapsedTo));
  const cmpExpense = sum(between(EXPENSES, from, elapsedTo));
  const priorIncome = sum(between(PAYMENTS, priorFrom, priorTo));
  const priorExpense = sum(between(EXPENSES, priorFrom, priorTo));
  const incomeByDay = new Map();
  for (const p of payments) incomeByDay.set(dayKey(p.date), (incomeByDay.get(dayKey(p.date)) || 0) + p.amount);
  const expenseByDay = new Map();
  for (const e of expenses) expenseByDay.set(dayKey(e.date), (expenseByDay.get(dayKey(e.date)) || 0) + e.amount);
  const days = [];
  for (let k = from; k <= to; k = shiftDays(k, 1)) {
    days.push({ date: k, income: round2(incomeByDay.get(k) || 0), expenses: round2(expenseByDay.get(k) || 0), future: k > elapsedTo });
  }
  const cats = byCategory(expenses).map((c) => ({ name: c.category, value: c.total }));
  const top = cats.slice(0, 3);
  const rest = cats.slice(3);
  if (rest.length) top.push({ name: "Other", value: round2(rest.reduce((s, r) => s + r.value, 0)), collapsed: rest.map((r) => r.name) });
  const periodDays = spanDays(from, to);
  return {
    range: { from, to },
    priorRange: { from: shiftDays(from, -periodDays), to: shiftDays(from, -1) },
    comparison: { basis: elapsedTo < to ? "to_date" : "full_period", inProgress: elapsedTo < to, elapsedDays, periodDays, priorRange: { from: priorFrom, to: priorTo } },
    income: figure({ value: incomeTotal }),
    expenses: figure({ value: expenseTotal }),
    remaining: figure({ value: round2(incomeTotal - expenseTotal) }),
    trends: {
      income: compare(cmpIncome, priorIncome),
      expenses: compare(cmpExpense, priorExpense),
      remaining: compare(round2(cmpIncome - cmpExpense), round2(priorIncome - priorExpense)),
    },
    days,
    chartAvailable: true,
    categories: top,
    categoriesTotal: round2(top.reduce((s, c) => s + c.value, 0)),
    materialsTrap: { triggered: false, buyListTotal: 0, expenseTotal: sum(expenses.filter((e) => e.category === "Materials")) },
  };
}

// Fixed costs come from Settings → Overhead's four tables, not from the
// expense ledger: rent and insurance as recorded overhead, Julie's office
// share as overhead pay, the CNC lease and the Sprinter loan as debt.
const BURN = {
  breakdown: { overhead: 3150, salaries: 4800, debt: 1150, debtInterest: 168.4, debtChargedInFull: 640, depreciation: 1421.91 },
  totalMonthlyBurn: 9100,
  totalMonthlyCost: 9689.31,
  assets: [],
  interestOnlyDebtIds: ["debt_sprinter"],
  doubleCountRisk: null,
  runwayMonths: null,
  sourcesRecorded: 7,
};

function financeOverviewPayload(from, to) {
  return {
    currency: "CAD",
    range: { from, to },
    payroll: {
      value: 63418.5, available: true, reason: null, reasonText: null, incomplete: false, sampleSize: 5,
      raw: { ratedHours: 2214, unratedHours: 0, unratedWorkers: 0, pendingHours: 14.5 },
    },
    fixedCosts: figure({ value: BURN.totalMonthlyCost }),
    marketing: {
      value: 1860, available: true, reason: null, reasonText: null, incomplete: false, approximate: false,
      convertedFrom: [], currencyConversions: [], excluded: [],
      channels: [
        { channel: "google_ads", spend: 1240, leads: 11 },
        { channel: "meta", spend: 620, leads: 7 },
      ],
    },
  };
}

// ── Expense tracking ────────────────────────────────────────────────────────

function expenseSummary(month) {
  const [y, m] = (month || TODAY_KEY.slice(0, 7)).split("-").map(Number);
  const rows = inMonth(EXPENSES, y, m);
  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    trend.push({
      month: d.toLocaleString("en-US", { month: "short", year: "2-digit" }),
      total: sum(inMonth(EXPENSES, d.getFullYear(), d.getMonth() + 1)),
    });
  }
  const recent = [...EXPENSES].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 20);
  return {
    period: { start: iso(at(y, m, 1, 0)), end: iso(new Date(y, m, 1)) },
    totalThisMonth: sum(rows),
    categoryBreakdown: byCategory(rows),
    associationBreakdown: {
      job: sum(rows.filter((r) => r.projectId)),
      overhead: sum(rows.filter((r) => r.isOverhead)),
      general: sum(rows.filter((r) => !r.isOverhead && !r.projectId)),
    },
    burnRate: BURN,
    trend,
    recent,
  };
}

export const ROUTES_MONEY = [
  // Payroll
  { path: "/api/payroll/runs", method: "GET", reply: () => ({ runs: PAY_RUNS, canRun: true }) },
  // Marc draws no wage through payroll — an owner-operator paid by dividend,
  // which is the case the route answers with `reason: "no_worker_record"`.
  { path: "/api/payroll/my-payslips", reply: () => ({ worker: null, payslips: [], reason: "no_worker_record" }) },
  { path: "/api/settings/pay-cycle", method: "GET", reply: () => payCycleShape() },

  // Expense tracking
  { path: "/api/expenses/summary", reply: ({ search }) => expenseSummary(search.get("month")) },
  { path: "/api/expenses", method: "GET", reply: () => EXPENSES },

  // Purchasing
  { path: "/api/purchase-orders", method: "GET", reply: () => ({ orders: PURCHASE_ORDERS }) },
  { path: "/api/suppliers", method: "GET", reply: ({ search }) => ({ suppliers: search.get("includeInactive") ? SUPPLIERS : SUPPLIERS.filter((s) => s.active) }) },
  { path: "/api/stock", method: "GET", reply: () => ({ levels: STOCK, low: STOCK.filter((l) => l.belowThreshold === true), withoutThreshold: STOCK.filter((l) => l.belowThreshold === null).length }) },
  { path: "/api/stock/movements", method: "GET", reply: () => ({ movements: STOCK_MOVEMENTS }) },

  // Fleet
  { path: "/api/fleet", method: "GET", reply: () => fleetPayload() },

  // Insights
  { path: "/api/analytics/benchmark", reply: () => BENCHMARK },
  { path: "/api/analytics/pricing-benchmark", reply: () => BENCHMARK },

  // KPI dashboard — three endpoints, one period selector.
  { path: "/api/analytics/kpis", reply: ({ search }) => kpisPayload(search.get("from") || "2026-07-01", search.get("to") || "2026-09-30") },
  { path: "/api/analytics/money-flow", reply: ({ search }) => moneyFlowPayload(search.get("from") || "2026-07-01", search.get("to") || "2026-09-30") },
  { path: "/api/analytics/finance-overview", reply: ({ search }) => financeOverviewPayload(search.get("from") || "2026-07-01", search.get("to") || "2026-09-30") },
];
