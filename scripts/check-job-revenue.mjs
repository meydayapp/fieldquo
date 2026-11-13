// scripts/check-job-revenue.mjs
//
// lib/costing/jobRevenue.js executed against hostile fixtures — no database.
//
// ══ What this exists to prove ══════════════════════════════════════════════
//
// The owner reported a job whose "What this job has cost" panel read Quoted
// $5,717.13 while the invoice he sent said $4,972.50. Two faults, one symptom:
// the job's revenue never looked at the invoice at all, and both documents'
// `total` carries sales tax that is collected for a government rather than
// earned. jobRevenue() is the one rule both the job page and the dashboard's
// margin roll-up now call, and section 1 below is that exact job — the live
// rows, by the numbers.
//
// Section 2 is the double-count trap that is LIVE on that job: v1 and v2 are
// one document seen twice. Sections 3–10 drive one rule each — the draft
// fallback, absence vs zero, a real zero, change orders already billed, change
// orders on their own invoice, statuses that are not money, tax-disabled
// documents, and plain hostile input. Section 11 mutates the library on disk,
// one bug at a time, and re-runs this file as a subprocess: a mutation that is
// NOT caught means the assertion guarding that line has no teeth.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-job-revenue.mjs

import { readFileSync, writeFileSync, mkdtempSync, rmSync, cpSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { jobRevenue, documentNet, documentGross, NON_REVENUE_INVOICE_STATUSES } from "@/lib/costing/jobRevenue";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);

// ═══════════════════════════════════════════════════════════════════════════
// 1. The reported job — Joel Reardon, Q-2026-0052, TrueFinish
// ═══════════════════════════════════════════════════════════════════════════
//
// Quote   5850.00 − 877.50 + 744.63 tax = 5717.13   (GST+QST, Gatineau)
// Inv v1  identical to the quote, sent
// Inv v2  the amendment he actually sent: no tax, total 4972.50
// No change orders on the job.
//
// The quote's NET and the amended invoice's TOTAL are the same number. That
// is not a coincidence to lean on — it is the cross-check: both corrections,
// from either direction, land on the figure the client was asked to pay.

console.log("\n1. The reported job\n");

const QUOTE = { subtotal: 5850.0, discount: 877.5, tax: 744.63, total: 5717.13, taxEnabled: true };
const INV_V1 = {
  id: "inv1",
  parentInvoiceId: null,
  version: 1,
  status: "sent",
  subtotal: 5850.0,
  discount: 877.5,
  tax: 744.63,
  total: 5717.13,
};
const INV_V2 = {
  id: "inv2",
  parentInvoiceId: "inv1",
  version: 2,
  status: "sent",
  subtotal: 5850.0,
  discount: 877.5,
  tax: 0,
  total: 4972.5,
};

const reported = jobRevenue({ quote: QUOTE, invoices: [INV_V1, INV_V2], changeOrders: [] });
ok("the job is worth 4972.50 — the invoice he sent", reported.revenue === 4972.5, reported.revenue);
ok("basis is the invoice, not the quote", reported.basis === "invoiced", reported.basis);
ok("NOT 5717.13 — the quote's gross, the number he was shown", reported.revenue !== 5717.13);
ok("NOT 10689.63 — both versions' totals summed", reported.revenue !== 10689.63);
ok("NOT 9945.00 — both versions' nets summed", reported.revenue !== 9945.0);
ok("the quote's own net is reported too, for the screen to compare", reported.quotedNet === 4972.5, reported.quotedNet);
ok("one invoice counted, not two", reported.invoiceCount === 1, reported.invoiceCount);
ok("the counted row is v2, the current document", reported.invoiceIds.join() === "inv2", reported.invoiceIds);
ok("the amended invoice carries no tax, so nothing is excluded", reported.taxExcluded === 0, reported.taxExcluded);

