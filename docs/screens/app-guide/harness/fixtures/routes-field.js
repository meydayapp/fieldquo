// docs/screens/app-guide/harness/fixtures/routes-field.js
//
// Field work (2026-09-21): the daily sheets, the past-client callback list
// and the Settings → Field work switches. Same fixture company (Érable
// Design), same people; the day is the harness's fixed "today" so Léo's
// sheet always reads Monday 14 September.
import { COMPANY, PEOPLE, CLIENT, JOB, day, iso } from "./company.js";
import { W, TIME_ENTRIES } from "./routes-people.js";

const [MARC, JULIE, SAM, DAN, LEO, ANA] = PEOPLE;
const DATE = "2026-09-14";

const leoEntries = TIME_ENTRIES.filter((e) => e.workerId === W.u_leo.id && e.clockIn.startsWith("2026-09-14"));
const anaEntries = TIME_ENTRIES.filter((e) => e.workerId === W.u_ana.id && e.clockIn.startsWith("2026-09-14"));

export const LEO_SHEET = {
  id: "ds_leo_0914",
  companyId: COMPANY.id,
  workerId: W.u_leo.id,
  date: `${DATE}T00:00:00.000Z`,
  dateKey: DATE,
  jobId: JOB.id,
  job: { id: JOB.id, title: JOB.title },
  objectives: [
    { id: "o1", taskId: "task_01", title: "Hang the uppers — kitchen wall A", plannedHours: 4, status: "done", actualHours: 3.6, note: "", beforePhoto: "https://res.cloudinary.com/demo/image/upload/w_400/sample.jpg", afterPhoto: "https://res.cloudinary.com/demo/image/upload/w_400/sample.jpg" },
    { id: "o2", taskId: "task_02", title: "Set the bases and level the run", plannedHours: 4, status: "partial", actualHours: 4.3, note: "", beforePhoto: "https://res.cloudinary.com/demo/image/upload/w_400/sample.jpg", afterPhoto: null },
  ],
  upsells: [{ id: "u1", description: "Under-cabinet LED strip — 3 runs", amountCents: 34000, quoteAddOnId: "ao_led", changeOrderId: null }],
  evaluationScore: 4,
  evaluationNote: "Uppers dead level, clean scribe on the end panel. Bases slipped to Tuesday — the island panels came late, not Léo. Client happy.",
  evaluatedById: JULIE.userId,
  evaluatedBy: { name: JULIE.name },
  evaluatedAt: iso(day(0, 17, 5)),
  bonusCents: null,
  bonusBreakdown: null,
  payRunId: null,
};

export const DAILY_SHEETS = {
  date: DATE,
  today: DATE,
  coordinator: true,
  ownWorkerId: W.u_marc.id,
  hasRule: false,
  currency: COMPANY.currency,
  rows: [
    {
      worker: { id: W.u_leo.id, name: LEO.name, title: "Lead installer" },
      entries: leoEntries.map((e) => ({ ...e, job: { id: JOB.id, title: JOB.title }, locationStamps: [] })),
      sheet: LEO_SHEET,
      suggestedObjectives: [],
      jobs: [{ id: JOB.id, title: JOB.title }],
    },
    {
      worker: { id: W.u_ana.id, name: ANA.name, title: "Installer" },
      entries: anaEntries.map((e) => ({ ...e, job: { id: JOB.id, title: JOB.title }, locationStamps: [] })),
      sheet: null,
      suggestedObjectives: [
        { id: "o3", taskId: "task_03", title: "Island — assemble and place", plannedHours: 5, status: "planned", actualHours: null, note: "", beforePhoto: null, afterPhoto: null },
        { id: "o4", taskId: "task_04", title: "Toe kicks and fillers", plannedHours: 2, status: "planned", actualHours: null, note: "", beforePhoto: null, afterPhoto: null },
      ],
      jobs: [{ id: JOB.id, title: JOB.title }],
    },
  ],
};

export const DAILY_WEEK = {
  worker: { id: W.u_leo.id, name: LEO.name },
  weekOf: DATE,
  days: [
    { dateKey: "2026-09-14", hours: 7.9, objectives: 2, done: 1, upsellCents: 34000, score: 4, bonusCents: null, hasSheet: true },
    { dateKey: "2026-09-15", hours: 0, objectives: 0, done: 0, upsellCents: 0, score: null, bonusCents: null, hasSheet: false },
    { dateKey: "2026-09-16", hours: 0, objectives: 0, done: 0, upsellCents: 0, score: null, bonusCents: null, hasSheet: false },
    { dateKey: "2026-09-17", hours: 0, objectives: 0, done: 0, upsellCents: 0, score: null, bonusCents: null, hasSheet: false },
    { dateKey: "2026-09-18", hours: 0, objectives: 0, done: 0, upsellCents: 0, score: null, bonusCents: null, hasSheet: false },
    { dateKey: "2026-09-19", hours: 0, objectives: 0, done: 0, upsellCents: 0, score: null, bonusCents: null, hasSheet: false },
    { dateKey: "2026-09-20", hours: 0, objectives: 0, done: 0, upsellCents: 0, score: null, bonusCents: null, hasSheet: false },
  ],
  totals: { hours: 7.9, objectives: 2, done: 1, upsellCents: 34000, avgScore: 4, bonusCents: null, daysWithSheet: 1 },
};

