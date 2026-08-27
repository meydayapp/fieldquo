// scripts/check-rbac-redaction.mjs
//
//   npm run check:rbac-redaction
//
// The read half of the granular permission grid, executed.
//
// Every assertion here is a hole QA found in production by probing as a real
// employee account. They are regression guards, not hypotheticals:
//
//   * an employee set to clientsProperties "name_address_only" received every
//     client's email, phone, private notes and portal token
//   * the same employee could read a quote's shareToken and open the priced
//     public page logged out
//
// The gates (403s) were already right. Nothing shaped a PAYLOAD, which is why
// every read-shaped dial in the grid did nothing at all.
import {
  redactClient,
  redactClients,
  redactQuote,
  redactQuotes,
  redactInvoice,
  redactInvoices,
  redactQuoteMoney,
  redactInvoiceMoney,
  redactShareToken,
  canSeeMoney,
  hasLevel,
  hasToggle,
  requireLevel,
  requireToggle,
  requireMoney,
} from "../lib/permissions/enforce.js";
import { readFileSync } from "node:fs";
import { PERMISSION_PRESETS, PRESET_TO_ROLE, can } from "../lib/permissions.js";
import { summarisePlan } from "../lib/servicePlans/summary.js";

let pass = 0;
const failures = [];
const check = (label, ok) => {
  if (ok) { pass += 1; console.log(`  ok   ${label}`); }
  else { failures.push(label); console.log(`  FAIL ${label}`); }
};

// Daniel's real grid, as saved in production.
const restricted = {
  role: "employee",
  permissions: {
    jobs: "view_only", notes: "jobs_visits_only", quotes: "view_only",
    payroll: "view_own", expenses: "view_record_edit_own", invoices: "view_only",
    payments: false, requests: "view_only", schedule: "view_complete_own",
    jobCosting: false, showPricing: false, timeTracking: "view_record_own",
    clientsProperties: "name_address_only",
  },
};
const fullView = { role: "employee", permissions: { ...restricted.permissions, clientsProperties: "full_view", quotes: "view_create_edit" } };
const owner = { role: "owner", permissions: null };
const admin = { role: "admin", permissions: restricted.permissions };
const legacy = { role: "employee", permissions: null };

const CLIENT = {
  id: "c1", companyId: "co1", name: "Marie Tremblay", type: "residential",
  contactName: "Marie", email: "castes-query.8v@icloud.com", phone: "819-238-7263",
  address: "755 Rue Saint-Louis", city: "Gatineau", province: "QC",
  notes: "Difficult about scheduling", language: "fr",
  portalToken: "tok_live_abc123", createdAt: "2026-08-01",
  _count: { quotes: 1, invoices: 0 },
};

console.log("\nclientsProperties: name_address_only\n");
const r = redactClient(restricted, CLIENT);
check("name survives", r.name === "Marie Tremblay");
check("address survives", r.address === "755 Rue Saint-Louis");
check("city and province survive", r.city === "Gatineau" && r.province === "QC");
check("email is gone", r.email === undefined);
check("phone is gone", r.phone === undefined);
check("contactName is gone", r.contactName === undefined);
check("private notes are gone", r.notes === undefined);
check("portalToken is gone", r.portalToken === undefined);
check("history counts are gone", r._count === undefined);
check("marked restricted so the UI can say why", r.restricted === true);
check("the source row is not mutated", CLIENT.email === "castes-query.8v@icloud.com");

console.log("\nWho still sees everything\n");
check("owner sees the full record", redactClient(owner, CLIENT).email === CLIENT.email);
check("admin sees it even with a restrictive grid", redactClient(admin, CLIENT).email === CLIENT.email);
check("employee at full_view sees it", redactClient(fullView, CLIENT).email === CLIENT.email);
check("a member predating the grid is not locked out", redactClient(legacy, CLIENT).email === CLIENT.email);

console.log("\nLists and hostile input\n");
check("a list redacts every element", redactClients(restricted, [CLIENT, CLIENT]).every((c) => c.email === undefined));
check("a non-array passes through", redactClients(restricted, null) === null);
check("null client doesn't throw", redactClient(restricted, null) === null);
check("undefined client doesn't throw", redactClient(restricted, undefined) === undefined);
check("a string isn't treated as a record", redactClient(restricted, "nope") === "nope");
check("no member means no access to detail", redactClient(null, CLIENT).email === undefined);

console.log("\nshareToken — a distribution capability, not a number\n");
const QUOTE = {
  id: "q1", quoteNumber: "Q-2026-0002", total: "27000",
  shareToken: "TaOVwgtMyn4OqPw1YKIwkBC9JHhp1u2P_hEAuTjlRzA",
  client: { ...CLIENT },
};
check("view_only cannot read the token", redactShareToken(restricted, QUOTE).shareToken === undefined);
check("view_create_edit keeps it", redactShareToken(fullView, QUOTE).shareToken === QUOTE.shareToken);
check("owner keeps it", redactShareToken(owner, QUOTE).shareToken === QUOTE.shareToken);

console.log("\nredactQuote does both halves — the bug was remembering one\n");
const rq = redactQuote(restricted, QUOTE);
check("token stripped", rq.shareToken === undefined);
check("nested client email stripped too", rq.client.email === undefined);
check("nested client name kept", rq.client.name === "Marie Tremblay");
check("source quote not mutated", QUOTE.shareToken.length > 10 && QUOTE.client.email === CLIENT.email);

console.log("\nThe level ladder still reads correctly\n");
check("name_address_only is below full_view", !hasLevel(restricted, "clientsProperties", "full_view"));
check("full_view meets full_view", hasLevel(fullView, "clientsProperties", "full_view"));
check("name_address_only still meets its own level", hasLevel(restricted, "clientsProperties", "name_address_only"));

// ═══════════════════════════════════════════════════════════════════════════
// THE TWO WORKER PERSONAS, EXECUTED
//
// Everything above was written against one hand-copied grid. These sections
// build the fixtures from PERMISSION_PRESETS itself, so a preset edited in
// lib/permissions.js cannot quietly stop being what this file tests — the
// hand-copied `restricted` object above is exactly the kind of copy AGENTS.md
// warns rots.
//
// Four claims, each of which has to be true at the API rather than on screen:
//
//   1. name_address_only really redacts, on every endpoint returning a client
//   2. showPricing:false masks money everywhere it can be read
//   3. view_only on quotes/jobs/invoices/requests is enforced on writes
//   4. jobCosting:false REFUSES a posted costing block, not merely hides it
// ═══════════════════════════════════════════════════════════════════════════

const persona = (key) => ({
  role: PRESET_TO_ROLE[key],
  permissions: { ...PERMISSION_PRESETS[key].values },
});
const worker = persona("worker");             // Employee (limited)
const workerFull = persona("workerFullView"); // Employee
const dispatcher = persona("dispatcher");
const src = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

console.log("\nThe presets are still the personas this file tests\n");
check("worker maps to the employee role", worker.role === "employee");
check("workerFullView maps to the employee role", workerFull.role === "employee");
check("worker is name_address_only", worker.permissions.clientsProperties === "name_address_only");
check("workerFullView is full_view", workerFull.permissions.clientsProperties === "full_view");
check("worker cannot see prices", worker.permissions.showPricing === false);
check("workerFullView can", workerFull.permissions.showPricing === true);
check("neither has job costing", !worker.permissions.jobCosting && !workerFull.permissions.jobCosting);
check("neither has payments", !worker.permissions.payments && !workerFull.permissions.payments);
// ── The two presets no longer agree here, and that IS the change ─────────
//
// They were both view_only on all four, which made "Worker (limited access)"
// a name for a tier that could read every quote, invoice, job and lead in the
// company. The lower one is now Crew and holds `none`; workerFullView is
// unchanged and still reads all four. Asserted as two different values rather
// than one shared one, because a preset edit that quietly re-merged them is
// exactly what this file exists to catch.
for (const cat of ["quotes", "jobs", "invoices", "requests"]) {
  check(`Crew holds NO access to ${cat}`, worker.permissions[cat] === "none");
  check(`workerFullView still reads ${cat}`, workerFull.permissions[cat] === "view_only");
}

