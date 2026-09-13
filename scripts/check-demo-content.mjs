// scripts/check-demo-content.mjs
//
//   npm run check:demo-content
//
// "The demo companies should look like real businesses on every screen."
// (owner, 2026-09-12)
//
// ══ What this file EXECUTES ═══════════════════════════════════════════════
//
// lib/demo/seedContent.js is run, for every trade, against an in-memory
// Prisma (scripts/fixtures/memoryPrisma.mjs, served as `@/lib/db` by
// memory-db-loader.mjs so the product writers the seed calls — the Stripe
// payment recorder, the chat store, the task resolver — land in the same
// store). Every claim below is a query with an asserted answer:
//
//   §1  the profile table is complete and consistent per trade
//   §2  coverage — every screen's table is non-empty, and the specific
//       states the owner listed exist (a signed quote, a refund, a dispute,
//       a pay run paid, a booking with a fee, leave next week, …)
//   §3  idempotent — a second run creates nothing and moves no count
//   §4  tenancy — every row is the demo company's
//   §5  fictional contact details only — 555-01xx phones, example.com mail
//   §6  names come from the pools and nowhere else
//   §7  the refusal, and the wiring: the pool script, a rep's demo, the
//       console reset and the owner's script all reach the same function
//   §8  determinism — two fresh seeds are the same business
//   §9  the cabinets demo is the help-centre harness's shop, people and client
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { db } from "@/lib/db";
import { seedDemoCompany, CLIENT_COUNT } from "@/lib/demo/seedContent";
import { INDUSTRIES, INDUSTRY_KEYS } from "@/lib/demo/industries";
import { PROFILES, PROFILE_KEYS } from "@/lib/demo/profiles";
import { STAFF, FICTIONAL_PHONE, EXAMPLE_EMAIL, allSeedNames, rng, person, business } from "@/lib/demo/people";
import { PEOPLE as HARNESS_PEOPLE, CLIENT as HARNESS_CLIENT, COMPANY as HARNESS_COMPANY } from "../docs/screens/app-guide/harness/fixtures/company.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`);
  }
}
const section = (t) => console.log(`\n${t}\n`);

