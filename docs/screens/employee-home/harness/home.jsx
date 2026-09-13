// docs/screens/employee-home/harness/home.jsx
//
// Renders the REAL employee-home components against a fixture and a fetch
// stub — no server, no database, no login, nothing written anywhere. The
// same pattern as docs/screens/scheduler-board/harness/board.jsx. Scenes:
//
//   ?screen=home&as=worker           WorkerHome (the Homebase dashboard)
//   ?screen=home&as=manager          ManagerHome (report, dispatch, Gantt, review)
//   ?screen=requests&as=worker       the Requests hub
//   ?screen=availability&as=worker   My availability (&scene=form opens the request form)
//   ?screen=week&as=owner            the scheduler's week grid (&scene=modal opens Apply-to)
//
// build.sh bundles it with esbuild; shot.sh captures it at 375 and 1280.
import React from "react";
import { createRoot } from "react-dom/client";
import MeHomePage from "@/app/app/me/page";
import MeRequestsPage from "@/app/app/me/requests/page";
import MeAvailabilityPage from "@/app/app/me/availability/page";
import SchedulerPage from "@/app/app/scheduler/page";
import MobileTabBar from "@/app/components/layout/MobileTabBar";

const params = new URLSearchParams(window.location.search);
const screen = params.get("screen") || "home";
const scene = params.get("scene") || "";
const pad = (n) => String(n).padStart(2, "0");
const today = new Date();
const ymdOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ymd = ymdOf(today);
const at = (hhmm, dayOffset = 0) => {
  const d = new Date(`${ymd}T${hhmm}:00`);
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString();
};
const dayPlus = (n) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return d;
};
const nowMinus = (min) => new Date(Date.now() - min * 60000).toISOString();

const jobA = { id: "job_a", title: "Kitchen repaint", siteAddress: "12 rue Principale", siteCity: "Laval", client: { name: "Sophie Dubois" } };
const jobB = { id: "job_b", title: "Deck stain", siteAddress: "88 Elm Street", siteCity: "Ottawa", client: { name: "R. Chen" } };
const jobC = { id: "job_c", title: "Cabinet install", siteAddress: "4 Bay Road", siteCity: "Ottawa", client: { name: "Northside Property Mgmt" } };

const workers = [
  { id: "w1", name: "Marc Tremblay", userId: "u1", title: "Foreman" },
  { id: "w2", name: "Ana Pereira", userId: "u2", title: "Painter" },
  { id: "w3", name: "Sophie Lavoie", userId: "u3", title: "Receptionist" },
  { id: "w4", name: "Luis Ortega", userId: "u4", title: "Painter" },
  { id: "w5", name: "Jean Roy", userId: null, title: "Yard" },
];

// ── The worker's Home ──────────────────────────────────────────────────────
const nextShift = {
  kind: "shift", id: "s2", start: at("09:00", 1), end: at("16:00", 1),
  title: "Sophie Dubois", subtitle: "Kitchen repaint", address: "12 rue Principale, Laval", href: "/app/me/schedule",
  note: "Second coat on the island — bring the 4-inch roller.", label: "Lead", job: jobA, overridden: false, pendingRequest: null,
  breaks: [{ start: at("12:00", 1), end: at("12:30", 1), kind: "lunch", paid: false }],
  coworkers: [{ id: "w1", name: "Marc Tremblay", title: "Foreman", image: null }, { id: "w4", name: "Luis Ortega", title: "Painter", image: null }],
  estimate: { hours: 6.5, amount: 162.5 },
};
const workerHome = {
  me: { name: "Ana Pereira", image: null, title: "Painter", workerId: "w2", onRoster: true, quoter: false },
  company: { name: "Truefinish Cabinets", timeZone: "America/Toronto", weekStartsOn: 1 },
  today: { ymd },
  next: nextShift,
  upcoming: [
    { kind: "visit", id: "v1", start: at("13:30", 2), end: null, title: "R. Chen", subtitle: "Deck stain", address: "88 Elm Street, Ottawa", href: "/app/jobs/job_b", status: "scheduled" },
    { kind: "open", id: "s9", start: at("07:00", 3), end: at("15:00", 3), title: "Northside Property Mgmt", subtitle: "Helper", address: "4 Bay Road, Ottawa", label: "Helper", job: jobC, myRequestId: null },
    { kind: "task", id: "t1", start: at("17:00", 3), end: null, title: "Return the sprayer to the yard", subtitle: null, href: "/app/tasks", status: "open" },
    { kind: "shift", id: "s4", start: at("08:00", 4), end: at("16:00", 4), title: "R. Chen", subtitle: "Deck stain", address: "88 Elm Street, Ottawa", job: jobB, breaks: [] },
  ],
  eventsToday: [{ kind: "event", id: "e1", start: at("00:00"), title: "Safety meeting 7:30 — yard", note: "Ladders and harness check" }],
  clock: {
    entries: [{ id: "te1", clockIn: at("07:52"), clockOut: null, hours: null, status: "pending", job: { id: "job_a", title: "Kitchen repaint", client: "Sophie Dubois" }, onBreak: false, unpaidBreakMinutes: 30 }],
    open: { id: "te1", clockIn: at("07:52"), onBreak: false },
    hoursToday: 5.6,
    earnedToday: 140,
  },
  shoutOuts: [
    { id: "so1", message: "Great work on the Dubois kitchen — the client called to say the trim looks perfect.", createdAt: nowMinus(120), from: { name: "Marc Tremblay", image: null }, to: { workerId: "w2", name: "Ana Pereira" }, forMe: true },
    { id: "so2", message: "Luis stayed late to get the deck sealed before the rain. Thanks.", createdAt: nowMinus(1500), from: { name: "Emilio Boves", image: null }, to: { workerId: "w4", name: "Luis Ortega" }, forMe: false },
  ],
  counts: { pendingRequests: 1, pendingAvailability: 0 },
  seesPay: true,
};

