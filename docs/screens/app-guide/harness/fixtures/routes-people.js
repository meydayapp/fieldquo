// Fixture routes for the people screens. See routes.js for the entry shape.
//
// Everything here is the same shop as company.js — the six PEOPLE, Sophie
// Dubois, J-318 — seen through the roster, the rota, the clock, the
// timesheet, leave and the safety log. Shapes follow the route handlers
// under app/api/..., field for field, so a page reads a fixture exactly as
// it reads production.
import { COMPANY, PEOPLE, CLIENT, QUOTE, JOB, INVOICE, day, iso, TODAY } from "./company.js";

const [MARC, JULIE, SAM, DAN, LEO, ANA] = PEOPLE;

// ── Clients ────────────────────────────────────────────────────────────────
const CLIENTS = [
  CLIENT,
  {
    id: "cl_lefebvre", name: "Martin Lefebvre", firstName: "Martin", lastName: "Lefebvre",
    email: "m.lefebvre@example.com", phone: "+1 450 555 0192", address: "312 rue Principale",
    city: "Laval", province: "QC", postalCode: "H7X 1L4", country: "CA", language: "fr",
    tags: ["bathroom"], createdAt: iso(day(-140)), updatedAt: iso(day(-30)),
    _count: { quotes: 2, jobs: 1, invoices: 2 },
  },
  {
    id: "cl_khoury", name: "Nadia Khoury", firstName: "Nadia", lastName: "Khoury",
    email: "nadia.khoury@example.com", phone: "+1 514 555 0163", address: "5230 av. du Parc",
    city: "Montréal", province: "QC", postalCode: "H2V 4G7", country: "CA", language: "en",
    tags: ["kitchen"], createdAt: iso(day(-75)), updatedAt: iso(day(-9)),
    _count: { quotes: 1, jobs: 0, invoices: 0 },
  },
  {
    id: "cl_beaulieu", name: "Rénovations Beaulieu inc.", type: "company", contactName: "Éric Beaulieu",
    email: "eric@renobeaulieu.ca", phone: "+1 450 555 0128", address: "77 boul. des Laurentides",
    city: "Laval", province: "QC", postalCode: "H7G 2S9", country: "CA", language: "fr",
    tags: ["contractor", "repeat"], createdAt: iso(day(-380)), updatedAt: iso(day(-4)),
    _count: { quotes: 6, jobs: 5, invoices: 5 },
  },
  {
    id: "cl_raman", name: "Priya Raman", firstName: "Priya", lastName: "Raman",
    email: "priya.raman@example.com", phone: "+1 450 555 0174", address: "18 rue des Pins",
    city: "Boisbriand", province: "QC", postalCode: "J7G 1P3", country: "CA", language: "en",
    tags: ["closet"], createdAt: iso(day(-260)), updatedAt: iso(day(-200)),
    _count: { quotes: 1, jobs: 1, invoices: 1 },
  },
];

