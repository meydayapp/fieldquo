import React from "react";
import { createRoot } from "react-dom/client";
import TimeOffPage from "@/app/app/time-off/page";
const params = new URLSearchParams(window.location.search);
const day = (offset) => new Date(Date.UTC(2026, 8, 13 + offset)).toISOString();
const policies = [
  { id: "p1", name: "Vacation", kind: "vacation", paid: true, accrualMethod: "annual_allotment", requiresApproval: true },
  { id: "p2", name: "Sick leave", kind: "sick", paid: true, accrualMethod: "annual_allotment", requiresApproval: false },
  { id: "p3", name: "Unpaid leave", kind: "unpaid", paid: false, accrualMethod: "annual_allotment", requiresApproval: true },
];
const W = { w1: { id: "w1", name: "Marc Tremblay", title: "Foreman" }, w2: { id: "w2", name: "Ana Pereira", title: null }, w3: { id: "w3", name: "Sophie Lavoie", title: "Receptionist" }, w4: { id: "w4", name: "Luis Ortega", title: null } };
const req = (id, w, p, s, e, days, status, extra = {}) => ({ id, workerId: w, policyId: p, worker: W[w], policy: policies.find((x) => x.id === p), startDate: day(s), endDate: day(e), days, halfDay: false, reason: null, status, createdAt: day(-3), hoursPerDay: 8, othersOff: [], balanceAfter: { isMoney: false, remaining: 9 }, routing: { canAct: true, label: "Waiting on Emilio (owner)" }, ...extra });
const requests = [
  req("r1", "w2", "p1", 8, 12, 5, "pending", { reason: "Family wedding in Lisbon", othersOff: [{ workerId: "w3", workerName: "Sophie Lavoie", policyName: "Vacation", startDate: day(-1), endDate: day(9) }] }),
  req("r2", "w4", "p3", 15, 15, 1, "pending", { balanceAfter: null, hoursPerDay: null }),
  req("r3", "w3", "p1", -1, 9, 7, "approved", { routing: null }),
  req("r4", "w1", "p2", 20, 20, 1, "approved", { routing: null }),
  req("r5", "w1", "p1", -60, -56, 5, "approved", { routing: null }),
  req("r6", "w2", "p2", -20, -20, 1, "approved", { routing: null }),
  req("r7", "w4", "p1", -30, -29, 2, "declined", { routing: null }),
];
const balances = [
  { id: "b1", policyId: "p1", workerId: "w1", year: 2026, accruedDays: 15, usedDays: 5, carriedInDays: 0, remainingDays: 10, worker: W.w1, policy: policies[0] },
  { id: "b2", policyId: "p1", workerId: "w2", year: 2026, accruedDays: 15, usedDays: 1, carriedInDays: 0, remainingDays: 14, worker: W.w2, policy: policies[0] },
  { id: "b3", policyId: "p1", workerId: "w3", year: 2026, accruedDays: 15, usedDays: 7, carriedInDays: 0, remainingDays: 8, worker: W.w3, policy: policies[0] },
  { id: "b4", policyId: "p2", workerId: "w1", year: 2026, accruedDays: 5, usedDays: 1, carriedInDays: 0, remainingDays: 4, worker: W.w1, policy: policies[1] },
];
const team = {
  scope: "team", policies, requests, balances, canApprove: true,
  rules: { blackouts: [{ from: "2026-12-15", to: "2027-01-05", label: "Christmas installs" }], maxConcurrent: 2, holidayRegion: null },
  holidayRegion: { country: "CA", province: "QC" },
  holidays: [{ key: "labourDay", name: "Labour Day", date: "2026-09-07", observed: "2026-09-07" }, { key: "thanksgivingCA", name: "Thanksgiving", date: "2026-10-12", observed: "2026-10-12" }, { key: "christmas", name: "Christmas Day", date: "2026-12-25", observed: "2026-12-25" }],
  hoursPerDayByWorker: { w1: 8, w2: 8, w3: 8, w4: null },
  workers: Object.values(W),
};
const mine = { scope: "self", worker: W.w1, policies, requests: requests.filter((r) => r.workerId === "w1"), balances: balances.filter((b) => b.workerId === "w1"), rules: team.rules, holidays: team.holidays };
const realFetch = window.fetch.bind(window);
window.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.startsWith("/api/leave")) {
    await new Promise((r) => setTimeout(r, 60));
    return new Response(JSON.stringify(u.includes("scope=team") ? team : mine), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return realFetch(url, init);
};
createRoot(document.getElementById("root")).render(<div className="bg-background text-foreground min-h-screen"><TimeOffPage /></div>);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  await wait(600);
  const tab = [...document.querySelectorAll("button")].find((b) => /Team/.test(b.textContent));
  if (tab) tab.click();
  await wait(400);
  if (params.get("scene") === "detail") {
    const btn = document.querySelector('button[aria-label="Details"]');
    if (btn) btn.click();
    await wait(300);
  }
  if (params.get("scene") === "add") {
    const btn = [...document.querySelectorAll("button")].find((b) => /Add time off/.test(b.textContent));
    if (btn) btn.click();
    await wait(300);
  }
  document.documentElement.setAttribute("data-harness-done", "1");
})();
