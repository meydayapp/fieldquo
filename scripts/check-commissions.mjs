// scripts/check-commissions.mjs
//
//   npm run check:commissions
//
// Executes the commission engine — lib/commissions/compute.js (the maths),
// lib/commissions/sync.js (the ledger, against an in-memory database that
// enforces the same unique index Postgres does) and lib/commissions/access.js
// (who sees what) — against the cases the owner named: revenue vs gross-profit
// basis, the item's rate beating the member's, splits summing to 100, a
// partial payment, a refund reversing, rounding to the cent, two workers and
// one seller on one job, a replayed payment webhook, and RBAC per preset.
//
// Nothing here reads source text to decide a behaviour; every assertion runs
// the function. The few source reads at the end prove the hooks are WIRED —
// a correct function nothing calls is the failure this repo keeps finding.

import fs from "node:fs";
import {
  computeJobCommissions,
  familyLines,
  paidFraction,
  grossProfitRatio,
  evenSplits,
  rateFor,
  normaliseEarners,
  defaultEarners,
  ledgerDeltas,
  lineKey,
  toCents,
  fromCents,
} from "@/lib/commissions/compute";
import { syncJobCommissions } from "@/lib/commissions/sync";
import { syncCommissionsForInvoice } from "@/lib/commissions/hook";
import { commissionAccess, visibleEarners, canConfigureCommissions } from "@/lib/commissions/access";
import { PERMISSION_PRESETS } from "@/lib/permissions";
import { lineFromProduct } from "@/lib/quotes/lineDetail";

let passed = 0;
let failed = 0;
function ok(label, cond, detail) {
  if (cond) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
  }
}
const section = (t) => console.log(`\n${t}`);
const eq = (label, got, want) => ok(label, got === want, { got, want });
const earner = (e) => e;
const find = (r, memberId, role) => r.earners.find((e) => e.memberId === memberId && e.role === role);

// ───────────────────────────────────────────────────────────────────────────
section("A — revenue basis, the plain case");
{
  const r = computeJobCommissions({
    basis: "revenue",
    families: [{ rootId: "inv1", total: 1130, amountPaid: 1130, discount: 0, lineItems: [{ description: "Repaint", amount: 1000 }] }],
    earners: [earner({ memberId: "w1", role: "worked", memberPct: 10, splitPct: 100 })],
  });
  eq("10% of a $1,000 line (tax is never in the basis)", find(r, "w1", "worked").earnedCents, 10000);
  eq("paid in full: earned = potential", find(r, "w1", "worked").potentialCents, 10000);
  eq("revenue is the pre-tax, post-discount line total", r.revenue, 1000);
  eq("no margin is reported on the revenue basis", r.grossProfitRatio, null);
}

section("B — gross-profit basis");
{
  const fam = [{ rootId: "inv1", total: 1000, amountPaid: 1000, discount: 0, lineItems: [{ description: "Repaint", amount: 1000 }] }];
  const r = computeJobCommissions({ basis: "gross_profit", families: fam, cost: 600, earners: [{ memberId: "w1", role: "worked", memberPct: 10, splitPct: 100 }] });
  eq("GP ratio (1000 − 600) ÷ 1000 = 0.4", r.grossProfitRatio, 0.4);
  eq("10% of $400 gross profit = $40", find(r, "w1", "worked").earnedCents, 4000);
  const loss = computeJobCommissions({ basis: "gross_profit", families: fam, cost: 1400, earners: [{ memberId: "w1", role: "worked", memberPct: 10, splitPct: 100 }] });
  eq("a job that lost money pays $0, never a negative commission", find(loss, "w1", "worked").earnedCents, 0);
  eq("grossProfitRatio: no revenue is 0, not 100%", grossProfitRatio({ revenue: 0, cost: 0 }), 0);
  eq("grossProfitRatio: junk cost is 0 cost", grossProfitRatio({ revenue: 100, cost: "abc" }), 1);
  const same = computeJobCommissions({ basis: "revenue", families: fam, cost: 600, earners: [{ memberId: "w1", role: "worked", memberPct: 10, splitPct: 100 }] });
  eq("…and the same job on the revenue basis ignores cost entirely", find(same, "w1", "worked").earnedCents, 10000);
}