// ── Client equipment ───────────────────────────────────────────────────────
// What a cabinet shop installs and warrants: hardware, counters, lighting.
// Warranty state is computed the way lib/expiry/window.js does — a blank date
// is UNKNOWN and never listed, expired before due-soon, soonest first.
const EQUIPMENT = [
  { id: "eq_lefebvre_hinges", clientId: "cl_lefebvre", name: "Soft-close hinge system", manufacturer: "Blum", modelNumber: "CLIP top BLUMOTION", siteAddress: "312 rue Principale, Laval", installedAt: iso(day(-712)), warrantyEndsAt: iso(day(18)), warrantyProvider: "Blum" },
  { id: "eq_raman_counter", clientId: "cl_raman", name: "Quartz countertop", manufacturer: "Caesarstone", modelNumber: "5141 Frosty Carrina", siteAddress: "18 rue des Pins, Boisbriand", installedAt: iso(day(-200)), warrantyEndsAt: iso(day(41)), warrantyProvider: "Installer warranty" },
  { id: "eq_beaulieu_led", clientId: "cl_beaulieu", name: "Under-cabinet LED lighting", manufacturer: "Häfele", modelNumber: "Loox5 LED 3045", siteAddress: "77 boul. des Laurentides, Laval", installedAt: iso(day(-745)), warrantyEndsAt: iso(day(-15)), warrantyProvider: "Häfele" },
  { id: "eq_dubois_island", clientId: CLIENT.id, name: "White oak island", manufacturer: "Érable Design", modelNumber: null, siteAddress: `${CLIENT.address}, ${CLIENT.city}`, installedAt: null, warrantyEndsAt: null, warrantyProvider: null },
];
const clientOf = (id) => {
  const c = CLIENTS.find((x) => x.id === id);
  return c ? { id: c.id, name: c.name, phone: c.phone, email: c.email } : null;
};
function warrantyState(endsAt, withinDays) {
  if (!endsAt) return { state: "unknown", daysRemaining: null, endsAt: null };
  const days = Math.ceil((new Date(endsAt).getTime() - TODAY.getTime()) / 86400000);
  const state = days < 0 ? "expired" : days <= withinDays ? "due_soon" : "ok";
  return { state, daysRemaining: days, endsAt };
}

// ── Workers (the crew roster the rota, clock and timesheet schedule) ───────
// Every member of the shop is also a Worker row, linked to their login, so
// Manage Team has no "On the payroll, no login" section to draw.
const worker = (p, extra) => ({
  id: `w_${p.id.slice(2)}`, companyId: COMPANY.id, userId: p.userId, managerId: null,
  name: p.name, email: p.email, phone: p.phone, active: true, type: "employee",
  createdAt: p.createdAt, user: { id: p.userId, email: p.email }, ...extra,
});
const WORKERS = [
  worker(ANA, { hourlyRate: 28 }),
  worker(DAN, { hourlyRate: 34 }),
  worker(JULIE, { hourlyRate: 38 }),
  worker(LEO, { hourlyRate: 31 }),
  worker(MARC, { hourlyRate: 45 }),
  worker(SAM, { hourlyRate: 32 }),
];
const W = Object.fromEntries(WORKERS.map((w) => [w.userId, w]));

// ── Manage Team ────────────────────────────────────────────────────────────
// The roster route nests the login under `user` and adds lastLoginAt; the
// top-level name/email stay so every other page reading PEOPLE still works.
const lastLogin = { u_marc: day(0, 8, 41), u_julie: day(0, 8, 12), u_sam: day(-1, 17, 30), u_dan: day(0, 7, 5), u_leo: day(0, 7, 28), u_ana: day(0, 7, 31) };
const MEMBERS = PEOPLE.map((p) => ({
  ...p,
  user: { id: p.userId, name: p.name, email: p.email, image: null },
  lastLoginAt: iso(lastLogin[p.userId]),
}));
const PENDING_INVITES = [
  { id: "pend_mathieu", companyId: COMPANY.id, name: "Mathieu Lavoie", email: "mathieu.lavoie@example.com", role: "employee", permissions: LEO.permissions, phone: null, createdAt: iso(day(-2, 16)) },
];
const SEATS = {
  used: 4, // Marc, Julie, Samuel, Daniel
  limit: null,
  seatCap: 6,
  crewCap: 11,
  tier: "Shop",
  nextTier: { label: "Crew", seats: 10, crewSeats: 20 },
  crew: 3, // Léo, Ana, and Mathieu's pending invite
  breakdown: { administrator: 1, manager: 1, dispatcher: 1, worker: 1, crew: 3, custom: 0 },
};

