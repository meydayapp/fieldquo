// docs/screens/hr/harness/fixture.js
//
// One person's HR file for the four HR screens — Léo Bouchard, the crew
// member the app guide photographs, a month into the job at Érable Design.
// Every URL the real components fetch is answered from here; nothing is
// written to any database. Dates hang off the guide's fixed Monday.
const TODAY = new Date("2026-09-14T13:00:00-04:00");
const day = (n) => new Date(TODAY.getTime() + n * 86400000).toISOString();
const CLOUD = "https://res.cloudinary.com/demo/image/upload/v1/fieldquo/companies/c_erable";

export const WORKER = { id: "w_leo", name: "Léo Bouchard", title: "Installer" };

export const DOCUMENTS = [
  { id: "d1", workerId: "w_leo", kind: "licence", title: "Driver's licence — class 5", fileUrl: `${CLOUD}/leo-licence.jpg`, sizeBytes: 412_000, mimeType: "image/jpeg", issuedAt: day(-900), expiresAt: day(21), number: "B1234-567890-12", uploadedByKind: "worker", verifiedAt: day(-20), note: null, archivedAt: null, createdAt: day(-25) },
  { id: "d2", workerId: "w_leo", kind: "certification", title: "WHMIS 2015", fileUrl: `${CLOUD}/leo-whmis.pdf`, sizeBytes: 88_000, mimeType: "application/pdf", issuedAt: day(-30), expiresAt: day(1065), number: null, uploadedByKind: "worker", verifiedAt: null, note: null, archivedAt: null, createdAt: day(-3) },
  { id: "d3", workerId: "w_leo", kind: "certification", title: "Working at heights", fileUrl: `${CLOUD}/leo-heights.pdf`, sizeBytes: 120_000, mimeType: "application/pdf", issuedAt: day(-1100), expiresAt: day(-4), number: "WAH-20481", uploadedByKind: "manager", verifiedAt: day(-1100), note: "Original in the office binder", archivedAt: null, createdAt: day(-1000) },
  { id: "d4", workerId: "w_leo", kind: "contract", title: "Employment agreement", fileUrl: `${CLOUD}/leo-contract.pdf`, sizeBytes: 240_000, mimeType: "application/pdf", issuedAt: day(-31), expiresAt: null, number: null, uploadedByKind: "manager", verifiedAt: null, note: null, archivedAt: null, createdAt: day(-31) },
];

export const POLICIES = [
  { id: "p1", title: "Safety & PPE", version: 1, effectiveFrom: day(-60), requiresAcknowledgement: true, acknowledged: true, acknowledgedAt: day(-28), signatureName: "Léo Bouchard", reacknowledge: false, bodyHash: "h1", body: "## Why this matters\nNobody goes home hurt. That is the whole policy; the rest is how.\n\n## What we expect\n- Wear the PPE the job needs: safety boots, eye protection, gloves, hearing protection when tools are loud, a hard hat where anything can fall.\n- Check ladders, harnesses and power tools before using them. A damaged one is tagged out, not used carefully.\n- Stop work and tell your supervisor if something looks unsafe. You will never be in trouble for stopping.\n- Report every injury and every near miss the same day, however small.\n\n## What the company does\n- Provides the PPE the job needs and replaces it when it is worn.\n- Trains you before you use equipment that needs training." },
  { id: "p2", title: "Vehicle use", version: 2, effectiveFrom: day(-2), requiresAcknowledgement: true, acknowledged: false, acknowledgedAt: null, signatureName: null, reacknowledge: true, bodyHash: "h2", body: "## The vehicle\nA company vehicle is a work tool. Treat it like one.\n\n## What we expect\n- A valid driver's licence, kept on you and kept current. Tell us before it expires or if it is suspended.\n- Seat belts on, phone down. No calls or texts while driving — pull over.\n- Follow the speed limit. Tickets are the driver's to pay.\n- Report any damage, warning light or accident the same day, before the next trip.\n- Personal use only with a supervisor's okay.\n\n## What the company does\n- Keeps the insurance, registration and servicing current.\n- Fixes what you report." },
  { id: "p3", title: "Phone & social media on site", version: 1, effectiveFrom: day(-60), requiresAcknowledgement: true, acknowledged: false, acknowledgedAt: null, signatureName: null, reacknowledge: false, bodyHash: "h3", body: "## On a client's property\nYou are in someone's home or business. What you photograph and post reflects on all of us.\n\n## What we expect\n- Phones away while working, except for the app, calls with the office, or an emergency.\n- Take job photos in the app, for the job.\n- Do not post job photos, the client's name or their street on social media without the company's written okay." },
];