// The persona the REDACTORS are about: somebody who may open the documents and
// may not see the money or the client's contact details. That used to be the
// worker preset itself; now it is a deliberate configuration an owner makes —
// Crew plus read access — and it is Daniel's real production grid either way.
// The redaction assertions below run as HIM, because a member refused at the
// door proves nothing about what the payload would have carried.
const viewOnly = {
  role: "employee",
  permissions: {
    ...worker.permissions,
    quotes: "view_only", jobs: "view_only",
    invoices: "view_only", requests: "view_only",
  },
};
// And the rung between "record" and "edit", which Crew has moved OFF: crew
// correct their own forgotten clock-out now (the correction goes back to
// pending — see the route). Somebody stored at view_record_own still cannot,
// and that rung is what the C6 block below is testing, so it gets its own
// fixture rather than borrowing whichever preset happens to sit on it.
const recordOnly = {
  role: "employee",
  permissions: { ...worker.permissions, timeTracking: "view_record_own" },
};
check("Crew may correct their own timesheet",
  worker.permissions.timeTracking === "view_record_edit_own");

// ── Refusals are 403, never 500 ────────────────────────────────────────────
//
// A permission check whose failure mode is a crash is the wrong shape: the
// caller cannot tell "you may not" from "we broke", and an error boundary
// renders a stack trace where a sentence belongs. Asserted on every thrower
// rather than trusted, because `can()` genuinely used to throw a TypeError on
// a prototype-chain role.
console.log("\nEvery refusal carries status 403\n");
const throws403 = (label, fn) => {
  let err = null;
  try { fn(); } catch (e) { err = e; }
  check(`${label} throws`, err !== null);
  check(`${label} is 403, not 500`, err?.status === 403);
  check(`${label} says something a human can act on`,
    typeof err?.message === "string" && err.message.length > 20 && !/undefined|\[object/.test(err.message));
};
throws403("quotes view_only → create", () => requireLevel(worker, "quotes", "view_create_edit", "create quotes"));
throws403("jobs view_only → edit", () => requireLevel(worker, "jobs", "view_create_edit", "edit jobs"));
throws403("invoices view_only → create", () => requireLevel(worker, "invoices", "view_create_edit", "create invoices"));
throws403("requests view_only → edit", () => requireLevel(worker, "requests", "view_create_edit", "change a request"));
throws403("showPricing off → priced PDF", () => requireMoney(worker, "download priced documents"));
throws403("jobCosting off", () => requireToggle(worker, "jobCosting", "see job costing"));
throws403("payments off", () => requireToggle(worker, "payments", "record payments"));

// ═══ CLAIM 1 — the client, on every shape that carries one ════════════════
console.log("\nCLAIM 1 — name_address_only redacts wherever a client travels\n");

const APPOINTMENT = { id: "a1", scheduledAt: "2026-09-01", client: { ...CLIENT } };
const JOB = { id: "j1", title: "Repaint kitchen", client: { ...CLIENT } };
const INVOICE = {
  id: "i1", invoiceNumber: "INV-1042", status: "sent",
  subtotal: "2000", discount: "0", tax: "300", total: "2300",
  amountPaid: "500", amountDue: "1800",
  lineItems: [{ description: "Painting: doors", quantity: 14, rate: 120, amount: 1680 }],
  payments: [{ id: "p1", date: "2026-08-02", amount: 500, method: "card" }],
  client: { ...CLIENT },
  quote: { ...QUOTE, client: { ...CLIENT } },
};

// The nested-client shapes each route assembles by hand. Executed rather than
// grepped: a route can call the redactor and still hand back the wrong object.
check("a job's client is redacted",
  redactClient(worker, JOB.client).email === undefined);
check("an appointment's client is redacted",
  redactClient(worker, APPOINTMENT.client).phone === undefined);
check("an invoice's client is redacted through redactInvoice",
  redactInvoice(worker, INVOICE).client.email === undefined);
check("...and the invoice's NESTED QUOTE's client too — two levels down",
  redactInvoice(worker, INVOICE).quote.client.email === undefined);
check("...and that nested quote's shareToken",
  redactInvoice(worker, INVOICE).quote.shareToken === undefined);
check("a list of invoices redacts every element",
  redactInvoices(worker, [INVOICE, INVOICE]).every((i) => i.client.email === undefined));
check("the source invoice is not mutated",
  INVOICE.client.email === CLIENT.email && INVOICE.quote.client.email === CLIENT.email);

// A service plan assembles { id, name, email } by hand, outside the client
// routes — the one place a redactor is easy to forget because the object never
// looked like a Client row.
const PLAN = {
  id: "sp1", name: "Quarterly maintenance", status: "active",
  frequency: "monthly", startDate: "2026-01-01", endMode: "open",
  collectionMode: "automatic", language: "en",
  amountPerOccurrence: "450", discountPct: "0", taxRatePct: "5",
  client: { id: "c1", name: "Marie Tremblay", email: CLIENT.email },
  occurrences: [{ id: "o1", seq: 1, dueDate: "2026-02-01", status: "paid", total: "472.50" }],
};
const planWorker = summarisePlan(PLAN, { member: worker });
check("a service plan's client email is redacted", planWorker.client.email === undefined);
check("...and the name survives", planWorker.client.name === "Marie Tremblay");
check("...and it is marked restricted, not blanked", planWorker.client.restricted === true);
check("workerFullView keeps the plan's client email",
  summarisePlan(PLAN, { member: workerFull }).client.email === CLIENT.email);

// workerFullView is full_view: the whole point of the second persona is that
// it sees what the first cannot. A redactor that redacted for both would pass
// every assertion above and be wrong.
console.log("\n...and the OTHER persona is not over-restricted\n");
check("workerFullView reads a client's email", redactClient(workerFull, CLIENT).email === CLIENT.email);
check("workerFullView reads a client's phone", redactClient(workerFull, CLIENT).phone === CLIENT.phone);
check("workerFullView is NOT marked restricted", redactClient(workerFull, CLIENT).restricted === undefined);
check("workerFullView still cannot read a shareToken (that's the quotes level, not this one)",
  redactShareToken(workerFull, QUOTE).shareToken === undefined);

// Routes that assemble the client themselves. Grepped, because calling them
// needs a database — but grepped for the CALL, so a route that drops the
// redactor fails here.
console.log("\nThe routes that hand a client back call the redactor\n");
for (const [label, rel, pattern] of [
  ["GET /api/appointments (the calendar feed)", "app/api/appointments/route.js", /redactClient\(full, a\.client\)/],
  ["POST /api/appointments", "app/api/appointments/route.js", /client: redactClient\(full, appointment\.client\)/],
  ["GET /api/jobs/[id]", "app/api/jobs/[id]/route.js", /client: redactClient\(full, job\.client\)/],
  ["PATCH /api/jobs/[id]", "app/api/jobs/[id]/route.js", /client: redactClient\(full, updated\.client\)/],
  ["GET /api/invoices", "app/api/invoices/route.js", /redactInvoices\(full, invoices\)/],
  ["POST /api/invoices", "app/api/invoices/route.js", /redactInvoice\(full, invoice\)/],
  ["GET /api/invoices/[id]", "app/api/invoices/[id]/route.js", /redactInvoice\(full, invoice\)/],
  ["POST /api/quotes", "app/api/quotes/route.js", /redactQuote\(full, quote\)/],
  ["GET /api/quotes", "app/api/quotes/route.js", /redactQuotes\(full, quotes\)/],
]) check(`${label} redacts`, pattern.test(src(rel)));
check("summarisePlan is never called without a member",
  ["app/api/service-plans/route.js", "app/api/service-plans/[id]/route.js",
   "app/api/service-plans/[id]/cancel/route.js"]
    .flatMap((f) => [...src(f).matchAll(/summarisePlan\(([^)]*)\)/g)])
    .every((m) => /member:/.test(m[1])));