// ── Subcontractors ─────────────────────────────────────────────────────────
const SUBS = [
  { id: "sub_morin", name: "Électrique Morin inc.", trade: "Electrical", contactName: "Patrick Morin", email: "info@electriquemorin.ca", phone: "+1 450 555 0201", linkedCompanyId: null, insuranceExpiresAt: iso(day(18)), clearanceExpiresAt: iso(day(160)), taxFormRequired: true, notes: null, active: true, paidThisYear: 6840, paymentsThisYear: 3 },
  { id: "sub_granite", name: "Comptoirs Granite Plus", trade: "Countertop fabrication", contactName: "Lucie Bergeron", email: "lucie@graniteplus.ca", phone: "+1 450 555 0219", linkedCompanyId: null, insuranceExpiresAt: iso(day(230)), clearanceExpiresAt: iso(day(-9)), taxFormRequired: true, notes: null, active: true, paidThisYear: 11200, paymentsThisYear: 2 },
  { id: "sub_dagenais", name: "Plomberie Dagenais", trade: "Plumbing", contactName: "Yves Dagenais", email: "yves@plomberiedagenais.ca", phone: "+1 450 555 0244", linkedCompanyId: null, insuranceExpiresAt: iso(day(290)), clearanceExpiresAt: iso(day(305)), taxFormRequired: true, notes: null, active: true, paidThisYear: 1950, paymentsThisYear: 1 },
];
function subAttention(sub) {
  const expiries = [
    { kind: "insurance", ...warrantyState(sub.insuranceExpiresAt, 60) },
    { kind: "clearance", ...warrantyState(sub.clearanceExpiresAt, 60) },
  ];
  const rank = { expired: 3, due_soon: 2, ok: 1, unknown: 0 };
  const state = expiries.reduce((worst, e) => (rank[e.state] > rank[worst] ? e.state : worst), "unknown");
  return { state, reasons: expiries.filter((e) => e.state === "expired" || e.state === "due_soon") };
}

// ── Shifts, the fixture week ───────────────────────────────────────────────
const shift = (id, p, offset, from, to, job, note, published = true) => ({
  id, workerId: W[p.userId].id, start: iso(day(offset, from)), end: iso(day(offset, to)), note, published,
  availabilityOverrideAt: null, availabilityOverrideNote: null, availabilityOverrideBy: null,
  worker: { name: p.name }, job: job ? { id: job.id, title: job.title } : null,
});
const SHIFTS = [
  shift("sh_01", LEO, 0, 7, 15, JOB, "Load the van, deliver cabinets"),
  shift("sh_02", ANA, 0, 7, 15, JOB, "Load the van, deliver cabinets"),
  shift("sh_03", DAN, 0, 8, 16, null, "Shop — cut list for Khoury"),
  shift("sh_04", LEO, 1, 7, 16, JOB, "Install day 1 — uppers and bases"),
  shift("sh_05", ANA, 1, 7, 16, JOB, "Install day 1 — uppers and bases"),
  shift("sh_06", SAM, 1, 9, 12, null, "Site measure — Khoury kitchen, Montréal"),
  shift("sh_07", LEO, 2, 7, 16, JOB, "Install day 2 — island, trim"),
  shift("sh_08", ANA, 2, 7, 16, JOB, "Install day 2 — island, trim"),
  shift("sh_09", DAN, 2, 8, 16, null, "Shop — finishing"),
  shift("sh_10", SAM, 3, 8, 16, null, "Quotes and follow-ups", false),
  shift("sh_11", LEO, 3, 8, 16, null, "Shop — Beaulieu vanities", false),
  shift("sh_12", ANA, 4, 8, 15, null, "Shop — Beaulieu vanities", false),
  shift("sh_13", DAN, 4, 8, 15, null, "Deliveries — Beaulieu", false),
];

