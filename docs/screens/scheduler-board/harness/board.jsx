import React from "react";
import { createRoot } from "react-dom/client";
import SchedulerPage from "@/app/app/scheduler/page";

// ── Fixture: today, in the browser's own zone, so the live dots line up ────
const params = new URLSearchParams(window.location.search);
const as = params.get("as") || "owner";
const pad = (n) => String(n).padStart(2, "0");
const today = new Date();
const ymd = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
const at = (hhmm, dayOffset = 0) => {
  const d = new Date(`${ymd}T${hhmm}:00`);
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString();
};
const nowMinus = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();

const jobA = {
  id: "job_a",
  title: "Kitchen repaint",
  siteAddress: "12 rue Principale",
  siteCity: "Laval",
  client: { name: "Sophie Dubois" },
};
const jobB = {
  id: "job_b",
  title: "Deck stain",
  siteAddress: "88 Elm Street",
  siteCity: "Ottawa",
  client: { name: "R. Chen" },
};
const jobC = {
  id: "job_c",
  title: "Cabinet install",
  siteAddress: null,
  siteCity: null,
  client: { name: "Northside Property Mgmt" },
};

const workers = [
  { id: "w1", name: "Marc Tremblay", userId: "u1", title: "Foreman" },
  { id: "w2", name: "Ana Pereira", userId: "u2" },
  { id: "w3", name: "Sophie Lavoie", userId: "u3", title: "Receptionist" },
  { id: "w4", name: "Luis Ortega", userId: "u4" },
  { id: "w5", name: "Jean Roy", userId: null },
];

const shifts = [
  {
    id: "s1", workerId: "w1", start: at("08:00"), end: at("16:00"), note: null, published: true,
    availabilityOverrideAt: null, availabilityOverrideNote: null, availabilityOverrideBy: null,
    worker: { name: "Marc Tremblay" }, job: jobA,
    breaks: [{ id: "b1", start: at("12:00"), end: at("12:30"), kind: "lunch", paid: false }],
  },
  {
    id: "s2", workerId: "w2", start: at("08:30"), end: at("16:30"), note: null, published: true,
    availabilityOverrideAt: null, availabilityOverrideNote: null, availabilityOverrideBy: null,
    worker: { name: "Ana Pereira" }, job: jobA,
    breaks: [
      { id: "b2", start: at("10:15"), end: at("10:30"), kind: "break", paid: true },
      { id: "b3", start: at("12:30"), end: at("13:00"), kind: "lunch", paid: false },
    ],
  },
  {
    id: "s4", workerId: "w4", start: at("12:00"), end: at("16:00"), note: "Yard — load the van for tomorrow", published: false,
    availabilityOverrideAt: at("07:10"), availabilityOverrideNote: "Covering for Sophie", availabilityOverrideBy: { name: "Emilio" },
    worker: { name: "Luis Ortega" }, job: jobB,
    breaks: [{ id: "b4", start: at("14:00"), end: at("14:30"), kind: "lunch", paid: false }],
  },
];

const leave = [
  { workerId: "w3", startDate: at("00:00", -1), endDate: at("00:00", 2), halfDay: false, policy: { name: "Vacation" } },
];
const availability = [
  { workerId: "w4", windows: [{ from: at("06:00"), to: at("18:00") }] },
  { workerId: "w1", windows: [{ from: at("07:00"), to: at("17:00") }] },
];
const visits = [
  { id: "v1", jobId: "job_a", scheduledAt: at("09:00"), status: "in_progress", workerId: "w1", job: jobA },
  { id: "v2", jobId: "job_c", scheduledAt: at("10:00"), status: "scheduled", workerId: "w5", job: jobC },
  { id: "v3", jobId: "job_b", scheduledAt: at("14:00"), status: "scheduled", workerId: "w4", job: jobB },
];
const live = [
  { workerId: "w1", clockIn: at("07:42"), jobId: "job_a", breaks: [] },
  { workerId: "w2", clockIn: at("08:31"), jobId: "job_a", breaks: [{ start: nowMinus(7), end: null, kind: "lunch", paid: false }] },
];
const businessHours = [
  { day: 0, closed: false, open: "08:00", close: "17:00" },
  { day: 1, closed: false, open: "08:00", close: "17:00" },
  { day: 2, closed: false, open: "08:00", close: "17:00" },
  { day: 3, closed: false, open: "08:00", close: "17:00" },
  { day: 4, closed: false, open: "08:00", close: "17:00" },
  { day: 5, closed: false, open: "08:00", close: "16:00" },
  { day: 6, closed: false, open: "08:00", close: "17:00" },
];

function payload() {
  if (as === "worker") {
    return {
      manager: false,
      shifts: shifts.filter((s) => s.workerId === "w2" && s.published),
      workers: [],
      self: { id: "w2", name: "Ana Pereira" },
      leave: [],
      availability: [],
      visits: visits.filter((v) => v.workerId === "w2"),
      live: live.filter((l) => l.workerId === "w2"),
      businessHours,
    };
  }
  return {
    manager: true,
    shifts,
    workers,
    missingHours: [{ id: "w5", name: "Jean Roy" }],
    jobs: [jobA, jobB, jobC],
    leave,
    availability,
    visits,
    live,
    businessHours,
  };
}

// ── fetch stub: the shifts GET answers from the fixture; writes say ok ─────
const realFetch = window.fetch.bind(window);
window.fetch = async (url, init = {}) => {
  const u = String(url);
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  if (u.startsWith("/api/shifts") && (!init.method || init.method === "GET")) {
    await new Promise((r) => setTimeout(r, 80));
    return json(payload());
  }
  if (u.startsWith("/api/shifts")) return json({ ok: true, count: 1, warnings: [] });
  return realFetch(url, init);
};

createRoot(document.getElementById("root")).render(
  <div className="bg-background text-foreground min-h-screen">
    <SchedulerPage />
  </div>,
);

// ── Scene driver ───────────────────────────────────────────────────────────
const scene = params.get("scene");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (sel, tries = 60) => {
  for (let i = 0; i < tries; i++) {
    const el = document.querySelector(sel);
    if (el) return el;
    await wait(100);
  }
  throw new Error(`scene: never found ${sel}`);
};
(async () => {
  try {
    window.localStorage.setItem("scheduler.view", params.get("view") || "day");
  } catch {}
  if (!scene) return;
  await until('[role="tablist"]');
  await wait(400);
  if (scene === "edit") {
    const block = await until('button[aria-label*="Kitchen repaint"]');
    block.click();
    await until("h2");
  }
  if (scene === "new") {
    const cell = await until('button[aria-label^="Add a shift for Jean Roy"]');
    cell.click();
    await until("h2");
  }
  await wait(400);
  document.documentElement.setAttribute("data-scene-ready", scene);
})().catch((err) => {
  document.documentElement.setAttribute("data-scene-error", String(err?.message || err));
});