// ═══ CLAIM 2 — money ══════════════════════════════════════════════════════
console.log("\nCLAIM 2 — showPricing:false removes money from the payload\n");

const RICH_QUOTE = {
  id: "q9", quoteNumber: "Q-2026-0009", status: "sent",
  subtotal: "20000", discount: "500", tax: "2925", total: "22425",
  scopeGroups: [{
    id: "g1", label: "Painting", sortOrder: 0, subtotal: "20000",
    takeoff: { doors: 14 },
    lineItems: [{ description: "Prime and paint doors", quantity: 14, unit: "each", rate: 120, amount: 1680 }],
  }],
  addOns: [{ id: "ao1", description: "Trim", amount: 900, selected: false }],
  client: { ...CLIENT },
};
const q = redactQuoteMoney(worker, RICH_QUOTE);
for (const f of ["subtotal", "discount", "tax", "total"])
  check(`quote.${f} is absent, not zeroed`, q[f] === undefined);
check("the scope group's own subtotal is gone too", q.scopeGroups[0].subtotal === undefined);
check("...and every money key inside its line items", (() => {
  const li = q.scopeGroups[0].lineItems[0];
  return li.rate === undefined && li.amount === undefined;
})());
check("...but the WORK survives — quantity and description are not money", (() => {
  const li = q.scopeGroups[0].lineItems[0];
  return li.quantity === 14 && li.description === "Prime and paint doors" && li.unit === "each";
})());
check("the takeoff survives — it is how many doors, not what they cost",
  q.scopeGroups[0].takeoff.doors === 14);
check("an add-on's amount is gone", q.addOns[0].amount === undefined);
check("...and its description is not", q.addOns[0].description === "Trim");
check("marked pricingHidden so the UI can print a dash, not $NaN", q.pricingHidden === true);
check("the source quote is not mutated", RICH_QUOTE.total === "22425" && RICH_QUOTE.scopeGroups[0].subtotal === "20000");

const inv = redactInvoiceMoney(worker, INVOICE);
for (const f of ["subtotal", "discount", "tax", "total", "amountPaid", "amountDue"])
  check(`invoice.${f} is absent`, inv[f] === undefined);
check("invoice line-item amounts are gone", inv.lineItems[0].amount === undefined && inv.lineItems[0].rate === undefined);
check("the PAYMENT rows are stripped too — they reconstruct the balance",
  inv.payments[0].amount === undefined);
check("...and a payment keeps its date and method, which are not money",
  inv.payments[0].date === "2026-08-02" && inv.payments[0].method === "card");
check("invoice is marked pricingHidden", inv.pricingHidden === true);

check("a service plan's amounts are gone", planWorker.amountPerOccurrence === undefined);
check("...including each occurrence's total", planWorker.occurrences[0].total === undefined);
check("...but the DUE DATE and status survive — the cadence is not the price",
  planWorker.occurrences[0].dueDate === "2026-02-01" && planWorker.occurrences[0].status === "paid");
check("plan marked pricingHidden", planWorker.pricingHidden === true);

console.log("\n...and workerFullView, who HAS showPricing, still sees all of it\n");
check("canSeeMoney is true for workerFullView", canSeeMoney(workerFull) === true);
check("canSeeMoney is false for worker", canSeeMoney(worker) === false);
check("workerFullView keeps the quote total", redactQuoteMoney(workerFull, RICH_QUOTE).total === "22425");
check("workerFullView keeps the invoice balance", redactInvoiceMoney(workerFull, INVOICE).amountDue === "1800");
check("workerFullView keeps the plan amount",
  summarisePlan(PLAN, { member: workerFull }).amountPerOccurrence === 450);
check("workerFullView is not marked pricingHidden",
  redactQuoteMoney(workerFull, RICH_QUOTE).pricingHidden === undefined);
check("an owner keeps everything", redactQuoteMoney(owner, RICH_QUOTE).total === "22425");

check("redactQuote folds the money half in, so a route cannot remember one and forget the other",
  redactQuote(worker, RICH_QUOTE).total === undefined &&
  redactQuote(worker, RICH_QUOTE).client.email === undefined &&
  redactQuote(worker, RICH_QUOTE).shareToken === undefined);
check("redactQuotes does it over a list",
  redactQuotes(worker, [RICH_QUOTE]).every((x) => x.total === undefined));

