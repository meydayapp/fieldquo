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
    "jobDocument", "jobPhotoTag", "jobPhotoTagLink",
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
// What the crew need to DO the job — the live test's work order said only
// "0 h across 1 areas · Cabinet Refinishing · 0 h". Each fact below comes
// from a row that ALSO carries money (the add-on's amount, the material's
// cost, the quote costing's dollars), and none of the money may follow it.
seed();
{
  const job1 = tables.job.find((j) => j.id === "j1");
  const quote1 = tables.quote.find((q) => q.id === "q1");
  quote1.addOns = [
    { id: "a1", quoteId: "q1", description: "Paint the ceiling", amount: 650, sortOrder: 0, selected: false },
    { id: "a2", quoteId: "q1", description: "Two-Tone Finish", detail: "Uppers white, lowers navy", amount: 900, sortOrder: 1, selected: true, areaLabel: "Kitchen" },
  ];
  quote1.costing = { quoteId: "q1", labourHours: 18, labourCost: 1260, totalCost: 2400, materialTotal: 400 };
  quote1.scopeGroups.push({
    id: "g2", quoteId: "q1", label: "Cabinet Refinishing", sortOrder: 1, categoryId: "cat2", subtotal: 4800, takeoff: null,
    intakeValues: { doorCount: 32, drawerCount: 12, topCoats: 2, twoTone: true },
    category: { id: "cat2", key: "cabinet_refinishing", label: "Cabinet Refinishing" },
    lineItems: [{ description: "Cabinet Refinishing", quantity: 44, unit: "unit", rate: 109, amount: 4800, meta: { baseUnitPrice: 100, color: "Hale Navy", sheen: "satin", doorStyle: "Shaker" } }],
  });
  job1.materials = [
    { id: "m1", jobId: "j1", name: "Cabinet enamel", qty: 3, unit: "gal", group: "Paint", estUnitCost: 89, actualCost: 260, excludedAt: null, purchasedAt: null, sortOrder: 0, createdAt: new Date() },
    { id: "m2", jobId: "j1", name: "Dropped item", qty: 1, unit: "ea", estUnitCost: 5, excludedAt: new Date(), purchasedAt: null, sortOrder: 1, createdAt: new Date() },
  ];
  job1.checklistItems = [{ label: "Mask the windows", required: true, phase: "before", done: false }];
  const { status, json } = await call(WORK_ORDER, "GET", { as: "crew", params: { id: "j1" } });
  const wo = json?.workOrder;
  ok("crew work order: opens with the cabinet group (200)", status === 200 && wo?.areas?.some((a) => a.label === "Cabinet Refinishing"), `status ${status}`);
  const cab = wo?.areas?.find((a) => a.label === "Cabinet Refinishing");
  ok("…how many: 32 doors and 12 drawers", cab?.counts?.doors === 32 && cab?.counts?.drawers === 12, JSON.stringify(cab?.counts));
  ok("…the finish: colour, sheen, door style, coats, two-tone", cab?.finish?.colour === "Hale Navy" && cab.finish.sheen === "satin" && cab.finish.doorStyle === "Shaker" && cab.finish.topCoats === 2 && cab.finish.twoTone === true, JSON.stringify(cab?.finish));
  ok("…the scope says how many, not only what", /Cabinet Refinishing × 44/.test(cab?.scope || ""), cab?.scope);
  ok("…what's included, as the client's quote printed it", Array.isArray(cab?.included) && cab.included.length > 0, JSON.stringify(cab?.included));
  ok("…the option the client CHOSE, and not the one they didn't", wo?.addOns?.map((a) => a.description).join("|") === "Two-Tone Finish" && wo.addOns[0].detail === "Uppers white, lowers navy");
  ok("…the materials still on the list, with quantity and unit", wo?.materials?.length === 1 && wo.materials[0].name === "Cabinet enamel" && wo.materials[0].qty === 3 && wo.materials[0].unit === "gal");
  ok("…the checklist and the visit note", wo?.checklist?.[0]?.label === "Mask the windows" && wo.checklist[0].required === true && wo?.visits?.[0]?.notes === "Bring the 24ft ladder");
  ok("…hours: the cabinet group has its own (no takeoff, counted from the doors and drawers)", Number(cab?.hours) > 0, String(cab?.hours));
  ok("…and the total is the areas', not the quote's estimate added on top", wo?.hoursFromQuote === false && Math.abs(Number(wo?.totalHours) - wo.areas.reduce((s, a) => s + a.hours, 0)) < 0.2, String(wo?.totalHours));
  ok("…and STILL no money key anywhere — add-on amount, material cost, costing dollars", findWorkOrderMoneyKey(wo) === null && moneyIn(json).length === 0, `${findWorkOrderMoneyKey(wo)} ${moneyIn(json).join(", ")}`);
  ok("…and no price figure leaked as text (900, 4800, 89, 260, 1260)", !/\b(900|4800|4,800|1260|2400)\b/.test(JSON.stringify(wo)) && !/"(89|260)"/.test(JSON.stringify(wo)));
}

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