section("C — the item's rate beats the member's");
{
  const products = new Map([
    ["p_cab", { commissionable: true, workedByPct: 5, soldByPct: null }],
    ["p_permit", { commissionable: false, workedByPct: 50, soldByPct: 50 }],
  ]);
  eq("item override wins", rateFor({ role: "worked", memberPct: 10, product: products.get("p_cab") }).pct, 5);
  eq("…and says where it came from", rateFor({ role: "worked", memberPct: 10, product: products.get("p_cab") }).source, "item");
  eq("item with no sold-by rate → the member's", rateFor({ role: "sold", memberPct: 3, product: products.get("p_cab") }).pct, 3);
  eq("not commissionable pays nobody, whatever its rates say", rateFor({ role: "worked", memberPct: 10, product: products.get("p_permit") }).pct, 0);
  eq("no rate anywhere is 0 and says 'none'", rateFor({ role: "worked", memberPct: null, product: null }).source, "none");
  eq("an item override of 0 is a rate of 0, not 'use the member'", rateFor({ role: "worked", memberPct: 10, product: { workedByPct: 0 } }).pct, 0);
  const r = computeJobCommissions({
    families: [{ rootId: "inv1", total: 1500, amountPaid: 1500, lineItems: [
      { description: "Cabinets", amount: 1000, productId: "p_cab" },
      { description: "Permit", amount: 300, productId: "p_permit" },
      { description: "Hand-typed extra", amount: 200 },
    ] }],
    earners: [{ memberId: "w1", role: "worked", memberPct: 10, splitPct: 100 }],
    products,
  });
  // 1000 × 5% + 300 × 0 + 200 × 10% = 50 + 0 + 20
  eq("per line: item 5% on $1,000 + permit 0 + member 10% on $200 = $70", find(r, "w1", "worked").earnedCents, 7000);
  const tpl = { description: "Wall prep", amount: 400, meta: { template: { productId: "p_cab" } } };
  eq("a template line is tied to its item through meta.template.productId", lineKey(tpl), "p:p_cab");
  eq("lineFromProduct now carries the item's id", lineFromProduct({ id: "p_cab", name: "Cabinets", unitPrice: 10 }, {}).productId, "p_cab");
  ok("…and a product with no id adds no key", !("productId" in lineFromProduct({ name: "Rush", unitPrice: 5 }, {})));
}

section("D — splits sum to 100");
{
  const three = evenSplits(3);
  eq("even three-way split is 33.33 / 33.33 / 33.34", JSON.stringify(three), JSON.stringify([33.33, 33.33, 33.34]));
  eq("…which sums to exactly 100.00 in cents", three.reduce((s, x) => s + toCents(x), 0), 10000);
  eq("seven ways still sums to 100", evenSplits(7).reduce((s, x) => s + toCents(x), 0), 10000);
  eq("zero earners → no splits", evenSplits(0).length, 0);
  const ids = new Set(["a", "b", "c"]);
  const good = normaliseEarners([
    { memberId: "a", role: "worked", splitPct: 33.33 },
    { memberId: "b", role: "worked", splitPct: 33.33 },
    { memberId: "c", role: "worked", splitPct: 33.34 },
    { memberId: "a", role: "sold", splitPct: 100 },
  ], ids);
  ok("33.33 + 33.33 + 33.34 and a lone seller at 100 is accepted", good.ok, good);
  const bad = normaliseEarners([
    { memberId: "a", role: "worked", splitPct: 33.33 },
    { memberId: "b", role: "worked", splitPct: 33.33 },
    { memberId: "c", role: "worked", splitPct: 33.33 },
  ], ids);
  ok("33.33 × 3 = 99.99 is refused", !bad.ok && bad.code === "split_sum", bad);
  ok("a stranger's member id is refused", normaliseEarners([{ memberId: "zzz", role: "worked", splitPct: 100 }], ids).code === "unknown_member");
  ok("a split of 150% is refused", normaliseEarners([{ memberId: "a", role: "worked", splitPct: 150 }], ids).code === "split_range");
  ok("a negative fixed amount is refused", normaliseEarners([{ memberId: "a", role: "worked", splitPct: 100, fixedAmount: -5 }], ids).code === "fixed_range");
  ok("a fixed amount past the ceiling is refused, not clamped", normaliseEarners([{ memberId: "a", role: "worked", splitPct: 100, fixedAmount: 5e9 }], ids).code === "fixed_range");
  ok("the same person twice in one role is refused", normaliseEarners([{ memberId: "a", role: "worked", splitPct: 50 }, { memberId: "a", role: "worked", splitPct: 50 }], ids).code === "duplicate");
  ok("an unknown role is refused", normaliseEarners([{ memberId: "a", role: "boss", splitPct: 100 }], ids).code === "shape");
  ok("junk line keys are dropped, real ones kept", JSON.stringify(normaliseEarners([{ memberId: "a", role: "worked", splitPct: 100, excludedLines: ["p:x", "evil", 5, "d:paint"] }], ids).earners[0].excludedLines) === JSON.stringify(["p:x", "d:paint"]));
  ok("not a list → refused", !normaliseEarners("nope", ids).ok);
}

