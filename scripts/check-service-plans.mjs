// scripts/check-service-plans.mjs
//
// The pure parts of service plans, executed rather than read.
//
//   npm run check:service-plans
//
// This touches money, so the bar is the one AGENTS.md sets for that: nothing
// may charge a client that the client has not agreed to. Four things are
// asserted, in order of how much damage getting them wrong would do:
//
//   1. A cancelled, completed, exhausted or not-yet-started plan generates
//      NOTHING. Proven by executing the generator, not by reading the query.
//   2. The discount arithmetic — including how it rounds, and that the total a
//      contractor is quoted is the sum of the invoices that will actually be
//      raised.
//   3. Occurrence dates from a frequency and a length, including the month-end
//      case that the calendar module deliberately handles differently.
//   4. Absence is stated: no payment method resolves to a NAMED reason, never
//      to a silent fallback that collects nothing.
//
// Plus a set of static assertions over the Stripe code — that it uses the
// destination-charge shape the rest of the codebase uses, confirms off-session,
// and creates no Stripe Subscription. NO LIVE STRIPE CALL is made here, and
// none may be added: a check that needs a network and a secret is a check that
// stops being run.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PLAN_FREQUENCY_KEYS,
  occurrenceDate,
  plannedOccurrenceCount,
  seqWithinTerm,
  planBlockedReason,
  dueOccurrences,
  termIsFinished,
  nextDueDate,
  MAX_OCCURRENCES_PER_RUN,
} from "@/lib/servicePlans/schedule";
import { occurrenceAmounts, termTotals, fromCents } from "@/lib/servicePlans/pricing";
import { isChargeable, automaticBlockedReason } from "@/lib/servicePlans/authorisation";
import { validatePlanInput } from "@/lib/servicePlans/validate";
import {
  buildAuthorisationTerms,
  canAuthoriseInLanguage,
  mandateIntervalDescription,
  AUTHORISATION_LANGUAGES,
} from "@/lib/servicePlans/consent";
import { buildInvoiceEmail } from "@/lib/email/invoiceEmail";
import { buildAuthorisationRequestEmail } from "@/lib/email/servicePlanEmail";
import { SUPPORTED_EMAIL_LANGUAGES } from "@/lib/i18n/emailCopy";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
}

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : String(d));
const UTC = (s) => new Date(`${s}T00:00:00.000Z`);