// ── Time entries (last week, plus this morning's punches) ──────────────────
const stamp = (id, kind, at, distance, accuracy = 12) => ({ id, kind, distanceToSiteM: distance, accuracyM: accuracy, at: iso(at) });
const entry = (id, p, offset, from, to, status, job, opts = {}) => {
  const clockIn = day(offset, from, opts.inMin || 0);
  const clockOut = to == null ? null : day(offset, to, opts.outMin || 0);
  const hours = clockOut ? Math.round(((clockOut - clockIn) / 3600000) * 100) / 100 : null;
  return {
    id, workerId: W[p.userId].id, jobId: job ? job.id : null, clockIn: iso(clockIn), clockOut: clockOut ? iso(clockOut) : null,
    hours, status, note: null, approvedById: status === "approved" ? MARC.userId : null, approvedAt: status === "approved" ? iso(day(-2, 17)) : null,
    worker: { id: W[p.userId].id, name: p.name, hourlyRate: W[p.userId].hourlyRate, userId: p.userId },
    job: job ? { id: job.id, title: job.title } : null,
    locationStamps: opts.stamps || [],
  };
};
const BEAULIEU_JOB = { id: "j_312", title: "Beaulieu — 4 bathroom vanities" };
const TIME_ENTRIES = [
  // This morning, still open — Léo and Ana loading for the Dubois install.
  entry("te_20", LEO, 0, 7, null, "pending", JOB, { inMin: 28, stamps: [stamp("ls_20a", "clock_in", day(0, 7, 28), 40)] }),
  entry("te_21", ANA, 0, 7, null, "pending", JOB, { inMin: 31, stamps: [stamp("ls_21a", "clock_in", day(0, 7, 31), 55)] }),
  // Last week, on the vanities for Beaulieu — Friday's still waiting for approval.
  entry("te_15", LEO, -3, 7, 15, "pending", BEAULIEU_JOB, { inMin: 55, outMin: 40, stamps: [stamp("ls_15a", "clock_in", day(-3, 7, 55), 120), stamp("ls_15b", "clock_out", day(-3, 15, 40), 95)] }),
  entry("te_16", ANA, -3, 8, 15, "pending", BEAULIEU_JOB, { inMin: 2, outMin: 45, stamps: [stamp("ls_16a", "clock_in", day(-3, 8, 2), 2140, 18), stamp("ls_16b", "clock_out", day(-3, 15, 45), 80)] }),
  entry("te_13", LEO, -4, 8, 16, "approved", BEAULIEU_JOB, { stamps: [stamp("ls_13a", "clock_in", day(-4, 8), 60), stamp("ls_13b", "clock_out", day(-4, 16), 70)] }),
  entry("te_14", ANA, -4, 8, 16, "approved", BEAULIEU_JOB, { stamps: [stamp("ls_14a", "clock_in", day(-4, 8), 45), stamp("ls_14b", "clock_out", day(-4, 16), 50)] }),
  entry("te_11", LEO, -5, 8, 16, "approved", BEAULIEU_JOB, { inMin: 5, outMin: 10 }),
  entry("te_12", DAN, -5, 8, 16, "approved", null),
  entry("te_10", ANA, -6, 8, 15, "approved", BEAULIEU_JOB, { outMin: 30, stamps: [stamp("ls_10a", "clock_in", day(-6, 8), 30), stamp("ls_10b", "clock_out", day(-6, 15, 30), 25)] }),
];