const items = [
  { key: "contact-details", label: "Confirm your contact and emergency-contact details", kind: "task", required: true, dueDays: 1, status: "done", doneAt: day(-30), doneByName: "Léo Bouchard", dueAt: day(-30), overdue: false },
  { key: "photo-id", label: "Upload a piece of photo ID", kind: "document", documentKind: "id", required: true, dueDays: 3, status: "open", doneAt: null, dueAt: day(-28), overdue: true },
  { key: "td1-federal", label: "Fill in the federal TD1", kind: "form", formKind: "td1_federal", required: true, dueDays: 3, status: "done", doneAt: day(-29), dueAt: day(-28), overdue: false },
  { key: "td1-provincial", label: "Fill in the provincial TD1", kind: "form", formKind: "td1_provincial", required: true, dueDays: 3, status: "open", doneAt: null, dueAt: day(-28), overdue: true },
  { key: "direct-deposit", label: "Hand in your direct-deposit details", kind: "task", required: true, dueDays: 7, status: "done", doneAt: day(-27), doneByName: "Julie Gagnon", dueAt: day(-24), overdue: false },
  { key: "safety-walkthrough", label: "Safety walk-through with your supervisor", kind: "task", required: true, dueDays: 1, status: "done", doneAt: day(-31), doneByName: "Julie Gagnon", dueAt: day(-30), overdue: false },
  { key: "vehicle-policy", label: "Read and sign the vehicle policy", kind: "policy", policyId: "p2", policyTitle: "Vehicle use", required: true, dueDays: 7, status: "open", doneAt: null, dueAt: day(-24), overdue: true },
  { key: "tickets", label: "Upload your trade tickets and certifications", kind: "document", documentKind: "certification", required: false, dueDays: 14, status: "done", doneAt: day(-3), dueAt: day(-17), overdue: false },
];
export const RUN = { id: "run1", workerId: "w_leo", templateId: "t1", startedAt: day(-31), completedAt: null, items, progress: { total: 8, done: 5, requiredTotal: 7, requiredDone: 4, complete: false } };

export const COMPLIANCE = [
  { workerId: "w_marc", name: "Marc Tremblay", title: "Owner", active: true, userId: "u_marc", documents: { expired: 0, dueSoon: 0, unverified: 0, worst: "ok" }, onboarding: null, policies: { pending: 0 }, notes: { pending: 0 }, attention: false },
  { workerId: "w_julie", name: "Julie Gagnon", title: "Foreman", active: true, userId: "u_julie", documents: { expired: 0, dueSoon: 1, unverified: 0, worst: "due_soon" }, onboarding: { runId: "r2", total: 8, done: 8, requiredTotal: 7, requiredDone: 7, complete: true, overdue: 0 }, policies: { pending: 0 }, notes: { pending: 0 }, attention: true },
  { workerId: "w_sam", name: "Samuel Roy", title: "Estimator", active: true, userId: "u_sam", documents: { expired: 0, dueSoon: 0, unverified: 0, worst: "ok" }, onboarding: { runId: "r3", total: 8, done: 8, requiredTotal: 7, requiredDone: 7, complete: true, overdue: 0 }, policies: { pending: 1 }, notes: { pending: 0 }, attention: true },
  { workerId: "w_dan", name: "Daniel Côté", title: "Dispatcher", active: true, userId: "u_dan", documents: { expired: 0, dueSoon: 0, unverified: 0, worst: "ok" }, onboarding: null, policies: { pending: 0 }, notes: { pending: 0 }, attention: false },
  { workerId: "w_leo", name: "Léo Bouchard", title: "Installer", active: true, userId: "u_leo", documents: { expired: 1, dueSoon: 1, unverified: 1, worst: "expired" }, onboarding: { runId: "run1", total: 8, done: 5, requiredTotal: 7, requiredDone: 4, complete: false, overdue: 3 }, policies: { pending: 2 }, notes: { pending: 1 }, attention: true },
  { workerId: "w_ana", name: "Ana Pereira", title: "Installer", active: true, userId: "u_ana", documents: { expired: 0, dueSoon: 0, unverified: 2, worst: "ok" }, onboarding: { runId: "r6", total: 8, done: 7, requiredTotal: 7, requiredDone: 7, complete: true, overdue: 0 }, policies: { pending: 0 }, notes: { pending: 0 }, attention: true },
];

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Replace window.fetch with the fixture. Writes answer as if they worked. */
export function installFetch() {
  window.__calls = [];
  window.fetch = async (url, options = {}) => {
    const u = String(url);
    const method = (options.method || "GET").toUpperCase();
    window.__calls.push({ method, url: u });
    const path = u.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    if (path === "/api/hr/me/onboarding") return json({ worker: WORKER, company: { name: "Érable Design", country: "CA" }, run: RUN });
    if (path === "/api/hr/me/documents") return json({ worker: WORKER, documents: DOCUMENTS.map((d) => ({ ...d, note: undefined })), selfKinds: ["certification", "licence", "id", "other"] });
    if (path === "/api/hr/me/policies") return json({ worker: WORKER, policies: POLICIES });
    if (path.startsWith("/api/hr/me/policies/") && method === "POST") return json({ acknowledgement: { id: "a9", policyId: "p2", policyVersion: 2, acknowledgedAt: new Date().toISOString(), signatureName: "Léo Bouchard" } }, 201);
    if (path === "/api/hr/compliance") return json({ rows: COMPLIANCE, asOf: TODAY.toISOString() });
    if (path === "/api/hr/me/summary") return json({ hasWorker: true, policiesPending: 2, notesPending: 1, onboardingOpen: 3, documentsExpiring: 2 });
    if (path === "/api/notifications") return json({ notifications: [], unread: 0 });
    if (path === "/api/me/home" || path.startsWith("/api/me/")) return json({});
    return json({ error: `harness: no fixture for ${method} ${path}` }, 404);
  };
}