function plan(overrides = {}) {
  return {
    id: "plan_1",
    status: "active",
    frequency: "semiannual",
    startDate: UTC("2026-04-15"),
    endMode: "count",
    occurrenceCount: 2,
    amountPerOccurrence: 250,
    discountPct: 10,
    taxRatePct: null,
    collectionMode: "invoice",
    language: "en",
    name: "Spring & Fall",
    createdAt: UTC("2026-01-01"),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n1. Nothing bills that shouldn't\n");

// The single most important assertion in this file. Cancelling has to STOP the
// money, and the proof is that the generator itself refuses — not that a Prisma
// `where` clause happens to filter first.
for (const [label, mutation] of [
  ["a cancelled plan", { status: "cancelled", cancelledAt: UTC("2026-05-01") }],
  ["a plan with cancelledAt but a stale status", { cancelledAt: UTC("2026-05-01") }],
  ["a completed plan", { status: "completed" }],
  ["a plan with completedAt but a stale status", { completedAt: UTC("2026-05-01") }],
  ["a plan in an unknown status", { status: "paused" }],
]) {
  const p = plan(mutation);
  const result = dueOccurrences(p, { now: UTC("2030-01-01") });
  ok(`${label} generates nothing`, result.due.length === 0, `blocked=${result.blocked}`);
  ok(`  ^ and names why`, typeof result.blocked === "string" && result.blocked.length > 0);
  ok(`  ^ and offers no next date`, nextDueDate(p, { now: UTC("2030-01-01") }) === null);
}

{
  // Exhausted term: a 2-visit plan, both visits already generated, years later.
  const p = plan();
  const result = dueOccurrences(p, { now: UTC("2030-01-01"), existingSeqs: [0, 1] });
  ok("a fully billed 2-visit plan generates nothing", result.due.length === 0);
  ok("  ^ and reports itself exhausted", result.exhausted === true);
  ok(
    "  ^ termIsFinished agrees",
    termIsFinished(p, { now: UTC("2030-01-01"), existingSeqs: [0, 1] }) === true,
  );
  ok(
    "an open-ended plan is never 'finished'",
    termIsFinished(plan({ endMode: "open", occurrenceCount: null }), {
      now: UTC("2099-01-01"),
      existingSeqs: [0, 1, 2, 3],
    }) === false,
  );
}

{
  // Not started: the first visit is in the future.
  const result = dueOccurrences(plan(), { now: UTC("2026-01-02") });
  ok("a plan whose first visit hasn't arrived bills nothing", result.due.length === 0);
  ok("  ^ and says 'not_started'", result.blocked === "not_started");
}

{
  // The back-billing guard. A contractor entering a plan today with a start
  // date last spring must not have last spring's visits invoiced at them.
  const p = plan({ startDate: UTC("2024-04-15"), createdAt: UTC("2026-06-01"), endMode: "open", occurrenceCount: null });
  const result = dueOccurrences(p, { now: UTC("2026-06-02"), limit: 10 });
  const anyBeforeCreation = result.due.some((d) => d.dueDate < p.createdAt);
  ok("no occurrence is generated for a date before the plan existed", !anyBeforeCreation,
    result.due.map((d) => iso(d.dueDate)).join(" "));
}

{
  // The burst guard.
  const p = plan({ frequency: "weekly", startDate: UTC("2026-01-08"), endMode: "open", occurrenceCount: null, createdAt: UTC("2026-01-01") });
  const result = dueOccurrences(p, { now: UTC("2026-12-31") });
  ok(
    `at most ${MAX_OCCURRENCES_PER_RUN} occurrence(s) per run by default`,
    result.due.length <= MAX_OCCURRENCES_PER_RUN,
    `${result.due.length}`,
  );
  ok("  ^ and it is the EARLIEST unbilled one", iso(result.due[0]?.dueDate) === "2026-01-08");
}

{
  // Idempotency: an already-generated sequence is never handed out twice.
  const p = plan({ frequency: "monthly", startDate: UTC("2026-01-10"), endMode: "count", occurrenceCount: 6, createdAt: UTC("2026-01-01") });
  const first = dueOccurrences(p, { now: UTC("2026-04-01") });
  const again = dueOccurrences(p, { now: UTC("2026-04-01"), existingSeqs: [first.due[0].seq] });
  ok("a generated occurrence is not generated again", again.due[0]?.seq !== first.due[0].seq);
  ok("  ^ the next one is the next sequence", again.due[0]?.seq === first.due[0].seq + 1);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n2. Discount arithmetic\n");

{
  // The owner's two examples, worked through.
  const springFall = plan({ amountPerOccurrence: 250, discountPct: 10, occurrenceCount: 2 });
  const a = occurrenceAmounts(springFall);
  ok("Spring & Fall 2×$250, 10% off — each visit", a.total === 225, `${a.total}`);
  const term = termTotals(springFall, plannedOccurrenceCount(springFall));
  ok("  ^ whole plan", term.total === 450, `${term.total}`);
  ok("  ^ discount stated", term.discount === 50, `${term.discount}`);
  // The number quoted IS the number billed. Term totals are summed from the
  // occurrences, never computed by discounting the gross — see pricing.js.
  ok("  ^ term total == occurrences × per-visit", term.total === a.total * term.occurrences);
}

{
  const quarterly = plan({
    amountPerOccurrence: 180,
    discountPct: 15,
    frequency: "quarterly",
    occurrenceCount: 4,
  });
  const a = occurrenceAmounts(quarterly);
  ok("Quarterly maintenance 4×$180, 15% off — each visit", a.total === 153, `${a.total}`);
  const term = termTotals(quarterly, 4);
  ok("  ^ whole plan", term.total === 612, `${term.total}`);
  ok("  ^ term total == occurrences × per-visit", term.total === a.total * 4);
}

{
  // Rounding: 33.33% off $100 is $33.33, and four of them is $133.34 kept, not
  // a figure with a stray cent nobody can reconcile.
  const p = plan({ amountPerOccurrence: 100, discountPct: 33.333, occurrenceCount: 4 });
  const a = occurrenceAmounts(p);
  ok("an awkward percentage still lands on whole cents",
    Number.isInteger(a.totalCents) && Number.isInteger(a.discountCents),
    `${a.discountCents} / ${a.totalCents}`);
  const term = termTotals(p, 4);
  ok("  ^ and the term total is exactly 4 identical invoices",
    term.totalCents === a.totalCents * 4);
}

{
  // Tax after the discount, never before.
  const p = plan({ amountPerOccurrence: 200, discountPct: 10, taxRatePct: 13 });
  const a = occurrenceAmounts(p);
  ok("tax applies to the DISCOUNTED subtotal", a.tax === 23.4, `${a.tax}`);
  ok("  ^ total = subtotal + tax", a.total === 203.4, `${a.total}`);
  const noTax = occurrenceAmounts(plan({ amountPerOccurrence: 200, discountPct: 10 }));
  ok("a null tax rate charges no tax rather than guessing one", noTax.tax === 0);
}

{
  // Hostile input. None of these may produce a negative charge, a NaN, or a
  // figure larger than the gross.
  const hostile = [
    { amountPerOccurrence: -500, discountPct: 10 },
    { amountPerOccurrence: "abc", discountPct: 10 },
    { amountPerOccurrence: 100, discountPct: 500 },
    { amountPerOccurrence: 100, discountPct: -50 },
    { amountPerOccurrence: 100, discountPct: NaN },
    { amountPerOccurrence: null, discountPct: null },
    { amountPerOccurrence: Infinity, discountPct: 10 },
    { amountPerOccurrence: "100.005", discountPct: "10" },
  ];
  let clean = true;
  const bad = [];
  for (const h of hostile) {
    const a = occurrenceAmounts(h);
    const sane =
      Number.isFinite(a.totalCents) &&
      a.totalCents >= 0 &&
      a.discountCents >= 0 &&
      a.discountCents <= a.grossCents &&
      Number.isInteger(a.totalCents);
    if (!sane) {
      clean = false;
      bad.push(JSON.stringify(h));
    }
  }
  ok("no hostile input produces a negative, fractional or NaN charge", clean, bad.join(" "));
  ok("a 500% discount cannot invert into a surcharge",
    occurrenceAmounts({ amountPerOccurrence: 100, discountPct: 500 }).totalCents === 0);
  ok("fromCents round-trips", fromCents(12345) === 123.45);
}

{
  // Open-ended plans have no term total, and null is the answer — not zero.
  const open = plan({ endMode: "open", occurrenceCount: null });
  ok("an open-ended plan reports no term total",
    termTotals(open, plannedOccurrenceCount(open)) === null);
  ok("  ^ and no planned count", plannedOccurrenceCount(open) === null);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n3. Occurrence dates from a frequency and a length\n");

{
  const cases = [
    ["weekly", "2026-03-02", ["2026-03-02", "2026-03-09", "2026-03-16"]],
    ["monthly", "2026-03-10", ["2026-03-10", "2026-04-10", "2026-05-10"]],
    ["quarterly", "2026-01-15", ["2026-01-15", "2026-04-15", "2026-07-15"]],
    ["semiannual", "2026-04-15", ["2026-04-15", "2026-10-15", "2027-04-15"]],
    ["annual", "2026-04-15", ["2026-04-15", "2027-04-15", "2028-04-15"]],
  ];
  for (const [freq, start, expected] of cases) {
    const got = [0, 1, 2].map((i) => iso(occurrenceDate(UTC(start), freq, i)));
    ok(`${freq} from ${start}`, got.join(" ") === expected.join(" "), got.join(" "));
  }
  ok("every declared frequency is covered above",
    cases.length === PLAN_FREQUENCY_KEYS.length,
    `${cases.length}/${PLAN_FREQUENCY_KEYS.length}`);
}

{
  // The month-end case this module handles DIFFERENTLY from lib/jobs/recurrence.
  // Iterating (Jan 31 → Feb 28 → Mar 28) would walk a client's billing date
  // backwards for ever; anchoring restores the 31st the moment a month has one.
  const got = [0, 1, 2, 3].map((i) => iso(occurrenceDate(UTC("2026-01-31"), "monthly", i)));
  ok("monthly from the 31st clamps and then RECOVERS",
    got.join(" ") === "2026-01-31 2026-02-28 2026-03-31 2026-04-30", got.join(" "));
  const leap = iso(occurrenceDate(UTC("2028-01-31"), "monthly", 1));
  ok("  ^ and knows a leap February", leap === "2028-02-29", leap);
}

{
  // Length: count.
  const p = plan({ frequency: "monthly", startDate: UTC("2026-01-10"), endMode: "count", occurrenceCount: 6 });
  ok("count: 6 visits planned", plannedOccurrenceCount(p) === 6);
  ok("  ^ seq 5 is the last one inside the term", seqWithinTerm(p, 5) === true);
  ok("  ^ seq 6 is outside it", seqWithinTerm(p, 6) === false);
}

{
  // Length: until a date. April 15 + semiannual, ending 2027-06-30 → Apr 2026,
  // Oct 2026, Apr 2027 = 3.
  const p = plan({ endMode: "until", endDate: UTC("2027-06-30"), occurrenceCount: null });
  ok("until: counts only the occurrences that fit", plannedOccurrenceCount(p) === 3,
    String(plannedOccurrenceCount(p)));
  ok("  ^ a date past the end is refused", seqWithinTerm(p, 3) === false);
}

{
  // Length: open.
  const p = plan({ endMode: "open", occurrenceCount: null });
  ok("open: seq 500 is still inside the term", seqWithinTerm(p, 500) === true);
}

{
  // A malformed plan yields nothing rather than a plausible-looking date.
  ok("an unknown frequency yields no date", occurrenceDate(UTC("2026-01-01"), "fortnightly", 0) === null);
  ok("an invalid start date yields no date", occurrenceDate("not-a-date", "monthly", 0) === null);
  ok("a negative index yields no date", occurrenceDate(UTC("2026-01-01"), "monthly", -1) === null);
  ok("a malformed plan is blocked, not billed",
    planBlockedReason(plan({ frequency: "fortnightly" })) === "malformed");
  ok("an unknown end mode sells nothing", seqWithinTerm(plan({ endMode: "forever" }), 0) === false);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n4. Absence is stated, never padded\n");

{
  const p = plan({ collectionMode: "automatic" });
  ok("no authorisation at all → 'no_consent'",
    automaticBlockedReason(p, null) === "no_consent");
  ok("consent recorded, no payment method → 'awaiting_payment_method'",
    automaticBlockedReason(p, {
      acceptedAt: new Date(), stripeCustomerId: "cus_x",
      stripePaymentMethodId: "", paymentMethodType: "",
    }) === "awaiting_payment_method");
  ok("revoked → 'revoked'",
    automaticBlockedReason(p, {
      acceptedAt: new Date(), stripeCustomerId: "cus_x",
      stripePaymentMethodId: "pm_x", paymentMethodType: "card",
      revokedAt: new Date(),
    }) === "revoked");
  ok("a live mandate → null (nothing blocking)",
    automaticBlockedReason(p, {
      acceptedAt: new Date(), stripeCustomerId: "cus_x",
      stripePaymentMethodId: "pm_x", paymentMethodType: "card",
    }) === null);
  ok("an invoice-tier plan says 'not_requested', not 'no_consent'",
    automaticBlockedReason(plan(), null) === "not_requested");
}

{
  // isChargeable is the one gate. Every half-filled row must fail it.
  const full = {
    acceptedAt: new Date(), stripeCustomerId: "cus_x",
    stripePaymentMethodId: "pm_x", paymentMethodType: "card",
  };
  ok("a complete authorisation is chargeable", isChargeable(full) === true);
  for (const missing of ["acceptedAt", "stripeCustomerId", "stripePaymentMethodId", "paymentMethodType"]) {
    ok(`  ^ refused without ${missing}`, isChargeable({ ...full, [missing]: null }) === false);
  }
  ok("  ^ refused when revoked", isChargeable({ ...full, revokedAt: new Date() }) === false);
  ok("  ^ refused when absent entirely", isChargeable(null) === false);
  ok("  ^ refused when undefined", isChargeable(undefined) === false);
}

{
  // The language gate. A client we cannot state the terms to is never asked.
  ok("automatic collection is refused in an unreviewed language",
    validatePlanInput(
      { name: "X", serviceName: "Y", clientId: "c1", frequency: "monthly",
        startDate: "2026-01-10", endMode: "open", amountPerOccurrence: 100,
        collectionMode: "automatic" },
      { language: "pa" },
    ).ok === false);
  ok("  ^ but the invoice tier works in that same language",
    validatePlanInput(
      { name: "X", serviceName: "Y", clientId: "c1", frequency: "monthly",
        startDate: "2026-01-10", endMode: "open", amountPerOccurrence: 100,
        collectionMode: "invoice" },
      { language: "pa" },
    ).ok === true);
  for (const code of AUTHORISATION_LANGUAGES) {
    ok(`  ^ ${code} can authorise`, canAuthoriseInLanguage(code) === true);
  }
  ok("  ^ an unknown code cannot", canAuthoriseInLanguage("zz") === false);
}

{
  // Validation refuses what would become a plan that silently never bills, or
  // one whose figures are nonsense.
  const base = {
    name: "Plan", serviceName: "Gutters", clientId: "c1",
    frequency: "semiannual", startDate: "2026-04-15",
    endMode: "count", occurrenceCount: 2, amountPerOccurrence: 250,
  };
  ok("a valid payload is accepted", validatePlanInput(base).ok === true);
  ok("  ^ blank tax stays NULL, not 0",
    validatePlanInput({ ...base, taxRatePct: "" }).plan.taxRatePct === null);
  ok("  ^ a stated 0% tax stays 0",
    validatePlanInput({ ...base, taxRatePct: 0 }).plan.taxRatePct === 0);
  const refusals = [
    ["no name", { name: "" }],
    ["no service", { serviceName: "" }],
    ["no client", { clientId: "" }],
    ["unknown frequency", { frequency: "fortnightly" }],
    ["no start date", { startDate: "" }],
    ["zero visits", { occurrenceCount: 0 }],
    ["fractional visits", { occurrenceCount: 2.5 }],
    ["negative amount", { amountPerOccurrence: -1 }],
    ["zero amount", { amountPerOccurrence: 0 }],
    ["100% discount", { discountPct: 100 }],
    ["negative discount", { discountPct: -5 }],
    ["end date before the first visit", { endMode: "until", endDate: "2026-01-01" }],
    ["unknown end mode", { endMode: "forever" }],
    ["unknown collection mode", { collectionMode: "telepathy" }],
  ];
  for (const [label, override] of refusals) {
    const r = validatePlanInput({ ...base, ...override });
    ok(`  ^ refused: ${label}`, r.ok === false && typeof r.error === "string" && r.error.length > 10,
      r.ok ? "ACCEPTED" : "");
  }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n5. The consent text says the four things Stripe requires\n");

{
  const p = plan({ language: "en", collectionMode: "automatic" });
  const company = { name: "Ridgeline Exteriors", currency: "CAD", phone: "555-0100", email: "hi@ridgeline.ca" };
  const amounts = occurrenceAmounts(p);
  const terms = buildAuthorisationTerms({
    plan: p, company, amounts, term: termTotals(p, plannedOccurrenceCount(p)),
  });

  // 1 series of payments · 2 timing and frequency · 3 how the amount is
  // determined · 4 the cancellation policy.
  ok("1. states a SERIES of payments", /series of payments/i.test(terms.text));
  ok("2. states the first date and the cadence",
    /first payment is taken on/i.test(terms.text) && /twice a year/i.test(terms.text));
  ok("3. states the amount and that it is fixed",
    terms.text.includes("225") && /fixed now and cannot be changed/i.test(terms.text));
  ok("4. states how to cancel", /end this arrangement at any time/i.test(terms.text));
  ok("  ^ and that nothing is taken after cancelling",
    /No payment is taken after it is cancelled/i.test(terms.text));
  ok("  ^ names the company", terms.text.includes("Ridgeline Exteriors"));
  ok("  ^ the recorded snapshot contains every displayed bullet",
    terms.bullets.every((b) => terms.text.includes(b)));

  // The length clause has to tell the truth about each of the three modes.
  const counted = buildAuthorisationTerms({ plan: p, company, amounts });
  ok("count: says how many payments in total", /2 payments in total/i.test(counted.text));
  const until = buildAuthorisationTerms({
    plan: plan({ endMode: "until", endDate: UTC("2027-06-30"), occurrenceCount: null }),
    company, amounts,
  });
  ok("until: names the last date", /No payments after/i.test(until.text));
  const open = buildAuthorisationTerms({
    plan: plan({ endMode: "open", occurrenceCount: null }), company, amounts,
  });
  ok("open: says there is NO end date rather than inventing one",
    /no end date/i.test(open.text) && !/in total/i.test(open.text));

  // French must state the same four things.
  const fr = buildAuthorisationTerms({
    plan: plan({ language: "fr" }), company, amounts,
    term: termTotals(p, 2),
  });
  ok("fr: same four statements", fr.bullets.length === terms.bullets.length);
  ok("fr: states a series of payments", /série de paiements/i.test(fr.text));
  ok("fr: states cancellation", /mettre fin à cette entente/i.test(fr.text));
  ok("fr: nothing is taken after cancelling", /Aucun paiement n’est prélevé après/i.test(fr.text));
}

{
  // The PAD mandate's interval_description is printed verbatim inside the
  // agreement Stripe makes the client sign. If it described a different cadence
  // from the one the plan bills on, every debit would be outside the mandate.
  const map = {
    weekly: /week/i, monthly: /month/i, quarterly: /three months/i,
    semiannual: /twice a year/i, annual: /once a year/i,
  };
  for (const freq of PLAN_FREQUENCY_KEYS) {
    ok(`mandate interval_description matches ${freq}`,
      map[freq].test(mandateIntervalDescription(freq, "en")),
      mandateIntervalDescription(freq, "en"));
  }
  ok("and exists in French too", mandateIntervalDescription("semiannual", "fr").length > 0);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n6. The Stripe integration, asserted statically\n");

// Executing these would need a live key and a network. Reading them is enough
// to catch the changes that would actually hurt: a Subscription creeping in, a
// charge losing its Connect destination, or off_session being dropped.
{
  const mandate = read("lib/servicePlans/stripeMandate.js");
  const run = read("lib/servicePlans/run.js");
  const stripeLib = read("lib/stripe.js");

  ok("no Stripe Subscription is ever created for a plan",
    !/subscriptions\.create|mode:\s*["']subscription["']/.test(mandate + run));
  ok("no Stripe Price or Product is created either",
    !/prices\.create|products\.create/.test(mandate + run));
  ok("the setup session is mode: 'setup'", /mode:\s*["']setup["']/.test(mandate));
  ok("the setup intent is usage: 'off_session'", /usage:\s*["']off_session["']/.test(mandate));
  ok("the charge confirms off-session",
    /off_session:\s*true/.test(mandate) && /confirm:\s*true/.test(mandate));
  ok("the charge is a DESTINATION charge, like the existing pay link",
    /transfer_data:\s*\{\s*destination/.test(mandate) &&
      /transfer_data:\s*\{\s*destination/.test(stripeLib));
  ok("  ^ with the same zero platform fee", /application_fee_amount:\s*0/.test(mandate));
  ok("the mandate id is passed when there is one", /mandate:\s*authorisation\.stripeMandateId/.test(mandate));
  ok("the payment method type is pinned to the authorised one",
    /payment_method_types:\s*\[authorisation\.paymentMethodType\]/.test(mandate));
  ok("every charge carries an idempotency key", /idempotencyKey/.test(mandate) && /idempotencyKey:\s*`fq-plan-occ-/.test(run));
  ok("pre-authorized debit passes the mandate options Stripe requires",
    /payment_schedule:\s*["']interval["']/.test(mandate) &&
      /interval_description/.test(mandate) &&
      /transaction_type/.test(mandate));
  ok("acss_debit is only offered when the company bills in CAD",
    /currency === ["']cad["']/.test(mandate));

  // The customer-metadata trap: a bare `companyId` key on a CUSTOMER would be
  // picked up by getOrCreateStripeCustomer's `metadata['companyId']` search in
  // lib/platform/stripeBilling.js, and hand a tenant's own subscription a
  // homeowner's card. Scoped to the customers.create call — the same key on a
  // Checkout Session is fine, because that search only looks at Customers.
  const customerCreate = /stripe\.customers\.create\(\{[\s\S]*?\n  \}\)/.exec(mandate)?.[0] || "";
  ok("the customers.create call was found to inspect", customerCreate.length > 0);
  ok("client customers are NOT tagged with a bare `companyId` metadata key",
    customerCreate.length > 0 && !/\bcompanyId:/.test(customerCreate),
    "would collide with lib/platform/stripeBilling.js's customers.search");
  ok("  ^ they use the fq_ prefixed keys instead", /fq_clientId/.test(customerCreate));
}

{
  const cancel = read("app/api/service-plans/[id]/cancel/route.js");
  const cron = read("app/api/cron/service-plans/route.js");
  const auth = read("lib/servicePlans/authorisation.js");

  ok("cancelling sets status AND cancelledAt",
    /status:\s*["']cancelled["']/.test(cancel) && /cancelledAt:/.test(cancel));
  ok("cancelling revokes the authorisation", /revokeAuthorisation/.test(cancel));
  ok("revoking detaches the payment method at Stripe", /detachPaymentMethod/.test(auth));
  ok("  ^ and writes revokedAt BEFORE calling Stripe",
    auth.indexOf("revokedAt: new Date()") < auth.indexOf("detachPaymentMethod(existing"));
  ok("the cron only looks at active plans", /status:\s*["']active["']/.test(cron));
  ok("  ^ and the engine re-checks per plan (two guards, deliberately)",
    /planBlockedReason/.test(read("lib/servicePlans/schedule.js")) &&
      /dueOccurrences/.test(read("lib/servicePlans/run.js")));
}

{
  const run = read("lib/servicePlans/run.js");
  ok("the automatic path is gated on isChargeable, not on collectionMode alone",
    /isChargeable\(plan\.authorisation\)/.test(run));
  ok("a failed charge falls back to the pay link", /charge_failed/.test(run) && /kind: "invoice"/.test(run));
  ok("a 'processing' charge is NOT marked paid",
    /status:\s*["']charging["']/.test(run) && !/processing[\s\S]{0,200}status:\s*["']paid["']/.test(run));
  ok("pending charges are reconciled without relying on a webhook",
    /settlePendingCharges/.test(run) && /retrievePaymentIntent/.test(run));
  ok("a plan asking for automatic collection without a mandate is REPORTED",
    /invoiced_no_mandate/.test(run));
}

{
  // The public consent endpoint must not leak Stripe identifiers.
  const summary = read("lib/servicePlans/summary.js");
  const publicRoute = read("app/api/plan/[token]/route.js");
  for (const [file, src] of [["summary.js", summary], ["plan/[token]", publicRoute]]) {
    const leaks = ["stripePaymentMethodId", "stripeCustomerId", "stripeMandateId", "stripeSetupIntentId"]
      .filter((k) => new RegExp(`${k}:\\s*(auth|plan)`).test(src));
    ok(`${file} returns no Stripe identifier to the browser`, leaks.length === 0, leaks.join(" "));
  }
  ok("the return leg binds the Stripe session to THIS plan",
    /session\?\.metadata\?\.servicePlanId !== planId/.test(read("lib/servicePlans/authorisation.js")));
}

{
  // Money terms are frozen. Both halves: the API refuses, and the UI says so.
  const detail = read("app/api/service-plans/[id]/route.js");
  ok("PATCH refuses a change to any money term",
    /frozen/.test(detail) && /amountPerOccurrence/.test(detail) && /status: 400/.test(detail));
  ok("  ^ and refuses out loud rather than dropping the field silently",
    /A plan's payment terms can't be changed/.test(detail));
}

{
  // No live Stripe call may creep into this file.
  const self = read("scripts/check-service-plans.mjs");
  ok("this check makes no live Stripe call",
    !/stripe\.(customers|paymentIntents|checkout|setupIntents|paymentMethods)\./.test(
      self.replace(/\/\/.*$/gm, ""),
    ));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n7. The client-facing emails\n");

// Built, not read. These are the two messages a homeowner actually receives,
// and both are money surfaces: one asks them to authorise a standing payment,
// the other tells them money has already been taken.
{
  const company = {
    name: "Ridgeline Exteriors", currency: "CAD", brandColor: "#ffcc00",
    phone: "555-0100", email: "hi@ridgeline.ca", paymentMethods: ["card", "e_transfer"],
  };
  const client = { name: "Dana Fielding" };
  const p = plan({ language: "en", collectionMode: "automatic" });

  for (const code of AUTHORISATION_LANGUAGES) {
    const localised = plan({ language: code, collectionMode: "automatic" });
    const terms = buildAuthorisationTerms({
      plan: localised, company,
      amounts: occurrenceAmounts(localised),
      term: termTotals(localised, 2),
    });
    const req = buildAuthorisationRequestEmail({
      plan: localised, client, company, terms, url: "https://example.test/plan/tok",
    });
    ok(`${code}: the authorisation email carries EVERY term from the page`,
      terms.bullets.every((b) => req.text.includes(b)));
    ok(`  ^ no "undefined" reaches the client`, !/undefined/.test(req.html + req.text));
    // White-label: the homeowner is dealing with the contractor, not with us.
    ok(`  ^ says nothing about FieldQuo`, !/FieldQuo/i.test(req.html + req.text));
    ok(`  ^ names the company`, req.subject.includes(company.name));
  }

  // The receipt for an automatic charge.
  const paidInvoice = {
    invoiceNumber: "INV-2026-0007", total: 225, amountPaid: 225,
    dueDate: UTC("2026-04-15"), language: "en",
  };
  const receipt = buildInvoiceEmail({
    invoice: paidInvoice, client, company, url: "https://example.test/portal/t/invoices/i",
    canTakeCard: true, kind: "paid", language: "en",
  });
  ok("a settled occurrence sends a RECEIPT, not a demand",
    /Receipt from/.test(receipt.subject) && !/due/i.test(receipt.subject), receipt.subject);
  ok("  ^ it shows the amount PAID", /Amount paid: \$225\.00/.test(receipt.text));
  ok("  ^ and offers no Pay button for a zero balance",
    !/Pay online/.test(receipt.html));
  ok("  ^ no 'undefined' from a newly added copy key",
    !/undefined/.test(receipt.html + receipt.text));

  // The guard that matters: asking for the "paid" framing on an invoice that is
  // NOT settled must fall back to asking for the money. run.js re-reads the
  // invoice after charging precisely so this branch is never needed in practice.
  const stale = buildInvoiceEmail({
    invoice: { ...paidInvoice, amountPaid: 0 }, client, company,
    url: "https://example.test", canTakeCard: true, kind: "paid", language: "en",
  });
  ok("a 'paid' email for an UNSETTLED invoice falls back to asking",
    stale.subject !== receipt.subject && /due/i.test(stale.subject), stale.subject);

  // Every language the invoice email ships in must have the new receipt copy —
  // emailCopy merges over English per key, so a gap degrades to English rather
  // than rendering "undefined" at a client.
  for (const code of SUPPORTED_EMAIL_LANGUAGES) {
    const m = buildInvoiceEmail({
      invoice: { ...paidInvoice, language: code }, client, company,
      url: "https://example.test", canTakeCard: true, kind: "paid", language: code,
    });
    ok(`  ^ ${code} receipt renders with no undefined`, !/undefined/.test(m.html + m.text));
  }
  const unknown = buildInvoiceEmail({
    invoice: { ...paidInvoice, language: "zz" }, client, company,
    url: "https://example.test", canTakeCard: true, kind: "paid", language: "zz",
  });
  ok("  ^ an unknown language falls back to English rather than breaking",
    !/undefined/.test(unknown.html + unknown.text));
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) {
  console.error(`${failures} FAILED`);
  process.exit(1);
}
