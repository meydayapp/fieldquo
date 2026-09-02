// scripts/check-change-order-money.mjs
//
//   npm run check:change-order-money
//
// A change order's price must reach a total. It didn't.
//
// ══ The bug this file is the regression proof for ═══════════════════════════
//
// ChangeOrder shipped complete-looking: a model, a route, a working form on the
// job page, a KPI. A contractor could record $3,000 of agreed extra work and
// see it on screen. Then:
//
//   * job costing computed `revenue: job.quote?.total` and nothing else, so the
//     margin on every job was wrong by the value of every agreed change;
//   * no file under lib/invoices/, lib/documentSections/ or app/api/invoices/
//     mentioned changeOrder at all, so agreed work was never billed;
//   * `raw.totalPriceDelta` was summed in lib/analytics/kpis.js and read by one
//     test script and nothing else.
//
// That is AGENTS.md's most emphasised failure with money attached: a control
// that appears to work, and a number that goes nowhere.
//
// ══ What is EXECUTED, and what is only read ════════════════════════════════
//
// Every figure runs, against hostile input: no change orders, one approved, one
// pending, one rejected, a negative delta (a credit), several summing past the
// quote, a change order on a job with NO quote, and a priceDelta that is null,
// NaN, a string or absent. Most of the real bugs in this repo were found that
// way and not by reading.
//
// What cannot be executed — "does the costing route pass the contract value
// rather than the quote", "does the bill route re-read inside its transaction"
// — is matched against source with comments stripped, and EVERY positional rule
// is scoped to ONE named function pulled out by brace matching. A guard string
// appearing elsewhere in the same file must not manufacture a pass.
//
// And note `src.indexOf(a) < src.indexOf(b)` is a FALSE PASS when `a` is
// absent: indexOf returns -1, which is less than everything. That exact bug was
// found in three checks in this project on one day. `orderedIn` below refuses
// unless BOTH strings are present.
//
// ══ The properties, in the order they move money ═══════════════════════════
//
//   1. Only an APPROVED change order is money. Pending, rejected and
//      unrecognised affect no total anywhere.
//   2. The job panel shows quoted + changes = contract value as THREE figures.
//      A single blended number hides that the job grew.
//   3. Unknown plus something is unknown. A job with no quote has no contract
//      value, even with $500 of agreed changes against it.
//   4. Billing is explicit, one invoice, once. The tax rate the document
//      already charged is the rate the added work is charged at.
//   5. The KPI's dollar figure and the job page's dollar figure come from the
//      same function, so they cannot disagree.

