// lib/expenses/placement.js
//
// WHERE an expense may be filed, by whom. One rule for POST /api/expenses
// and PATCH /api/expenses/[id], so the two cannot disagree.
//
// ── What was open (the 2026-10-03 role-access audit) ────────────────────────
//
// Recording your own receipt is every member's right (Expenses, lowest rung),
// and stays so. But the two routes took the receipt's PLACEMENT from the
// browser unchecked:
//
//   * `projectId` — the job the cost lands on. Any job id in the company was
//     accepted, so a crew member could move cost onto a job they are not on,
//     changing a margin they cannot see. Now: a job this member can read,
//     with the same assignedJobWhere scope as every job route.
//   * `isOverhead` + `recurring` — that pair IS the company's fixed costs
//     (rent, insurance, the phone bill: lib/analytics/burnRate.js and the
//     minimum-price floor read exactly it). Writing fixed costs is the cost
//     basis, gated in lib/permissions/costBasis.js on jobCosting + user:manage.
//     A one-off overhead receipt (shop supplies) is still anyone's.
import { assignedJobWhere } from "@/lib/permissions/enforce";
import { canWriteCostBasis } from "@/lib/permissions/costBasis";

/**
 * @returns {null | { status: number, error: string }} null when allowed
 */
export async function expensePlacementRefusal(db, { companyId, full, projectId, isOverhead, recurring }) {
  if (isOverhead === true && recurring === true && !canWriteCostBasis(full, "fixedCosts")) {
    return {
      status: 403,
      error: "A recurring overhead cost is one of the company's fixed costs. Ask an owner or manager to add it.",
    };
  }
  if (projectId) {
    if (typeof projectId !== "string") return { status: 404, error: "Job not found" };
    const job = await db.job.findFirst({
      where: { id: projectId, companyId, ...assignedJobWhere(full) },
      select: { id: true },
    });
    if (!job) return { status: 404, error: "Job not found" };
  }
  return null;
}