section("E — partial payment");
{
  eq("paidFraction: half of a tax-inclusive total", paidFraction({ total: 1130, amountPaid: 565 }), 0.5);
  eq("paidFraction: overpaid clamps to 1", paidFraction({ total: 100, amountPaid: 103 }), 1);
  eq("paidFraction: zero total has nothing to collect", paidFraction({ total: 0, amountPaid: 50 }), 0);
  eq("paidFraction: junk is 0", paidFraction({ total: "x", amountPaid: "y" }), 0);
  const fam = (paid) => [{ rootId: "inv1", total: 1130, amountPaid: paid, lineItems: [{ description: "Repaint", amount: 1000 }] }];
  const e = [{ memberId: "w1", role: "worked", memberPct: 10, splitPct: 100 }];
  eq("a 50% deposit earns half", find(computeJobCommissions({ families: fam(565), earners: e }), "w1", "worked").earnedCents, 5000);
  eq("…while the potential stays the full $100", find(computeJobCommissions({ families: fam(565), earners: e }), "w1", "worked").potentialCents, 10000);
  eq("a sent, unpaid invoice earns nothing", find(computeJobCommissions({ families: fam(0), earners: e }), "w1", "worked").earnedCents, 0);
}

section("F — refund reversal (ledger deltas)");
{
  const cur = new Map([["inv1|w1|worked", { totalCents: 5000, seq: 1 }]]);
  const d = ledgerDeltas(cur, new Map([["inv1|w1|worked", 2500]]));
  ok("a refund of half the deposit writes −$25 at seq 2", d.length === 1 && d[0].deltaCents === -2500 && d[0].totalCents === 2500 && d[0].seq === 2, d);
  const full = ledgerDeltas(cur, new Map([["inv1|w1|worked", 0]]));
  ok("a full refund reverses to zero", full[0].deltaCents === -5000 && full[0].totalCents === 0, full);
  const gone = ledgerDeltas(cur, new Map());
  ok("an earner taken off the job is reversed, not silently kept", gone.length === 1 && gone[0].deltaCents === -5000, gone);
  ok("no change → nothing to write", ledgerDeltas(cur, new Map([["inv1|w1|worked", 5000]])).length === 0);
  ok("first payment starts at seq 1", ledgerDeltas(new Map(), new Map([["inv2|w1|sold", 700]]))[0].seq === 1);
}

section("G — rounding to the cent");
{
  // 7.5% of 333.33 = 24.99975 → $25.00; three families of that stay three
  // whole-cent figures, and the total is their sum — never 74.99925 rounded.
  const fams = ["a", "b", "c"].map((id) => ({ rootId: id, total: 333.33, amountPaid: 333.33, lineItems: [{ description: "x", amount: 333.33 }] }));
  const r = computeJobCommissions({ families: fams, earners: [{ memberId: "w1", role: "worked", memberPct: 7.5, splitPct: 100 }] });
  const w = find(r, "w1", "worked");
  ok("each family rounds once, to 2500 cents", w.byFamily.every((b) => b.earnedCents === 2500), w.byFamily);
  eq("the job total is the sum of whole cents", w.earnedCents, 7500);
  eq("toCents(1.005) is 101 (the EPSILON case)", toCents(1.005), 101);
  eq("toCents(-1.005) is -101", toCents(-1.005), -101);
  eq("fromCents(toCents(0.1 + 0.2)) is 0.3", fromCents(toCents(0.1 + 0.2)), 0.3);
  // A 1/3 paid fraction: 100 × 1/3 = 33.333… → 3333 cents.
  const third = computeJobCommissions({ families: [{ rootId: "t", total: 300, amountPaid: 100, lineItems: [{ description: "x", amount: 1000 }] }], earners: [{ memberId: "w1", role: "worked", memberPct: 10, splitPct: 100 }] });
  eq("a third paid of $100 is $33.33", find(third, "w1", "worked").earnedCents, 3333);
}