// The same job BEFORE he amended it: v1 only. Same revenue, and now the tax
// line is real and named. This is the assertion that holds the net rule on its
// own, with no version collapsing involved.
const beforeAmend = jobRevenue({ quote: QUOTE, invoices: [INV_V1], changeOrders: [] });
ok("v1 alone is also 4972.50 — net of tax", beforeAmend.revenue === 4972.5, beforeAmend.revenue);
ok("and it names the 744.63 of tax it left out", beforeAmend.taxExcluded === 744.63, beforeAmend.taxExcluded);
ok("the gross is still reported, never used as revenue", beforeAmend.basisGross === 5717.13, beforeAmend.basisGross);

// ═══════════════════════════════════════════════════════════════════════════
// 2. Versions are one document, never a sum
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n2. A family is one document\n");

const v1 = { id: "a", parentInvoiceId: null, version: 1, status: "sent", subtotal: 1000, discount: 0, total: 1130 };
const v2 = { id: "b", parentInvoiceId: "a", version: 2, status: "sent", subtotal: 1200, discount: 0, total: 1356 };
const v3 = { id: "c", parentInvoiceId: "a", version: 3, status: "paid", subtotal: 900, discount: 100, total: 904 };

ok("three versions collapse to the highest", jobRevenue({ invoices: [v1, v2, v3] }).revenue === 800, jobRevenue({ invoices: [v1, v2, v3] }).revenue);
ok("order in the array does not matter", jobRevenue({ invoices: [v3, v1, v2] }).revenue === 800);
ok("two SEPARATE invoices do add up", jobRevenue({ invoices: [v1, { id: "z", parentInvoiceId: null, version: 1, status: "sent", subtotal: 500, discount: 0, total: 565 }] }).revenue === 1500);

// A root amended but not re-sent: v1 sent, v2 draft. The client is holding v1,
// so v1 is what was billed. Collapsing first and filtering after would report
// this job as never invoiced.
const draftAmend = jobRevenue({
  quote: QUOTE,
  invoices: [v1, { id: "b2", parentInvoiceId: "a", version: 2, status: "draft", subtotal: 9999, discount: 0, total: 9999 }],
});
ok("a draft amendment does not hide the sent v1", draftAmend.revenue === 1000, draftAmend.revenue);
ok("and the draft's own figure never reaches the total", draftAmend.revenue !== 9999);

// ═══════════════════════════════════════════════════════════════════════════
// 3. Draft only — nothing has been billed, so the quote stands
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n3. Draft only falls back to the quote\n");

const draftOnly = jobRevenue({
  quote: QUOTE,
  invoices: [{ id: "d", parentInvoiceId: null, version: 1, status: "draft", subtotal: 1, discount: 0, total: 1 }],
});
ok("basis is the quote", draftOnly.basis === "quoted", draftOnly.basis);
ok("revenue is the quote's net", draftOnly.revenue === 4972.5, draftOnly.revenue);
ok("invoicedNet stays null — nothing was issued", draftOnly.invoicedNet === null, draftOnly.invoicedNet);
ok("the quote's 744.63 of tax is named as excluded", draftOnly.taxExcluded === 744.63, draftOnly.taxExcluded);
ok("draft is the whole non-revenue list", NON_REVENUE_INVOICE_STATUSES.join() === "draft", NON_REVENUE_INVOICE_STATUSES);

