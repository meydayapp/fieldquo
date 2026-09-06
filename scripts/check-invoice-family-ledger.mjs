// scripts/check-invoice-family-ledger.mjs
//
//   npm run check:invoice-family-ledger
//
// Every version of an invoice shares ONE ledger, and the latest version is the
// current document. Held from every side that reads or writes the balance.
//
// ══ What went wrong ════════════════════════════════════════════════════════
//
// Editing a sent, partially-paid invoice created version 2 with the column
// DEFAULTS — amountPaid 0, amountDue 0 — while the $200 Payment row stayed on
// version 1. v2 read as settled, v1 still showed the money, and the client
// portal listed BOTH as payable. A client could pay the same bill twice; the
// office list kept the old total.
//
// Carrying the cached number onto v2 would only have hidden it: every recorder
// computed state from ONE row's own Payment rows, so the next payment on v2
// recomputed from v2's rows and dropped the $200 again. That is the half-fix
// this file exists to refuse. The rule (lib/invoices/family.js): the FAMILY
// owns the payments; state is computed against the LATEST version's total;
// every list and pay path resolves to the latest. Payment rows are never
// re-pointed — a replayed webhook carries the original invoiceId.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { latestPerFamily, familyRootId } from "@/lib/invoices/family";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) =>
  readFileSync(join(ROOT, p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

let pass = 0;
const failures = [];
const ok = (label, cond, detail) =>
  cond ? (pass++, undefined) : failures.push(`${label}${detail !== undefined ? ` — ${detail}` : ""}`);

// ── 1. The pure parts, executed ────────────────────────────────────────────
{
  const rows = [
    { id: "v1", parentInvoiceId: null, version: 1 },
    { id: "v2", parentInvoiceId: "v1", version: 2 },
    { id: "other", parentInvoiceId: null, version: 1 },
    { id: "v3", parentInvoiceId: "v1", version: 3 },
  ];
  const kept = latestPerFamily(rows);
  ok("latestPerFamily keeps one row per family", kept.length === 2, kept.map((r) => r.id).join(","));
  ok("...and it is the HIGHEST version, not the first seen", kept.find((r) => familyRootId(r) === "v1")?.id === "v3");
  ok("...preserving the order families first appeared", kept[0].id === "v3" && kept[1].id === "other");
  ok("an unamended invoice passes through as itself", latestPerFamily([{ id: "x", parentInvoiceId: null, version: 1 }])[0].id === "x");
  ok("empty and garbage input are harmless", latestPerFamily([]).length === 0 && latestPerFamily(null).length === 0);
  ok("a missing version reads as 1, never NaN", latestPerFamily([{ id: "a", parentInvoiceId: null }, { id: "b", parentInvoiceId: "a", version: 2 }])[0].id === "b");
}

// ── 2. Every site is family-aware ──────────────────────────────────────────
const SITES = [
  ["lib/invoices/recordStripePayment.js", "Stripe payment resolves the latest version", /latestInFamily\(db, invoiceId/],
  ["lib/invoices/recordStripePayment.js", "...and computes from the family's payments", /familyPayments\(db, inv\.id\)/],
  ["lib/invoices/recordStripeRefund.js", "refund resolves the latest version", /latestInFamily\(db, payment\.invoiceId\)/],
  ["lib/invoices/recordStripeRefund.js", "...from the family's payments", /familyPayments\(db, invoice\.id\)/],
  ["lib/invoices/recordStripeDispute.js", "dispute resolves the latest version", /latestInFamily\(db, payment\.invoiceId\)/],
  ["lib/invoices/recordStripeDispute.js", "...from the family's payments", /familyPayments\(db, invoice\.id\)/],
  ["app/api/payments/route.js", "manual payment resolves the latest version after proving the tenant", /latestInFamily\(db, scoped\.id/],
  ["app/api/payments/route.js", "...computes both before and after from the family", /payments: familyRows/],
  ["app/api/payments/route.js", "...and writes the cash row against the current document", /invoiceId: invoice\.id,/],
  // Two identical POSTs fired together both landed (QA rerun, two rows 3 ms
  // apart): the cap was read-then-write with nothing serialising the readers.
  ["app/api/payments/route.js", "the manual payment runs read-check-write in ONE transaction under an advisory lock on the invoice", /db\.\$transaction\(async \(tx\) => \{[\s\S]{0,200}pg_advisory_xact_lock\(hashtext\(\$\{invoice\.id\}\)\)/],
  ["app/api/payments/route.js", "...reads the family through the transaction's own client", /familyPayments\(tx, invoice\.id\)/],
  ["app/api/payments/route.js", "...and refuses a same-amount, same-method repeat inside fifteen seconds as the double-click it is", /DUPLICATE_WINDOW_MS = 15_000[\s\S]{0,400}status: 409/],
  ["app/api/jobs/[id]/change-orders/bill/route.js", "change-order billing reads the family inside its transaction", /familyPayments\(tx, fresh\.id/],
  ["app/api/invoices/[id]/route.js", "a new version is created WITH the ledger, re-derived", /amountPaid: ledger\.amountPaid,[\s\S]{0,80}amountDue: ledger\.amountDue/],
  ["app/api/invoices/[id]/route.js", "...from the family's payments against the new total", /computeInvoiceState\(\{\s*total: total \?\? existing\.total,\s*payments: await familyPayments\(db, existing\.id\)/],
  ["app/api/invoices/[id]/route.js", "the detail page shows the family's payment history", /invoice\.payments = await familyPayments\(db, invoice\.id/],
  ["app/api/invoices/[id]/route.js", "...and re-derives the shown amounts from it, for display", /invoice\.amountPaid = shown\.amountPaid;[\s\S]{0,60}invoice\.amountDue = shown\.amountDue/],
  ["app/api/invoices/[id]/pdf/route.js", "the PDF shows the family's payments", /invoice\.payments = await familyPayments\(db, invoice\.id/],
  // The three readers the 6 September QA rerun caught reading the CACHED
  // columns on an invoice amended before the family ledger existed: the
  // request-payment email quoted $1,390.72 for a $1,190.72 balance, lifecycle
  // said "paid 0, settled", the PDF's balance disagreed with its own payment
  // list. Each now recomputes the family before stating a number.
  ["app/api/invoices/[id]/pdf/route.js", "...and recomputes its totals from the same ledger", /const ledger = await refreshFamilyLedger\(db, invoice\.id\);[\s\S]{0,120}invoice\.amountDue = ledger\.state\.amountDue/],
  ["app/api/invoices/[id]/request-payment/route.js", "the payment-request email quotes the family's balance, recomputed", /const ledger = await refreshFamilyLedger\(db, invoice\.id\);[\s\S]{0,120}invoice\.amountPaid = ledger\.state\.amountPaid/],
  ["app/api/invoices/[id]/lifecycle/route.js", "the lifecycle screen states the family's money, recomputed", /const ledger = await refreshFamilyLedger\(db, invoice\.id\);[\s\S]{0,120}invoice\.amountDue = ledger\.state\.amountDue/],
  ["app/api/invoices/[id]/credit-visit-fee/route.js", "the visit-fee recompute uses the shared state, not its own sum", /latestInFamily\(db, invoiceId\)[\s\S]{0,300}familyPayments\(db, inv\.id\)/],
  ["app/api/invoices/[id]/credit-visit-fee/route.js", "...through computeInvoiceState", /computeInvoiceState\(\{/],
  ["app/api/portal/[token]/route.js", "the portal shows one current document per family", /latestPerFamily\(members\)/],
  ["app/api/portal/[token]/route.js", "...with amountPaid re-derived from the family, server-side", /inv\.amountPaid = computeInvoiceState\(/],
  ["app/api/portal/[token]/pay/route.js", "portal pay refreshes the ledger before Stripe sees an amount", /refreshFamilyLedger\(db, invoice\.id\)/],
  ["app/api/portal/[token]/pay/route.js", "...and charges the current document", /invoice: current,/],
  ["app/api/portal/[token]/pay/route.js", "...refusing an unsent amendment rather than charging a superseded bill", /has been updated — please refresh/],
  ["app/api/invoices/[id]/checkout-link/route.js", "checkout-link refreshes the ledger before Stripe sees an amount", /refreshFamilyLedger\(db, invoice\.id\)/],
  ["app/api/invoices/[id]/checkout-link/route.js", "...and charges the current document", /invoice: current,/],
  ["app/api/invoices/route.js", "the office list presents the latest version's numbers on the family row", /currentVersionId: latest\.id/],
  ["app/api/invoices/route.js", "...with the balance re-derived across the family", /payments: familyRows,[\s\S]{0,80}priorStatus: latest\.status/],
  ["app/api/invoices/route.js", "...and the status filter applied to the CURRENT status", /\.filter\(\(inv\) => !status \|\| inv\.status === status\)/],
];
for (const [file, what, re] of SITES) ok(`${file}: ${what}`, re.test(read(file)));

// ── 3. The trap, refused ───────────────────────────────────────────────────
//
// Re-pointing Payment rows to the new version would make a replayed webhook
// (which carries the ORIGINAL invoiceId) miss the idempotency check and hit
// the global unique on stripePaymentIntentId — a 500 Stripe retries for ever.
ok(
  "family.js never re-points a Payment row",
  !/payment\.update(?:Many)?\(/.test(read("lib/invoices/family.js")),
);
ok(
  "[id]/route.js version-create never re-points Payment rows either",
  !/payment\.updateMany/.test(read("app/api/invoices/[id]/route.js")),
);
// And the single-row shape this file exists to remove must not creep back.
for (const file of [
  "lib/invoices/recordStripePayment.js",
  "lib/invoices/recordStripeRefund.js",
  "lib/invoices/recordStripeDispute.js",
  "app/api/payments/route.js",
  "app/api/invoices/[id]/credit-visit-fee/route.js",
]) {
  ok(`${file}: no longer computes state from one row's own \`payments\``, !/payments: (?:inv|invoice)\.payments\b/.test(read(file)));
}

if (failures.length) {
  console.error(`check:invoice-family-ledger FAILED — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`check:invoice-family-ledger passed — ${pass} assertions across ${new Set(SITES.map((s) => s[0])).size} files.`);