// ── Time off ───────────────────────────────────────────────────────────────
const POLICIES = [
  { id: "lp_vac", companyId: COMPANY.id, name: "Vacation", kind: "vacation", paid: true, requiresApproval: true, accrualMethod: "fixed_days", daysPerYear: 15, percentOfGross: null, carryoverMaxDays: 5, active: true },
  { id: "lp_sick", companyId: COMPANY.id, name: "Sick days", kind: "sick", paid: true, requiresApproval: false, accrualMethod: "fixed_days", daysPerYear: 5, percentOfGross: null, carryoverMaxDays: 0, active: true },
  { id: "lp_personal", companyId: COMPANY.id, name: "Personal day", kind: "personal", paid: false, requiresApproval: true, accrualMethod: "fixed_days", daysPerYear: 3, percentOfGross: null, carryoverMaxDays: 0, active: true },
];
const policyRef = (id) => { const p = POLICIES.find((x) => x.id === id); return { id: p.id, name: p.name, kind: p.kind, paid: p.paid, accrualMethod: p.accrualMethod }; };
const balance = (id, p, policyId, accrued, used, pending = 0, carried = 0) => ({
  // accruedDays is reported the way lib/leave/accrual.js remainingBalance()
  // reports it: this year's accrual plus what carried in.
  id, workerId: W[p.userId].id, policyId, year: 2026, accruedDays: accrued + carried, usedDays: used, carriedInDays: carried,
  accruedAmount: 0, usedAmount: 0, pendingDays: pending, remainingDays: accrued + carried - used - pending, remainingAmount: 0,
  policy: policyRef(policyId), worker: { id: W[p.userId].id, name: p.name },
});
const leave = (id, p, policyId, startOff, endOff, days, status, reason, extra = {}) => ({
  id, workerId: W[p.userId].id, policyId, startDate: iso(day(startOff, 0)), endDate: iso(day(endOff, 0)), days, halfDay: false,
  status, reason, reviewNote: null, reviewedById: null, createdAt: iso(day(startOff - 12, 10)),
  policy: policyRef(policyId), worker: { id: W[p.userId].id, name: p.name }, routing: null, ...extra,
});
const MY_REQUESTS = [
  leave("lr_marc1", MARC, "lp_vac", 25, 29, 5, "approved", "Fishing week at the chalet"),
  leave("lr_marc0", MARC, "lp_vac", -70, -66, 5, "approved", null),
];
const TEAM_REQUESTS = [
  leave("lr_leo1", LEO, "lp_personal", 11, 11, 1, "pending", "Moving day", { routing: { approverWorkerId: W.u_julie.id, label: "Waiting on Julie Gagnon.", note: null, canAct: true } }),
  leave("lr_ana1", ANA, "lp_vac", 21, 25, 5, "approved", "Family visit in Porto", { reviewedById: JULIE.userId }),
  ...MY_REQUESTS,
  leave("lr_sam0", SAM, "lp_sick", -33, -33, 1, "approved", null),
  leave("lr_dan0", DAN, "lp_vac", -55, -52, 4, "approved", null),
];
const MY_BALANCES = [
  balance("lb_marc_vac", MARC, "lp_vac", 15, 5, 0, 3),
  balance("lb_marc_sick", MARC, "lp_sick", 5, 0),
  balance("lb_marc_pers", MARC, "lp_personal", 3, 0),
];
const TEAM_BALANCES = [
  ...MY_BALANCES,
  balance("lb_julie_vac", JULIE, "lp_vac", 15, 4),
  balance("lb_sam_vac", SAM, "lp_vac", 10, 2),
  balance("lb_sam_sick", SAM, "lp_sick", 5, 1),
  balance("lb_dan_vac", DAN, "lp_vac", 10, 4),
  balance("lb_leo_vac", LEO, "lp_vac", 10, 0),
  balance("lb_leo_pers", LEO, "lp_personal", 3, 0, 1),
  balance("lb_ana_vac", ANA, "lp_vac", 10, 5),
];