// Every other status is a document that left the building.
for (const status of ["sent", "paid", "overdue", "refunded", "partially_refunded", "disputed"]) {
  const r = jobRevenue({ quote: QUOTE, invoices: [{ id: "s", parentInvoiceId: null, version: 1, status, subtotal: 100, discount: 0, total: 113 }] });
  ok(`status ${status} counts as issued`, r.basis === "invoiced" && r.revenue === 100, r);
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Absence is not zero
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n4. Absence is not zero\n");

const nothing = jobRevenue({});
ok("no quote and no invoice → revenue null", nothing.revenue === null, nothing.revenue);
ok("…and null is not 0", nothing.revenue !== 0);
ok("…and the basis says so", nothing.basis === null, nothing.basis);
ok("…and no tax figure is invented", nothing.taxExcluded === null, nothing.taxExcluded);

// Unknown plus agreed changes is still unknown.
const unknownPlusChanges = jobRevenue({ changeOrders: [{ priceDelta: 500, status: "approved" }] });
ok("unknown + $500 of agreed changes is still unknown", unknownPlusChanges.revenue === null, unknownPlusChanges.revenue);
ok("…but the $500 is still reported on its own", unknownPlusChanges.unbilledChanges === 500, unknownPlusChanges.unbilledChanges);

// ═══════════════════════════════════════════════════════════════════════════
// 5. A real zero stays a real zero
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n5. A real zero is a statement\n");

const zeroQuote = jobRevenue({ quote: { subtotal: 0, discount: 0, tax: 0, total: 0 } });
ok("a $0 quote is revenue 0, not null", zeroQuote.revenue === 0, zeroQuote.revenue);
ok("…and the basis is the quote", zeroQuote.basis === "quoted", zeroQuote.basis);
ok("a fully discounted quote is also a real zero", jobRevenue({ quote: { subtotal: 1000, discount: 1000, total: 0 } }).revenue === 0);
ok("documentNet(null) is null, documentNet({subtotal:0}) is 0", documentNet(null) === null && documentNet({ subtotal: 0 }) === 0);

// ═══════════════════════════════════════════════════════════════════════════
// 6. A change order already on the invoice is not added twice
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n6. Billed change orders are already inside the invoice\n");

// The job's invoice, with the change order billed onto it: billChangeOrders
// raised the subtotal by 500, so 2000 already contains it.
const billedRoot = { id: "root", parentInvoiceId: null, version: 1, status: "sent", subtotal: 2000, discount: 0, total: 2260 };
const billedOnIt = jobRevenue({
  quote: { subtotal: 1500, discount: 0, total: 1695 },
  invoices: [billedRoot],
  changeOrders: [{ id: "co1", priceDelta: 500, status: "approved", invoiceId: "root" }],
});
ok("the billed change is not added again", billedOnIt.revenue === 2000, billedOnIt.revenue);
ok("…and 2500 would have been the double count", billedOnIt.revenue !== 2500);
ok("…so nothing is reported as unbilled", billedOnIt.unbilledChanges === 0, billedOnIt.unbilledChanges);

// ChangeOrder.invoiceId is ALWAYS the family root, so an amendment must not
// break the link: the counted row is v2, but the CO points at v1's id.
const billedThenAmended = jobRevenue({
  invoices: [billedRoot, { id: "root2", parentInvoiceId: "root", version: 2, status: "sent", subtotal: 2000, discount: 0, total: 2000 }],
  changeOrders: [{ id: "co1", priceDelta: 500, status: "approved", invoiceId: "root" }],
});
ok("amending the invoice does not un-bill the change order", billedThenAmended.revenue === 2000, billedThenAmended.revenue);

// ═══════════════════════════════════════════════════════════════════════════
// 7. A change order on its own invoice IS added
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n7. Pay-on-approval change orders are outside the job's invoice\n");

// lib/jobs/changeOrderPayment.js raises an invoice carrying neither jobId nor
// quoteId, so it never reaches the job's invoice set. Nothing in `base` knows
// about that money.
const ownInvoice = jobRevenue({
  invoices: [billedRoot],
  changeOrders: [{ id: "co2", priceDelta: 750, status: "approved", invoiceId: "someOtherRoot" }],
});
ok("a change paid on its own invoice is added", ownInvoice.revenue === 2750, ownInvoice.revenue);
ok("…and reported as not inside the invoice", ownInvoice.unbilledChanges === 750, ownInvoice.unbilledChanges);

const neverBilled = jobRevenue({ invoices: [billedRoot], changeOrders: [{ id: "co3", priceDelta: 300, status: "approved" }] });
ok("an approved change nobody billed is added", neverBilled.revenue === 2300, neverBilled.revenue);

// On the quoted basis NOTHING is inside the base, so every approved change is
// added — including one sitting on a draft invoice that was not counted.
const quotedPlusChanges = jobRevenue({
  quote: { subtotal: 1000, discount: 0, total: 1130 },
  invoices: [{ id: "dr", parentInvoiceId: null, version: 1, status: "draft", subtotal: 1500, discount: 0, total: 1695 }],
  changeOrders: [{ id: "co4", priceDelta: 500, status: "approved", invoiceId: "dr" }],
});
ok("on the quote basis a change on a draft is still owed", quotedPlusChanges.revenue === 1500, quotedPlusChanges.revenue);

// ═══════════════════════════════════════════════════════════════════════════
// 8. Statuses that are not money
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n8. Only an approved change order is money\n");

const base1000 = { subtotal: 1000, discount: 0, total: 1130 };
for (const status of ["pending", "waiting_client", "rejected", "sorta_approved", "APPROVED", ""]) {
  const r = jobRevenue({ quote: base1000, changeOrders: [{ priceDelta: 999, status }] });
  // "" is the legacy absent-status rule — a row written before the column
  // existed meant "already agreed with the client", so it IS money.
  const expected = status === "" ? 1999 : 1000;
  ok(`status ${JSON.stringify(status)} → ${expected}`, r.revenue === expected, r.revenue);
}
ok("an absent status is the legacy approved", jobRevenue({ quote: base1000, changeOrders: [{ priceDelta: 50 }] }).revenue === 1050);
ok("a null status is the legacy approved", jobRevenue({ quote: base1000, changeOrders: [{ priceDelta: 50, status: null }] }).revenue === 1050);
ok("a negative approved change reduces the job", jobRevenue({ quote: base1000, changeOrders: [{ priceDelta: -200, status: "approved" }] }).revenue === 800);

// ═══════════════════════════════════════════════════════════════════════════
// 9. A tax-disabled document is untouched by the net rule
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n9. No tax, no difference\n");

const noTaxQuote = { subtotal: 3200, discount: 200, tax: 0, total: 3000, taxEnabled: false };
const noTax = jobRevenue({ quote: noTaxQuote });
ok("net equals total when no tax was charged", noTax.revenue === 3000, noTax.revenue);
ok("…and nothing is reported as excluded", noTax.taxExcluded === 0, noTax.taxExcluded);
ok("documentGross agrees with documentNet there", documentGross(noTaxQuote) === documentNet(noTaxQuote));

// ═══════════════════════════════════════════════════════════════════════════
// 10. Hostile input
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n10. Hostile input\n");

ok("no arguments at all", jobRevenue().revenue === null);
ok("nulls in every slot", jobRevenue({ quote: null, invoices: null, changeOrders: null }).revenue === null);
ok("junk rows in the arrays", jobRevenue({ quote: base1000, invoices: [null, 7, "x", {}], changeOrders: [null, 3, "y"] }).revenue === 1000);
ok("string decimals (Prisma hands back objects that stringify)", jobRevenue({ quote: { subtotal: "5850.00", discount: "877.50", total: "5717.13" } }).revenue === 4972.5);
ok("a non-numeric subtotal is unknown, not zero", documentNet({ subtotal: "abc" }) === null);
ok("an invoice with an unreadable subtotal falls through to the quote", jobRevenue({ quote: base1000, invoices: [{ id: "bad", parentInvoiceId: null, version: 1, status: "sent", subtotal: null }] }).basis === "quoted");
ok("a non-numeric priceDelta cannot poison the total with NaN", jobRevenue({ quote: base1000, changeOrders: [{ priceDelta: "oops", status: "approved" }] }).revenue === 1000);
ok("float dust is rounded away", jobRevenue({ quote: { subtotal: 0.1, discount: 0, total: 0.1 }, changeOrders: [{ priceDelta: 0.2, status: "approved" }] }).revenue === 0.3);
ok("a huge discount makes a real negative, not a null", jobRevenue({ quote: { subtotal: 100, discount: 500, total: 0 } }).revenue === -400);

// ═══════════════════════════════════════════════════════════════════════════
// 11. Mutation pass — every rule above must be load-bearing
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

console.log("\n11. Mutation pass — break each rule, confirm it is caught\n");

const SELF = fileURLToPath(import.meta.url);
const LOADER = fileURLToPath(new URL("./alias-loader.mjs", import.meta.url));
const LIB = join(ROOT, "lib/costing/jobRevenue.js");

// A directory unique to THIS run, and a file backup — never `git checkout`,
// which restores the last commit rather than the working file. This repo has
// lost uncommitted work to exactly that.
const backupDir = mkdtempSync(join(tmpdir(), "job-revenue-"));
const BACKUP = join(backupDir, "jobRevenue.js.bak");
cpSync(LIB, BACKUP);
const ORIGINAL = readFileSync(BACKUP, "utf8");

const MUTATIONS = [
  [
    "sums every version instead of the latest — bills one invoice to itself twice",
    (s) => s.replace("  const counted = latestPerFamily(issued);", "  const counted = issued;"),
  ],
  [
    "uses `total` instead of the net, so sales tax is counted as revenue",
    (s) => s.replace(
      "  return round2(Number(sub) - num(doc.discount));",
      "  return round2(Number(doc.total ?? sub));",
    ),
  ],
  [
    "counts drafts, so an accepted quote's auto-draft reads as billed",
    (s) => s.replace(
      'export const NON_REVENUE_INVOICE_STATUSES = ["draft"];',
      "export const NON_REVENUE_INVOICE_STATUSES = [];",
    ),
  ],
  [
    "collapses versions before dropping drafts, hiding a sent v1 behind a draft v2",
    (s) => s.replace(
      "      !NON_REVENUE_INVOICE_STATUSES.includes(r.status) &&\n      documentNet(r) !== null,",
      "      documentNet(r) !== null,",
    ),
  ],
  [
    "adds a change order that is already on the invoice — double counted",
    (s) => s.replace(
      "    if (co.invoiceId && countedRootIds.has(String(co.invoiceId))) continue;",
      "    if (false) continue;",
    ),
  ],
  [
    "matches change orders on the counted ROW id, so an amendment un-bills them",
    (s) => s.replace(
      "  const countedRootIds = new Set(counted.map((r) => String(r.parentInvoiceId || r.id)));",
      "  const countedRootIds = new Set(counted.map((r) => String(r.id)));",
    ),
  ],
  [
    "counts every change order, approved or not",
    (s) => s.replace("    if (!isApprovedChangeOrder(co)) continue;", "    if (false) continue;"),
  ],
  [
    "returns 0 for an unknown revenue, inventing a contract nobody agreed",
    (s) => s.replace(
      "    revenue: base === null ? null : round2(base + unbilledChanges),",
      "    revenue: round2((base || 0) + unbilledChanges),",
    ),
  ],
  [
    "prefers the quote over the invoice — the original bug",
    (s) => s.replace(
      '  const basis = invoicedNet !== null ? "invoiced" : quotedNet !== null ? "quoted" : null;',
      '  const basis = quotedNet !== null ? "quoted" : invoicedNet !== null ? "invoiced" : null;',
    ),
  ],
  [
    "drops the changes from the total, so agreed extra work is unpaid again",
    (s) => s.replace(
      "    revenue: base === null ? null : round2(base + unbilledChanges),",
      "    revenue: base,",
    ),
  ],
  [
    "treats a missing subtotal as zero instead of unknown",
    (s) => s.replace(
      '  if (sub === null || sub === undefined || sub === "" || !Number.isFinite(Number(sub))) return null;',
      "  if (!Number.isFinite(Number(sub))) return 0;",
    ),
  ],
  [
    "lets a non-numeric priceDelta poison the total with NaN",
    (s) => s.replace(
      "const num = (v) => {\n  const n = Number(v);\n  return Number.isFinite(n) ? n : 0;\n};",
      "const num = (v) => Number(v);",
    ),
  ],
  [
    "stops rounding, letting float dust into every money figure",
    (s) => s.replace("const round2 = (n) => Math.round(n * 100) / 100;", "const round2 = (n) => n;"),
  ],
  [
    "invents a zero tax figure when the gross cannot be read",
    (s) => s.replace(
      "    taxExcluded: basisGross === null || base === null ? null : round2(basisGross - base),",
      "    taxExcluded: round2((basisGross || 0) - (base || 0)),",
    ),
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
    : `\nPASSED — ${pass}/${pass} assertions — the job is worth what was invoiced, net of tax`,
);
process.exit(fails.length ? 1 : 0);
