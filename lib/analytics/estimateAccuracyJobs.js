// lib/analytics/estimateAccuracyJobs.js
//
// The rows lib/analytics/estimateAccuracy.js's buildEstimateAccuracy reads,
// loaded once, the same way, for everything that asks.
//
// ── Why this left the route ────────────────────────────────────────────────
//
// GET /api/analytics/estimate-accuracy loaded completed jobs with their SAVED
// costing, their expenses and their time entries, and shaped them for the
// pure roll-up. The AI quote review now asks the same question of the same
// rows — "how far over their estimate do this company's painting jobs run" —
// and a second loader in lib/ai/quoteReview.js would have been the copy that
// drifts: one of them would eventually include pending hours, or a derived
// estimate, and the analytics page and the review would start disagreeing
// about the same jobs.
//
// The two rules the route wrote down travel with the loader:
//
//   * the SAVED estimate only — a derivation re-costs against today's price
//     book, and a roll-up mixing "what we thought then" with "what we would
//     think now" moves when somebody edits a rate card and touches no job;
//   * expenses and time entries in two flat queries, never as nested
//     includes — an include fans out one row per entry per expense per job.

import { db } from "@/lib/db";

/**
 * @param {object} p
 * @param {string} p.companyId
 * @param {object} [p.where]   extra Job filters merged into the query — the
 *                             route passes a completedAt range, the review a
 *                             category on the quote's scope groups
 * @param {object} [p.orderBy] and
 * @param {number} [p.take]    for "the most recent N" rather than a range
 * @returns {Promise<Array>} rows in buildEstimateAccuracy's input shape,
 *          Decimals already turned into numbers
 */
export async function loadEstimateAccuracyJobs({ companyId, where = {}, orderBy, take } = {}) {
  const jobs = await db.job.findMany({
    where: { companyId, status: "completed", ...where },
    ...(orderBy ? { orderBy } : {}),
    ...(take ? { take } : {}),
    select: {
      id: true,
      title: true,
      completedAt: true,
      client: { select: { id: true, name: true } },
      quote: {
        select: {
          id: true,
          costing: {
            select: {
              labourHours: true,
              labourCost: true,
              materialTotal: true,
              unpricedMaterials: true,
              costIncomplete: true,
              totalCost: true,
              updatedAt: true,
            },
          },
          scopeGroups: {
            select: { category: { select: { key: true, label: true } } },
          },
        },
      },
    },
  });

  const jobIds = jobs.map((j) => j.id);
  const [expenses, timeEntries] = jobIds.length
    ? await Promise.all([
        db.expense.findMany({
          where: { companyId, projectId: { in: jobIds } },
          select: { projectId: true, category: true, amount: true },
        }),
        // TimeEntry carries no companyId — it is scoped through the worker,
        // which is also where the rate lives.
        db.timeEntry.findMany({
          where: { jobId: { in: jobIds }, worker: { companyId } },
          select: {
            jobId: true,
            hours: true,
            status: true,
            workerId: true,
            worker: { select: { id: true, name: true, hourlyRate: true } },
          },
        }),
      ])
    : [[], []];

  const expensesByJob = new Map();
  for (const e of expenses) {
    if (!expensesByJob.has(e.projectId)) expensesByJob.set(e.projectId, []);
    expensesByJob.get(e.projectId).push({ category: e.category, amount: e.amount });
  }
  const entriesByJob = new Map();
  for (const t of timeEntries) {
    if (!entriesByJob.has(t.jobId)) entriesByJob.set(t.jobId, []);
    entriesByJob.get(t.jobId).push(t);
  }

  return jobs.map((job) => ({
    id: job.id,
    title: job.title,
    completedAt: job.completedAt,
    clientId: job.client?.id || null,
    clientName: job.client?.name || null,
    tradeKeys: (job.quote?.scopeGroups || [])
      .map((g) => g.category)
      .filter((c) => c && c.key),
    // Decimal columns arrive as Prisma Decimal objects; Number() them once here
    // so the pure builder never has to know what a Decimal is.
    estimate: job.quote?.costing
      ? {
          labourHours: Number(job.quote.costing.labourHours),
          labourCost: Number(job.quote.costing.labourCost),
          materialTotal: Number(job.quote.costing.materialTotal),
          unpricedMaterials: Number(job.quote.costing.unpricedMaterials),
          costIncomplete: Boolean(job.quote.costing.costIncomplete),
          totalCost: Number(job.quote.costing.totalCost),
          at: job.quote.costing.updatedAt || null,
        }
      : null,
    expenses: expensesByJob.get(job.id) || [],
    timeEntries: entriesByJob.get(job.id) || [],
  }));
}