section("H — discount spread over the lines");
{
  const lines = familyLines({ discount: 100, lineItems: [{ description: "A", amount: 600 }, { description: "B", amount: 400 }, { description: "Heading", amount: 0 }] });
  eq("heading lines are not lines anyone earns on", lines.length, 2);
  eq("a $100 discount on $1,000 takes $60 off the $600 line", Math.round(lines[0].net * 100), 54000);
  eq("…and $40 off the $400 line", Math.round(lines[1].net * 100), 36000);
  const over = familyLines({ discount: 5000, lineItems: [{ description: "A", amount: 100 }] });
  eq("a discount larger than the invoice clamps to it (net 0, never negative)", over[0].net, 0);
  ok("junk lineItems → no lines, no crash", familyLines({ lineItems: "nope" }).length === 0 && familyLines(null).length === 0);
}

section("I — two workers and one seller (the worked example)");
{
  // Job: $2,000 interior repaint (member rates) + $500 cabinet hardware (item
  // worked-by 4%), invoice discount $250, tax 13% on $2,250 = $292.50, total
  // $2,542.50. Client pays a $1,271.25 deposit (50%). Worker Ana 10%, worker
  // Ben 8%, split 60/40; seller Sam 5%.
  //   discount factor 2250/2500 = 0.9 → repaint net 1800, hardware net 450
  //   Ana:  (1800×10% + 450×4%) × 60% = (180 + 18) × 0.6 = 118.80 potential
  //   Ben:  (1800×8%  + 450×4%) × 40% = (144 + 18) × 0.4 =  64.80 potential
  //   Sam:  (1800×5%  + 450×5%) × 100% = 90 + 22.50     = 112.50 potential
  //   Earned at 50% paid: 59.40, 32.40, 56.25
  const products = new Map([["p_hw", { commissionable: true, workedByPct: 4, soldByPct: null }]]);
  const families = [{ rootId: "inv1", total: 2542.5, amountPaid: 1271.25, discount: 250, lineItems: [
    { description: "Interior repaint", amount: 2000 },
    { description: "Cabinet hardware", amount: 500, productId: "p_hw" },
  ] }];
  const earners = [
    { memberId: "ana", role: "worked", memberPct: 10, splitPct: 60 },
    { memberId: "ben", role: "worked", memberPct: 8, splitPct: 40 },
    { memberId: "sam", role: "sold", memberPct: 5, splitPct: 100 },
  ];
  const r = computeJobCommissions({ families, earners, products });
  eq("Ana potential $118.80", find(r, "ana", "worked").potentialCents, 11880);
  eq("Ben potential $64.80", find(r, "ben", "worked").potentialCents, 6480);
  eq("Sam potential $112.50", find(r, "sam", "sold").potentialCents, 11250);
  eq("Ana earned on the deposit $59.40", find(r, "ana", "worked").earnedCents, 5940);
  eq("Ben earned $32.40", find(r, "ben", "worked").earnedCents, 3240);
  eq("Sam earned $56.25", find(r, "sam", "sold").earnedCents, 5625);
  eq("job total earned $148.05", r.earnedCents, 14805);

  // Ben opts out of the hardware line: Ana takes all of it (renormalised),
  // Ben's repaint share is unchanged.
  const picked = computeJobCommissions({ families, products, earners: earners.map((e) => (e.memberId === "ben" ? { ...e, excludedLines: ["p:p_hw"] } : e)) });
  // Ana: 1800×10%×0.6 + 450×4%×1.0 = 108 + 18 = 126; Ben: 1800×8%×0.4 = 57.60
  eq("Ben opts out of the hardware: Ana earns 100% of it ($126.00 potential)", find(picked, "ana", "worked").potentialCents, 12600);
  eq("…and Ben keeps only his repaint share ($57.60)", find(picked, "ben", "worked").potentialCents, 5760);

  // A fixed override on Ben: $50 for the job, earned on the paid fraction.
  const fixed = computeJobCommissions({ families, products, earners: earners.map((e) => (e.memberId === "ben" ? { ...e, fixedAmount: 50 } : e)) });
  eq("Ben fixed at $50 → $25 earned on a 50% deposit", find(fixed, "ben", "worked").earnedCents, 2500);
  eq("…and Ana's share is untouched by it ($59.40)", find(fixed, "ana", "worked").earnedCents, 5940);

  const def = defaultEarners({
    worked: [{ memberId: "ana", workedByPct: 10 }, { memberId: "ben", workedByPct: 8 }, { memberId: "ana", workedByPct: 10 }, { memberId: "hourly", workedByPct: null }],
    sold: [{ memberId: "sam", soldByPct: 5 }],
  });
  ok("defaults: each worker once, only people ON commission, split evenly", JSON.stringify(def.filter((d) => d.role === "worked").map((d) => [d.memberId, d.splitPct])) === JSON.stringify([["ana", 50], ["ben", 50]]), def);
  ok("defaults: the seller at 100%", def.some((d) => d.memberId === "sam" && d.role === "sold" && d.splitPct === 100));
}