import { readFileSync, writeFileSync, cpSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import {
  CHANGE_ORDER_STATUSES,
  CHANGE_ORDER_CREATE_STATUSES,
  billChangeOrders,
  changeOrderStatus,
  changeOrderSummary,
  contractValue,
  isApprovedChangeOrder,
  isBillableChangeOrder,
  paymentScheduleShortfall,
} from "@/lib/jobs/changeOrderValue";
import { buildChangeOrderRate } from "@/lib/analytics/kpis";
import { compareJobCost } from "@/lib/costing/actualJobCost";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
const fails = [];
/** Returns the verdict — load-bearing, so `if (!ok(...)) return` can short-circuit. */
function ok(name, condition, got) {
  if (condition) {
    pass++;
    return true;
  }
  fails.push(name);
  console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  return false;
}
const eq = (name, got, want) =>
  ok(name, JSON.stringify(got) === JSON.stringify(want), got);
const section = (title) => console.log(`\n${title}`);

// ── Source helpers ─────────────────────────────────────────────────────────

/** A guard named in a comment is not a guard. */
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const read = (relative) => stripComments(readFileSync(join(ROOT, relative), "utf8"));

/**
 * The body of ONE named function, by brace matching. Walks the parameter list
 * to its closing paren first — taking the next `{` after the name lands on the
 * destructuring brace of `POST(request, { params })` and matches a two-word
 * "body" every assertion then passes against for the wrong reason.
 *
 * Handles `export default function Name(` too, which the JobCosting component
 * needs.
 */
function functionBody(src, name) {
  const start = src.search(
    new RegExp(`(export\\s+)?(default\\s+)?(async\\s+)?function\\s+${name}\\s*\\(`),
  );
  if (start === -1) return null;
  const paren = src.indexOf("(", start);
  if (paren === -1) return null;
  let parens = 0;
  let afterParams = -1;
  for (let i = paren; i < src.length; i++) {
    if (src[i] === "(") parens++;
    else if (src[i] === ")") {
      parens--;
      if (parens === 0) {
        afterParams = i;
        break;
      }
    }
  }
  if (afterParams === -1) return null;
  const open = src.indexOf("{", afterParams);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

/**
 * "a appears before b" — but ONLY when both actually appear.
 *
 * `src.indexOf(a) < src.indexOf(b)` reads correctly and passes when `a` is
 * missing entirely, because indexOf returns -1. That is the exact false pass
 * that got three checks in this repo shipped green over deleted guards.
 */
function orderedIn(body, a, b) {
  if (typeof body !== "string") return false;
  const ia = body.indexOf(a);
  const ib = body.indexOf(b);
  return ia !== -1 && ib !== -1 && ia < ib;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Only an approved change order is money
// ═══════════════════════════════════════════════════════════════════════════

section("1. Status decides whether a number is money at all");

eq("the closed set is exactly three", CHANGE_ORDER_STATUSES, [
  "pending",
  "approved",
  "rejected",
]);
eq("the form may only create two of them", CHANGE_ORDER_CREATE_STATUSES, [
  "approved",
  "pending",
]);
ok("`rejected` is never offered at creation — a refusal nobody made is not a record",
  !CHANGE_ORDER_CREATE_STATUSES.includes("rejected"));

// The legacy rule, stated as an assertion rather than as prose: rows written
// before the column existed carry no status, and the model's documented
// meaning was "logged means already agreed".
eq("no status at all reads as approved (rows that predate the column)",
  changeOrderStatus({ priceDelta: 100 }), "approved");
eq("an explicit null reads as approved for the same reason",
  changeOrderStatus({ priceDelta: 100, status: null }), "approved");
eq("an empty string reads as approved", changeOrderStatus({ status: "" }), "approved");
// PRESENT but unknown is a different fact from ABSENT, and the money-safe
// reading is "affects nothing".
eq("a status nobody has heard of is NOT approved",
  changeOrderStatus({ status: "agreed-ish" }), "unrecognised");
eq("...nor is a numeric one", changeOrderStatus({ status: 1 }), "unrecognised");
eq("...nor is the capitalised spelling", changeOrderStatus({ status: "Approved" }), "unrecognised");
ok("isApprovedChangeOrder agrees with changeOrderStatus on every input above",
  [
    {},
    { status: null },
    { status: "" },
    { status: "approved" },
    { status: "pending" },
    { status: "rejected" },
    { status: "nonsense" },
  ].every((co) => isApprovedChangeOrder(co) === (changeOrderStatus(co) === "approved")));

section("2. The four hostile shapes the brief names, executed");

eq("no change orders at all", changeOrderSummary([]), {
  counts: { approved: 0, pending: 0, rejected: 0, unrecognised: 0 },
  total: 0,
  approvedTotal: 0,
  pendingTotal: 0,
  rejectedTotal: 0,
  billedTotal: 0,
  unbilledTotal: 0,
  unbilledCount: 0,
});
eq("no argument at all behaves the same", changeOrderSummary(), changeOrderSummary([]));
eq("null behaves the same", changeOrderSummary(null), changeOrderSummary([]));
eq("a string where an array belongs behaves the same",
  changeOrderSummary("3000"), changeOrderSummary([]));

{
  const one = changeOrderSummary([{ id: "a", priceDelta: 3000, status: "approved" }]);
  eq("one approved: $3,000 of contract", one.approvedTotal, 3000);
  eq("...and it is unbilled", one.unbilledTotal, 3000);
  eq("...counted once", one.unbilledCount, 1);
}
{
  const p = changeOrderSummary([{ id: "a", priceDelta: 3000, status: "pending" }]);
  eq("one pending: nothing reaches the contract", p.approvedTotal, 0);
  eq("...but the money is still reported, on its own line", p.pendingTotal, 3000);
  eq("...and it is not billable", p.unbilledCount, 0);
}
{
  const r = changeOrderSummary([{ id: "a", priceDelta: 3000, status: "rejected" }]);
  eq("one rejected: nothing reaches the contract", r.approvedTotal, 0);
  eq("...and nothing is billable", r.unbilledTotal, 0);
  eq("...the amount is still visible so the record isn't silently blank", r.rejectedTotal, 3000);
}
{
  const u = changeOrderSummary([{ id: "a", priceDelta: 3000, status: "who-knows" }]);
  eq("an unrecognised status affects no total", [u.approvedTotal, u.pendingTotal, u.rejectedTotal], [0, 0, 0]);
  eq("...and is counted, so a screen can say one exists", u.counts.unrecognised, 1);
}

section("3. A negative delta is a credit, not an error");

{
  const credit = changeOrderSummary([
    { id: "a", priceDelta: 1200, status: "approved" },
    { id: "b", priceDelta: -450, status: "approved" },
  ]);
  eq("a credit reduces the contract", credit.approvedTotal, 750);
  eq("...and both rows are unbilled", credit.unbilledCount, 2);
  eq("a credit on its own is negative, not clamped to zero",
    changeOrderSummary([{ id: "a", priceDelta: -450, status: "approved" }]).approvedTotal,
    -450);
  eq("a job of nothing but credits has a smaller contract than its quote",
    contractValue({
      quotedTotal: 1000,
      changeOrders: [{ id: "a", priceDelta: -450, status: "approved" }],
    }).currentContractValue,
    550);
}

section("4. priceDelta that is null, NaN, a string or missing");

for (const [label, delta, want] of [
  ["null", null, 0],
  ["undefined", undefined, 0],
  ["absent entirely", Symbol.for("omit"), 0],
  ["NaN", NaN, 0],
  ["Infinity", Infinity, 0],
  ["-Infinity", -Infinity, 0],
  ['the string "abc"', "abc", 0],
  ['the empty string', "", 0],
  ['the numeric string "300"', "300", 300],
  ['the numeric string "-300"', "-300", -300],
  ["a Decimal-like object with toString", { toString: () => "42.50" }, 42.5],
]) {
  const row =
    delta === Symbol.for("omit")
      ? { id: "a", status: "approved" }
      : { id: "a", priceDelta: delta, status: "approved" };
  const s = changeOrderSummary([row]);
  eq(`${label} contributes ${want}, never NaN`, s.approvedTotal, want);
  ok(`${label} does not poison the total with NaN`, Number.isFinite(s.approvedTotal));
}
// The rows themselves can be junk. A null in the array is not a change order,
// and counting it would put a phantom in the "1 change order" sentence.
{
  const junk = changeOrderSummary([null, undefined, "x", 7, { id: "a", priceDelta: 100 }]);
  eq("junk array entries are skipped, not counted", junk.total, 1);
  eq("...and the one real row still lands", junk.approvedTotal, 100);
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. The split — three figures, never one
// ═══════════════════════════════════════════════════════════════════════════

section("5. Quoted + approved changes = contract value, kept apart");

{
  const c = contractValue({
    quotedTotal: 10000,
    changeOrders: [
      { id: "a", priceDelta: 3000, status: "approved" },
      { id: "b", priceDelta: 900, status: "pending" },
      { id: "c", priceDelta: 500, status: "rejected" },
    ],
  });
  eq("the quote is still visible on its own", c.quotedTotal, 10000);
  eq("the changes are visible on their own", c.approvedChanges, 3000);
  eq("and the sum is a third figure", c.currentContractValue, 13000);
  ok("the split is three separate keys, not one blended number",
    "quotedTotal" in c && "approvedChanges" in c && "currentContractValue" in c);
  ok("...and the third is exactly the sum of the first two",
    c.currentContractValue === c.quotedTotal + c.approvedChanges);
  eq("the pending $900 is NOT in the contract value", c.currentContractValue, 13000);
  eq("...and the rejected $500 is not either", c.summary.approvedTotal, 3000);
}

{
  // "Several summing to more than the quote" — the brief's own case.
  const c = contractValue({
    quotedTotal: 2000,
    changeOrders: [
      { id: "a", priceDelta: 1500, status: "approved" },
      { id: "b", priceDelta: 1200, status: "approved" },
      { id: "c", priceDelta: 800, status: "approved" },
    ],
  });
  eq("changes can exceed the quote — nothing clamps them", c.currentContractValue, 5500);
  ok("...and the quote is still legible underneath", c.quotedTotal === 2000);
  // This is the whole reason the panel shows a split: 5500 on its own would
  // read as "we quoted 5500", which is not what happened.
  ok("the changes alone exceed the quote and remain separately readable",
    c.approvedChanges > c.quotedTotal);
}

section("6. A change order on a job with NO quote");

{
  const c = contractValue({
    quotedTotal: null,
    changeOrders: [{ id: "a", priceDelta: 500, status: "approved" }],
  });
  eq("the changes are still real money", c.approvedChanges, 500);
  eq("the quoted total is unknown, not zero", c.quotedTotal, null);
  eq("...so it is flagged unknown rather than defaulted", c.quotedTotalKnown, false);
  // Absence of a statement is not a statement (AGENTS.md). Returning 500 here
  // would state a contract value nobody ever agreed, and compareJobCost would
  // then print a margin percentage against it.
  eq("unknown plus $500 is still unknown", c.currentContractValue, null);
  eq("...and the margin stays null rather than becoming 100%",
    compareJobCost({ revenue: c.currentContractValue, actualCost: 200 }).marginPct, null);
  eq("...and so does the profit", compareJobCost({ revenue: c.currentContractValue, actualCost: 200 }).profit, null);
}
eq("undefined is unknown too", contractValue({ changeOrders: [] }).currentContractValue, null);
eq("a quote genuinely totalling ZERO is a real statement and stays one",
  contractValue({
    quotedTotal: 0,
    changeOrders: [{ id: "a", priceDelta: 500, status: "approved" }],
  }).currentContractValue,
  500);
eq("a non-numeric quoted total is unknown, not zero",
  contractValue({ quotedTotal: "not a number", changeOrders: [] }).currentContractValue, null);
eq("no arguments at all", contractValue().currentContractValue, null);

section("7. Float dust does not leak into a contract value");

eq("0.1 + 0.2 arithmetic is rounded once, at the end",
  contractValue({
    quotedTotal: 0.1,
    changeOrders: [{ id: "a", priceDelta: 0.2, status: "approved" }],
  }).currentContractValue,
  0.3);
eq("a long tail of cents stays cents",
  changeOrderSummary([
    { id: "a", priceDelta: 33.33, status: "approved" },
    { id: "b", priceDelta: 33.33, status: "approved" },
    { id: "c", priceDelta: 33.34, status: "approved" },
  ]).approvedTotal,
  100);

// ═══════════════════════════════════════════════════════════════════════════
// 8. Billing: explicit, once, at the rate the document already charged
// ═══════════════════════════════════════════════════════════════════════════

section("8. Putting approved changes on the invoice");

const DRAFT = {
  id: "inv1",
  invoiceNumber: "INV-2026-0008",
  status: "draft",
  lineItems: [{ description: "Painting: walls", quantity: 1, amount: 1000 }],
  subtotal: 1000,
  discount: 0,
  tax: 130,
  taxEnabled: true,
  total: 1130,
};

{
  const r = billChangeOrders({
    invoice: DRAFT,
    changeOrders: [
      { id: "co1", description: "Add a subpanel", priceDelta: 3000, status: "approved" },
      { id: "co2", description: "Not agreed yet", priceDelta: 999, status: "pending" },
      { id: "co3", description: "Turned down", priceDelta: 777, status: "rejected" },
    ],
  });
  ok("a draft invoice takes the approved change", r.ok);
  eq("exactly one line is added", r.newLineItems.length, 1);
  eq("...and the existing line survives", r.lineItems.length, 2);
  eq("the added money is the approved delta only", r.added, 3000);
  eq("subtotal grows by exactly that", r.subtotal, 4000);
  // The invariant that makes this safe: the rate on the document does not move.
  eq("tax is charged at the rate the invoice ALREADY used (13%)", r.tax, 520);
  eq("total = subtotal - discount + tax", r.total, 4520);
  ok("the effective rate before and after is identical",
    Math.abs(130 / 1000 - r.tax / r.subtotal) < 1e-9);
  eq("the line carries its provenance so the invoice can say where it came from",
    r.newLineItems[0].changeOrderId, "co1");
  eq("...and the ids come back for the write", r.changeOrderIds, ["co1"]);
  eq("a pending change order is not billed", r.lineItems.some((li) => li.changeOrderId === "co2"), false);
  eq("a rejected change order is not billed", r.lineItems.some((li) => li.changeOrderId === "co3"), false);
}

{
  // A discount sits between subtotal and tax, so the rate is read off the
  // POST-discount base or every discounted invoice would be taxed wrongly.
  const withDiscount = { ...DRAFT, discount: 200, tax: 104, total: 904 };
  const r = billChangeOrders({
    invoice: withDiscount,
    changeOrders: [{ id: "co1", description: "Extra", priceDelta: 3000, status: "approved" }],
  });
  eq("the rate is read off subtotal MINUS discount", r.effectiveTaxRate, 0.13);
  eq("tax on the new post-discount base", r.tax, 494);
  eq("total", r.total, 4294);
}

{
  const noTax = { ...DRAFT, taxEnabled: false, tax: 0, total: 1000 };
  const r = billChangeOrders({
    invoice: noTax,
    changeOrders: [{ id: "co1", description: "Extra", priceDelta: 3000, status: "approved" }],
  });
  eq("an invoice raised with tax OFF stays off", r.tax, 0);
  eq("...and its total is just the work", r.total, 4000);
  eq("...and no rate is invented", r.effectiveTaxRate, 0);
}

{
  // Degenerate: tax is owed but there is no base it could have been charged on.
  // Guessing a rate here would move real money on a guess.
  const broken = { ...DRAFT, subtotal: 0, discount: 0, tax: 130, total: 130 };
  const r = billChangeOrders({
    invoice: broken,
    changeOrders: [{ id: "co1", description: "Extra", priceDelta: 3000, status: "approved" }],
  });
  eq("an underivable rate is refused, not guessed", [r.ok, r.reason], [false, "tax_rate_underivable"]);
  eq("...and nothing is added", r.added, 0);
}

{
  const alreadyBilled = billChangeOrders({
    invoice: DRAFT,
    changeOrders: [
      { id: "co1", description: "Extra", priceDelta: 3000, status: "approved", invoiceId: "inv1" },
    ],
  });
  eq("a change order already linked to an invoice is not billed twice",
    [alreadyBilled.ok, alreadyBilled.reason], [false, "nothing_to_bill"]);
  ok("isBillableChangeOrder is the single rule behind that",
    !isBillableChangeOrder({ status: "approved", invoiceId: "inv1" }) &&
      isBillableChangeOrder({ status: "approved" }) &&
      !isBillableChangeOrder({ status: "pending" }));
}

{
  // The link column could be missing while the line is already on the
  // document — a half-committed write, or a hand-edited invoice. The
  // description alone would not catch it; the changeOrderId key does.
  const invoiceCarryingTheLine = {
    ...DRAFT,
    lineItems: [
      ...DRAFT.lineItems,
      { description: "Add a subpanel", quantity: 1, amount: 3000, changeOrderId: "co1" },
    ],
    subtotal: 4000,
    tax: 520,
    total: 4520,
  };
  const r = billChangeOrders({
    invoice: invoiceCarryingTheLine,
    changeOrders: [{ id: "co1", description: "Add a subpanel", priceDelta: 3000, status: "approved" }],
  });
  eq("a line already on the document is not added a second time",
    [r.ok, r.reason], [false, "already_on_invoice"]);
}

{
  const r = billChangeOrders({ invoice: DRAFT, changeOrders: [] });
  eq("nothing to bill is a refusal, not an empty write",
    [r.ok, r.reason], [false, "nothing_to_bill"]);
  eq("no invoice at all is refused", billChangeOrders({ changeOrders: [] }).reason, "no_invoice");
  eq("no arguments at all is refused", billChangeOrders().reason, "no_invoice");
  eq("junk change-order rows are skipped, and an empty set refuses",
    billChangeOrders({ invoice: DRAFT, changeOrders: [null, "x", 3] }).reason, "nothing_to_bill");
}

{
  // A credit billed onto an invoice REDUCES it. Nothing clamps at zero, and
  // the tax follows the smaller base.
  const r = billChangeOrders({
    invoice: DRAFT,
    changeOrders: [{ id: "co1", description: "Removed the trim", priceDelta: -500, status: "approved" }],
  });
  eq("a credit line is negative on the invoice", r.newLineItems[0].amount, -500);
  eq("subtotal falls", r.subtotal, 500);
  eq("tax falls with it", r.tax, 65);
  eq("total", r.total, 565);
}

{
  const r = billChangeOrders({
    invoice: DRAFT,
    changeOrders: [{ id: "co1", description: "   ", priceDelta: 100, status: "approved" }],
  });
  eq("a blank description gets a real label rather than an empty invoice line",
    r.newLineItems[0].description, "Change order");
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. Payment stages are NOT recomputed — and the gap is stated
// ═══════════════════════════════════════════════════════════════════════════

section("9. The frozen payment schedule, and saying so");

{
  const stages = [
    { id: "s1", seq: 0, amountCents: 300000, status: "requested" },
    { id: "s2", seq: 1, amountCents: 700000, status: "pending" },
  ];
  const g = paymentScheduleShortfall({
    stages,
    changeOrders: [{ id: "a", priceDelta: 3000, status: "approved" }],
  });
  eq("the stages still add to the accepted total, untouched", g.stagedCents, 1000000);
  eq("the approved change is reported in the same unit", g.approvedChangeCents, 300000);
  ok("...and the screen is told to say so", g.applies);
  // The point of the whole section: nothing here writes amountCents.
  eq("no stage amount was altered", stages.map((s) => s.amountCents), [300000, 700000]);
}
ok("a job with no schedule has no shortfall to report",
  !paymentScheduleShortfall({ stages: [], changeOrders: [{ priceDelta: 3000, status: "approved" }] }).applies);
ok("a schedule with no approved changes has nothing to say either",
  !paymentScheduleShortfall({
    stages: [{ amountCents: 100 }],
    changeOrders: [{ priceDelta: 3000, status: "pending" }],
  }).applies);
ok("a credit is a gap in the other direction and is still worth saying",
  paymentScheduleShortfall({
    stages: [{ amountCents: 100 }],
    changeOrders: [{ priceDelta: -3000, status: "approved" }],
  }).applies);
eq("no arguments at all", paymentScheduleShortfall().applies, false);
eq("junk stages contribute no cents, not NaN",
  paymentScheduleShortfall({ stages: [null, {}, { amountCents: "x" }], changeOrders: [] }).stagedCents, 0);

// ═══════════════════════════════════════════════════════════════════════════
// 10. The KPI and the job page must not be two opinions
// ═══════════════════════════════════════════════════════════════════════════

section("10. buildChangeOrderRate agrees with the same summing function");

{
  // The pre-existing fixture shape in scripts/check-kpis.mjs: no `status` key
  // at all. Its documented meaning is "already agreed", so the KPI's dollar
  // figure must be unchanged by this work.
  const legacyJobs = Array.from({ length: 10 }, (_, i) => ({
    id: `j${i}`,
    changeOrders:
      i === 0
        ? [{ priceDelta: 250 }, { priceDelta: 100 }]
        : i === 1
          ? [{ priceDelta: 250 }]
          : [],
  }));
  const r = buildChangeOrderRate({ jobs: legacyJobs });
  eq("legacy statusless fixtures still total $600", r.raw.totalPriceDelta, 600);
  eq("...and the rate is still 20%", r.value, 20);
  eq("...and the row count is unchanged", r.raw.totalChangeOrders, 3);
}
{
  const jobs = [
    { id: "j1", changeOrders: [{ priceDelta: 1000, status: "approved" }] },
    { id: "j2", changeOrders: [{ priceDelta: 5000, status: "rejected" }] },
    { id: "j3", changeOrders: [{ priceDelta: 400, status: "pending" }] },
  ];
  const r = buildChangeOrderRate({ jobs });
  eq("the KPI's dollar figure counts APPROVED money only", r.raw.totalPriceDelta, 1000);
  // The parity assertion. If either side grows its own opinion, this breaks.
  const viaHelper = jobs.reduce(
    (s, j) => s + changeOrderSummary(j.changeOrders).approvedTotal,
    0,
  );
  eq("...exactly what the job page's own helper would say", r.raw.totalPriceDelta, viaHelper);
  eq("the RATE still counts a job with any change order, agreed or not",
    r.raw.jobsWithChangeOrder, 3);
}

// ═══════════════════════════════════════════════════════════════════════════
// 11. Source rules — every one scoped to ONE brace-matched function
// ═══════════════════════════════════════════════════════════════════════════

section("11. The wiring, read from source (comments stripped, per function)");

{
  const src = read("app/api/jobs/[id]/costing/route.js");
  const body = functionBody(src, "GET");
  if (ok("costing route: GET body found", body !== null)) {
    ok("costing GET calls contractValue", body.includes("contractValue({"));
    ok("costing GET passes the CONTRACT value as revenue, not the quote",
      body.includes("revenue: contract.currentContractValue"));
    ok("costing GET no longer passes the bare quote total as revenue",
      !body.includes("revenue: job.quote?.total"));
    ok("costing GET loads change orders WITH their status",
      body.includes("changeOrders: { select:") && body.includes("status: true"));
    ok("costing GET returns the split for the panel to render",
      body.includes("contract,"));
    ok("contractValue is computed BEFORE compareJobCost consumes it",
      orderedIn(body, "contractValue({", "compareJobCost({"));
  }
}

{
  const src = read("app/components/jobs/JobCosting.js");
  const body = functionBody(src, "JobCosting");
  if (ok("JobCosting: component body found", body !== null)) {
    // The split, visible rather than blended — the brief's own requirement.
    for (const key of [
      "app.jobCosting.quotedTotal",
      "app.jobCosting.approvedChanges",
      "app.jobCosting.contractValue",
    ]) {
      ok(`JobCosting renders "${key}" as its own figure`, body.includes(key));
    }
    ok("JobCosting reads the split off the payload rather than re-deriving it",
      body.includes("data.contract"));
    ok("the split renders only when there ARE changes — no +$0.00 on every job",
      body.includes("hasChanges &&"));
    ok("hasChanges is computed before it gates anything",
      orderedIn(body, "const hasChanges", "hasChanges &&"));
    ok("an unknown quoted total says so rather than printing a zero",
      body.includes("app.jobCosting.noQuote"));
  }
}

{
  const src = read("app/api/jobs/[id]/change-orders/bill/route.js");
  const post = functionBody(src, "POST");
  if (ok("bill route: POST body found", post !== null)) {
    ok("POST refuses when the pre-flight state says it cannot bill",
      post.includes("if (!state.canBill)"));
    ok("POST re-reads the invoice INSIDE the transaction",
      orderedIn(post, "db.$transaction", "tx.invoice.findFirst"));
    ok("POST re-checks draft status on the fresh row, not the one the GET rendered",
      post.includes('fresh.status !== "draft"'));
    ok("POST re-reads the change orders inside the transaction too",
      orderedIn(post, "db.$transaction", "tx.changeOrder.findMany"));
    ok("the change orders are marked billed in the SAME transaction as the lines",
      orderedIn(post, "tx.invoice.update", "tx.changeOrder.updateMany"));
    ok("the money written comes from billChangeOrders, not from the request",
      post.includes("billChangeOrders({ invoice: fresh"));
    ok("the balance is re-derived through computeInvoiceState, not adjusted by hand",
      post.includes("computeInvoiceState({"));
    ok("nothing in POST reads an amount off the request body",
      !post.includes("request.json()"));
  }
  const state = functionBody(src, "billingState");
  if (ok("bill route: billingState body found", state !== null)) {
    ok("a sent invoice is refused with a reason the screen can print",
      state.includes('"invoice_sent"'));
    ok("no invoice at all is its own reason", state.includes('"no_invoice"'));
    ok("the confirmation numbers are computed here, before anything moves",
      state.includes("preview:"));
  }
}

{
  const src = read("app/api/jobs/[id]/change-orders/[changeOrderId]/route.js");
  const body = functionBody(src, "PATCH");
  if (ok("change-order PATCH body found", body !== null)) {
    ok("a billed change order cannot change status", body.includes("if (existing.invoiceId)"));
    ok("...and that check happens before the update",
      orderedIn(body, "if (existing.invoiceId)", "db.changeOrder.update"));
    ok("the status is validated against the closed set",
      body.includes("CHANGE_ORDER_STATUSES.includes(status)"));
    // Append-only survives: only the status may move.
    ok("PATCH never writes description", !body.includes("description:"));
    ok("PATCH never writes priceDelta", !body.includes("priceDelta:"));
    ok("the change order is scoped to THIS job, not looked up by id alone",
      body.includes("jobId: job.id"));
    ok("showPricing gates deciding money, same as logging it",
      body.includes('requireToggle(full, "showPricing"'));
  }
}

{
  const src = read("lib/analytics/kpis.js");
  const body = functionBody(src, "buildChangeOrderRate");
  if (ok("buildChangeOrderRate body found", body !== null)) {
    ok("the KPI sums through the shared helper", body.includes("changeOrderSummary("));
    ok("...and has no second opinion of its own", !body.includes("num(co?.priceDelta)"));
  }
}

{
  const src = read("app/app/jobs/[id]/PaymentScheduleCard.js");
  const body = functionBody(src, "PaymentScheduleCard");
  if (ok("PaymentScheduleCard body found", body !== null)) {
    ok("the card computes the shortfall", body.includes("paymentScheduleShortfall({"));
    ok("...and says so on screen", body.includes("app.job.paymentSchedule.changeOrderNote"));
    // The load-bearing negative: this component must not write stage amounts.
    ok("nothing here recomputes amountCents", !body.includes("amountCents ="));
  }
}

{
  // The frozen decision, checked where it is actually enforced: no code
  // anywhere writes JobPaymentStage.amountCents from a change order.
  const engine = read("lib/paymentSchedule/engine.js");
  ok("the payment-schedule engine knows nothing about change orders",
    !engine.includes("changeOrder") && !engine.includes("ChangeOrder"));
}

// ═══════════════════════════════════════════════════════════════════════════
// 12. Mutation pass — every guarantee above must be load-bearing
// ═══════════════════════════════════════════════════════════════════════════

const MUTATING = !process.argv.includes("--no-mutate");
if (!MUTATING) {
  console.log(
    fails.length
      ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
      : `\nPASSED — ${pass}/${pass} assertions`,
  );
  process.exit(fails.length ? 1 : 0);
}

console.log("\n12. Mutation pass — break each guarantee, confirm it is caught\n");

const SELF = fileURLToPath(import.meta.url);
const LOADER = fileURLToPath(new URL("./alias-loader.mjs", import.meta.url));
const LIB = join(ROOT, "lib/jobs/changeOrderValue.js");

// A directory unique to THIS run. Never `git checkout` — that restores the
// last commit, not the working file, and this repo has lost uncommitted work
// to exactly that.
const backupDir = mkdtempSync(join(tmpdir(), "change-order-money-"));
const BACKUP = join(backupDir, "changeOrderValue.js.bak");
cpSync(LIB, BACKUP);
const ORIGINAL = readFileSync(BACKUP, "utf8");

const MUTATIONS = [
  [
    "reads every status as approved, so a pending change order reaches the contract",
    (s) => s.replace(
      '  if (raw === undefined || raw === null || raw === "") return "approved";\n  return CHANGE_ORDER_STATUSES.includes(raw) ? raw : "unrecognised";',
      '  if (raw === undefined || raw === null || raw === "") return "approved";\n  return CHANGE_ORDER_STATUSES.includes(raw) ? "approved" : "unrecognised";',
    ),
  ],
  [
    "treats an unrecognised status as approved",
    (s) => s.replace(
      'return CHANGE_ORDER_STATUSES.includes(raw) ? raw : "unrecognised";',
      'return CHANGE_ORDER_STATUSES.includes(raw) ? raw : "approved";',
    ),
  ],
  [
    "folds rejected money into the approved total",
    (s) => s.replace(
      '    } else if (status === "pending") pendingTotal += delta;\n    else if (status === "rejected") rejectedTotal += delta;',
      '    } else if (status === "pending") pendingTotal += delta;\n    else if (status === "rejected") { rejectedTotal += delta; approvedTotal += delta; }',
    ),
  ],
  [
    "states a contract value for a job that never had a quote",
    (s) => s.replace(
      "    currentContractValue: known ? round2(quoted + summary.approvedTotal) : null,",
      "    currentContractValue: round2((quoted || 0) + summary.approvedTotal),",
    ),
  ],
  [
    "blends the split away — contract value ignores the changes",
    (s) => s.replace(
      "    currentContractValue: known ? round2(quoted + summary.approvedTotal) : null,",
      "    currentContractValue: known ? quoted : null,",
    ),
  ],
  [
    "lets a non-numeric priceDelta poison every total with NaN",
    (s) => s.replace(
      "const num = (v) => {\n  const n = Number(v);\n  return Number.isFinite(n) ? n : 0;\n};",
      "const num = (v) => Number(v);",
    ),
  ],
  [
    "forgets that a billed change order is already billed, so it bills again",
    (s) => s.replace(
      "  return isApprovedChangeOrder(co) && !co?.invoiceId;",
      "  return isApprovedChangeOrder(co);",
    ),
  ],
  [
    "charges no tax on billed change orders",
    (s) => s.replace(
      "  const newTax = round2(rate * round2(newSubtotal - discount));",
      "  const newTax = round2(tax);",
    ),
  ],
  [
    "guesses a tax rate on an invoice that cannot supply one",
    (s) => s.replace(
      '    if (base <= 0) return refuse("tax_rate_underivable");\n    rate = tax / base;',
      "    rate = base <= 0 ? 0.13 : tax / base;",
    ),
  ],
  [
    "drops the changeOrderId provenance key, disarming the double-add guard",
    (s) => s.replace("    changeOrderId: co.id,\n  }));", "  }));"),
  ],
  [
    "reports a schedule shortfall on a job that has no schedule",
    (s) => s.replace(
      "    applies: rows.length > 0 && approvedChangeCents !== 0,",
      "    applies: approvedChangeCents !== 0,",
    ),
  ],
  [
    "stops rounding, letting float dust into every money figure",
    (s) => s.replace("const round2 = (n) => Math.round(n * 100) / 100;", "const round2 = (n) => n;"),
  ],
];

let caught = 0;
const escaped = [];
try {
  for (const [label, mutate] of MUTATIONS) {
    const mutated = mutate(ORIGINAL);
    if (mutated === ORIGINAL) {
      escaped.push(`${label} — the mutation did not apply (the source moved under it)`);
      continue;
    }
    writeFileSync(LIB, mutated);
    let survived = false;
    try {
      execFileSync(process.execPath, ["--import", LOADER, SELF, "--no-mutate"], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      survived = true;
    } catch {
      /* non-zero exit = the mutant was caught, which is the point */
    }
    // Restored from the backup FILE, immediately, whatever happened.
    cpSync(BACKUP, LIB);
    if (survived) escaped.push(`${label} — NOT caught`);
    else {
      caught++;
      console.log(`  ✓ caught: ${label}`);
    }
  }
} finally {
  cpSync(BACKUP, LIB);
  rmSync(backupDir, { recursive: true, force: true });
}

ok(`all ${MUTATIONS.length} mutants caught`, escaped.length === 0, escaped.join(" | "));
pass += caught;

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions — a change order reaches the total`,
);
process.exit(fails.length ? 1 : 0);