// ═══════════════════════════════════════════════════════════════════════════
section("9. A published SHIFT on a job puts the crew member on it — a draft does not");
//
// The live test, 2026-10-04: the scheduler's "Job (optional)" sent Joe to a
// job on My schedule, and the job page told him it did not exist. A
// published shift on a job now grants the same access a visit does, from
// publication until SHIFT_ACCESS_DAYS_AFTER days after it ends
// (lib/permissions/enforce.js shiftAssignmentWhere). j2 is the job the crew
// member has NO visit on; each case below puts a different shift on it.
const DAY = 86400000;
function seedShift(over = {}) {
  seed();
  const job2 = tables.job.find((j) => j.id === "j2");
  const shift = {
    id: "s1", companyId: "co1", workerId: "w_crew", jobId: "j2", published: true,
    start: new Date(Date.now() + 2 * DAY), end: new Date(Date.now() + 2 * DAY + 8 * 3600000),
    worker: tables.worker[0], ...over,
  };
  job2.shifts = [shift];
  tables.shift = [{ ...shift, job: job2 }];
  return shift;
}
seedShift();
{
  const page = await call(JOB, "GET", { as: "crew", params: { id: "j2" } });
  ok("crew: a published shift on j2 opens the job page (200)", page.status === 200, `status ${page.status}`);
  ok("…with no money and no contact details, exactly as via a visit", moneyIn(page.json).length === 0 && contactIn(page.json).length === 0, [...moneyIn(page.json), ...contactIn(page.json)].join(", "));
  const wo = await call(WORK_ORDER, "GET", { as: "crew", params: { id: "j2" } });
  ok("crew: …and its work order (200), with no money key", wo.status === 200 && wo.json?.workOrder && findWorkOrderMoneyKey(wo.json.workOrder) === null, `status ${wo.status}`);
  const list = await call(JOBS, "GET", { as: "crew", url: "http://test.local/api/jobs" });
  ok("crew: the job list now holds both jobs", (list.json || []).map((j) => j.id).sort().join(",") === "j1,j2");
  const cl = await call(CLIENT, "GET", { as: "crew", params: { id: "c2" } });
  ok("crew: the shift job's household opens — name and address, no contact", cl.status === 200 && cl.json?.name === "Jean Roy" && contactIn(cl.json).length === 0);
  const t = await call(TIME, "POST", { as: "crew", body: { workerId: "w_crew", jobId: "j2" } });
  ok("crew: hours may be booked to it (not 404)", t.status !== 404, `status ${t.status}`);
  const e = await call(EXPENSES, "POST", { as: "crew", body: { category: "materials", amount: 40, projectId: "j2" } });
  ok("crew: a receipt may be filed on it", e.status === 200 || e.status === 201, `status ${e.status}`);
  const quote = await call(QUOTE, "GET", { as: "crew", params: { id: "q1" } });
  ok("crew: the shift opens the job, never the quote (still 403)", quote.status === 403);
}
for (const [label, over] of [
  ["an UNPUBLISHED draft shift", { published: false }],
  ["somebody else's shift", { workerId: "w_other", worker: { id: "w_other", companyId: "co1", userId: "u_other", name: "other" } }],
  ["an open shift (nobody on it)", { workerId: null, worker: null }],
  ["a shift that ended 15 days ago", { start: new Date(Date.now() - 15 * DAY - 8 * 3600000), end: new Date(Date.now() - 15 * DAY) }],
]) {
  seedShift(over);
  const page = await call(JOB, "GET", { as: "crew", params: { id: "j2" } });
  ok(`crew: ${label} grants nothing — job is Not found (404)`, page.status === 404, `status ${page.status}`);
  const wo = await call(WORK_ORDER, "GET", { as: "crew", params: { id: "j2" } });
  ok(`crew: ${label} — work order Not found too`, wo.status === 404, `status ${wo.status}`);
  const t = await call(TIME, "POST", { as: "crew", body: { workerId: "w_crew", jobId: "j2" } });
  ok(`crew: ${label} — no hours on it (404)`, t.status === 404, `status ${t.status}`);
}
seedShift({ start: new Date(Date.now() - 13 * DAY - 8 * 3600000), end: new Date(Date.now() - 13 * DAY) });
ok("crew: a shift that ended 13 days ago still opens the job (late receipts, corrections)", (await call(JOB, "GET", { as: "crew", params: { id: "j2" } })).status === 200);
seedShift({ start: new Date(Date.now() + 30 * DAY), end: new Date(Date.now() + 30 * DAY + 8 * 3600000) });
ok("crew: a shift published for a month out opens the job now (My schedule links it)", (await call(JOB, "GET", { as: "crew", params: { id: "j2" } })).status === 200);