const NOW = new Date("2026-09-14T17:00:00Z"); // Monday 14 Sept 2026, 1 pm Montreal
const DAY = 86_400_000;
const rows = (t) => db.__tables[t] || [];
const of = (t, companyId) => rows(t).filter((r) => r.companyId === companyId);
/** Tables without a companyId column: is this row a child of the company's? */
function ownedBy(t, r, companyId) {
  const parent = (pt, id) => rows(pt).find((x) => x.id === id);
  const viaUser = (id) => of("member", companyId).some((m) => m.userId === id);
  switch (t) {
    case "user": return viaUser(r.id);
    case "availabilitySchedule": return viaUser(r.userId);
    case "leaveBalance": return parent("leavePolicy", r.policyId)?.companyId === companyId;
    case "leadNote": return parent("leadRequest", r.leadId)?.companyId === companyId;
    case "quoteAddOn": case "quoteCosting": return parent("quote", r.quoteId)?.companyId === companyId;
    case "jobVisit": case "jobMaterial": case "changeOrder": return parent("job", r.jobId)?.companyId === companyId;
    case "timeEntry": return parent("worker", r.workerId)?.companyId === companyId;
    case "payment": case "invoiceCosting": return parent("invoice", r.invoiceId)?.companyId === companyId;
    case "servicePlanAuthorisation": case "servicePlanOccurrence": return parent("servicePlan", r.planId)?.companyId === companyId;
    case "booking": return parent("eventType", r.eventTypeId)?.companyId === companyId;
    case "payRunLine": return parent("payRun", r.payRunId)?.companyId === companyId;
    case "purchaseOrderLine": return parent("purchaseOrder", r.purchaseOrderId)?.companyId === companyId;
    case "vehicleMaintenance": return parent("vehicleDetail", r.vehicleId)?.companyId === companyId;
    case "pamphletStop": return parent("marketingCampaign", r.campaignId)?.companyId === companyId;
    case "clientEquipmentService": return parent("clientEquipment", r.equipmentId)?.companyId === companyId;
    default: return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("1. The profile table");
// ═══════════════════════════════════════════════════════════════════════════

ok("every trade preset has a profile", INDUSTRY_KEYS.every((k) => PROFILES[k]), INDUSTRY_KEYS.filter((k) => !PROFILES[k]));
ok("...and no profile names a trade that does not exist", PROFILE_KEYS.every((k) => INDUSTRIES[k]));
const shape = Object.keys(PROFILES.painting).sort().join(",");
ok("every profile has the same keys", PROFILE_KEYS.every((k) => Object.keys(PROFILES[k]).sort().join(",") === shape));
for (const k of PROFILE_KEYS) {
  const p = PROFILES[k];
  const problems = [];
  if (!/^\d{3}$/.test(p.phoneArea)) problems.push("phoneArea");
  if (!["CAD", "USD"].includes(p.currency)) problems.push("currency");
  if ((p.currency === "USD") !== (p.country === "US")) problems.push("currency/country");
  if (!p.taxRates.some((t) => t.isDefault)) problems.push("default tax");
  if (p.streets.length < 10) problems.push("streets");
  if (p.qty.length !== INDUSTRIES[k].services.length) problems.push("qty per service");
  if (p.materials.length < 5) problems.push("materials");
  if (!p.checklist?.length) problems.push("checklist");
  if (!p.languages?.length) problems.push("languages");
  ok(`${k.padEnd(12)} is complete`, problems.length === 0, problems);
}
ok("two US-state demos in USD", PROFILE_KEYS.filter((k) => PROFILES[k].currency === "USD").length === 2);
ok("Quebec demos are mostly francophone", ["cabinets", "flooring", "electrical"].every((k) => PROFILES[k].languages[0] === "fr"));

// ═══════════════════════════════════════════════════════════════════════════
section("2. Coverage — seed every trade, read every screen");
// ═══════════════════════════════════════════════════════════════════════════

const seeded = {};
for (const [i, key] of INDUSTRY_KEYS.entries()) {
  const company = await db.company.create({
    data: { name: INDUSTRIES[key].company, slug: `demo${i + 1}`, isDemo: true, demoIndustry: key },
  });
  const result = await seedDemoCompany(company.id, { now: NOW });
  seeded[key] = { company, result };
}

const MUST_HAVE = [
  "taxRate", "paymentScheduleStage", "forecastSettings", "product", "material", "expense",
  "user", "member", "worker", "workingHours", "availabilitySchedule", "leavePolicy", "leaveBalance", "leaveRequest",
  "client", "marketingSubscriber", "smsOptOut",
  "leadRequest", "leadNote",
  "quote", "quoteAddOn", "quoteCosting", "job", "jobVisit", "jobPhoto", "timeEntry", "jobMaterial", "changeOrder", "jobDailyLog", "jobPaymentStage",
  "invoice", "payment", "invoiceCosting", "satisfactionResponse", "safetyIncident",
  "servicePlan", "servicePlanAuthorisation", "servicePlanOccurrence",
  "eventType", "appointment", "booking",
  "payRun", "payRunLine",
  "supplier", "purchaseOrder", "purchaseOrderLine", "stockMovement", "asset", "vehicleDetail", "vehicleMaintenance", "assetUseLog",
  "subcontractor", "jobSubcontractor", "subcontractorPayment", "task",
  "marketingCampaign", "pamphletStop", "marketingDesign", "testimonial",
  "companyChatRoom", "companyChatMember", "companyChatMessage",
  "voiceCall", "activityLog",
];

for (const key of INDUSTRY_KEYS) {
  const { company, result } = seeded[key];
  // Read back from the store, not from the seed's own tally: the chat rooms
  // are written by lib/company/chat/store.js, which the seed calls but does
  // not count, and a screen reads the table, not the tally.
  const missing = MUST_HAVE.filter((m) => !(of(m, company.id).length > 0 || rows(m).some((r) => r.companyId === undefined && ownedBy(m, r, company.id))));
  ok(`${key.padEnd(12)} populates every table (${MUST_HAVE.length})`, missing.length === 0, missing);
  void result;
}

// The specific states, on one trade in depth (cabinets — the one the owner
// films) and the trade-conditional ones on each.
{
  const { company: c } = seeded.cabinets;
  const id = c.id;
  const quotes = of("quote", id);
  const byStatus = (s) => quotes.filter((q) => q.status === s);
  ok("quotes in every status", ["draft", "sent", "accepted", "declined"].every((s) => byStatus(s).length > 0), quotes.map((q) => q.status));
  ok("an expired quote (sent, validUntil past)", quotes.some((q) => q.status === "sent" && q.validUntil < NOW));
  ok("a sent quote with a follow-up on it", quotes.some((q) => q.status === "sent" && q.followUpCount > 0));
  ok("a signed acceptance carrying the audit record", quotes.some((q) => q.signature?.documentHash && q.signature.consent === true && q.signature.name));
  ok("...whose signature verifies against the stored quote", quotes.some((q) => q.signature?.documentHash) && (await import("@/lib/documents/signatureAudit")).verifySignature(quotes.find((q) => q.signature?.documentHash), quotes.find((q) => q.signature?.documentHash).signature));
  ok("a declined quote with a reason", quotes.some((q) => q.status === "declined" && q.declineReason));
  ok("a Good / Better / Best trio sharing a group", new Set(quotes.filter((q) => q.tierGroupId).map((q) => q.tierGroupId)).size === 1 && quotes.filter((q) => q.tierGroupId).length === 3);
  ok("...numbered -G / -B / -T", ["-G", "-B", "-T"].every((s) => quotes.some((q) => q.quoteNumber.endsWith(s))));
  ok("one AI review", quotes.filter((q) => q.aiReview && q.aiReviewedAt).length === 1);
  ok("one large quote flagged for review", quotes.filter((q) => q.needsReview).length === 1 && quotes.find((q) => q.needsReview).total > 20000);
  ok("every quote records createdVia demo", quotes.every((q) => q.createdVia === "demo"));
  ok("every quote keeps its client's language", quotes.every((q) => ["fr", "en", "es"].includes(q.language)));
  ok("numbering follows the product's format", quotes.every((q) => /^Q-\d{4}-\d{4}(-[GBT])?$/.test(q.quoteNumber)));
  const addOns = rows("quoteAddOn").filter((a) => quotes.some((q) => q.id === a.quoteId));
  ok("add-ons on more than one quote, one of them selected", new Set(addOns.map((a) => a.quoteId)).size >= 2 && addOns.some((a) => a.selected));

  const jobs = of("job", id);
  ok("jobs completed, in progress, scheduled", ["completed", "in_progress", "scheduled"].every((s) => jobs.some((j) => j.status === s)));
  ok("one recurring job with a rule the product knows", jobs.filter((j) => j.recurring).length === 1 && jobs.find((j) => j.recurring).recurrenceRule === "weekly");
  const visits = rows("jobVisit").filter((v) => jobs.some((j) => j.id === v.jobId));
  const week0 = new Date("2026-09-14T00:00:00Z");
  ok("past visits completed with photos and a ticked checklist", visits.some((v) => v.status === "completed" && v.photos.length === 2 && v.checklistItems?.every((c) => c.done)));
  ok("visits this week", visits.some((v) => v.scheduledAt >= week0 && v.scheduledAt < new Date(week0.getTime() + 7 * DAY)));
  ok("visits next month", visits.some((v) => v.scheduledAt > new Date(NOW.getTime() + 25 * DAY)));
  ok("a change order on the live job", rows("changeOrder").some((co) => jobs.some((j) => j.id === co.jobId && j.status === "in_progress")));
  ok("job costing populated on paid work", of("invoice", id).some((i) => i.status === "paid" && rows("invoiceCosting").some((c) => c.invoiceId === i.id && Number(c.totalCost) > 0)));

  const invoices = of("invoice", id);
  const st = (s) => invoices.filter((i) => i.status === s);
  ok("invoices paid, overdue, refunded, disputed", ["paid", "overdue", "refunded", "disputed"].every((s) => st(s).length > 0), invoices.map((i) => i.status));
  ok("the overdue one has been chased", st("overdue").some((i) => i.chaseCount > 0 && i.lastChasedAt));
  ok("the refund is a negative ledger row pointing at its payment", rows("payment").some((p) => p.kind === "refund" && Number(p.amount) < 0 && p.refundOfPaymentId && invoices.some((i) => i.id === p.invoiceId && i.status === "refunded")));
  ok("the dispute holds the money on the payment row", rows("payment").some((p) => p.disputeStatus && p.disputeHeldCents > 0 && invoices.some((i) => i.id === p.invoiceId && i.status === "disputed")));
  const payments = rows("payment").filter((p) => invoices.some((i) => i.id === p.invoiceId));
  ok("a card payment with the processing fee recorded", payments.some((p) => p.feeRateLabel === "card" && p.processingFeeCents > 0 && p.netCents > 0));
  ok("a bank-debit payment with its (cheaper) fee recorded", payments.some((p) => p.feeRateLabel === "acss_debit" && p.processingFeeCents > 0));
  ok("an e-transfer recorded by hand", payments.some((p) => p.method === "e_transfer"));
  ok("every Stripe intent id says demo", payments.filter((p) => p.stripePaymentIntentId).every((p) => p.stripePaymentIntentId.startsWith("demo_pi_")));
  ok("a job partway through its payment schedule", rows("jobPaymentStage").some((s) => s.companyId === id && s.status === "paid") && rows("jobPaymentStage").some((s) => s.companyId === id && s.status === "pending"));
  ok("invoice numbering follows the product's format", invoices.every((i) => /^INV-\d{4}-\d{4}$/.test(i.invoiceNumber)) && new Set(invoices.map((i) => i.invoiceNumber)).size === invoices.length);

  const leads = of("leadRequest", id);
  ok("leads in every score band", ["hot", "warm", "cold"].every((t) => leads.some((l) => l.temperature === t)), leads.map((l) => l.temperature));
  ok("leads from every source", ["self_quote", "meta_lead_form", "phone_assistant", "referral"].every((s) => leads.some((l) => l.source === s)));
  ok("leads new, contacted, converted, lost", ["new", "contacted", "converted", "lost"].every((s) => leads.some((l) => l.status === s)));
  ok("the converted lead points at its quote", leads.some((l) => l.status === "converted" && l.quoteId && quotes.some((q) => q.id === l.quoteId)));
  ok("a phone lead is not scored against the budget it could not ask", leads.filter((l) => l.source === "phone_assistant").every((l) => !l.scoreReasons?.some((r) => /budget/i.test(r.label))));

  const clients = of("client", id);
  ok(`${CLIENT_COUNT} clients`, clients.length === CLIENT_COUNT, clients.length);
  ok("a mix of French and English clients", clients.some((c) => c.language === "fr") && clients.some((c) => c.language === "en"));
  ok("business clients with a contact", clients.filter((c) => c.type === "company" && c.contactName).length >= 2);
  ok("every client on a real street in the company's city", clients.every((c) => c.city === "Laval" && PROFILES.cabinets.streets.some((s) => c.address.endsWith(s.name))));
  ok("one unsubscribed from marketing", of("marketingSubscriber", id).filter((s) => !s.subscribed && s.unsubscribedAt).length === 1);
  ok("one texted STOP", of("smsOptOut", id).length === 1);

  const workers = of("worker", id);
  const members = of("member", id);
  ok("owner, estimator, dispatcher and crew", members.some((m) => m.role === "owner") && members.filter((m) => m.permissions).length >= 5);
  ok("labour rates on the crew", workers.filter((w) => Number(w.hourlyRate) > 0).length >= 5);
  ok("availability Mon–Fri for everyone", of("workingHours", id).length === members.length * 5);
  const leave = of("leaveRequest", id);
  const nextMon = new Date("2026-09-21T00:00:00Z");
  ok("one approved leave next week", leave.some((l) => l.status === "approved" && l.startDate >= nextMon && l.startDate < new Date(nextMon.getTime() + 7 * DAY)));
  ok("one pending leave request", leave.some((l) => l.status === "pending"));

  const entries = rows("timeEntry").filter((e) => workers.some((w) => w.id === e.workerId));
  const twoWeeks = new Date(NOW.getTime() - 14 * DAY);
  ok("timesheets for the last two weeks", entries.filter((e) => e.clockIn >= twoWeeks).length >= 30);
  ok("...last week approved, this week pending", entries.some((e) => e.status === "approved" && e.approvedById) && entries.some((e) => e.status === "pending" && e.clockIn >= week0));
  const runs = of("payRun", id);
  ok("a pay run approved and one paid", runs.some((r) => r.status === "approved" && r.approvedAt && !r.paidAt) && runs.some((r) => r.status === "paid" && r.paidAt));
  const lines = rows("payRunLine").filter((l) => runs.some((r) => r.id === l.payRunId));
  ok("payslip lines with earnings and statutory deductions", lines.length >= 10 && lines.every((l) => l.items.some((i) => i.kind === "earning") && l.items.some((i) => i.kind === "deduction") && Number(l.net) < Number(l.gross)));

  const bookings = rows("booking").filter((b) => of("eventType", id).some((e) => e.id === b.eventTypeId));
  ok("bookings past, upcoming and cancelled", ["completed", "confirmed", "cancelled"].every((s) => bookings.some((b) => b.status === s)));
  ok("one with a booking fee and its fee breakdown", bookings.filter((b) => b.feePaidCents > 0 && b.feeProcessingCents > 0 && b.feeStripePaymentIntentId?.startsWith("demo_pi_")).length === 1);
  ok("every booking has its appointment on the calendar", bookings.every((b) => b.appointmentId && of("appointment", id).some((a) => a.id === b.appointmentId)));

  const plan = of("servicePlan", id)[0];
  const occ = rows("servicePlanOccurrence").filter((o) => o.planId === plan.id);
  ok("a service plan with a mandate", plan.collectionMode === "automatic" && rows("servicePlanAuthorisation").some((a) => a.planId === plan.id && a.stripeMandateId));
  ok("...with paid occurrences behind it and one ahead", occ.some((o) => o.status === "paid" && o.invoiceId) && occ.some((o) => o.status === "pending"));

  ok("a safety report, reviewed", of("safetyIncident", id).some((s) => s.status === "closed" && s.reviewedByMemberId));
  ok("a purchase order received in full", of("purchaseOrder", id).some((p) => p.status === "received" && p.receivedAt) && of("stockMovement", id).length === 3);
  ok("...and one still on order", of("purchaseOrder", id).some((p) => p.status === "ordered" && !p.receivedAt));
  ok("a vehicle with maintenance history", of("vehicleDetail", id).length === 1 && rows("vehicleMaintenance").length >= 3);
  ok("a subcontractor with insurance on file", of("subcontractor", id).some((s) => s.insuranceExpiresAt > NOW));
  ok("...paid for work on a job", of("subcontractorPayment", id).length === 1);
  ok("overhead expenses for six months", of("expense", id).filter((e) => e.isOverhead && e.recurring).length === 30);

  ok("a pamphlet route with stops in every state", of("marketingCampaign", id).some((m) => m.type === "pamphlet") && ["delivered", "spoke", "not_home", "pending"].every((s) => rows("pamphletStop").some((p) => p.status === s)));
  ok("an email campaign that went out", of("marketingCampaign", id).some((m) => m.type === "email" && m.sentAt && m.recipientCount > 0));
  ok("a designer post, approved", of("marketingDesign", id).some((d) => d.approvedAt && d.caption && d.hashtags.length));
  ok("reviews on finished jobs", of("satisfactionResponse", id).filter((r) => r.score >= 4 && r.respondedAt).length >= 3);
  ok("a testimonial", of("testimonial", id).some((t) => t.approved && t.featured));

  const chat = of("companyChatMessage", id);
  ok("crew chat in #general and the live job's room", new Set(chat.map((m) => m.roomId)).size === 2 && chat.length >= 6);
  ok("the receptionist's call log, one needing review", of("voiceCall", id).length === 5 && of("voiceCall", id).filter((v) => v.needsReview).length === 2);
  ok("the activity log is full", of("activityLog", id).length >= 30);
  ok("KPIs draw on six months: revenue in at least five distinct months", new Set(invoices.filter((i) => i.paidDate).map((i) => i.paidDate.toISOString().slice(0, 7))).size >= 5);
  ok("company address, tax and hours set", (await db.company.findUnique({ where: { id } })).city === "Laval" && Number((await db.company.findUnique({ where: { id } })).taxRate) === 14.975 && (await db.company.findUnique({ where: { id } })).businessHours.length === 7);
}

for (const key of ["plumbing", "hvac", "electrical"]) {
  const { company } = seeded[key];
  ok(`${key.padEnd(12)} clients own equipment under warranty`, of("clientEquipment", company.id).some((e) => e.warrantyEndsAt > NOW && e.serialNumber) && rows("clientEquipmentService").some((s) => of("clientEquipment", company.id).some((e) => e.id === s.equipmentId)));
}
for (const key of ["hvac", "roofing"]) {
  const { company } = seeded[key];
  const pays = rows("payment").filter((p) => of("invoice", company.id).some((i) => i.id === p.invoiceId));
  ok(`${key.padEnd(12)} (USD) never pretends at a Canadian bank-debit rail`, pays.every((p) => p.feeRateLabel !== "acss_debit"));
  const c = await db.company.findUnique({ where: { id: company.id } });
  ok(`${key.padEnd(12)} is in USD with its state's tax`, c.currency === "USD" && c.country === "US" && Number(c.taxRate) > 8);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Idempotent — a second run adds nothing");
// ═══════════════════════════════════════════════════════════════════════════

{
  const before = db.__counts();
  for (const key of INDUSTRY_KEYS) {
    const { company } = seeded[key];
    const again = await seedDemoCompany(company.id, { now: NOW });
    const created = Object.values(again.created).reduce((a, b) => a + b, 0);
    ok(`${key.padEnd(12)} second run created 0 rows`, created === 0, again.created);
  }
  const after = db.__counts();
  ok("no table's row count moved", JSON.stringify(before) === JSON.stringify(after));
  // A day later, too: keys are natural, never dates.
  // Tomorrow the timesheet legitimately gains today's clock-ins (a business
  // that has been open one more day); nothing else may move.
  const later = await seedDemoCompany(seeded.painting.company.id, { now: new Date(NOW.getTime() + DAY) });
  ok("...nor when run again the next day, beyond the new day's timesheet", Object.keys(later.created).every((m) => m === "timeEntry"), later.created);
  ok("no deleteMany anywhere in the seed", !/deleteMany|\.delete\(/.test(code(read("lib/demo/seedContent.js"))));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Tenancy — every row belongs to its demo");
// ═══════════════════════════════════════════════════════════════════════════

{
  const ids = new Set(Object.values(seeded).map((s) => s.company.id));
  const stray = [];
  for (const [t, list] of Object.entries(db.__tables)) {
    if (t === "company") continue;
    for (const r of list) if ("companyId" in r && !ids.has(r.companyId)) stray.push([t, r.id]);
  }
  ok("every row with a companyId is a demo's", stray.length === 0, stray.slice(0, 5));
  ok("every seeded company is isDemo", rows("company").every((c) => c.isDemo === true));
  // Rows without a companyId hang off a parent that has one.
  const orphans = rows("jobVisit").filter((v) => !rows("job").some((j) => j.id === v.jobId)).length + rows("payment").filter((p) => !rows("invoice").some((i) => i.id === p.invoiceId)).length;
  ok("no visit or payment without its parent", orphans === 0, orphans);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Fictional contact details only");
// ═══════════════════════════════════════════════════════════════════════════

{
  const E164 = /^\+1\d{3}55501\d{2}$/;
  const phones = [
    ...rows("client").map((r) => r.phone),
    ...rows("member").map((r) => r.phone),
    ...rows("worker").map((r) => r.phone),
    ...rows("company").map((r) => r.phone),
    ...rows("booking").map((r) => r.clientPhone),
    ...rows("supplier").map((r) => r.phone),
    ...rows("subcontractor").map((r) => r.phone),
    ...rows("leadRequest").map((r) => r.phone),
    ...rows("marketingSubscriber").map((r) => r.phone),
  ].filter(Boolean);
  const badPhones = phones.filter((p) => !FICTIONAL_PHONE.test(p));
  ok(`${phones.length} phone numbers, all in the 555-01xx block`, badPhones.length === 0, badPhones.slice(0, 5));
  const e164s = [...rows("voiceCall").map((r) => r.fromE164), ...rows("smsOptOut").map((r) => r.e164)].filter(Boolean);
  ok("...and every E.164 form too", e164s.every((p) => E164.test(p)), e164s.filter((p) => !E164.test(p)));

  const emails = [
    ...rows("user").map((r) => r.email),
    ...rows("client").map((r) => r.email),
    ...rows("worker").map((r) => r.email),
    ...rows("leadRequest").map((r) => r.email),
    ...rows("booking").map((r) => r.clientEmail),
    ...rows("supplier").map((r) => r.email),
    ...rows("subcontractor").map((r) => r.email),
    ...rows("marketingSubscriber").map((r) => r.email),
    ...rows("quote").map((r) => r.sentToEmail),
    ...rows("invoice").map((r) => r.sentToEmail),
    ...rows("company").map((r) => r.email),
  ].filter(Boolean);
  const badMail = emails.filter((e) => !EXAMPLE_EMAIL.test(e));
  ok(`${emails.length} email addresses, all on example.com`, badMail.length === 0, badMail.slice(0, 5));
  ok("staff logins are unique across companies", new Set(rows("user").map((u) => u.email)).size === rows("user").length);
  ok("no Cloudinary or vendor URL was invented", rows("jobPhoto").every((p) => /^https:\/\/picsum\.photos\//.test(p.url)));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Names come from the pools and nowhere else");
// ═══════════════════════════════════════════════════════════════════════════

{
  // Reconstruct the pool of every name the generator can produce.
  const pool = new Set(allSeedNames());
  const r = rng("pool");
  for (const lang of ["fr", "en", "es"]) {
    for (let i = 0; i < 4000; i++) {
      const p = person(r, lang);
      pool.add(`${p.firstName} ${p.lastName}`);
      pool.add(business(r, lang));
    }
  }
  pool.add("Sophie Dubois");
  const names = [...rows("client").map((c) => c.name), ...rows("leadRequest").map((l) => l.name), ...rows("user").map((u) => u.name)];
  const outside = names.filter((n) => !pool.has(n));
  ok(`${names.length} people, every one from the pools`, outside.length === 0, outside.slice(0, 5));
  // A real customer's name must never be in the pool. The only real people
  // this repo knows by name are its own fixtures' authors and the owner —
  // none of them may be a demo client.
  const real = ["Emilio Boves", "Emilio"];
  ok("no real person is in the pool", real.every((n) => !pool.has(n) && !names.includes(n)));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The refusal, and the wiring");
// ═══════════════════════════════════════════════════════════════════════════

{
  const realCo = await db.company.create({ data: { name: "A real customer", slug: "real-co", isDemo: false } });
  let threw = null;
  try { await seedDemoCompany(realCo.id, { now: NOW }); } catch (e) { threw = e; }
  ok("a non-demo company is refused with 403", threw?.status === 403 && /isDemo/.test(threw.message));
  ok("...and nothing was written to it", Object.values(db.__tables).every((list) => list.every((r) => r.companyId !== realCo.id)));
  let unknown = null;
  try { await seedDemoCompany("nope", { now: NOW }); } catch (e) { unknown = e; }
  ok("an unknown id is a 404", unknown?.status === 404);

  const seedDemo = code(read("lib/demo/seedDemo.js"));
  ok("applyIndustry's content step is seedDemoCompany", /seedDemoCompany\(companyId, \{ trade: key, now \}\)/.test(seedDemo) && /seedDemoContent\(companyId, preset, new Date\(\), industryKey\)/.test(seedDemo));
  const repDemo = code(read("lib/sales/repDemo.js"));
  ok("a rep's demo is dressed by applyIndustry on creation and on reset", /dress = applyIndustry/.test(repDemo) && /await dress\(company\.id, key\)/.test(repDemo) && /resetRepDemo/.test(repDemo));
  const route = code(read("app/api/platform/demo/route.js"));
  ok("the platform console's reset and re-dress go through the same function", /resetDemo\(companyId\)/.test(route) && /applyIndustry\(companyId, industry\)/.test(route));
  const pool = code(read("scripts/seed-demos.mjs"));
  ok("the pool script dresses through applyIndustry", /applyIndustry\(company\.id, acct\.industry\)/.test(pool));
  const script = code(read("scripts/seed-demo-content.mjs"));
  ok("the owner's script is a dry run unless --write", /const write = flag\("--write"\)/.test(script) && /write \? "SEEDING" : "DRY RUN"/.test(script));
  ok("...seeds the pool only under --all", /\{ isDemo: true, demoOwnerRepId: null \}/.test(script));
  const pkg = JSON.parse(read("package.json"));
  ok("check:demo-content is a script", /check-demo-content\.mjs/.test(pkg.scripts["check:demo-content"] || ""));
  ok("...run under the memory db", /memory-db-loader/.test(pkg.scripts["check:demo-content"] || ""));
  ok("...and in check:all", /npm run check:demo-content/.test(pkg.scripts["check:all"]));
  ok("seed:demo-content is a script", /seed-demo-content\.mjs/.test(pkg.scripts["seed:demo-content"] || ""));
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. Determinism — the same business twice");
// ═══════════════════════════════════════════════════════════════════════════

{
  const a = await db.company.create({ data: { name: "A", slug: "demo-det-a", isDemo: true, demoIndustry: "roofing" } });
  const b = await db.company.create({ data: { name: "B", slug: "demo-det-a-2", isDemo: true, demoIndustry: "roofing" } });
  await seedDemoCompany(a.id, { now: NOW });
  await seedDemoCompany(b.id, { now: NOW });
  const names = (id) => of("client", id).map((c) => `${c.name}|${c.address}|${c.phone}`).join(";");
  // Same trade, different slug → the dice are seeded by trade and slug, so
  // the two are different businesses; the same slug reseeded is identical.
  ok("two roofing demos are not clones of each other", names(a.id) !== names(b.id));
  const c1 = await db.company.create({ data: { name: "C", slug: "demo-twin", isDemo: true, demoIndustry: "painting" } });
  await seedDemoCompany(c1.id, { now: NOW });
  const snapshot = names(c1.id);
  const fresh = (await import("./fixtures/memoryPrisma.mjs")).fakeDb();
  const c2 = await fresh.company.create({ data: { name: "C", slug: "demo-twin", isDemo: true, demoIndustry: "painting" } });
  await seedDemoCompany(c2.id, { now: NOW, db: fresh });
  const twin = fresh.__tables.client.map((c) => `${c.name}|${c.address}|${c.phone}`).join(";");
  ok("the same slug seeded in a fresh database is the same business", snapshot === twin);
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. The cabinets demo is the help-centre harness's shop");
// ═══════════════════════════════════════════════════════════════════════════

{
  const { company } = seeded.cabinets;
  const c = await db.company.findUnique({ where: { id: company.id } });
  ok("same name", c.name === HARNESS_COMPANY.name, [c.name, HARNESS_COMPANY.name]);
  ok("same street, city, postal code", c.address === HARNESS_COMPANY.address && c.city === HARNESS_COMPANY.city && c.postalCode === HARNESS_COMPANY.postalCode);
  const seededNames = STAFF.cabinets.slice(0, 6).map((p) => `${p.firstName} ${p.lastName}`);
  ok("the same six people, in the same order", HARNESS_PEOPLE.every((p, i) => p.name === seededNames[i]), [HARNESS_PEOPLE.map((p) => p.name), seededNames]);
  const users = of("member", company.id).map((m) => rows("user").find((u) => u.id === m.userId).name);
  ok("...and they are members of the demo", HARNESS_PEOPLE.every((p) => users.includes(p.name)));
  const sophie = of("client", company.id).find((x) => x.name === HARNESS_CLIENT.name);
  ok("Sophie Dubois is the first client, at the fixture's address and number", sophie && sophie.address === HARNESS_CLIENT.address && sophie.phone === HARNESS_CLIENT.phone && sophie.email === HARNESS_CLIENT.email && sophie.language === "fr");
  ok("...with the live job this week on her kitchen", of("job", company.id).some((j) => j.clientId === sophie.id && j.status === "in_progress"));
}

console.log(`\n${failures.length === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${failures.length} failed\n`);
process.exit(failures.length ? 1 : 0);
