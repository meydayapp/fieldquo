// scripts/check-role-access.mjs
//
//   npm run check:role-access
//
// The owner, 2026-10-03: "make sure that if we share it to a teammate that
// only the pertinent information is displayed that fits the right access…
// specially for crew.. they can do work related but not have access to
// pricing etc.. i want a confirmation same for the estimator admin, manager".
//
// This is that confirmation, EXECUTED. Every assertion below calls the
// SHIPPED route handler — app/api/** — as a fixture member of each preset,
// against a database stub that answers `select` and `include` the way Prisma
// does (scripts/fixtures/prismaShapeStub.mjs, which reads its relations from
// prisma/schema.prisma). So "the crew never receives a price" is a statement
// about the JSON that leaves the server, not about what a page chooses to
// draw. docs/ROLE-ACCESS.md is the plain-English table; each of its rows
// names the section here that proves it.
//
// The fixture company: one painting job (j1) the crew member is booked on,
// one (j2) they are not; a priced quote with an AI review carrying the margin;
// an invoice with a payment and an amendment; a deposit schedule; a change
// order billed on the invoice; an office to-do chasing that invoice.
import { tables, writes, resetShapeStub } from "./fixtures/prismaShapeStub.mjs";
import { session } from "./fixtures/apiMemberStub.mjs";
import { PERMISSION_PRESETS, PRESET_TO_ROLE } from "@/lib/permissions";
import { findWorkOrderMoneyKey } from "@/lib/workOrder/build";

