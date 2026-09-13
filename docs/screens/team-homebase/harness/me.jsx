import React from "react";
import { createRoot } from "react-dom/client";
import MySchedulePage from "@/app/app/me/schedule/page";

// ── Fixture: the worker's next fortnight, today in the browser's zone ─────
const pad = (n) => String(n).padStart(2, "0");
const today = new Date();
const ymdOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const at = (hhmm, dayOffset = 0) => {
  const d = new Date(`${ymdOf(today)}T${hhmm}:00`);
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString();
};
const jobA = { id: "job_a", title: "Kitchen repaint", siteAddress: "12 rue Principale", siteCity: "Laval", client: { name: "Sophie Dubois" } };
const jobB = { id: "job_b", title: "Deck stain", siteAddress: "88 Elm Street", siteCity: "Ottawa", client: { name: "R. Chen" } };
const shift = (id, d, s, e, job, extra = {}) => ({
  id, workerId: "w2", start: at(s, d), end: at(e, d), note: null, published: true,
  availabilityOverrideAt: null, availabilityOverrideNote: null, availabilityOverrideBy: null,
  job, breaks: [{ id: `b-${id}`, start: at("12:00", d), end: at("12:30", d), kind: "lunch", paid: false }], ...extra,
});
const shifts = [
  shift("s1", 0, "08:00", "16:00", jobA, { note: "Bring the 18-ft ladder — the stairwell ceiling is on this pass." }),
  shift("s2", 1, "09:00", "16:00", jobA),
  shift("s3", 2, "08:30", "15:30", jobB, { availabilityOverrideAt: at("07:10", -1), availabilityOverrideNote: "Covering for Sophie", availabilityOverrideBy: { name: "Emilio" } }),
  shift("s4", 4, "08:00", "16:00", null, { note: "Yard — load the van for Monday", breaks: [] }),
  shift("s5", 7, "08:00", "16:00", jobA),
];
const labourDay = ymdOf(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3));
const payload = {
  manager: false,
  shifts,
  workers: [],
  self: { id: "w2", name: "Ana Pereira", title: null },
  leave: [], availability: [], visits: [], live: [], businessHours: null,
  coworkers: { s1: ["Marc Tremblay", "Luis Ortega"], s2: ["Marc Tremblay"], s5: ["Marc Tremblay", "Luis Ortega", "Jean Roy"] },
  holidays: [{ key: "labourDay", name: "Labour Day", date: labourDay, observed: labourDay }],
};
const realFetch = window.fetch.bind(window);
window.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.startsWith("/api/shifts")) {
    await new Promise((r) => setTimeout(r, 80));
    return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return realFetch(url, init);
};
createRoot(document.getElementById("root")).render(
  <div className="bg-background text-foreground min-h-screen">
    <MySchedulePage />
  </div>,
);