export const FIELD_WORK = {
  offlineCachingEnabled: true,
  labourSellRate: 85,
  performancePayRule: null,
  currency: COMPANY.currency,
  rateOptions: [{ key: "company", rate: 85, label: "", source: "company" }],
};

const member = (p) => ({ id: p.id, name: p.name, role: p.role });
export const CALLBACK_RULES = {
  rules: [
    {
      id: "cbr_1", companyId: COMPANY.id, enabled: true, weekday: 1, monthsSinceJob: 10, minTicket: 1500, areaKind: "city", areaValue: "Laval",
      assigneeMemberId: SAM.id, assigneeName: SAM.name, weeklyCap: 8, createdAt: iso(day(-30)), updatedAt: iso(day(-30)),
    },
  ],
  members: [MARC, JULIE, SAM, DAN].map(member),
  workAreas: [{ id: "wa_laval", name: "Laval", hasPolygon: false }],
  areaKinds: ["postcode", "city", "work_area"],
  timezone: "America/Toronto",
  currency: COMPANY.currency,
};

const entry = (id, name, city, lastJobAt, lastJobTitle, lastTicket, outcome = null, extra = {}) => ({
  id, client: { id: `cl_${id}`, name, phone: "+1 450 555 0190", city, postalCode: "H7N 1A1" },
  lastJobAt: iso(lastJobAt), lastJobTitle, lastTicket, outcome, outcomeNote: null, callBackOn: null, outcomeAt: outcome ? iso(day(0, 10)) : null, outcomeByName: outcome ? SAM.name : null, ...extra,
});
export const CALLBACKS = {
  weekOf: DATE,
  weeks: [DATE],
  outcomes: ["booked", "call_back", "not_now", "not_interested", "wrong_number", "do_not_contact"],
  lists: [
    {
      id: "cbl_1", weekOf: DATE,
      rule: { ...CALLBACK_RULES.rules[0] },
      entries: [
        entry("e1", "Rita Angelos", "Laval", day(-660), "Exterior trim", 3900, "booked", { outcomeNote: "Estimate Thu 10:00" }),
        entry("e2", "Paul & Meera Sandhu", "Laval", day(-390), "3 bedrooms", 2650, "call_back", { outcomeNote: "After the kids' school starts", callBackOn: "2026-10-05" }),
        entry("e3", "Greg Lalonde", "Laval", day(-420), "Garage + doors", 1820, "not_interested", { outcomeNote: "Moving in spring" }),
        entry("e4", "Hélène Fortier", "Laval", day(-370), "Main floor", 4200),
        entry("e5", "Aman & Josée Bakshi", "Laval", day(-340), "Basement", 2100),
        entry("e6", "Tom Whitcombe", "Laval", day(-320), "Exterior", 5600),
      ],
    },
  ],
};

export const ROUTES_FIELD = [
  { path: "/api/daily-sheets", method: "GET", reply: () => DAILY_SHEETS },
  { path: "/api/daily-sheets/week", method: "GET", reply: () => DAILY_WEEK },
  { path: "/api/daily-sheets/upsells", method: "GET", reply: () => ({ options: [{ quoteAddOnId: "ao_led", description: "Under-cabinet LED strip — 3 runs", amountCents: 34000 }] }) },
  { path: "/api/settings/field-work", method: "GET", reply: () => FIELD_WORK },
  { path: "/api/settings/callback-rules", method: "GET", reply: () => CALLBACK_RULES },
  { path: "/api/callbacks", method: "GET", reply: () => CALLBACKS },
  { path: "/api/invoices/labour-line", method: "GET", reply: () => ({
    job: { id: JOB.id, title: JOB.title, clientId: CLIENT.id, clientName: CLIENT.name },
    entries: [
      { id: "te_13", workerName: LEO.name, clockIn: iso(day(-4, 8)), clockOut: iso(day(-4, 16)), hours: 8 },
      { id: "te_11", workerName: LEO.name, clockIn: iso(day(-5, 8)), clockOut: iso(day(-5, 16)), hours: 7.75 },
    ],
    hours: 15.75,
    byWorker: [{ name: LEO.name, hours: 15.75 }],
    skipped: { open: 1 },
    rates: [{ key: "company", rate: 85, label: "", source: "company" }],
  }) },
];