// ── Safety ─────────────────────────────────────────────────────────────────
const reportedBy = (p) => ({ id: p.id, user: { name: p.name, email: p.email } });
const INCIDENTS = [
  {
    id: "si_02", kind: "near_miss", status: "open", occurredAt: iso(day(-3, 14, 20)),
    location: "Beaulieu site — garage, unloading", jobId: BEAULIEU_JOB.id, job: BEAULIEU_JOB,
    description: "Vanity carcass slid off the dolly on the ramp and landed a foot from Ana. Nobody hurt. The ramp had frost on it and the load wasn't strapped.",
    workStopped: true, regulatoryNote: null, followUpNotes: null, reportedByMemberId: LEO.id, reportedByMember: reportedBy(LEO),
    involvedWorkerId: W.u_ana.id, involvedWorker: { id: W.u_ana.id, name: ANA.name }, photos: [], createdAt: iso(day(-3, 15)), updatedAt: iso(day(-3, 15)),
  },
  {
    id: "si_01", kind: "property_damage", status: "reviewed", occurredAt: iso(day(-19, 10, 45)),
    location: "Shop — finishing room", jobId: null, job: null,
    description: "Spray gun hose caught the edge of a finished door on the drying rack; two doors need re-spraying. No one in the booth at the time.",
    workStopped: false, regulatoryNote: "No CNESST reporting required — no injury, damage to our own stock only.",
    followUpNotes: "Rack moved 1 m from the booth door; hose now routed overhead.", reportedByMemberId: DAN.id, reportedByMember: reportedBy(DAN),
    involvedWorkerId: null, involvedWorker: null, photos: [], createdAt: iso(day(-19, 11)), updatedAt: iso(day(-17, 9)),
  },
];

// ── Team schedule (availability) ───────────────────────────────────────────
const weekdays = (from, to, days = [1, 2, 3, 4, 5]) => days.map((dayOfWeek) => ({ dayOfWeek, startTime: from, endTime: to }));
const TEAM_SCHEDULES = [
  { userId: MARC.userId, name: MARC.name, role: MARC.role, hasAvailability: true, availability: weekdays("08:00", "17:00"), upcoming: [
    { when: iso(day(1, 10)), label: "Nadia Khoury", kind: "booking" },
    { when: iso(day(3, 14)), label: "Rénovations Beaulieu inc.", kind: "appointment" },
  ] },
  { userId: JULIE.userId, name: JULIE.name, role: JULIE.role, hasAvailability: true, availability: weekdays("08:00", "16:30"), upcoming: [] },
  { userId: SAM.userId, name: SAM.name, role: SAM.role, hasAvailability: true, availability: [...weekdays("08:00", "17:00", [1, 2, 3, 4]), { dayOfWeek: 5, startTime: "08:00", endTime: "12:00" }], upcoming: [
    { when: iso(day(1, 9)), label: "Nadia Khoury", kind: "appointment" },
    { when: iso(day(2, 13)), label: "Martin Lefebvre", kind: "booking" },
    { when: iso(day(8, 10)), label: "Priya Raman", kind: "booking" },
  ] },
  { userId: DAN.userId, name: DAN.name, role: DAN.role, hasAvailability: true, availability: weekdays("07:30", "16:00"), upcoming: [] },
  { userId: LEO.userId, name: LEO.name, role: LEO.role, hasAvailability: true, availability: weekdays("07:00", "15:30"), upcoming: [] },
  { userId: ANA.userId, name: ANA.name, role: ANA.role, hasAvailability: true, availability: weekdays("07:00", "15:30", [1, 2, 3, 4]), upcoming: [] },
];

// ── The clock, as the signed-in person (Marc) sees it ──────────────────────
// /api/time-clock resolves the worker from the session, so this is one
// person's punch, not the roster's. Marc is on site with the crew this morning.
const MARC_OPEN = { id: "te_22", clockIn: iso(day(0, 7, 30)), jobId: JOB.id, job: { id: JOB.id, title: JOB.title } };
const CLOCK = {
  worker: { id: W.u_marc.id, name: MARC.name },
  open: MARC_OPEN,
  today: [{ ...MARC_OPEN, clockOut: null, hours: null, status: "pending", workerId: W.u_marc.id }],
  todayHours: 1.5,
  jobOptions: [
    { id: JOB.id, title: JOB.title, client: CLIENT.name, scheduledAt: iso(day(0, 7, 30)), today: true },
    { id: BEAULIEU_JOB.id, title: BEAULIEU_JOB.title, client: "Rénovations Beaulieu inc.", scheduledAt: null, today: false },
  ],
  todayCount: 1,
  suggestedJobId: JOB.id,
  truncated: false,
};