// ═══════════════════════════════════════════════════════════════════════════
section("10. Crew on the job page: photos yes, the website and the office's cards no");
//
// The live test (2026-10-04): the crew's job page said "Tap the star to show
// a photo on your website", linked "Manage tags", captioned the upload box
// with the homeowner's "helps us quote accurately", and drew the client
// preparation guide card. Each refusal below is the SERVER's; the static
// half proves the screen no longer offers what the server refuses.
const PHOTOS = await import("../app/api/jobs/[id]/photos/route.js");
const PHOTO_TAGS = await import("../app/api/settings/job-photo-tags/route.js");
const PREP_GUIDE = await import("../app/api/jobs/[id]/prep-guide/route.js");
seed();
{
  tables.jobPhoto = [{ id: "ph1", companyId: "co1", jobId: "j1", url: "https://x/1.jpg", stage: "finish", featured: false, createdAt: new Date(), tags: [] }];
  const add = await call(PHOTOS, "POST", { as: "crew", params: { id: "j1" }, body: { photos: [{ url: "https://res.cloudinary.com/x/2.jpg" }] } });
  ok("crew: CAN add a photo to their job (200)", add.status === 200, `status ${add.status} ${JSON.stringify(add.json)}`);
  const star = await call(PHOTOS, "PATCH", { as: "crew", params: { id: "j1" }, body: { photoId: "ph1", featured: true } });
  ok("crew: cannot put a photo on the company website (403)", star.status === 403, `status ${star.status}`);
  const tag = await call(PHOTO_TAGS, "POST", { as: "crew", body: { name: "Sanding", color: "#123456" } });
  ok("crew: cannot create a photo tag (403)", tag.status === 403, `status ${tag.status}`);
  ok("…and nothing was featured or tagged", !writes.some((w) => (w.model === "jobPhoto" && w.action === "update") || w.model === "jobPhotoTag"));
  const prep = await call(PREP_GUIDE, "GET", { as: "crew", params: { id: "j1" } });
  ok("crew: the client preparation guide's status is refused (403) — office information", prep.status === 403, `status ${prep.status}`);
  const prepMgr = await call(PREP_GUIDE, "GET", { as: "manager", params: { id: "j1" } });
  ok("manager: reads it (not refused)", prepMgr.status !== 403, `status ${prepMgr.status}`);
}
{
  const { readFileSync } = await import("node:fs");
  const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const curator = src("app/components/jobs/JobPhotoCurator.js");
  ok("screen: the website star tip and count are drawn only for curators", /canCurate \? \(\s*<p[^>]*>\s*\{t\("app\.jobPhotos\.starTip"/.test(curator) && /\{canCurate && \(\s*<span[^>]*>\s*\{t\("app\.jobPhotos\.onWebsite"/.test(curator));
  ok("screen: 'Manage tags' only for whoever may manage them", /\{canManageTags && \(/.test(curator) && curator.indexOf("canManageTags && (") < curator.indexOf("/app/settings/job-photo-tags\" className"));
  ok("screen: the job upload box has the job's words, not the homeowner's", /hint=\{t\("app\.jobPhotos\.uploadHint"/.test(curator));
  ok("screen: no hardcoded 'Tap the star' left in the markup", !/>\s*Tap the star/.test(curator));
  const detail = src("app/app/jobs/[id]/JobDetail.js");
  ok("screen: the preparation guide card is not drawn for crew", /\{!seesOnlyAssignedJobs\(caller\) && <PrepGuideCard /.test(detail));
  ok("screen: the safety report's photo box has its own words too", /hint=\{t\("app\.safety\.photos\.hint"/.test(src("app/app/safety/page.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("11. Time off with no leave policies — crew can still ask for unpaid days");
//
// The live test (2026-10-04): with no policies set up, crew read "No leave
// policies have been set up yet" and could not ask for anything.
// lib/leave/unpaidFallback.js: unpaid only, approval required, created on the
// first ask; the owner's "set up policies" note stays.
const LEAVE = await import("../app/api/leave/route.js");
function seedLeave(policies = []) {
  seed();
  tables.leavePolicy = policies;
  for (const m of ["leaveBalance", "leaveRequest", "leaveOpeningBalance", "leaveAccrualOverride", "workingHours", "leaveBlackout", "notification", "notificationDelivery", "pushSubscription", "orgReport"]) tables[m] ||= [];
  tables.workingHours = [1, 2, 3, 4, 5].map((d) => ({ userId: "u_crew", dayOfWeek: d }));
  tables.company[0].defaultLanguage = "fr";
}
seedLeave();
{
  const g = await call(LEAVE, "GET", { as: "crew", url: "http://test.local/api/leave" });
  ok("crew GET: no policies → the unpaid fallback is offered, named in the company's language", g.status === 200 && g.json?.policies?.length === 0 && g.json?.unpaidFallback?.name === "Congé sans solde", JSON.stringify(g.json?.unpaidFallback) + ` status ${g.status} ${g.json?.error || ""}`);
  ok("…and GET wrote nothing (looking creates no policy)", !writes.some((w) => w.model === "leavePolicy"));
  const p = await call(LEAVE, "POST", { as: "crew", body: { unpaid: true, startDate: "2026-11-16", endDate: "2026-11-17", reason: "Moving house" } });
  ok("crew POST unpaid: accepted", p.status === 200 || p.status === 201, `status ${p.status} ${JSON.stringify(p.json)}`);
  const made = writes.find((w) => w.model === "leavePolicy" && (w.action === "upsert" || w.action === "create"));
  const policyData = made?.args?.create || made?.args?.data;
  ok("…the fallback policy is unpaid, needs approval, flagged systemUnpaid", policyData?.paid === false && policyData?.requiresApproval === true && policyData?.systemUnpaid === true && policyData?.kind === "unpaid");
  const req = writes.find((w) => w.model === "leaveRequest" && w.action === "create")?.args?.data;
  ok("…the request is PENDING (routed to approvers), with the dates and the reason", req?.status === "pending" && req?.reason === "Moving house" && String(req?.days) === "2", JSON.stringify(req));
  ok("…and no balance was consumed", !writes.some((w) => w.model === "leaveBalance"));
}
seedLeave([{ id: "lp1", companyId: "co1", name: "Vacation", kind: "vacation", paid: true, accrualMethod: "annual_allotment", annualDays: 10, requiresApproval: true, active: true, systemUnpaid: false }]);
{
  const g = await call(LEAVE, "GET", { as: "crew", url: "http://test.local/api/leave" });
  ok("with a policy set up: no fallback offered", g.json?.unpaidFallback === null && g.json?.policies?.length === 1);
  const p = await call(LEAVE, "POST", { as: "crew", body: { unpaid: true, startDate: "2026-11-16", endDate: "2026-11-16" } });
  ok("…and 'unpaid' without a policy is refused (400) — the company's own types apply", p.status === 400, `status ${p.status}`);
}
seedLeave([{ id: "lpx", companyId: "co1", name: "Unpaid time off", kind: "unpaid", paid: false, requiresApproval: true, active: true, systemUnpaid: true }]);
{
  const g = await call(LEAVE, "GET", { as: "crew", url: "http://test.local/api/leave" });
  ok("the fallback row, once made, is NOT a 'policy the company set up' — note and fallback stay", g.json?.policies?.length === 0 && Boolean(g.json?.unpaidFallback));
}
{
  const { readFileSync } = await import("node:fs");
  const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  ok("the settings list leaves the fallback out (starter templates still offered)", /where: \{ companyId: member\.companyId, systemUnpaid: false \}/.test(src("app/api/settings/leave-policies/route.js")));
  ok("accrual refresh leaves it out (no balance card for it)", /systemUnpaid: false/.test(src("lib/leave/balances.js")));
  const page = src("app/app/time-off/page.js");
  ok("the page keeps the owner's note AND offers the request", /data-unpaid-fallback/.test(page) && /app\.timeOff\.noPolicies/.test(page) && /unpaidFallback=\{unpaidFallback\}/.test(page));
  ok("the form posts unpaid:true in place of a policy", /unpaid: true/.test(src("app/app/time-off/RequestForm.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("Team chat channels and groups (2026-10-04) — the shipped routes, per role");
// ═══════════════════════════════════════════════════════════════════════════
//
// The owner: "only the office creates, renames and archives channels; anyone
// can start a group chat". Executed through app/api/chat/** as each preset,
// so the 403 is the route's, not a hidden button's. The full matrix (rename,
// add, remove, leave, mute, private isolation, a 56-person group) is
// executed against the store in scripts/check-company-chat.mjs §15–25.
const CHAT_ROOMS = await import("../app/api/chat/rooms/route.js");
const CHAT_ROOM = await import("../app/api/chat/rooms/[id]/route.js");
const CHAT_ARCHIVE = await import("../app/api/chat/rooms/[id]/archive/route.js");
const CHAT_JOIN = await import("../app/api/chat/rooms/[id]/join/route.js");
function seedChat() {
  seed();
  // The chat resolves every picked id against the ACTIVE roster.
  tables.member = tables.member.map((m) => ({ ...m, active: true }));
  const memberRow = (m, extra = {}) => ({
    id: `cm_${m.id}`, companyId: "co1", memberId: m.id, open: true, role: "member", notify: "default",
    mutedUntil: null, lastOpenedAt: null, lastSeenAt: null, hiddenAt: null, starredAt: null,
    member: { id: m.id, userId: m.userId, role: m.role, active: true, user: { name: `${m.id.slice(2)} person`, email: `${m.id}@example.test` } },
    ...extra,
  });
  // #announcements: office-only posting; the manager made it; crew are in it.
  const annMembers = [memberRow(MEMBERS.manager, { roomId: "ch_ann", role: "manager" }), memberRow(MEMBERS.crew, { roomId: "ch_ann" })];
  // #office: PRIVATE, the manager only.
  const offMembers = [memberRow(MEMBERS.manager, { roomId: "ch_off", role: "manager" })];
  const room = (id, extra, members) => ({
    id, companyId: "co1", kind: "channel", key: `channel:${id}`, name: id.slice(3), jobId: null, topic: null,
    private: false, postingPolicy: "everyone", autoJoin: false, archivedAt: null, createdByMemberId: "m_mgr",
    lastMessageAt: null, members, messages: [], job: null, ...extra,
  });
  tables.companyChatRoom = [
    room("ch_ann", { postingPolicy: "office" }, annMembers),
    room("ch_off", { private: true }, offMembers),
  ];
  tables.companyChatMember = [...annMembers, ...offMembers];
  tables.companyChatMessage = [];
  tables.activityLog = [];
}
const chatWrites = (model, action = "create") => writes.filter((w) => w.model === model && w.action === action);

for (const role of ROLES) {
  seedChat();
  const r = await call(CHAT_ROOMS, "POST", { as: role, body: { kind: "channel", name: `Estimating ${role}` } });
  const office = ["owner", "admin", "manager", "dispatcher"].includes(role);
  if (office) {
    ok(`${role}: creates a channel (200)`, r.status === 200 && Boolean(r.json?.roomId), `status ${r.status} ${JSON.stringify(r.json)}`);
    ok(`${role}: …logged in the activity log`, activityRows().some((a) => a.action === "chat.channel_created"));
  } else {
    ok(`${role}: is refused a channel (403 not_allowed)`, r.status === 403 && r.json?.code === "not_allowed", `status ${r.status}`);
    ok(`${role}: …and nothing was written`, chatWrites("companyChatRoom").length === 0 && chatWrites("companyChatMember", "createMany").length === 0);
  }
}
seedChat();
{
  const g = await call(CHAT_ROOMS, "POST", { as: "crew", body: { kind: "group", members: ["m_est", "m_disp"] } });
  ok("crew: starts a group chat (200, kind group)", g.status === 200 && g.json?.kind === "group", `status ${g.status} ${JSON.stringify(g.json)}`);
  ok("crew: …the room written is a group, the crew member its manager", chatWrites("companyChatRoom").some((w) => w.args.data.kind === "group") && chatWrites("companyChatMember", "createMany").some((w) => w.args.data.some((d) => d.memberId === "m_crew" && d.role === "manager")));
}
seedChat();
{
  const post = await call(CHAT_ROOM, "POST", { as: "crew", params: { id: "ch_ann" }, body: { body: "can I post?" } });
  ok("crew: cannot post in an office-only channel (403 office_only)", post.status === 403 && post.json?.code === "office_only", `status ${post.status}`);
  ok("crew: …nothing was written", chatWrites("companyChatMessage").length === 0);
  const read = await call(CHAT_ROOM, "GET", { as: "crew", params: { id: "ch_ann" } });
  ok("crew: still READS it (200), and is told it may not post", read.status === 200 && read.json?.can?.post === false && read.json?.can?.postRefusal === "office_only", `status ${read.status}`);
  const rename = await call(CHAT_ROOM, "PATCH", { as: "crew", params: { id: "ch_ann" }, body: { name: "mine" } });
  ok("crew: cannot rename a channel (403 not_allowed)", rename.status === 403 && rename.json?.code === "not_allowed", `status ${rename.status}`);
  const archive = await call(CHAT_ARCHIVE, "POST", { as: "crew", params: { id: "ch_ann" } });
  ok("crew: cannot archive a channel (403 not_allowed)", archive.status === 403 && archive.json?.code === "not_allowed", `status ${archive.status}`);
  ok("crew: …none of it wrote to the room", chatWrites("companyChatRoom", "update").length === 0);
}
seedChat();
{
  const archive = await call(CHAT_ARCHIVE, "POST", { as: "manager", params: { id: "ch_ann" } });
  ok("manager: archives the channel they manage (200), kept — an update, never a delete", archive.status === 200 && chatWrites("companyChatRoom", "update").some((w) => w.args.data.archivedAt instanceof Date) && !writes.some((w) => w.model.startsWith("companyChat") && /delete/i.test(w.action)), `status ${archive.status}`);
}
seedChat();
{
  for (const role of ["crew", "estimator", "owner"]) {
    const r = await call(CHAT_ROOM, "GET", { as: role, params: { id: "ch_off" } });
    ok(`${role}: a private channel they are not in is 404 — the owner included`, r.status === 404 && r.json?.code === "no_room", `status ${r.status}`);
    const j = await call(CHAT_JOIN, "POST", { as: role, params: { id: "ch_off" } });
    ok(`${role}: …and cannot join it (404)`, j.status === 404, `status ${j.status}`);
  }
  const list = await call(CHAT_ROOMS, "GET", { as: "crew" });
  ok("crew: the room list and Browse never name the private channel", list.status === 200 && !textHas(list.json, "ch_off"), `status ${list.status}`);
}

console.log(`\n${pass + failures.length} checks, ${failures.length} failure(s).\n`);
if (failures.length) process.exitCode = 1;
