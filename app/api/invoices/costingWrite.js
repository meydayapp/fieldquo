// app/api/invoices/costingWrite.js
//
// Writing an invoice's internal cost panel. Shared by POST /api/invoices and
// PATCH /api/invoices/[id] so the two cannot drift — the versioning path in
// PATCH is where a second copy of this would have been forgotten first.
//
// Not a route: this directory's HTTP handlers live in route.js files, and a
// plain module beside them is invisible to the router.
//
// ── The browser sends inputs; the server works out the money ────────────────
//
// The request carries crew names, rates and hours and nothing else. Labour
// cost, overhead and total cost are computed here from those rows, so a
// tampered or simply stale client cannot write a margin that its own numbers
// don't support. Same discipline as add-on repricing, applied where it is
// cheap rather than only where it is mandatory.

import { normaliseInvoiceCosting, invoiceCostSummary } from "@/lib/costing/actualJobCost";
import { calculateMinimumPrice } from "@/lib/analytics/minimumPrice";
import { hasToggle } from "@/lib/permissions/enforce";

/**
 * Turn a request body's `costing` into the row to persist.
 *
 * @returns the InvoiceCosting field object, or null when there is nothing to
 *          write — the caller must then leave any existing row alone rather
 *          than blanking it, because "this request didn't mention costing" is
 *          not "delete the costing".
 */
export async function buildCostingRow({ companyId, costing, price }) {
  const clean = normaliseInvoiceCosting(costing);
  if (!clean) return null;

  // The company's real overhead per job, when they've told us their capacity.
  // Read server-side rather than accepted from the request for the same reason
  // as everything else here: it is a figure about the company, not about this
  // invoice, and the browser has no business asserting it.
  let overheadPerJob = null;
  try {
    const min = await calculateMinimumPrice({ companyId });
    if (!min?.error && Number.isFinite(Number(min?.costPerJob))) {
      overheadPerJob = Number(min.costPerJob);
    }
  } catch {
    // Unknown overhead falls back to the percentage the user chose, which is
    // what the panel was already showing them.
  }

  const summary = invoiceCostSummary({
    crew: clean.crew,
    materialCost: clean.materialCost,
    overheadPct: clean.overheadPct,
    overheadPerJob,
    price,
  });

  return {
    crew: clean.crew,
    materialCost: clean.materialCost,
    overheadPct: clean.overheadPct,
    note: clean.note,
    labourHours: summary.labourHours,
    labourCost: summary.labourCost,
    overhead: summary.overhead,
    totalCost: summary.estimatedCost,
  };
}

/**
 * Did the user actually say anything?
 *
 * The panel posts on every save, so an invoice raised by someone who never
 * scrolled to it would otherwise get a row of zeroes — and the invoice page
 * would then show a "Job cost $0.00" card claiming a job with no crew and no
 * materials had been costed. Absence of a statement is not a statement.
 *
 * Overhead is excluded from the test on purpose: it defaults to 10% and is a
 * setting, not an assertion about this job.
 *
 * The caller still has to distinguish "nothing to say" from "clear what is
 * there". An empty block over an EXISTING row is a deletion the user asked
 * for and must be written; over no row it is nothing at all.
 */
export function isEmptyCosting(row) {
  if (!row) return true;
  return (
    (!Array.isArray(row.crew) || row.crew.length === 0) &&
    Number(row.materialCost) === 0 &&
    !row.note
  );
}

/**
 * May this member write cost data at all?
 *
 * Gated on the same toggle as reading it. Without this, someone who cannot see
 * the panel could still post a `costing` block alongside a line-item edit and
 * change what the company believes the job cost.
 */
export function mayCost(member) {
  return hasToggle(member, "jobCosting");
}