// ───────────────────────────────────────────────────────────────────────────
// A database in memory. Only what the sync touches, and the ledger's unique
// index enforced exactly as Postgres would: (invoiceRootId, memberId, role,
// seq). create() is lazy like a PrismaPromise, and $transaction([...]) is
// all-or-nothing.
function fakeDb(state) {
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const ledger = state.ledger;
  const P2002 = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
  return {
    company: { findUnique: async () => (await tick(), state.company) },
    job: { findFirst: async ({ where }) => (await tick(), where.quoteId ? { id: state.job.id } : state.job) },
    invoice: {
      findMany: async ({ where }) => {
        await tick();
        if (where.OR?.some((o) => o.jobId !== undefined)) return state.invoices.map((i) => ({ id: i.id, parentInvoiceId: i.parentInvoiceId }));
        return state.invoices;
      },
      findUnique: async ({ where }) => {
        const i = state.invoices.find((x) => x.id === where.id);
        return i ? { ...i, companyId: "co1", jobId: state.job.id, quoteId: null, company: { commissionsEnabled: state.company.commissionsEnabled } } : null;
      },
    },
    member: { findMany: async () => state.members },
    timeEntry: { findMany: async () => state.timeEntries || [] },
    jobVisit: { findMany: async () => [] },
    payment: { groupBy: async () => state.firstPayments || [] },
    product: { findMany: async () => state.products || [] },
    expense: { findMany: async () => state.expenses || [] },
    jobSubcontractor: { findMany: async () => [] },
    quoteImport: { findMany: async () => [] },
    jobCommissionEntry: {
      findMany: async () => {
        await tick();
        return ledger.map((r) => ({ ...r })).sort((a, b) => a.seq - b.seq);
      },
      create: ({ data }) => ({ __op: data }),
    },
    jobCommission: {
      upsert: async ({ create, update }) => {
        state.jobCommission = state.jobCommission ? { ...state.jobCommission, ...update } : { ...create };
        return state.jobCommission;
      },
    },
    $transaction: async (ops) => {
      await tick();
      const key = (d) => `${d.invoiceRootId}|${d.memberId}|${d.role}|${d.seq}`;
      const have = new Set(ledger.map(key));
      for (const op of ops) if (have.has(key(op.__op))) throw P2002();
      for (const op of ops) ledger.push({ ...op.__op, amount: Number(op.__op.amount), total: Number(op.__op.total) });
      return ops.length;
    },
  };
}

const baseState = () => ({
  company: { commissionsEnabled: true, commissionsEnabledAt: new Date("2026-01-01"), commissionBasis: "revenue" },
  job: { id: "job1", title: "Kitchen", quoteId: null, quote: { assignedToId: "u_sam", createdById: "u_sam" }, commission: null },
  invoices: [{ id: "inv1", parentInvoiceId: null, version: 1, invoiceNumber: "INV-1", status: "sent", total: 1130, amountPaid: 565, discount: 0, lineItems: [{ description: "Repaint", amount: 1000 }], historicalImportedAt: null }],
  members: [
    { id: "m_ana", userId: "u_ana", active: true, workedByPct: 10, soldByPct: null, laborCostPerHour: 30, user: { name: "Ana" } },
    { id: "m_sam", userId: "u_sam", active: true, workedByPct: null, soldByPct: 5, laborCostPerHour: null, user: { name: "Sam" } },
  ],
  timeEntries: [{ hours: 8, status: "approved", workerId: "wk_ana", worker: { userId: "u_ana", hourlyRate: null } }],
  firstPayments: [{ invoiceId: "inv1", _min: { date: new Date("2026-09-01") } }],
  ledger: [],
});