export const ROUTES_PEOPLE = [
  { path: "/api/clients", method: "GET", reply: () => CLIENTS },

  {
    path: "/api/equipment/expiring",
    reply: ({ search }) => {
      const asked = Number(search.get("withinDays"));
      const withinDays = Number.isFinite(asked) && asked >= 0 ? Math.min(asked, 730) : 60;
      const rows = EQUIPMENT.map((e) => ({ ...e, client: clientOf(e.clientId), warranty: warrantyState(e.warrantyEndsAt, withinDays) }));
      const tally = { expired: 0, dueSoon: 0, ok: 0, unknown: 0, total: rows.length };
      for (const r of rows) tally[r.warranty.state === "due_soon" ? "dueSoon" : r.warranty.state] += 1;
      const rank = { expired: 0, due_soon: 1 };
      const equipment = rows
        .filter((r) => r.warranty.state in rank)
        .sort((a, b) => rank[a.warranty.state] - rank[b.warranty.state] || new Date(a.warranty.endsAt) - new Date(b.warranty.endsAt));
      return { withinDays, equipment, tally };
    },
  },

  { path: "/api/settings/members", method: "GET", reply: () => MEMBERS },
  { path: "/api/settings/members/pending", method: "GET", reply: () => ({ pending: PENDING_INVITES, seats: SEATS }) },
  { path: "/api/settings/members/self/role", reply: () => ({ assignableRoles: ["admin", "supervisor", "employee"], canGrantAccess: true, yourRole: "owner", role: "owner" }) },
  { path: "/api/workers", method: "GET", reply: () => WORKERS },

  {
    path: "/api/subcontractors",
    method: "GET",
    reply: ({ search }) => {
      const year = Number(search.get("year")) || 2026;
      const subs = SUBS.map((s) => ({ ...s, attention: subAttention(s) }));
      const dueSoon = subs
        .filter((s) => s.attention.reasons.length)
        .sort((a, b) => (a.attention.state === "expired" ? 0 : 1) - (b.attention.state === "expired" ? 0 : 1))
        .map((s) => ({ subcontractorId: s.id, name: s.name, trade: s.trade, state: s.attention.state, reasons: s.attention.reasons }));
      const tally = { expired: 0, dueSoon: 0, ok: 0, unknown: 0, total: subs.length };
      for (const s of subs) tally[s.attention.state === "due_soon" ? "dueSoon" : s.attention.state] += 1;
      return { subcontractors: subs, dueSoon, tally, year, canEdit: true, canSeeMoney: true };
    },
  },

  {
    path: "/api/shifts",
    method: "GET",
    reply: ({ search }) => {
      const from = new Date(search.get("from") || 0).getTime();
      const to = new Date(search.get("to") || 8.64e15).getTime();
      const shifts = SHIFTS.filter((s) => { const t = new Date(s.start).getTime(); return t >= from && t < to; });
      return { manager: true, shifts, workers: WORKERS.map((w) => ({ id: w.id, name: w.name, userId: w.userId })), missingHours: [] };
    },
  },

  { path: "/api/team/schedules", reply: () => ({ team: TEAM_SCHEDULES, canManage: true }) },

  { path: "/api/time-clock", method: "GET", reply: () => CLOCK },

  { path: "/api/time-entries", method: "GET", reply: () => TIME_ENTRIES },

  {
    path: "/api/leave",
    method: "GET",
    reply: ({ search }) =>
      search.get("scope") === "team"
        ? { scope: "team", policies: POLICIES, requests: TEAM_REQUESTS, balances: TEAM_BALANCES, canApprove: true }
        : { scope: "self", worker: { id: W.u_marc.id, name: MARC.name }, policies: POLICIES, requests: MY_REQUESTS, balances: MY_BALANCES },
  },

  {
    path: "/api/safety-incidents",
    method: "GET",
    reply: ({ search }) => {
      const status = search.get("status");
      return { incidents: status ? INCIDENTS.filter((i) => i.status === status) : INCIDENTS };
    },
  },
];