// ── The manager's Home ─────────────────────────────────────────────────────
const managerHome = {
  me: { name: "Emilio Boves" },
  company: { name: "Truefinish Cabinets", timeZone: "America/Toronto" },
  today: { ymd, draftsToday: 2, shiftsToday: 4, openToday: 1 },
  report: { period: "today", paidHours: 27.5, wages: 742.5, unpricedEntries: 1, revenue: 3180, labourPct: 23.35 },
  seesWages: true,
  team: [
    { id: "w1", name: "Marc Tremblay", title: "Foreman", image: null, hasLogin: true, state: "clocked_in", out: false, shift: { start: at("08:00"), end: at("16:00"), published: true }, clockIn: at("07:42"), clockOut: null, where: { title: "Kitchen repaint", client: "Sophie Dubois", address: "12 rue Principale, Laval" } },
    { id: "w2", name: "Ana Pereira", title: "Painter", image: null, hasLogin: true, state: "on_break", out: false, shift: { start: at("08:30"), end: at("16:30"), published: true }, clockIn: at("08:31"), clockOut: null, where: { title: "Kitchen repaint", client: "Sophie Dubois", address: "12 rue Principale, Laval" } },
    { id: "w4", name: "Luis Ortega", title: "Painter", image: null, hasLogin: true, state: "late", out: false, shift: { start: at("08:00"), end: at("16:00"), published: true }, clockIn: null, clockOut: null, where: { title: "Deck stain", client: "R. Chen", address: "88 Elm Street, Ottawa" } },
    { id: "w3", name: "Sophie Lavoie", title: "Receptionist", image: null, hasLogin: true, state: "off", out: true, shift: null, clockIn: null, clockOut: null, where: null },
    { id: "w5", name: "Jean Roy", title: "Yard", image: null, hasLogin: false, state: "scheduled", out: false, shift: { start: at("13:00"), end: at("17:00"), published: false }, clockIn: null, clockOut: null, where: null },
  ],
  counts: { clocked_in: 1, on_break: 1, late: 1, scheduled: 1, clocked_out: 0, no_show: 0, off: 1 },
  dispatch: [
    { id: "v7", jobId: "job_c", scheduledAt: at("10:00"), status: "scheduled", reason: "unassigned", assignee: null, client: "Northside Property Mgmt", title: "Cabinet install", address: "4 Bay Road, Ottawa" },
    { id: "v8", jobId: "job_b", scheduledAt: at("14:00"), status: "scheduled", reason: "out", assignee: "Sophie Lavoie", client: "R. Chen", title: "Deck stain", address: "88 Elm Street, Ottawa" },
  ],
  needsReview: {
    timeOff: [{ id: "l1", worker: "Luis Ortega", policy: "Vacation", startDate: dayPlus(10).toISOString(), endDate: dayPlus(12).toISOString(), days: 3, halfDay: false, reason: "Family wedding" }],
    swaps: [{ id: "r1", kind: "cover", note: "Dentist at 9", from: "Ana Pereira", to: "Luis Ortega", start: at("09:00", 1), end: at("16:00", 1), client: "Sophie Dubois" }],
    availability: [{ id: "a1", worker: "Marc Tremblay", effectiveFrom: dayPlus(7).toISOString(), days: [], desired: 32, note: "Fridays off for school pickup" }],
    timesheets: [{ id: "te9", worker: "Marc Tremblay", workerId: "w1", clockIn: at("08:00", -1), clockOut: at("16:15", -1), hours: 7.75, job: "Kitchen repaint" }],
  },
  eventsToday: [],
  hasQuoters: true,
};