let pass = 0;
const failures = [];
const ok = (label, cond, detail = "") => {
  if (cond) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}${detail ? `  — ${detail}` : ""}`);
  }
};
const section = (t) => console.log(`\n${t}\n`);

// ── The people ─────────────────────────────────────────────────────────────
const preset = (key) => ({ ...PERMISSION_PRESETS[key].values });
const MEMBERS = {
  owner: { id: "m_owner", userId: "u_owner", companyId: "co1", role: "owner", permissions: null },
  admin: { id: "m_admin", userId: "u_admin", companyId: "co1", role: "admin", permissions: null },
  manager: { id: "m_mgr", userId: "u_mgr", companyId: "co1", role: PRESET_TO_ROLE.manager, permissions: preset("manager") },
  dispatcher: { id: "m_disp", userId: "u_disp", companyId: "co1", role: PRESET_TO_ROLE.dispatcher, permissions: preset("dispatcher") },
  estimator: { id: "m_est", userId: "u_est", companyId: "co1", role: PRESET_TO_ROLE.estimator, permissions: preset("estimator") },
  crew: { id: "m_crew", userId: "u_crew", companyId: "co1", role: PRESET_TO_ROLE.worker, permissions: preset("worker") },
  // The editor offers this shape: documents granted, money withheld.
  docsNoMoney: {
    id: "m_custom", userId: "u_custom", companyId: "co1", role: "employee",
    permissions: { ...preset("estimator"), showPricing: false, invoices: "view_only", quotes: "view_only" },
  },
};
const ROLES = ["owner", "admin", "manager", "dispatcher", "estimator", "crew"];

// ── The company ────────────────────────────────────────────────────────────
function seed() {
  resetShapeStub();
  const company = { id: "co1", name: "Tremblay Painting", currency: "USD", outboundCallsEnabled: false, timezone: "America/Toronto", travelBufferMinutes: 0 };
  const users = Object.values(MEMBERS).map((m) => ({ id: m.userId, name: `${m.id.slice(2)} person`, email: `${m.id}@example.test` }));

  const client1 = {
    id: "c1", companyId: "co1", name: "Marie Tremblay", type: "residential", contactName: "Marie",
    email: "marie@example.test", phone: "819-555-0100", address: "755 Rue Saint-Louis", city: "Gatineau",
    province: "QC", country: "CA", notes: "Gate code 4417", portalToken: "tok_portal", language: "fr",
    createdAt: new Date("2026-08-01"),
  };
  const client2 = {
    id: "c2", companyId: "co1", name: "Jean Roy", type: "residential", email: "jean@example.test",
    phone: "819-555-0199", address: "12 Rue Laval", city: "Gatineau", province: "QC", notes: null,
    portalToken: "tok_portal2", createdAt: new Date("2026-08-02"),
  };

  const scopeGroup = {
    id: "g1", quoteId: "q1", label: "Living room", sortOrder: 0, categoryId: "cat1", subtotal: 3000, takeoff: null,
    category: { id: "cat1", key: "interior_painting", label: "Interior painting" },
    lineItems: [
      { description: "Prime and paint walls", quantity: 3, unit: "room", rate: 1000, amount: 3000, meta: { baseUnitPrice: 900, colour: "Chantilly Lace" } },
    ],
  };
  const quote1 = {
    id: "q1", companyId: "co1", clientId: "c1", quoteNumber: "Q-0042", status: "accepted", title: "Interior repaint",
    subtotal: 8000, discount: 0, tax: 1000, total: 9000, acceptedSubtotal: 8000, acceptedTax: 1000, acceptedTotal: 9000,
    offlineDiscountPct: 3, taxResolution: { rate: 0.125, amount: 1000 }, shareToken: "share_q1", sentToEmail: "marie@example.test",
    language: "en", notes: "Two coats, 50% deposit", lineItems: null, autoEstimated: false, createdAt: new Date("2026-08-03"), updatedAt: new Date("2026-08-04"),
    aiReview: { quoteTotal: 9000, pricing: [{ note: "Below your usual $/room" }], margin: { pct: 31, targetPct: 35 }, actuals: { offers: [] }, checks: [] },
    estimateData: null,
    client: client1, scopeGroups: [scopeGroup], addOns: [{ id: "a1", quoteId: "q1", description: "Paint the ceiling", amount: 650, sortOrder: 0 }],
    invoices: [], company: { currency: "USD", outboundCallsEnabled: false }, assignedTo: null, appointments: [], jobs: [],
    costing: { crew: [] },
  };
  const visitMine = { id: "v1", jobId: "j1", assignedToId: "u_crew", scheduledAt: new Date("2026-10-06T13:00:00Z"), status: "scheduled", notes: "Bring the 24ft ladder", photos: [], checklistItems: null, assignedTo: { id: "u_crew", name: "crew person" }, locationStamps: [] };
  const job1 = {
    id: "j1", companyId: "co1", clientId: "c1", quoteId: "q1", title: "Tremblay interior", status: "scheduled",
    startDate: new Date("2026-10-06"), endDate: null, archivedAt: null, siteAddress: "755 Rue Saint-Louis, Gatineau",
    costReviewNote: "Came in $400 over on labour", costRevisionDecision: "raise_rate", costRevisionDecidedAt: new Date("2026-09-01"),
    workOrderHidden: [], clientPoNumber: null, recurring: false, createdAt: new Date("2026-08-05"), updatedAt: new Date("2026-08-05"),
    checklistItems: [{ label: "Mask the windows", required: true, phase: "before" }],
    client: client1, quote: quote1, company,
    visits: [visitMine], appointments: [], timeEntries: [{ hours: 6 }], tasks: [],
    paymentStages: [{ id: "ps1", jobId: "j1", companyId: "co1", seq: 1, label: "Deposit", trigger: "on_accept", percentage: 50, amountCents: 450000, status: "requested", invoiceId: "i1" }],
    changeOrders: [{
      id: "co1x", jobId: "j1", seq: 1, description: "Add the hallway", priceDelta: 450, status: "approved", createdAt: new Date("2026-09-10"),
      bodyHtml: "<p>Hallway walls, two coats</p>", originalLine: { description: "Prime and paint walls", amount: 3000, quantity: 3 },
      invoiceId: "i1", invoice: { id: "i1", invoiceNumber: "INV-0007", status: "sent" }, createdBy: { id: "u_mgr", name: "mgr person" },
      decidedBy: null, task: null, shareToken: "co_share", signature: null, photos: [], scheduleDeltaDays: 1,
    }],
    originalJob: null, callbackJobs: [], warrantyEquipment: null,
    materials: [],
  };
  const job2 = {
    id: "j2", companyId: "co1", clientId: "c2", quoteId: null, title: "Roy deck stain", status: "scheduled", archivedAt: null,
    costReviewNote: null, workOrderHidden: [], createdAt: new Date("2026-08-06"), updatedAt: new Date("2026-08-06"),
    client: client2, quote: null, company, visits: [], appointments: [], timeEntries: [], tasks: [], paymentStages: [], changeOrders: [],
    originalJob: null, callbackJobs: [], warrantyEquipment: null, checklistItems: null,
  };
  client1.jobs = [job1];
  client1.quotes = [quote1];
  client2.jobs = [job2];
  client2.quotes = [];
  quote1.jobs = [{ id: "j1", title: job1.title }];

  const invoice1 = {
    id: "i1", companyId: "co1", clientId: "c1", quoteId: "q1", invoiceNumber: "INV-0007", status: "sent", version: 1,
    subtotal: 8000, discount: 0, tax: 1000, total: 9000, amountPaid: 4500, amountDue: 4500, amountRefunded: 0,
    offlineDiscountAmount: 270, taxResolution: { rate: 0.125 }, sentToEmail: "marie@example.test",
    aiReview: { invoiceTotal: 9000, checks: [] }, lineItems: [{ description: "Prime and paint walls", quantity: 3, amount: 3000 }],
    createdAt: new Date("2026-09-01"), updatedAt: new Date("2026-09-02"), lastChasedAt: null, chaseCount: 0,
    client: client1, quote: quote1, payments: [], versions: [], parentInvoice: null, appointments: [],
  };
  invoice1.versions = [{ ...invoice1, id: "i1v2", version: 2, total: 9450, amountDue: 4950, client: undefined, quote: undefined, versions: undefined }];
  client1.invoices = [invoice1];
  client2.invoices = [];
  quote1.invoices = [{ id: "i1", invoiceNumber: "INV-0007", status: "sent" }];

  tables.company = [company];
  tables.user = users;
  tables.member = Object.values(MEMBERS);
  tables.client = [client1, client2];
  tables.quote = [quote1];
  tables.job = [job1, job2];
  tables.jobVisit = [{ ...visitMine, job: job1 }];
  tables.invoice = [invoice1];
  tables.payment = [{ id: "p1", invoiceId: "i1", companyId: "co1", amount: 4500, date: new Date("2026-09-03"), method: "card", status: "succeeded" }];
  tables.worker = [{ id: "w_crew", companyId: "co1", userId: "u_crew", name: "crew person", hourlyRate: 28 }];
  tables.task = [
    // The office's auto-created chase — unassigned, hanging off the invoice.
    { id: "t_chase", companyId: "co1", title: "Follow up payment on INV-0007", status: "open", priority: "high", assignedToId: null, createdById: "u_owner", invoiceId: "i1", quoteId: null, jobId: null, clientId: "c1", dueDate: null, createdAt: new Date(), assignedTo: null, client: client1, workArea: null, job: null, photos: [] },
    // A to-do on the job they are not on.
    { id: "t_other", companyId: "co1", title: "Pick up stain for the Roy deck", status: "open", priority: "normal", assignedToId: null, createdById: "u_owner", invoiceId: null, quoteId: null, jobId: "j2", clientId: "c2", dueDate: null, createdAt: new Date(), assignedTo: null, client: client2, workArea: null, job: job2, photos: [] },
    // A plan step on THEIR job — quote-linked, as the plan's steps are.
    { id: "t_step", companyId: "co1", title: "Cut in the living room", status: "open", priority: "normal", assignedToId: null, createdById: "u_mgr", invoiceId: null, quoteId: "q1", jobId: "j1", clientId: "c1", dueDate: null, createdAt: new Date(), assignedTo: null, client: client1, workArea: null, job: job1, photos: [] },
  ];
  tables.appointment = [{
    id: "ap1", companyId: "co1", clientId: "c1", assignedToId: null, scheduledAt: new Date("2026-10-07T14:00:00Z"), status: "scheduled",
    client: client1, assignedTo: null, quote: { id: "q1", quoteNumber: "Q-0042" }, job: null, invoice: { id: "i1", invoiceNumber: "INV-0007" },
    quoteId: "q1", invoiceId: "i1", jobId: null,
  }];
  // Every other model a route asks for, empty — "nothing recorded".
  for (const m of [
    "quoteImport", "followUpLog", "jobPaymentStage", "activityLog", "companyServiceCategory", "jobMaterial", "expense",
    "timeEntry", "jobPhoto", "changeOrder", "jobDailyLog", "assetUseLog", "companyChatRoom", "kitchenDesignConfig",
    "customFieldValue", "customField", "recordEdit", "materialPriceObservation", "smsDelivery", "safetyIncident",
    "booking", "shift", "leaveRequest", "calendarConnection", "googleCalendarBusy", "smsOptOut", "locationStamp",
  ]) tables[m] ||= [];
  tables.changeOrder = job1.changeOrders.map((c) => ({ ...c }));
  tables.payment ||= [];
}

async function call(mod, method, { as, url = "http://test.local/api", params = {}, body } = {}) {
  session.member = as ? { ...MEMBERS[as] } : null;
  const req = new Request(url, {
    method,
    ...(body !== undefined && { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
  });
  const res = await mod[method](req, { params: Promise.resolve(params) });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

/** Every key path in a payload, for "does a money/contact key appear anywhere". */
function keyPaths(value, path = "", out = []) {
  if (Array.isArray(value)) value.forEach((v, i) => keyPaths(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      out.push(`${path}.${k}`);
      keyPaths(v, `${path}.${k}`, out);
    }
  }
  return out;
}
const MONEY_KEY = /\.(total|subtotal|tax|discount|amount|amountCents|amountPaid|amountDue|amountRefunded|priceDelta|rate|unitPrice|price|acceptedTotal|acceptedSubtotal|acceptedTax|offlineDiscountPct|offlineDiscountAmount|baseUnitPrice|quoteTotal|invoiceTotal|percentage|cost|estUnitCost|actualCost|margin|markup|markupPercent|costAmount)$/;
const moneyIn = (payload) => keyPaths(payload).filter((p) => MONEY_KEY.test(p));
const CONTACT_KEY = /\.(email|phone|contactName|portalToken|sentToEmail)$/;
const contactIn = (payload) => keyPaths(payload).filter((p) => CONTACT_KEY.test(p));
const textHas = (payload, needle) => JSON.stringify(payload).includes(needle);

const JOB = await import("../app/api/jobs/[id]/route.js");
const JOBS = await import("../app/api/jobs/route.js");
const CHANGE_ORDERS = await import("../app/api/jobs/[id]/change-orders/route.js");
const WORK_ORDER = await import("../app/api/jobs/[id]/work-order/route.js");
const QUOTE = await import("../app/api/quotes/[id]/route.js");
const QUOTES = await import("../app/api/quotes/route.js");
const CLIENT = await import("../app/api/clients/[id]/route.js");
const CLIENTS = await import("../app/api/clients/route.js");
const INVOICE = await import("../app/api/invoices/[id]/route.js");
const TASKS = await import("../app/api/tasks/route.js");
const TASK = await import("../app/api/tasks/[id]/route.js");
const APPOINTMENT = await import("../app/api/appointments/[id]/route.js");
const SEARCH = await import("../app/api/search/route.js");
const VISIT = await import("../app/api/jobs/[id]/visits/[visitId]/route.js");
const VISITS = await import("../app/api/jobs/[id]/visits/route.js");
const CHECKLIST = await import("../app/api/jobs/[id]/checklist/route.js");
const ACTIVITY = await import("../app/api/activity/route.js");
const EXPENSES = await import("../app/api/expenses/route.js");
const TIME = await import("../app/api/time-entries/route.js");

const activityRows = () => writes.filter((w) => w.model === "activityLog" && w.action === "create").map((w) => w.args.data);

// ═══════════════════════════════════════════════════════════════════════════
section("1. The job page — GET /api/jobs/[id], per role");
for (const role of ROLES) {
  seed();
  const { status, json } = await call(JOB, "GET", { as: role, params: { id: "j1" } });
  const office = role !== "crew";
  ok(`${role}: opens the job (200)`, status === 200, `status ${status}`);
  ok(`${role}: sees the scope — visits, address, site notes`, json?.visits?.[0]?.notes === "Bring the 24ft ladder" && json?.client?.address === "755 Rue Saint-Louis");
  if (role === "crew") {
    ok("crew: NO money anywhere in the job payload", moneyIn(json).length === 0, moneyIn(json).join(", "));
    ok("crew: no payment schedule (the deposit)", json.paymentStages === undefined && json.pricingHidden === true);
    ok("crew: the change order's SCOPE survives, its price does not", json.changeOrders?.[0]?.description === "Add the hallway" && json.changeOrders[0].priceDelta === undefined);
    ok("crew: no invoice reference on the change order", json.changeOrders[0].invoice === undefined && json.changeOrders[0].invoiceId === undefined);
    ok("crew: no client email / phone / notes / portal token", contactIn(json).length === 0 && json.client.notes === undefined, contactIn(json).join(", "));
    ok("crew: no cost-review note (jobCosting)", json.costReviewNote === undefined && !textHas(json, "$400 over"));
  } else {
    ok(`${role}: sees the deposit schedule`, json?.paymentStages?.[0]?.amountCents === 450000);
    ok(`${role}: sees the change order's price`, json?.changeOrders?.[0]?.priceDelta === 450);
    ok(`${role}: sees the client's phone`, json?.client?.phone === "819-555-0100");
  }
  const seesCosting = ["owner", "admin", "manager"].includes(role);
  if (office) ok(`${role}: cost-review note ${seesCosting ? "shown" : "withheld"} (jobCosting ${seesCosting ? "on" : "off"})`, (json?.costReviewNote === "Came in $400 over on labour") === seesCosting);
}
seed();
{
  const { status } = await call(JOB, "GET", { as: "crew", params: { id: "j2" } });
  ok("crew: a job they are not booked on is Not found (404, not 403)", status === 404, `status ${status}`);
  const est = await call(JOB, "GET", { as: "estimator", params: { id: "j2" } });
  ok("estimator: sees every job (jobs board), j2 opens", est.status === 200);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The job list and change-order list");
for (const role of ROLES) {
  seed();
  const { json } = await call(JOBS, "GET", { as: role, url: "http://test.local/api/jobs" });
  const ids = (json || []).map((j) => j.id).sort().join(",");
  ok(`${role}: job list is ${role === "crew" ? "only their job" : "the whole board"}`, ids === (role === "crew" ? "j1" : "j1,j2"), ids);
  if (!["owner", "admin", "manager"].includes(role)) ok(`${role}: no cost-review note in the list`, !textHas(json, "$400 over"));
}
for (const role of ROLES) {
  seed();
  const { status, json } = await call(CHANGE_ORDERS, "GET", { as: role, params: { id: "j1" } });
  const prices = role !== "crew";
  ok(`${role}: change orders ${prices ? "with" : "WITHOUT"} prices`, status === 200 && (json?.[0]?.priceDelta === 450) === prices && json?.[0]?.description === "Add the hallway");
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The work order — what 'Share with team' gives the crew");
for (const role of ROLES) {
  seed();
  const { status, json } = await call(WORK_ORDER, "GET", { as: role, params: { id: "j1" } });
  ok(`${role}: work order opens`, status === 200, `status ${status}`);
  ok(`${role}: no money key anywhere in it`, json?.workOrder && findWorkOrderMoneyKey(json.workOrder) === null);
  ok(`${role}: the scope lines are there ("Prime and paint walls", 3 room)`, json?.workOrder?.areas?.[0]?.lines?.[0]?.label === "Prime and paint walls" && json.workOrder.areas[0].lines[0].quantity === 3);
  ok(`${role}: the site address is there`, /Saint-Louis/.test(json?.workOrder?.job?.siteAddress || ""));
  ok(`${role}: client phone ${role === "crew" ? "withheld" : "shown"}`, (json?.workOrder?.client?.phone === "819-555-0100") === (role !== "crew"));
}
seed();
ok("crew: the work order of a job they are not on is Not found", (await call(WORK_ORDER, "GET", { as: "crew", params: { id: "j2" } })).status === 404);

// ═══════════════════════════════════════════════════════════════════════════
section("4. Quotes — GET /api/quotes/[id] and the list");
for (const role of ROLES) {
  seed();
  const { status, json } = await call(QUOTE, "GET", { as: role, params: { id: "q1" } });
  if (role === "crew") {
    ok("crew: the quote is refused (403) before it is read", status === 403);
    ok("crew: the refusal carries no quote data", !textHas(json, "Q-0042") && moneyIn(json).length === 0);
    const list = await call(QUOTES, "GET", { as: role, url: "http://test.local/api/quotes" });
    ok("crew: the quotes list is refused (403)", list.status === 403);
    continue;
  }
  ok(`${role}: opens the quote with its prices`, status === 200 && Number(json?.total) === 9000 && json?.scopeGroups?.[0]?.lineItems?.[0]?.amount === 3000);
  const costing = ["owner", "admin", "manager"].includes(role);
  ok(`${role}: AI review margin ${costing ? "shown" : "withheld"} (jobCosting ${costing ? "on" : "off"})`, (json?.aiReview?.margin?.pct === 31) === costing && json?.aiReview?.quoteTotal === 9000);
}
seed();
{
  const { status, json } = await call(QUOTE, "GET", { as: "docsNoMoney", params: { id: "q1" } });
  ok("custom (quotes view, showPricing OFF): opens the quote", status === 200);
  ok("…with no money anywhere — totals, lines, add-ons, tax, AI review", moneyIn(json).length === 0, moneyIn(json).join(", "));
  ok("…the scope lines survive", json?.scopeGroups?.[0]?.lineItems?.[0]?.description === "Prime and paint walls");
  ok("…no share token (opens the priced public page)", json?.shareToken === undefined);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Clients — the book and one household");
for (const role of ROLES) {
  seed();
  const { json } = await call(CLIENTS, "GET", { as: role, url: "http://test.local/api/clients" });
  const ids = (json || []).map((c) => c.id).sort().join(",");
  ok(`${role}: client list is ${role === "crew" ? "only the household on their job" : "the whole book"}`, ids === (role === "crew" ? "c1" : "c1,c2"), ids);
  ok(`${role}: contact details ${role === "crew" ? "withheld" : "shown"}`, (contactIn(json).length === 0) === (role === "crew"));
}
seed();
{
  const { json } = await call(CLIENTS, "GET", { as: "crew", url: "http://test.local/api/clients?q=819-555-0100" });
  ok("crew: searching a phone number finds nobody (no contact-field oracle)", Array.isArray(json) && json.length === 0, JSON.stringify(json));
  const own = await call(CLIENT, "GET", { as: "crew", params: { id: "c1" } });
  ok("crew: their job's client opens — name and address", own.status === 200 && own.json?.name === "Marie Tremblay" && own.json?.address === "755 Rue Saint-Louis");
  ok("crew: …with no quotes or invoices list (dials at none), declared hidden", own.json?.quotes === undefined && own.json?.invoices === undefined && own.json?.documentsHidden?.includes("quotes"));
  ok("crew: …only their own job listed", (own.json?.jobs || []).map((j) => j.id).join(",") === "j1");
  ok("crew: …no contact details, no money", contactIn(own.json).length === 0 && moneyIn(own.json).length === 0, [...contactIn(own.json), ...moneyIn(own.json)].join(", "));
  ok("crew: a client they have no job for is Not found", (await call(CLIENT, "GET", { as: "crew", params: { id: "c2" } })).status === 404);
  const est = await call(CLIENT, "GET", { as: "estimator", params: { id: "c1" } });
  ok("estimator: the client opens with quotes (priced) and invoices", est.json?.quotes?.[0]?.total === 9000 && est.json?.invoices?.[0]?.invoiceNumber === "INV-0007");
  ok("estimator: …but no margin from the stored AI review", est.json?.quotes?.[0]?.aiReview?.margin === undefined);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Invoices — GET /api/invoices/[id]");
for (const role of ROLES) {
  seed();
  const { status, json } = await call(INVOICE, "GET", { as: role, params: { id: "i1" } });
  if (role === "crew") {
    ok("crew: the invoice is refused (403)", status === 403 && !textHas(json, "INV-0007"));
    continue;
  }
  ok(`${role}: opens the invoice with totals`, status === 200 && Number(json?.total) === 9000);
  ok(`${role}: nested quote has no margin unless jobCosting`, (json?.quote?.aiReview?.margin?.pct === 31) === ["owner", "admin", "manager"].includes(role));
}
seed();
{
  const { json } = await call(INVOICE, "GET", { as: "docsNoMoney", params: { id: "i1" } });
  ok("custom (invoices view, showPricing OFF): no money anywhere, amendments included", moneyIn(json).length === 0, moneyIn(json).join(", "));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. To-dos, calendar, search — the side doors");
seed();
{
  const crew = await call(TASKS, "GET", { as: "crew", url: "http://test.local/api/tasks" });
  const ids = (crew.json || []).map((t) => t.id).sort().join(",");
  ok("crew: to-do list holds the step on their job, not the invoice chase or another job's", ids === "t_step", ids);
  const chase = await call(TASK, "PATCH", { as: "crew", params: { id: "t_chase" }, body: { status: "done" } });
  ok("crew: cannot tick the office's invoice chase off as done (403)", chase.status === 403);
  ok("crew: …and nothing was written", !writes.some((w) => w.model === "task" && w.action === "update"));
  const mgr = await call(TASKS, "GET", { as: "manager", url: "http://test.local/api/tasks" });
  ok("manager: sees every to-do", (mgr.json || []).length === 3);
}
seed();
{
  const crew = await call(APPOINTMENT, "GET", { as: "crew", params: { id: "ap1" } });
  ok("crew: an unassigned appointment opens without its invoice / quote number", crew.status === 200 && crew.json?.invoice === undefined && crew.json?.quote === undefined && !textHas(crew.json, "INV-0007"));
  const est = await call(APPOINTMENT, "GET", { as: "estimator", params: { id: "ap1" } });
  ok("estimator: sees what the appointment is about", est.json?.invoice?.invoiceNumber === "INV-0007" && est.json?.quote?.quoteNumber === "Q-0042");
}
seed();
{
  const crew = await call(SEARCH, "GET", { as: "crew", url: "http://test.local/api/search?q=Ro" });
  ok("crew: search does not surface a job or client they are not on", !(crew.json?.results || []).some((r) => r.id === "j2" || r.id === "c2"), JSON.stringify(crew.json));
  const crew2 = await call(SEARCH, "GET", { as: "crew", url: "http://test.local/api/search?q=Marie" });
  ok("crew: a client result carries no email", (crew2.json?.results || []).every((r) => r.subtitle == null || !/@/.test(r.subtitle)));
  const est = await call(SEARCH, "GET", { as: "estimator", url: "http://test.local/api/search?q=Marie" });
  ok("estimator: client result shows the email", (est.json?.results || []).some((r) => r.type === "client" && r.subtitle === "marie@example.test"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. What the crew may DO — and that it is logged under their name");
seed();
{
  const r = await call(VISIT, "PATCH", { as: "crew", params: { id: "j1", visitId: "v1" }, body: { status: "completed", notes: "Walls done, touch-ups Tuesday" } });
  ok("crew: marks their own visit complete with a note (200)", r.status === 200, `status ${r.status} ${JSON.stringify(r.json)}`);
  const log = activityRows().find((a) => a.action === "visit.completed");
  ok("…logged under their name and role", log && log.actorUserId === "u_crew" && log.actorRole === "employee" && log.actorName === "crew person");
}
seed();
{
  const r = await call(VISIT, "PATCH", { as: "crew", params: { id: "j1", visitId: "v1" }, body: { scheduledAt: "2026-10-13T13:00:00Z" } });
  ok("crew: cannot move their visit to another day (403 — texts the client)", r.status === 403);
  const c = await call(VISIT, "PATCH", { as: "crew", params: { id: "j1", visitId: "v1" }, body: { status: "cancelled" } });
  ok("crew: cannot cancel it either (403)", c.status === 403);
  ok("…and no visit was written", !writes.some((w) => w.model === "jobVisit"));
  const b = await call(VISITS, "POST", { as: "crew", params: { id: "j1" }, body: { scheduledAt: "2026-10-14T13:00:00Z" } });
  ok("crew: cannot book a new visit (403 — Schedule: view and complete)", b.status === 403);
}
seed();
{
  const fill = await call(CHECKLIST, "PATCH", { as: "crew", params: { id: "j1" }, body: { checklistItems: [{ label: "Mask the windows", required: true, phase: "before", done: true }] } });
  ok("crew: fills in the job checklist (200)", fill.status === 200);
  ok("…logged under their name", activityRows().some((a) => a.action === "job.checklistUpdated" && a.actorUserId === "u_crew"));
  const strip = await call(CHECKLIST, "PATCH", { as: "crew", params: { id: "j1" }, body: { checklistItems: [] } });
  ok("crew: cannot delete the required item to get past it (403)", strip.status === 403);
  const unflag = await call(CHECKLIST, "PATCH", { as: "crew", params: { id: "j1" }, body: { checklistItems: [{ label: "Mask the windows", phase: "before", done: true }] } });
  ok("crew: cannot untick 'required' (403)", unflag.status === 403);
  const mgr = await call(CHECKLIST, "PATCH", { as: "manager", params: { id: "j1" }, body: { checklistItems: [] } });
  ok("manager: may redefine it", mgr.status === 200);
}
seed();
{
  for (const [label, mod, method, params, body] of [
    ["edit the job (title, status, dates)", JOB, "PATCH", { id: "j1" }, { title: "Renamed" }],
    ["log a change order (a price)", CHANGE_ORDERS, "POST", { id: "j1" }, { description: "x", priceDelta: 100 }],
    ["edit the quote", QUOTE, "PATCH", { id: "q1" }, { notes: "cheaper" }],
    ["edit the client", CLIENT, "PATCH", { id: "c1" }, { phone: "000" }],
  ]) {
    const r = await call(mod, method, { as: "crew", params, body });
    ok(`crew: cannot ${label} (403)`, r.status === 403, `status ${r.status}`);
  }
  ok("…and none of those wrote anything", !writes.some((w) => ["job", "changeOrder", "quote", "client"].includes(w.model)));
}
seed();
{
  const e1 = await call(EXPENSES, "POST", { as: "crew", body: { category: "materials", amount: 40, projectId: "j2" } });
  ok("crew: cannot file a receipt against a job they are not on (404)", e1.status === 404);
  const e2 = await call(EXPENSES, "POST", { as: "crew", body: { category: "rent", amount: 2000, isOverhead: true, recurring: true } });
  ok("crew: cannot add a recurring fixed cost (403 — feeds the price floor)", e2.status === 403);
  const e3 = await call(EXPENSES, "POST", { as: "crew", body: { category: "materials", amount: 40, projectId: "j1" } });
  ok("crew: files their own receipt on their job (201/200)", e3.status === 200 || e3.status === 201, `status ${e3.status} ${JSON.stringify(e3.json)}`);
  ok("…logged under their name", activityRows().some((a) => a.action === "expense.created" && a.actorUserId === "u_crew"));
  const t1 = await call(TIME, "POST", { as: "crew", body: { workerId: "w_crew", jobId: "j2" } });
  ok("crew: cannot clock hours onto a job they are not on (404)", t1.status === 404, `status ${t1.status}`);
}
seed();
{
  const r = await call(ACTIVITY, "GET", { as: "crew", url: "http://test.local/api/activity" });
  ok("crew: cannot read the activity log (owner/admin only)", r.status === 403);
  const m = await call(ACTIVITY, "GET", { as: "manager", url: "http://test.local/api/activity" });
  ok("manager: cannot either — the log is owner/admin (documented, not a leak)", m.status === 403);
  const o = await call(ACTIVITY, "GET", { as: "owner", url: "http://test.local/api/activity" });
  ok("owner: reads it", o.status === 200);
}

console.log(`\n${pass + failures.length} checks, ${failures.length} failure(s).\n`);
if (failures.length) process.exitCode = 1;
