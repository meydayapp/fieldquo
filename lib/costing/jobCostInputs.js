// lib/costing/jobCostInputs.js
//
// The subcontract rows actualJobCost() needs, loaded the one way.
//
// Lifted out of app/api/jobs/[id]/costing/route.js when a second caller
// arrived — lib/commissions/sync.js costs a job for the gross-profit
// commission basis, and it must cost the job exactly as the job page does or
// the commission and the margin on the same screen would disagree. A second
// copy of the import-expense lookup below is the copy that rots (AGENTS.md
// failure class #4), and what it would rot into is a subcontractor counted
// twice in someone's pay.
//
// ── Subcontractors adopted from an imported quote ──────────────────────────
//
// A JobSubcontractor with quoteImportId came from a sub's FieldQuo quote, and
// that import was materialised into an Expense (category "Subcontractor")
// when the job was created — before this row existed. Both describe the same
// $5,000. actualJobCost counts the row's agreed amount and drops the import's
// expense BY ID, so the id is looked up here. quoteImportId is not a relation
// (see the schema comment), hence the second query rather than an include.

/**
 * @returns {Promise<Array<{agreedAmount, status, importExpenseId}>>}
 */
export async function loadJobSubcontracts(db, { companyId, jobId }) {
  // companyId on the row as well as on the job — the same tenant-scope
  // discipline every costing query keeps.
  const rows = await db.jobSubcontractor.findMany({
    where: { jobId, companyId },
    select: { agreedAmount: true, status: true, quoteImportId: true },
  });
  const importIds = rows.map((r) => r.quoteImportId).filter(Boolean);
  const importExpense = new Map();
  if (importIds.length) {
    const imports = await db.quoteImport.findMany({
      where: { id: { in: importIds }, targetCompanyId: companyId },
      select: { id: true, expenseId: true },
    });
    for (const imp of imports) if (imp.expenseId) importExpense.set(imp.id, imp.expenseId);
  }
  return rows.map((r) => ({
    agreedAmount: r.agreedAmount,
    status: r.status,
    importExpenseId: r.quoteImportId ? importExpense.get(r.quoteImportId) || null : null,
  }));
}