// ── Requests hub ───────────────────────────────────────────────────────────
const shiftOf = (id, dayOffset, s, e, job) => ({ id, workerId: "w2", start: at(s, dayOffset), end: at(e, dayOffset), note: null, label: null, published: true, job, breaks: [] });
const requestsPayload = {
  me: { id: "w2", name: "Ana Pereira", title: "Painter" },
  manager: false,
  needsApproval: true,
  mine: [
    { id: "r1", kind: "cover", status: "pending_manager", fromWorkerId: "w2", toWorkerId: "w4", note: "Dentist at 9", decisionNote: null, shift: shiftOf("s2", 1, "09:00", "16:00", jobA), offeredShift: null, fromWorker: { id: "w2", name: "Ana Pereira" }, toWorker: { id: "w4", name: "Luis Ortega" }, createdAt: nowMinus(60) },
    { id: "r2", kind: "trade", status: "approved", fromWorkerId: "w2", toWorkerId: "w1", note: null, decisionNote: null, shift: shiftOf("s0", -3, "08:00", "16:00", jobB), offeredShift: shiftOf("s0b", -2, "08:00", "16:00", jobA), fromWorker: { id: "w2", name: "Ana Pereira" }, toWorker: { id: "w1", name: "Marc Tremblay" }, createdAt: nowMinus(4000) },
    { id: "r3", kind: "cover", status: "declined", fromWorkerId: "w2", toWorkerId: null, note: null, decisionNote: "Luis Ortega: They have approved time off on Friday.", shift: shiftOf("s5", 5, "08:00", "16:00", jobC), offeredShift: null, fromWorker: { id: "w2", name: "Ana Pereira" }, toWorker: { id: "w4", name: "Luis Ortega" }, createdAt: nowMinus(9000) },
  ],
  open: [
    { id: "r4", kind: "cover", status: "pending_peer", fromWorkerId: "w4", toWorkerId: null, note: "Can anyone take Thursday?", decisionNote: null, shift: { ...shiftOf("s7", 3, "07:00", "15:00", jobC), workerId: "w4" }, offeredShift: null, fromWorker: { id: "w4", name: "Luis Ortega" }, toWorker: null, createdAt: nowMinus(30) },
  ],
  approvals: [],
  partners: [{ id: "w1", name: "Marc Tremblay", title: "Foreman" }, { id: "w4", name: "Luis Ortega", title: "Painter" }],
};

// ── Availability ───────────────────────────────────────────────────────────
const availabilityPayload = {
  me: { id: "w2", name: "Ana Pereira", title: "Painter" },
  manager: false,
  needsApproval: true,
  bookable: false,
  current: [1, 2, 3, 4, 5].map((d) => ({ dayOfWeek: d, startTime: "08:00", endTime: "16:00", timezone: "America/Toronto" })),
  mine: [{ id: "a2", effectiveFrom: dayPlus(-30).toISOString(), days: [1, 2, 3, 4, 5].map((d) => ({ dayOfWeek: d, startTime: "08:00", endTime: "16:00" })), desiredHoursPerWeek: 40, status: "approved", decisionNote: null, appliedAt: dayPlus(-30).toISOString(), createdAt: dayPlus(-35).toISOString() }],
  approvals: [],
};

// ── The scheduler's week (owner) ───────────────────────────────────────────
const monday = (() => {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() - 1 + 7) % 7));
  return d;
})();
const wk = (dayIdx, hhmm) => {
  const d = new Date(monday);
  d.setDate(d.getDate() + dayIdx);
  return new Date(`${ymdOf(d)}T${hhmm}:00`).toISOString();
};
const mk = (id, workerId, dayIdx, s, e, job, extra = {}) => ({
  id, workerId, start: wk(dayIdx, s), end: wk(dayIdx, e), note: extra.note || null, label: extra.label || null, published: extra.published !== false,
  availabilityOverrideAt: null, availabilityOverrideNote: null, availabilityOverrideBy: null, worker: workers.find((w) => w.id === workerId) ? { name: workers.find((w) => w.id === workerId).name } : null, job, breaks: extra.breaks || [],
});
const weekShifts = [
  mk("k1", "w1", 0, "08:00", "15:00", jobA, { label: "Lead", note: "Bring the sprayer" }),
  mk("k2", "w1", 1, "08:00", "15:00", jobA, { label: "Lead" }),
  mk("k3", "w1", 2, "08:00", "15:00", jobA, { label: "Lead" }),
  mk("k4", "w1", 3, "07:00", "17:00", jobB),
  mk("k5", "w2", 0, "09:00", "16:00", jobA, { label: "Helper", breaks: [{ start: wk(0, "12:00"), end: wk(0, "12:30"), kind: "lunch", paid: false }] }),
  mk("k6", "w2", 1, "09:00", "16:00", jobA, { label: "Helper" }),
  mk("k7", "w2", 3, "08:00", "16:00", jobB, { published: false }),
  mk("k8", "w4", 0, "07:00", "15:00", jobB),
  mk("k9", "w4", 2, "07:00", "15:00", jobB, { note: "Second coat" }),
  mk("k10", "w4", 4, "07:00", "15:00", jobB, { published: false }),
  mk("k11", "w3", 0, "08:00", "16:00", null),
  mk("k12", "w3", 1, "08:00", "16:00", null),
  mk("k13", "w3", 2, "08:00", "16:00", null),
  mk("k14", "w3", 3, "08:00", "16:00", null),
  mk("k15", "w3", 4, "08:00", "12:00", null),
  mk("k16", "w5", 1, "13:00", "17:00", jobC, { label: "Yard" }),
  mk("k17", null, 2, "07:00", "15:00", jobC, { label: "Helper" }),
  mk("k18", null, 4, "08:00", "16:00", jobA, { label: "Painter" }),
];
const events = [
  { id: "e1", date: new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate())).toISOString(), title: "Safety meeting 7:30", description: "Ladders and harness check" },
  { id: "e2", date: new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate() + 4)).toISOString(), title: "Yard closed after 2", description: null },
];
const rates = { w1: 34, w2: 25, w4: 26, w3: 22 };
function shiftsPayload() {
  return {
    manager: true,
    shifts: weekShifts,
    weekShifts,
    workers,
    rates,
    payVisible: true,
    otThresholdWeekly: 40,
    missingHours: [],
    jobs: [jobA, jobB, jobC],
    events,
    leave: [],
    availability: [],
    visits: [],
    live: [],
    businessHours: null,
    attendance: [],
    holidays: [],
    blackouts: [],
  };
}