console.log("\nMoney reachable by direct URL refuses rather than shipping a hollow document\n");
for (const [label, rel] of [
  ["POST /api/quotes/[id]/pdf", "app/api/quotes/[id]/pdf/route.js"],
  ["POST /api/invoices/[id]/pdf", "app/api/invoices/[id]/pdf/route.js"],
  ["GET /api/quotes/[id]/document", "app/api/quotes/[id]/document/route.js"],
  ["GET /api/invoices/[id]/document", "app/api/invoices/[id]/document/route.js"],
]) check(`${label} requires showPricing`, /requireMoney\(full/.test(src(rel)));
for (const [label, rel] of [
  ["GET /api/quotes/versions (the Good/Better/Best trio)", "app/api/quotes/versions/route.js"],
  ["GET /api/invoices/versions", "app/api/invoices/versions/route.js"],
]) check(`${label} strips money`, /redact(Quote|Invoice)Money\(full/.test(src(rel)));
check("GET /api/analytics/benchmark is gated like its longer-named twin",
  /requireToggle\(full, "showPricing"/.test(src("app/api/analytics/benchmark/route.js")));
check("the importer's cost/markup/price view is gated",
  /hasToggle\(full, "showPricing"\)/.test(src("app/api/quotes/[id]/imports/route.js")));

console.log("\nThe screens do not render the absence as a number\n");
check("the quotes list prints a dash, not Number(undefined)",
  /pricingHidden \?/.test(src("app/app/quotes/page.js")));
check("the invoices list too", /pricingHidden \?/.test(src("app/app/invoices/page.js")));
check("the invoices list does not sum absent totals into $0.00",
  /!pricingHidden/.test(src("app/app/invoices/page.js")));

// ═══ CLAIM 3 — view_only on writes ════════════════════════════════════════
//
// ── The confusing part, resolved and written down ─────────────────────────
//
// PERMISSIONS.employee grants quote:create, job:create, appointment:create and
// followup:create. The Worker presets say quotes/jobs/invoices/requests are
// view_only. Read separately the two say opposite things.
//
// They are not two opinions. lib/permissions.js calls the role layer "the
// FLOOR" and the grid the layer that "narrows the coarse floor further": the
// role says what this KIND of member may ever do, the grid says what THIS
// member may do. An employee may in principle create a quote — which is why
// the role grants it, and why the Dispatcher preset (also not an admin) works
// at all — and this particular employee may not, because their owner said so.
// Narrower wins. Both checks run, in that order, and either one refuses.
//
// So: may an employee edit a draft quote they are in the middle of creating?
// No — and more precisely, the question cannot arise. POST /api/quotes is
// refused at the grid, so no draft of theirs ever exists to edit. There is no
// "your own draft" exception anywhere in the model, and inventing one would be
// a second, quieter permission system: the row's author is not an authority
// the grid knows about. The UI agrees rather than disagreeing politely — the
// quick-add "New quote" entry is hidden by NAV_REQUIREMENTS at exactly the
// level the API enforces, because the failure that is worse than a hidden
// button is composing a whole quote and losing it to a 403 on save.
console.log("\nCLAIM 3 — view_only is enforced on writes, and the UI agrees\n");

check("the employee ROLE does grant quote:create (the floor is permissive)",
  can("employee", "quote:create") && PRESET_TO_ROLE.worker === "employee");
check("...and the GRID refuses this employee anyway (the narrower layer wins)",
  !hasLevel(worker, "quotes", "view_create_edit"));
// Asked of the persona that HOLDS view_only. It used to be the worker preset;
// Crew now holds `none`, and asserting "view_only satisfies view_only" against
// a member who is not on view_only would be a check that passes for the wrong
// reason — which is the failure mode this whole file was written to avoid.
check("view_only still satisfies view_only — reading is a real grant, not a nothing",
  hasLevel(viewOnly, "quotes", "view_only") && hasLevel(viewOnly, "invoices", "view_only") &&
  hasLevel(workerFull, "quotes", "view_only"));
check("…and `none` is below it — Crew reads neither",
  !hasLevel(worker, "quotes", "view_only") && !hasLevel(worker, "invoices", "view_only"));
check("a dispatcher, same code path, IS allowed to create",
  hasLevel(dispatcher, "quotes", "view_create_edit"));
check("nobody at view_only can delete either",
  !hasLevel(worker, "quotes", "view_create_edit_delete") &&
  !hasLevel(workerFull, "jobs", "view_create_edit_delete"));

for (const [label, rel, pattern] of [
  ["POST /api/quotes", "app/api/quotes/route.js", /requireLevel\(full, "quotes", "view_create_edit"/],
  ["PATCH /api/quotes/[id]", "app/api/quotes/[id]/route.js", /requireLevel\(full, "quotes", "view_create_edit"/],
  ["POST /api/jobs", "app/api/jobs/route.js", /requireLevel\(full, "jobs", "view_create_edit"/],
  ["PATCH /api/jobs/[id]", "app/api/jobs/[id]/route.js", /requireLevel\(full, "jobs", "view_create_edit"/],
  ["POST /api/invoices", "app/api/invoices/route.js", /requireLevel\(full, "invoices", "view_create_edit"/],
  ["PATCH /api/invoices/[id]", "app/api/invoices/[id]/route.js", /requireLevel\(full, "invoices", "view_create_edit"/],
  // Requests are leads. This was the one category of the four whose routes had
  // no check at all: the board's drag-to-another-column PATCH, the detail
  // PATCH that reassigns and re-scores, and the bulk import.
  ["PATCH /api/leads", "app/api/leads/route.js", /requireLevel\(full, "requests", "view_create_edit"/],
  ["PATCH /api/leads/[id]", "app/api/leads/[id]/route.js", /requireLevel\(full, "requests", "view_create_edit"/],
  ["POST /api/leads/import", "app/api/leads/import/route.js", /requireLevel\(full, "requests", "view_create_edit"/],
  // Changing the markup on an imported subcontractor cost rescales the client
  // price. It had no permission check of ANY kind — not a role, not a level.
  ["PATCH /api/quotes/[id]/imports/[importId]", "app/api/quotes/[id]/imports/[importId]/route.js",
   /requireLevel\(full, "quotes", "view_create_edit"/],
]) check(`${label} enforces the grid`, pattern.test(src(rel)));

check("the quick-add menu hides at exactly the level the API enforces",
  /"app\.quickAdd\.quote": \{ category: "quotes", level: "view_create_edit" \}/.test(src("lib/permissions/nav.js")) &&
  /"app\.quickAdd\.request": \{ category: "requests", level: "view_create_edit" \}/.test(src("lib/permissions/nav.js")));

// ═══ CLAIM 4 — jobCosting REFUSES a posted block ══════════════════════════
//
// The failure this guards is specific and has happened here before: the panel
// was rendered to everyone and the server silently DROPPED the input. A 200
// with the crew, the hours and the margin quietly gone is worse than a 403,
// because the silence is indistinguishable from success.
console.log("\nCLAIM 4 — a posted costing block is refused, not dropped\n");

const { requireCost, mayCost } = await import("../app/api/invoices/costingWrite.js");
check("mayCost is false for both personas", !mayCost(worker) && !mayCost(workerFull));
check("mayCost is true for a manager", mayCost(persona("manager")));
throws403("requireCost for a worker", () => requireCost(worker));
throws403("requireCost for workerFullView (showPricing does not imply costing)", () => requireCost(workerFull));
check("requireCost lets a manager through", (() => {
  try { requireCost(persona("manager")); return true; } catch { return false; }
})());
check("the refusal SAYS the panel was not saved, so nobody assumes it was",
  (() => { try { requireCost(worker); return false; } catch (e) { return /wasn't saved|was not saved/.test(e.message); } })());

console.log("\nAll three surfaces — quote, job, invoice — on both halves\n");
for (const [label, rel] of [
  ["POST /api/quotes", "app/api/quotes/route.js"],
  ["PATCH /api/quotes/[id]", "app/api/quotes/[id]/route.js"],
  ["POST /api/invoices", "app/api/invoices/route.js"],
  ["PATCH /api/invoices/[id]", "app/api/invoices/[id]/route.js"],
]) check(`${label} refuses a posted block`, /if \(costing !== undefined\) requireCost\(full\)/.test(src(rel)));

// The job's own cost inputs. There is no `costing` block on a job — a job's
// cost is derived from expenses and time entries — but its MATERIALS carry
// estUnitCost and actualCost, and actualCost on the tick transition is written
// into the company's price history. That was the third surface, and it had no
// jobCosting involvement on the read OR the write.
for (const [label, pattern] of [
  ["POST a hand-added line's estUnitCost", /if \(body\.estUnitCost != null\) requireCost\(full\)/],
  ["PATCH a receipt's actualCost", /if \(body\.actualCost != null\) requireCost\(full\)/],
  ["the READ strips both cost columns", /function stripCosts/],
  ["...and the two money totals off the progress roll-up", /estimatedTotal, actualTotal, \.\.\.countsOnly/],
]) check(`job materials: ${label}`, pattern.test(src("app/api/jobs/[id]/materials/route.js")));

check("the materials panel does not render 'no price set' over a hidden one",
  /m\.costHidden \? \(/.test(src("app/components/jobs/JobMaterials.js")));
check("...nor print $0.00 as the estimated total",
  /!p\.costHidden/.test(src("app/components/jobs/JobMaterials.js")));

console.log("\nAnd the three costing READS answer 403, not a body of zeroes\n");
for (const [label, rel] of [
  ["quote", "app/api/quotes/[id]/costing/route.js"],
  ["job", "app/api/jobs/[id]/costing/route.js"],
  ["invoice", "app/api/invoices/costing/route.js"],
]) check(`GET the ${label}'s costing refuses without the toggle`,
  /if \(!hasToggle\(full, "jobCosting"\)\)/.test(src(rel)) && /status: 403/.test(src(rel)));

// ── The header comment is part of the contract ────────────────────────────
//
// lib/permissions.js listed requests and jobCosting as "written and read by
// nothing" long after both had teeth. A stale comment there is worse than
// none: it tells the next reader the feature is inert. Asserted so it cannot
// drift back.
console.log("\nThe grid's own header still tells the truth\n");
const HEADER = src("lib/permissions.js");
check("requests is no longer described as inert",
  !/\* requests\s+— saved, shown back, gates no request anywhere/.test(HEADER));
check("jobCosting is no longer described as inert",
  !/\* jobCosting\s+— saved, shown back, gates no costing view anywhere/.test(HEADER));
check("notes IS still named as the one that is (it genuinely is)",
  /notes — saved, shown back, gates no note anywhere/.test(HEADER));
check("showPricing's description covers the read half it now controls",
  /See prices on quotes, invoices and jobs/.test(HEADER));

// ═══════════════════════════════════════════════════════════════════════════
// THE SURFACES THE FIRST SWEEP DID NOT REACH — EXECUTED
//
// Everything above this line is a pure function called directly, plus a grep
// for the CALL at each route. That pairing found nine holes and missed six
// more, all reported by the same QA pass against production as `jonny` on the
// Worker (limited) preset:
//
//   C1  Settings > Services served the whole rate card — $150/door, the
//       complexity uplifts, add-ons to $1,000, a $3,800 job minimum — to a
//       member with showPricing:false. The sibling Products & Services page
//       already refused; the check existed and had never been applied here.
//   C2  GET /api/leads returned every enquiry's email, phone and stated
//       budget. Clients, quotes, invoices, appointments and jobs had all been
//       redacted; leads were never looked at.
//   C3  `pricingHidden: true` rode along correctly while `acceptedTotal`,
//       `estimateData.breakdown[].amount` and `lineItems[].meta.baseUnitPrice`
//       survived in the same payload.
//   C4  Invoice totals in plain text on the client page and in the lifecycle
//       banner ("Paid in full — $7,645.00").
//   C6  A worker at timeTracking "view_record_own" — record, NOT edit — could
//       PATCH his own APPROVED entry: hours 0.01 → 1, approved → pending.
//
// A grep would have passed on every one of them, because in each case the
// route DID call a redactor — just not on the field, the sibling collection or
// the verb that mattered. So this section runs the handlers.
//
// The stub trio below is the same one scripts/check-cost-basis.mjs uses and
// for the same three reasons: "@/lib/db" builds a Prisma pool against Neon at
// module load, "@/lib/currentMember" drags in Better Auth, and bare node
// cannot resolve "next/server". apiMember, enforce and every route handler are
// the shipped files.
// ═══════════════════════════════════════════════════════════════════════════

const { register } = await import("node:module");
const { writeFileSync, rmSync } = await import("node:fs");
const { pathToFileURL } = await import("node:url");

globalThis.__FQ_ENFORCEABLE = null;
globalThis.__FQ_MEMBER = async () => null;
globalThis.__FQ_DB = null;

const HOOKS = `
const STUBS = {
  "@/lib/db": "fq-stub:db",
  "@/lib/currentMember": "fq-stub:member",
  "next/server": "fq-stub:next",
};
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:db") {
    return { format: "module", shortCircuit: true,
      source: "export const db = new Proxy({}, { get: (_t, p) => globalThis.__FQ_DB[p] });" };
  }
  if (url === "fq-stub:member") {
    return { format: "module", shortCircuit: true,
      source: "export const getCurrentMember = (...a) => globalThis.__FQ_MEMBER(...a);" };
  }
  if (url === "fq-stub:next") {
    return { format: "module", shortCircuit: true,
      source: "export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) };" };
  }
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

// ── The fixtures every handler below reads ────────────────────────────────
//
// One lead, one quote, one invoice, one time entry — each carrying exactly the
// values QA read off production, so a failure here prints the real number that
// leaked rather than a placeholder.

const LEAD = {
  id: "lead1", companyId: "co", name: "Emilio Boves",
  email: "emilio.boves@gmail.com", phone: "819-238-7263",
  message: "Kitchen cabinets, 32 doors, want them sprayed white",
  status: "new", source: "website", budgetBand: "15k_plus", timeline: "asap",
  score: 78, temperature: "hot",
  scoreReasons: [{ label: "Budget $15k+", weight: 30 }, { label: "Phone number provided", weight: 8 }],
  photosRequestedAt: "2026-08-02", photosRequestedTo: "office@truefinish.ca",
  intake: { rooms: 1 }, createdAt: "2026-08-01",
  category: { label: "Cabinet refinishing" },
  assignedTo: { id: "u2", name: "Sam" },
  quote: null,
};

const ESTIMATE_QUOTE = {
  id: "q9", quoteNumber: "Q-2026-0031", total: "20250",
  estimateSource: "website", reviewNotes: null, createdAt: "2026-08-03",
  estimateData: {
    trade: "roofing", materialKey: "architectural",
    measurement: { squares: 27, areaSqft: 2700 },
    range: { low: 18000, point: 20250, high: 22500 },
    unit: null,
    breakdown: [
      { label: "Tear-off", amount: 6750 },
      { label: "Underlay", amount: 2250 },
      { label: "Shingles", amount: 11250 },
    ],
    assumptions: ["One layer to remove"],
    budget: { label: "15,000+", exceeded: false },
    capturedAt: "2026-08-03",
  },
  client: { name: "Marie Tremblay", email: CLIENT.email, phone: CLIENT.phone, address: CLIENT.address },
};

const CLIENT_ROW = {
  ...CLIENT,
  quotes: [{ id: "q1", quoteNumber: "Q-0001", total: "7645", shareToken: "tok_share_abc" }],
  invoices: [
    { id: "i9", invoiceNumber: "INV-0009", status: "paid", subtotal: "7000", discount: "0", tax: "645", total: "7645", amountPaid: "7645", amountDue: "0" },
    { id: "i3", invoiceNumber: "INV-0003", status: "sent", subtotal: "6000", discount: "0", tax: "650", total: "6650", amountPaid: "0", amountDue: "6650" },
  ],
  jobs: [{ id: "j1", title: "Repaint kitchen" }],
};

const LIFECYCLE_INVOICE = {
  id: "i9", companyId: "co", invoiceNumber: "INV-0009", status: "paid",
  clientId: "c1", quoteId: null, jobId: null, version: 1, parentInvoiceId: null,
  total: "7645", subtotal: "7000", discount: "0",
  amountPaid: "7645", amountDue: "0",
  paidDate: "2026-08-10", paidVia: "card", dueDate: "2026-08-09",
  sentAt: "2026-08-01", sentToEmail: CLIENT.email,
  client: { id: "c1", name: CLIENT.name, email: CLIENT.email },
};

// The entry QA rewrote: 0.01 hours, already APPROVED, and his own.
const APPROVED_ENTRY = {
  id: "te1", workerId: "w1", jobId: null, hours: 0.01, status: "approved",
  // 09:00 and 09:00:36 in America/Toronto, which is what the company's zone is
  // set to below. Stored UTC, because that is how the column is stored — and
  // resolveWallClock reads the PATCH's bare "2026-08-20T10:00" in the company's
  // zone, so a UTC clockIn here would make the arithmetic below off by the
  // offset and quietly turn a 1-hour assertion into a 5-hour one.
  approvedById: "u-boss", clockIn: new Date("2026-08-20T13:00:00Z"),
  clockOut: new Date("2026-08-20T13:00:36Z"),
  worker: { id: "w1", companyId: "co", userId: "u-jonny", name: "Jonny", hourlyRate: 25 },
};
const PENDING_ENTRY = { ...APPROVED_ENTRY, id: "te2", status: "pending", approvedById: null };

// Which time entry timeEntry.findFirst hands back. Set per scenario.
let timeEntryRow = APPROVED_ENTRY;

function makeDb() {
  const explicit = {
    // The whole point of the fixture: the handler asks the database who is
    // calling, and gets the preset under test.
    member: { async findUnique() { return globalThis.__FQ_ENFORCEABLE; } },
    leadRequest: {
      async findMany() { return [LEAD]; },
      async findFirst() { return { ...LEAD, notes: [] }; },
    },
    callConsent: { async findMany() { return []; }, async findFirst() { return null; } },
    quote: { async findMany() { return [ESTIMATE_QUOTE]; } },
    client: { async findFirst() { return CLIENT_ROW; } },
    invoice: {
      async findFirst() { return { ...LIFECYCLE_INVOICE }; },
      async findMany() { return [{ id: "i9", version: 1 }]; },
    },
    job: { async findFirst() { return null; } },
    task: { async findUnique() { return null; } },
    company: { async findUnique() { return { id: "co", timezone: "America/Toronto", slug: "truefinish", financing: null, currency: "CAD" }; } },
    timeEntry: {
      async findFirst() { return timeEntryRow; },
      // Echoes the patch back over the row, so an assertion can read what the
      // handler actually decided to write rather than trusting the status.
      async update({ data }) {
        return { ...timeEntryRow, ...data, worker: { id: "w1", name: "Jonny" } };
      },
    },
    user: { async findUnique() { return { name: "Jonny", email: "j@x.ca" }; } },
    activityLog: { async create() { return {}; } },
    serviceCategory: {
      async findMany() {
        return [{
          id: "sc1", key: "cabinet_refinishing", label: "Cabinet Refinishing",
          icon: null, isSystem: true, customFields: null,
          companySettings: [{ companyId: "co", enabled: true, defaultRate: 150, unit: "door", rates: { perDoor: 150 } }],
        }];
      },
    },
    instantQuoteConfig: { async findMany() { return []; } },
    companyServiceCategory: { async findMany() { return []; } },
  };

  const byName = (prop) => {
    if (/^(findMany|groupBy)$/.test(prop)) return async () => [];
    if (/^count$/.test(prop)) return async () => 0;
    if (/^aggregate$/.test(prop)) return async () => ({ _sum: {}, _count: {} });
    return async () => null;
  };
  return new Proxy(explicit, {
    get(target, model) {
      if (model in target)
        return new Proxy(target[model], { get: (t, prop) => (prop in t ? t[prop] : byName(prop)) });
      return new Proxy({}, { get: (_t, prop) => byName(prop) });
    },
  });
}
globalThis.__FQ_DB = makeDb();

/** Sign in as one of the personas above. */
function become(p, { userId = "u-jonny" } = {}) {
  const row = { id: "m-x", userId, companyId: "co", role: p.role, permissions: p.permissions };
  globalThis.__FQ_ENFORCEABLE = row;
  globalThis.__FQ_MEMBER = async () => ({ ...row, impersonation: false });
}

const req = (url, body) => ({
  url,
  json: async () => body ?? {},
});
const params = (o) => Promise.resolve(o);

const routeCache = new Map();
async function route(spec) {
  if (!routeCache.has(spec)) routeCache.set(spec, await import(spec));
  return routeCache.get(spec);
}

// ── C2 — every lead leaked client contact ─────────────────────────────────
console.log("\nC2 — GET /api/leads, executed at both worker presets\n");

const leads = await route("@/app/api/leads/route");

become(viewOnly);
const workerLeads = (await leads.GET(req("http://x/api/leads"))).body;
check("the list still arrives — a lead board is a screen a crew member may open",
  Array.isArray(workerLeads) && workerLeads.length === 1);
const wl = workerLeads[0];
check("the enquirer's email is ABSENT from the payload", wl.email === undefined);
check("…and the phone number", wl.phone === undefined);
check("…and the budget band they stated", wl.budgetBand === undefined);
check("…and the score reasons, which say the band in prose ('Budget $15k+')",
  wl.scoreReasons === undefined);
check("…and the address photos were requested at", wl.photosRequestedTo === undefined);
check("doNotCall goes with the number it describes", wl.doNotCall === undefined);
check("the NAME survives — the board is unusable without it", wl.name === "Emilio Boves");
check("…and what they asked for", /32 doors/.test(wl.message || ""));
check("…and the triage: score and temperature are not contact data",
  wl.score === 78 && wl.temperature === "hot");
check("…and the timeline, which is when not how much", wl.timeline === "asap");
check("marked restricted, so a screen can say why rather than show a gap",
  wl.restricted === true);

become(workerFull);
const fullLeads = (await leads.GET(req("http://x/api/leads"))).body;
check("workerFullView (full_view) still reads the email", fullLeads[0].email === LEAD.email);
check("…and the phone", fullLeads[0].phone === LEAD.phone);
check("…and the budget band", fullLeads[0].budgetBand === "15k_plus");
check("…and is NOT marked restricted", fullLeads[0].restricted === undefined);

const leadDetail = await route("@/app/api/leads/[id]/route");
become(viewOnly);
const oneLead = (await leadDetail.GET(req("http://x/api/leads/lead1"), { params: params({ id: "lead1" }) })).body;
check("the DETAIL door is closed too — enumerating ids off the board gets nothing more",
  oneLead.email === undefined && oneLead.phone === undefined && oneLead.budgetBand === undefined);
become(workerFull);
const oneLeadFull = (await leadDetail.GET(req("http://x/api/leads/lead1"), { params: params({ id: "lead1" }) })).body;
check("…and workerFullView still opens it in full", oneLeadFull.email === LEAD.email);

// ── C6 — his own APPROVED timesheet ───────────────────────────────────────
console.log("\nC6 — PATCH /api/time-entries/[id], the record/edit rung\n");

const timeEntry = await route("@/app/api/time-entries/[id]/route");
const patchEntry = async (body) =>
  timeEntry.PATCH(req("http://x/api/time-entries/te", body), { params: params({ id: timeEntryRow.id }) });

timeEntryRow = PENDING_ENTRY;
become(recordOnly);
const workerEditsOwn = await patchEntry({ clockOut: "2026-08-20T10:00" });
check("view_record_own may NOT edit its own entry — 'record' is not 'edit'",
  workerEditsOwn.status === 403);
check("…and the refusal is 403, never 500", workerEditsOwn.status === 403);
check("…and it says what they CAN still do rather than naming a permission",
  /record time, not edit it/.test(workerEditsOwn.body?.error || ""));

become(workerFull);
const fullEditsOwnPending = await patchEntry({ clockOut: "2026-08-20T10:00" });
check("workerFullView (view_record_edit_own) KEEPS editing its own pending entry",
  fullEditsOwnPending.status === 200);
check("…and the hours are recomputed by the server, not accepted from the body",
  fullEditsOwnPending.body?.hours === 1);

timeEntryRow = APPROVED_ENTRY;
const fullEditsOwnApproved = await patchEntry({ clockOut: "2026-08-20T10:00" });
check("…but NOT once it has been approved — payroll multiplies those hours",
  fullEditsOwnApproved.status === 403);
check("…and the refusal names who can reopen it",
  /supervisor or admin/.test(fullEditsOwnApproved.body?.error || ""));

const fullUnapprovesOwn = await patchEntry({ status: "pending" });
check("…and 'pending' is not a way round it — that is un-approving",
  fullUnapprovesOwn.status === 403);
const fullApprovesOwn = await patchEntry({ status: "approved" });
check("…nor is approving (this was the one gate that already worked)",
  fullApprovesOwn.status === 403);

become(dispatcher, { userId: "u-boss" });
const bossReopens = await patchEntry({ clockOut: "2026-08-20T10:00" });
check("a supervisor CAN reopen an approved entry — somebody has to be able to",
  bossReopens.status === 200);

timeEntryRow = PENDING_ENTRY;
become(worker, { userId: "u-someone-else" });
const workerEditsColleague = await patchEntry({ clockOut: "2026-08-20T10:00" });
check("…and nobody at 'own' touches a colleague's row", workerEditsColleague.status === 403);

// ── C3 — money in the payload behind `pricingHidden: true` ────────────────
console.log("\nC3 — the money that survived a payload already marked pricingHidden\n");

const ACCEPTED = {
  id: "q7", quoteNumber: "Q-0007", status: "accepted",
  subtotal: "7000", discount: "0", tax: "645", total: "7645",
  acceptedSubtotal: "7000", acceptedTax: "645", acceptedTotal: "7645",
  lineItems: [{
    description: "Prime and spray 32 doors", quantity: 32, unit: "door",
    rate: 170, amount: 5440,
    meta: {
      baseUnitPrice: 150, complexityLevel: "moderate", complexityUpcharge: 20,
      complexityReasons: ["deep_damage"], color: "Cloud White", sheen: "satin",
    },
  }],
  estimateData: ESTIMATE_QUOTE.estimateData,
  client: { ...CLIENT },
};
const hiddenQuote = redactQuoteMoney(worker, ACCEPTED);
check("it did declare itself hidden — that part was right all along",
  hiddenQuote.pricingHidden === true);
check("acceptedTotal is ABSENT — what the client agreed to is the harder number",
  hiddenQuote.acceptedTotal === undefined);
check("…and acceptedSubtotal and acceptedTax with it",
  hiddenQuote.acceptedSubtotal === undefined && hiddenQuote.acceptedTax === undefined);
check("lineItems[].meta.baseUnitPrice is gone — the rate before complexity is still a rate",
  hiddenQuote.lineItems[0].meta.baseUnitPrice === undefined);
check("…and meta.complexityUpcharge, which is what was added to it",
  hiddenQuote.lineItems[0].meta.complexityUpcharge === undefined);
check("…while the SPEC in meta survives: level, reasons, colour, sheen",
  hiddenQuote.lineItems[0].meta.complexityLevel === "moderate" &&
  hiddenQuote.lineItems[0].meta.color === "Cloud White" &&
  hiddenQuote.lineItems[0].meta.sheen === "satin");
check("estimateData.range is gone — that is the price the homeowner was shown",
  hiddenQuote.estimateData.range === undefined);
check("…and every breakdown amount (6750 / 2250 / 11250)",
  hiddenQuote.estimateData.breakdown.every((b) => b.amount === undefined));
check("…and the budget the homeowner stated", hiddenQuote.estimateData.budget === undefined);
check("…while the breakdown LABELS and the measurements stay — that is the job",
  hiddenQuote.estimateData.breakdown[0].label === "Tear-off" &&
  hiddenQuote.estimateData.measurement.squares === 27 &&
  hiddenQuote.estimateData.assumptions.length === 1);
check("estimateData declares itself hidden too, so no screen prints $0",
  hiddenQuote.estimateData.pricingHidden === true);
check("the source quote is not mutated",
  ACCEPTED.acceptedTotal === "7645" && ACCEPTED.lineItems[0].meta.baseUnitPrice === 150 &&
  ACCEPTED.estimateData.range.point === 20250);

console.log("\n…and workerFullView, who holds showPricing, still reads all of it\n");
const shownQuote = redactQuoteMoney(workerFull, ACCEPTED);
check("acceptedTotal survives", shownQuote.acceptedTotal === "7645");
check("meta.baseUnitPrice survives", shownQuote.lineItems[0].meta.baseUnitPrice === 150);
check("the estimate range survives", shownQuote.estimateData.range.point === 20250);
check("…and nothing is marked hidden", shownQuote.pricingHidden === undefined);

console.log("\nGET /api/quotes/estimate-reviews, executed\n");
const reviews = await route("@/app/api/quotes/estimate-reviews/route");
become(viewOnly);
const workerReviews = (await reviews.GET(req("http://x/api/quotes/estimate-reviews"))).body;
const wr = workerReviews.quotes[0];
check("the queue's own `total` is absent", wr.total === undefined);
check("…and the breakdown amounts inside estimateData",
  wr.estimateData.breakdown.every((b) => b.amount === undefined));
check("…and the range", wr.estimateData.range === undefined);
check("the client filter that DID land is still landing", wr.client.email === undefined);
check("…and it is declared", wr.pricingHidden === true);
become(workerFull);
const fullReviews = (await reviews.GET(req("http://x/api/quotes/estimate-reviews"))).body;
check("workerFullView reads the queue in full",
  fullReviews.quotes[0].total === "20250" &&
  fullReviews.quotes[0].estimateData.breakdown[0].amount === 6750);

// ── C4 — invoice totals in plain text ─────────────────────────────────────
console.log("\nC4 — the client page and the lifecycle banner\n");

const clientDetail = await route("@/app/api/clients/[id]/route");
become(worker);
const workerClient = (await clientDetail.GET(req("http://x/api/clients/c1"), { params: params({ id: "c1" }) })).body;
check("the client's own contact details are gone (this half already worked)",
  workerClient.email === undefined);
check("the nested QUOTES are redacted (this half already worked)",
  workerClient.quotes[0].total === undefined && workerClient.quotes[0].shareToken === undefined);
check("INV-0009's $7,645 is ABSENT — the half the first pass walked past",
  workerClient.invoices[0].total === undefined);
check("…and INV-0003's $6,650", workerClient.invoices[1].total === undefined);
check("…and what is still owed on it", workerClient.invoices[1].amountDue === undefined);
check("…and what has been paid", workerClient.invoices[0].amountPaid === undefined);
check("the invoice NUMBER and STATUS survive — which invoices exist is not money",
  workerClient.invoices[0].invoiceNumber === "INV-0009" &&
  workerClient.invoices[0].status === "paid");
check("…and each is declared hidden", workerClient.invoices[0].pricingHidden === true);
become(workerFull);
const fullClient = (await clientDetail.GET(req("http://x/api/clients/c1"), { params: params({ id: "c1" }) })).body;
check("workerFullView still reads the invoice totals", fullClient.invoices[0].total === "7645");

const lifecycle = await route("@/app/api/invoices/[id]/lifecycle/route");
become(viewOnly);
const workerLife = (await lifecycle.GET(req("http://x/api/invoices/i9/lifecycle"), { params: params({ id: "i9" }) })).body;
const paidBanner = workerLife.banners.find((b) => b.id === "paid");
check("the paid banner still appears — the STATE is not the amount", !!paidBanner);
check("…but '$7,645.00 received' is not in it", paidBanner.data.paid === undefined);
check("…and the banner declares itself, so the page prints the amount-free sentence",
  paidBanner.pricingHidden === true);
check("…and the paid DATE survives, which is when not how much",
  paidBanner.data.paidDate === "2026-08-10");
check("the `money` block is null rather than a set of zeroes", workerLife.money === null);
check("…and the response says why", workerLife.pricingHidden === true);
become(workerFull);
const fullLife = (await lifecycle.GET(req("http://x/api/invoices/i9/lifecycle"), { params: params({ id: "i9" }) })).body;
check("workerFullView gets the figures back",
  fullLife.money?.total === 7645 &&
  fullLife.banners.find((b) => b.id === "paid").data.paid === 7645);
check("…and nothing is marked hidden", fullLife.pricingHidden === undefined);

// ── C1 — the price book on Settings > Services ────────────────────────────
console.log("\nC1 — the rate card the sibling page already refused\n");

const serviceCategories = await route("@/app/api/settings/service-categories/route");
become(worker);
const workerCats = (await serviceCategories.GET(req("http://x/api/settings/service-categories"))).body;
check("the catalogue still arrives — four other screens read it for the labels",
  Array.isArray(workerCats) && workerCats[0].label === "Cabinet Refinishing");
check("…and which trades are switched on", workerCats[0].enabled === true);
check("the $150/door price book is ABSENT", workerCats[0].priceBook === undefined);
check("…and the company's own overrides", workerCats[0].rateOverrides === undefined);
check("…and the flat default rate", workerCats[0].defaultRate === undefined);
check("`unit` survives — 'per door' is how work is counted, not what it costs",
  workerCats[0].unit === "door");
check("and it is declared, so the screen prints the reason not empty boxes",
  workerCats[0].pricingHidden === true);
become(workerFull);
const fullCats = (await serviceCategories.GET(req("http://x/api/settings/service-categories"))).body;
check("workerFullView reads the rate card", fullCats[0].priceBook?.perDoor === 150);
check("…and its defaultRate", fullCats[0].defaultRate === 150);
check("…and is not marked hidden", fullCats[0].pricingHidden === undefined);

const instantQuote = await route("@/app/api/settings/instant-quote/route");
become(worker);
const workerInstant = await instantQuote.GET(req("http://x/api/settings/instant-quote"));
check("GET /api/settings/instant-quote refuses — it is nothing but sell rates",
  workerInstant.status === 403);
check("…with a 403, not a 500", workerInstant.status === 403);
become(workerFull);
const fullInstant = await instantQuote.GET(req("http://x/api/settings/instant-quote"));
check("…and workerFullView is let through", fullInstant.status === 200);

// ── B1/B2 and C8 — the screens agree with the API ─────────────────────────
//
// These are greps, and deliberately so: they assert that a RENDERING reads the
// flag the executed sections above proved is in the payload. Everything that
// can be executed is executed; a React tree cannot be, so the pairing is what
// is checked — payload here, reader there.
console.log("\nThe screens read what the API declares\n");

for (const [label, rel, pattern] of [
  // B1/B2 — the create controls, at exactly the level POST enforces. The
  // refusal was correct and the UI was wrong: the builder stayed on screen and
  // said nothing.
  ["the quotes list hides New Quote", "app/app/quotes/page.js",
   /useHasLevel\("quotes", "view_create_edit"\)/],
  ["the jobs list hides New Job", "app/app/jobs/page.js",
   /useHasLevel\("jobs", "view_create_edit"\)/],
  ["the dashboard's + New Quote too", "app/app/page.js",
   /useHasLevel\("quotes", "view_create_edit"\)/],
  ["the client page's two quick actions", "app/app/clients/[id]/page.js",
   /useHasLevel\("jobs", "view_create_edit"\)/],
  ["…and its Edit button, which PATCH refuses at full_edit", "app/app/clients/[id]/page.js",
   /useHasLevel\("clientsProperties", "full_edit"\)/],
  // The builder itself, for the URL somebody has bookmarked. One gate covers
  // /app/quotes/new AND /app/quotes/[id]/edit, because there is one screen.
  ["the quote builder refuses before the work, not after it",
   "app/components/quotes/builder/QuoteBuilder.js", /if \(!canWrite \|\| !canSeePrices\)/],
  ["…and scrolls a refusal that DOES arrive into view",
   "app/components/quotes/builder/QuoteBuilder.js", /errorRef\.current\?\.scrollIntoView/],
  ["the new-job form refuses the same way", "app/app/jobs/new/page.js",
   /useHasLevel\("jobs", "view_create_edit"\)/],
  // C8 — the trap AGENTS.md names. redactClient has set `restricted` since it
  // was written and nothing read it, so the job page printed "Not set" over a
  // phone number the client has.
  ["the job page tells restriction from absence", "app/app/jobs/[id]/JobDetail.js",
   /client\?\.restricted/],
  ["…and the client page says so too", "app/app/clients/[id]/page.js",
   /client\.restricted &&/],
  ["…and the leads board", "app/app/leads/page.js", /lead\.restricted &&/],
  ["…and its budget picker never claims 'Not stated' over a withheld band",
   "app/app/leads/page.js", /\{!lead\.restricted && \(/],
  // C4 — the banner's amount-free sentences.
  ["the invoice banner has a sentence without the figure",
   "app/app/invoices/[id]/LifecycleBanners.js", /paidNoAmount/],
  // C1 — the services screen prints the reason where the rates were.
  ["Settings > Services prints the reason, not empty rate boxes",
   "app/app/settings/services/page.js", /c\.pricingHidden/],
]) check(label, pattern.test(src(rel)));

check("…and 'Not set' is no longer hard-coded over a withheld field",
  !/\|\| "Not set"/.test(src("app/app/jobs/[id]/JobDetail.js")));

// One sentence, one key. app.quoteDetail.pricingHidden and
// app.invoiceDetail.pricingHidden held the identical string and a third and
// fourth were about to be written for the job page and the services screen.
check("the restriction sentences are one shared key, not one per screen",
  !/"app\.(quote|invoice)Detail\.pricingHidden":/.test(src("app/i18n/appMessages.js")));

// ═══════════════════════════════════════════════════════════════════════════
// MUTATION TESTS — prove each guard is what is doing the work
//
// An assertion that passes is only worth something if it FAILS when the thing
// it guards is removed. Both of these were live in production, so the mutant
// is the shipped file as it was, not a hypothetical.
// ═══════════════════════════════════════════════════════════════════════════
console.log("\nMutation: each guard, removed, and the leak comes back\n");

async function mutant(rel, edits, run) {
  const path = new URL(`../${rel}`, import.meta.url);
  const original = readFileSync(path, "utf8");
  let mutated = original;
  for (const [from, to] of edits) mutated = mutated.replace(from, to);
  check(`${rel}: the mutation actually changed the source`, mutated !== original);

  const tmp = new URL(`../.rbac-mutant-${Math.random().toString(36).slice(2)}.js`, import.meta.url);
  try {
    writeFileSync(tmp, mutated);
    const mod = await import(`${pathToFileURL(tmp.pathname).href}?v=${Date.now()}`);
    return await run(mod);
  } finally {
    rmSync(tmp, { force: true });
  }
}

// C2 — take redactLeads out and the email and phone come straight back.
await mutant(
  "app/api/leads/route.js",
  [["redactLeads(\n      full,", "((_m, rows) => rows)(\n      full,"]],
  async (mod) => {
    become(viewOnly);
    const leaked = (await mod.GET(req("http://x/api/leads"))).body[0];
    check("without redactLeads, a name_address_only member reads the email again",
      leaked.email === LEAD.email);
    check("…and the phone", leaked.phone === LEAD.phone);
    check("…and the budget band", leaked.budgetBand === "15k_plus");
  },
);

// C6 — take the two new gates out and the approved timesheet reopens.
await mutant(
  "app/api/time-entries/[id]/route.js",
  [
    ['if (!hasLevel(full, "timeTracking", "view_record_edit_own")) {', "if (false) {"],
    ['existing.status === "approved" &&', "false &&"],
  ],
  async (mod) => {
    timeEntryRow = APPROVED_ENTRY;
    become(worker);
    const reopened = await mod.PATCH(
      req("http://x/api/time-entries/te1", { clockOut: "2026-08-20T10:00", status: "pending" }),
      { params: params({ id: "te1" }) },
    );
    check("without the two gates, view_record_own edits an approved entry again",
      reopened.status === 200);
    check("…recalculating the hours 0.01 → 1, exactly as QA did",
      reopened.body?.hours === 1);
    check("…and flipping it back from approved to pending",
      reopened.body?.status === "pending");
  },
);

// And the shipped file does not behave that way. Same member, same request.
timeEntryRow = APPROVED_ENTRY;
become(worker);
const shipped = await timeEntry.PATCH(
  req("http://x/api/time-entries/te1", { clockOut: "2026-08-20T10:00", status: "pending" }),
  { params: params({ id: "te1" }) },
);
check("…while the shipped route refuses it", shipped.status === 403);

// ── The door itself, for the tier that is not allowed through it ──────────
//
// Everything above this line is about SHAPING a payload for somebody who may
// read the document. Crew may not, and that is a different mechanism: the
// route refuses before it reads a row. Executed against the same handlers, as
// the Crew preset, because "the redactor would have caught it anyway" is only
// true while somebody is allowed the endpoint at all.
console.log("\nCrew is refused at the door, not redacted at the till\n");

become(worker);
const crewLeads = await leads.GET(req("http://x/api/leads"));
check("GET /api/leads refuses Crew", crewLeads.status === 403);
check("…with a sentence naming the access level, not a permission string",
  /access level for Requests/.test(crewLeads.body?.error || ""));
const crewLead = await leadDetail.GET(req("http://x/api/leads/lead1"), { params: params({ id: "lead1" }) });
check("…and so does the detail endpoint beside it", crewLead.status === 403);
const crewReviews = await reviews.GET(req("http://x/api/quotes/estimate-reviews"));
check("GET /api/quotes/estimate-reviews refuses Crew", crewReviews.status === 403);
const crewLife = await lifecycle.GET(req("http://x/api/invoices/i9/lifecycle"), { params: params({ id: "i9" }) });
check("GET /api/invoices/[id]/lifecycle refuses Crew", crewLife.status === 403);

// And the control: the same requests, one rung up, still answer.
become(viewOnly);
check("a member at view_only still gets the lead board",
  Array.isArray((await leads.GET(req("http://x/api/leads"))).body));
check("…and the estimate queue",
  Array.isArray((await reviews.GET(req("http://x/api/quotes/estimate-reviews"))).body?.quotes));


console.log(`\n${pass + failures.length} checks, ${failures.length} failure(s).\n`);
if (failures.length) process.exitCode = 1;