section("J — the ledger: payment, replayed webhook, refund, concurrency");
{
  const s = baseState();
  const db = fakeDb(s);
  const first = await syncJobCommissions(db, { companyId: "co1", jobId: "job1" });
  eq("the deposit writes two rows (Ana worked, Sam sold)", first.written, 2);
  const ana = s.ledger.find((r) => r.memberId === "m_ana");
  ok("Ana +$50.00 (10% × $1,000 × 50%), reason payment, seq 1", ana && ana.amount === 50 && ana.total === 50 && ana.reason === "payment" && ana.seq === 1, ana);
  ok("Sam +$25.00 (5% × $1,000 × 50%)", s.ledger.some((r) => r.memberId === "m_sam" && r.amount === 25 && r.role === "sold"));
  ok("names are frozen onto the rows", s.ledger.every((r) => r.memberName));

  const replay = await syncJobCommissions(db, { companyId: "co1", jobId: "job1" });
  eq("a replayed webhook writes nothing", replay.written, 0);
  eq("…and the ledger still has two rows", s.ledger.length, 2);

  const viaHook = await syncCommissionsForInvoice(db, "inv1");
  eq("the money-path hook is idempotent too", viaHook.written, 0);

  s.invoices[0].amountPaid = 1130;
  const rest = await syncJobCommissions(db, { companyId: "co1", jobId: "job1" });
  eq("the balance arriving writes two more rows", rest.written, 2);
  ok("Ana's running total is $100, seq 2", s.ledger.filter((r) => r.memberId === "m_ana").map((r) => r.total).join(",") === "50,100");

  s.invoices[0].amountPaid = 282.5; // a refund of $847.50 leaves 25% collected
  const refund = await syncJobCommissions(db, { companyId: "co1", jobId: "job1" });
  const anaRefund = s.ledger.filter((r) => r.memberId === "m_ana").at(-1);
  ok("a refund writes −$75 for Ana (100 → 25), reason refund", refund.written === 2 && anaRefund.amount === -75 && anaRefund.total === 25 && anaRefund.reason === "refund", anaRefund);
  const net = s.ledger.filter((r) => r.memberId === "m_ana").reduce((a, r) => a + r.amount, 0);
  eq("the ledger's rows sum to the running total", net, 25);
  ok("the job's summary row was written", s.jobCommission && s.jobCommission.summary && s.jobCommission.syncedAt instanceof Date);

  // Two deliveries at once: both read the same seq, the unique index lets one
  // through, the other retries and finds nothing left to write.
  const s2 = baseState();
  const db2 = fakeDb(s2);
  const [a, b] = await Promise.all([
    syncJobCommissions(db2, { companyId: "co1", jobId: "job1" }),
    syncJobCommissions(db2, { companyId: "co1", jobId: "job1" }),
  ]);
  eq("two concurrent deliveries write the deposit exactly once", s2.ledger.length, 2);
  eq("…one of them wrote both rows, the other nothing", a.written + b.written, 2);

  // Commissions switched on AFTER the first payment: that family earns nothing.
  const s3 = baseState();
  s3.company.commissionsEnabledAt = new Date("2026-09-10");
  const early = await syncJobCommissions(fakeDb(s3), { companyId: "co1", jobId: "job1" });
  eq("an invoice first paid before commissions were on earns nothing", early.written, 0);

  // Off → the hook does nothing at all.
  const s4 = baseState();
  s4.company.commissionsEnabled = false;
  const off = await syncCommissionsForInvoice(fakeDb(s4), "inv1");
  eq("commissions off: the hook skips", off.skipped, "off");
  eq("…and writes nothing", s4.ledger.length, 0);

  // Drafts and historical imports never earn.
  const s5 = baseState();
  s5.invoices[0].status = "draft";
  await syncJobCommissions(fakeDb(s5), { companyId: "co1", jobId: "job1" });
  eq("a draft invoice earns nothing", s5.ledger.length, 0);

  // Gross-profit basis through the loader: 8 approved hours at the member's
  // $30 labour cost (no worker rate — payroll's own fallback) + $260 expenses
  // = $500 cost on $1,000 revenue → 50% margin.
  const s6 = baseState();
  s6.company.commissionBasis = "gross_profit";
  s6.invoices[0].amountPaid = 1130;
  s6.expenses = [{ id: "e1", category: "materials", amount: 260 }];
  const gp = await syncJobCommissions(fakeDb(s6), { companyId: "co1", jobId: "job1" });
  eq("GP basis costs labour at the member's rate: margin 0.5", gp.result.grossProfitRatio, 0.5);
  ok("Ana earns 10% of $500 = $50", s6.ledger.some((r) => r.memberId === "m_ana" && r.total === 50));

  // A hook that throws never reaches the caller.
  const broken = { invoice: { findUnique: async () => { throw new Error("db down"); } } };
  const res = await syncCommissionsForInvoice(broken, "inv1");
  eq("a failing sync is reported, never thrown into the payment path", res.skipped, "error");
}