// ── fetch stub ────────────────────────────────────────────────────────────
const realFetch = window.fetch.bind(window);
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
window.fetch = async (url, init = {}) => {
  const u = String(url);
  await new Promise((r) => setTimeout(r, 60));
  if (u.startsWith("/api/me/home")) return json(workerHome);
  if (u.startsWith("/api/me/manager")) return json(managerHome);
  if (u.startsWith("/api/shift-requests/partner-shifts")) return json({ shifts: [shiftOf("p1", 2, "08:00", "16:00", jobB)] });
  if (u.startsWith("/api/shift-requests")) return init.method === "POST" ? json({ ok: true }) : json(requestsPayload);
  if (u.startsWith("/api/availability-requests")) return init.method === "POST" ? json({ ok: true }) : json(availabilityPayload);
  if (u.startsWith("/api/settings/scheduling")) return json({ shiftSwapsNeedApproval: true, availabilityNeedsApproval: true, canEdit: true });
  if (u.startsWith("/api/shout-outs")) return json({ feed: [], forMe: [], colleagues: workers.filter((w) => w.id !== "w2"), max: 240 });
  if (u.startsWith("/api/shifts") && (!init.method || init.method === "GET")) return json(shiftsPayload());
  if (u.startsWith("/api/shifts")) return json({ ok: true, count: 2, warnings: [], refused: [] });
  if (u.startsWith("/api/schedule-events")) return json({ ok: true });
  return realFetch(url, init);
};

const Screen = { home: MeHomePage, requests: MeRequestsPage, availability: MeAvailabilityPage, week: SchedulerPage }[screen] || MeHomePage;
try {
  window.localStorage.setItem("scheduler.view", "week");
} catch {}

createRoot(document.getElementById("root")).render(
  <div className="bg-background text-foreground min-h-screen fq-app-shell">
    <main className="pb-[calc(var(--fq-tab-bar-height)+var(--fq-dock-height))]">
      <Screen />
    </main>
    <MobileTabBar />
  </div>,
);

// ── Scene driver ───────────────────────────────────────────────────────────
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (sel, tries = 80) => {
  for (let i = 0; i < tries; i++) {
    const el = document.querySelector(sel);
    if (el) return el;
    await wait(100);
  }
  throw new Error(`scene: never found ${sel}`);
};
const byText = (tag, text) => Array.from(document.querySelectorAll(tag)).find((el) => el.textContent.trim().startsWith(text));
(async () => {
  await until("[data-me-shell], [role=tablist]");
  await wait(500);
  if (scene === "form") {
    const b = byText("button", "Request new availability");
    b?.click();
    await until("input[type=date]");
  }
  if (scene === "cover") {
    const b = byText("button", "Find cover");
    b?.click();
    await until("[role=dialog]");
  }
  if (scene === "modal") {
    const b = byText("button", "Add shift");
    b?.click();
    await until("h2");
  }
  await wait(400);
  document.documentElement.setAttribute("data-harness-done", "1");
})().catch((err) => {
  document.documentElement.setAttribute("data-scene-error", String(err?.message || err));
  document.documentElement.setAttribute("data-harness-done", "1");
});
