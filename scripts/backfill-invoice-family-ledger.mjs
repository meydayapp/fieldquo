// scripts/backfill-invoice-family-ledger.mjs
//
//   node --env-file=.env --import ./scripts/alias-loader.mjs scripts/backfill-invoice-family-ledger.mjs [--apply]
//
// Refresh the cached ledger columns (amountPaid, amountDue, amountRefunded,
// status, paidDate) of the LATEST version of every amended invoice from the
// family's payments — the rule lib/invoices/family.js has applied to every
// payment since the X1 fix, applied once to the families amended BEFORE it.
//
// Why: an invoice amended before that deploy kept the cache its version was
// created with, and the cache only heals when money moves. The QA rerun's
// request-payment on such an invoice emailed a homeowner $1,390.72 for a
// $1,190.72 balance. This writes the truth once; from then on every payment
// keeps it true.
//
// Dry by default: prints every family whose cache disagrees with its ledger.
// --apply writes them. Nothing is deleted; only the cached columns of the
// latest version move, and only to what the payments already say.

import { db } from "@/lib/db";
import { familyRootId, refreshFamilyLedger, familyPayments, latestInFamily } from "@/lib/invoices/family";
import { computeInvoiceState } from "@/lib/invoices/computeInvoiceState";

const apply = process.argv.includes("--apply");
const versions = await db.invoice.findMany({
  where: { parentInvoiceId: { not: null } },
  select: { id: true, parentInvoiceId: true, companyId: true, invoiceNumber: true },
});
const roots = [...new Set(versions.map((v) => v.parentInvoiceId))];
console.log(`${roots.length} amended families across ${new Set(versions.map((v) => v.companyId)).size} companies (${apply ? "APPLY" : "dry run"})`);

let drift = 0;
let written = 0;
for (const rootId of roots) {
  const latest = await latestInFamily(db, rootId);
  if (!latest) continue;
  const payments = await familyPayments(db, latest.id);
  const state = computeInvoiceState({ total: latest.total, payments, priorStatus: latest.status });
  const same =
    Math.abs(Number(latest.amountPaid ?? 0) - state.amountPaid) < 0.005 &&
    Math.abs(Number(latest.amountDue ?? 0) - state.amountDue) < 0.005 &&
    latest.status === state.status;
  if (same) continue;
  drift += 1;
  console.log(
    `${latest.invoiceNumber} v${latest.version} (${latest.companyId}): cache paid ${latest.amountPaid} due ${latest.amountDue} ${latest.status} → ledger paid ${state.amountPaid} due ${state.amountDue} ${state.status}`,
  );
  if (apply) {
    await refreshFamilyLedger(db, familyRootId(latest));
    written += 1;
  }
}
console.log(`${drift} families drifted; ${written} written`);
await db.$disconnect();