section("K — RBAC");
{
  const preset = (key, role) => ({ role, permissions: { ...PERMISSION_PRESETS[key].values } });
  const owner = commissionAccess({ role: "owner", permissions: null });
  ok("owner: sees all, edits, settles", owner.seesAll && owner.canEdit && owner.canSettle);
  const crew = commissionAccess(preset("worker", "employee"));
  ok("Crew: own only, cannot edit or settle", !crew.seesAll && !crew.canEdit && !crew.canSettle, crew);
  const est = commissionAccess(preset("estimator", "employee"));
  ok("Estimator: own only", !est.seesAll && !est.canEdit, est);
  const disp = commissionAccess(preset("dispatcher", "supervisor"));
  ok("Dispatcher: own only", !disp.seesAll && !disp.canEdit, disp);
  const mgr = commissionAccess(preset("manager", "supervisor"));
  ok("Manager (jobCosting on, payroll view_own): sees everyone's, cannot change pay", mgr.seesAll && !mgr.canEdit && !mgr.canSettle, mgr);
  const payroller = commissionAccess({ role: "supervisor", permissions: { ...PERMISSION_PRESETS.worker.values, payroll: "run_payroll" } });
  ok("payroll run_payroll: sees, edits, settles", payroller.seesAll && payroller.canEdit && payroller.canSettle);
  const rows = [{ memberId: "me" }, { memberId: "you" }];
  eq("own-only sees exactly their own row", JSON.stringify(visibleEarners(preset("worker", "employee"), rows, "me")), JSON.stringify([{ memberId: "me" }]));
  eq("own-only with no member id sees nothing", visibleEarners(preset("worker", "employee"), rows, null).length, 0);
  eq("sees-all sees both", visibleEarners({ role: "owner" }, rows, "me").length, 2);
  ok("only owner/admin configure the feature", canConfigureCommissions({ role: "owner" }) && canConfigureCommissions({ role: "admin" }) && !canConfigureCommissions({ role: "supervisor" }));
  ok("no member → nothing", !commissionAccess(null).seesAll);
}

section("L — wired, not just correct");
{
  const read = (p) => fs.readFileSync(p, "utf8");
  const hooked = [
    "lib/invoices/recordStripePayment.js",
    "lib/invoices/refund.js",
    "lib/stripe/settleChargeEvent.js",
    "app/api/payments/route.js",
    "app/api/invoices/[id]/route.js",
    "app/api/invoices/[id]/credit-visit-fee/route.js",
    "app/api/jobs/[id]/change-orders/bill/route.js",
  ];
  for (const p of hooked) ok(`${p} calls syncCommissionsForInvoice`, /await syncCommissionsForInvoice\(/.test(read(p)));
  ok("the pay-run preview re-syncs stale jobs before offering commissions", /syncStaleCommissions\(/.test(read("app/api/payroll/runs/route.js")));
  ok("cancelling a pay run frees its commission rows", /jobCommissionEntry\.updateMany\(/.test(read("app/api/payroll/runs/[id]/route.js")));
  ok("the job page renders the Commissions card", /<JobCommissions\b/.test(read("app/app/jobs/[id]/JobDetail.js")));
}

console.log(`\n${failed ? "FAILED" : "PASSED"} — ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
