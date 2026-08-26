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
import { PERMISSION_PRESETS, PRESET_TO_ROLE } from "../lib/permissions.js";
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
for (const cat of ["quotes", "jobs", "invoices", "requests"]) {
  check(`both are view_only on ${cat}`,
    worker.permissions[cat] === "view_only" && workerFull.permissions[cat] === "view_only");
}

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
  PERMISSION_PRESETS.worker.values.quotes === "view_only" && PRESET_TO_ROLE.worker === "employee");
check("...and the GRID refuses this employee anyway (the narrower layer wins)",
  !hasLevel(worker, "quotes", "view_create_edit"));
check("view_only still satisfies view_only — reading is a real grant, not a nothing",
  hasLevel(worker, "quotes", "view_only") && hasLevel(worker, "invoices", "view_only"));
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

console.log(`\n${pass + failures.length} checks, ${failures.length} failure(s).\n`);
if (failures.length) process.exitCode = 1;

