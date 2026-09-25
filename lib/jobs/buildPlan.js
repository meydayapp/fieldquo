// lib/jobs/buildPlan.js
//
// The database half of the job plan: turn lib/jobs/plan.js's specs into Task
// rows, once. See that file's header for what a step is and why it is a Task.
//
// ── Idempotent, by the constraint ──────────────────────────────────────────
//
// Every generated step carries a sourceKey ("quote_line:<quoteId>:<groupId>:
// <index>", "quote_addon:<id>", "change_order_approved:<id>") and the column
// is UNIQUE. Running this twice on the same quote — a double-clicked Approve,
// a retried webhook, the office pressing "Rebuild from quote" — creates
// nothing the second time: the insert is refused by the index and P2002 is
// read as "already there". The same contract lib/tasks/autoCreate.js keeps,
// for the same reason: a findFirst-then-create loses the race that a public
// approval endpoint can be made to run.
//
// ── What a rebuild keeps ───────────────────────────────────────────────────
//
// Everything that exists. A rebuild adds the steps the quote now has that the
// plan does not; it never deletes a step, re-titles one, moves one or edits
// its dependencies — a step somebody assigned, re-ordered or wrote a hold on
// is their work, and the quote is not more right than they are. Hand-added
// steps have no sourceKey and are therefore invisible to this file entirely,
// which is the same rule JobMaterial.addedByHand follows on the buy list.
//
// Default dependency edges are written only between steps created in THIS
// run, so a dependency a person deleted does not come back on the next
// rebuild.
//
// ── Best effort ────────────────────────────────────────────────────────────
//
// Called from the acceptance path after the job exists. A plan that fails to
// build is a job page with an empty plan and a "Build from quote" button, not
// a client whose approval appears to have failed. Every entry point returns a
// result object and never throws.

import { db } from "@/lib/db";
import { fallbackAuthorId } from "@/lib/tasks/autoCreate";
import { planFromQuote } from "@/lib/jobs/plan";
import { productIdsInGroups, productionMapFrom } from "@/lib/services/productionRates";

const PLAN_QUOTE_SELECT = {
  id: true,
  companyId: true,
  clientId: true,
  scopeGroups: {
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      categoryId: true,
      sortOrder: true,
      lineItems: true,
      takeoff: true,
      // For a service's production rate measured off an intake box (the
      // fence's linear feet) — lib/services/productionRates.js runQuantity.
      intakeValues: true,
      label: true,
      subtotal: true,
      category: { select: { key: true } },
    },
  },
  addOns: {
    orderBy: { sortOrder: "asc" },
    select: { id: true, description: true, detail: true, selected: true, sortOrder: true },
  },
};

/**
 * Make sure a job built from a quote has its plan. Returns what happened.
 *
 * @param {string} jobId
 * @param {object} [opts]
 * @param {string|null} [opts.byUserId]  who pressed Rebuild, for attribution;
 *   the company's owner on the session-less approval path.
 * @param {object} [opts.db]  injection seam for scripts/check-job-plan.mjs.
 */
export async function ensurePlanForJob(jobId, { byUserId = null, db: prisma = db } = {}) {
  const result = { ok: false, created: 0, existing: 0, edges: 0, reason: null };
  if (!jobId) return { ...result, reason: "no_job" };

  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        companyId: true,
        clientId: true,
        quoteId: true,
        historicalImportedAt: true,
        quote: { select: PLAN_QUOTE_SELECT },
      },
    });
    if (!job) return { ...result, reason: "no_job" };
    // A past job entered after the fact was done years ago. Nine "Not started"
    // steps on it would be nine lies.
    if (job.historicalImportedAt) return { ...result, ok: true, reason: "historical" };
    if (!job.quote) return { ...result, ok: true, reason: "no_quote" };

    // The company's rate overrides live on CompanyServiceCategory, the same
    // place the buy list reads them (lib/jobs/sourcingList.js), so a company
    // that edited its production rates gets its own hours here too.
    const categoryIds = job.quote.scopeGroups.map((g) => g.categoryId).filter(Boolean);
    const settings = categoryIds.length
      ? await prisma.companyServiceCategory.findMany({
          where: { companyId: job.companyId, categoryId: { in: categoryIds } },
          select: { categoryId: true, rates: true },
        })
      : [];
    const ratesById = new Map(settings.map((s) => [s.categoryId, s.rates]));
    for (const g of job.quote.scopeGroups) {
      g.companySettings = { rates: ratesById.get(g.categoryId) || null };
    }

    // The production rates of the services the quote's template runs name
    // (lib/services/productionRates.js) — this company's rows only. Their
    // hours take precedence over the takeoff's for the groups they answer,
    // exactly as on the cost panel. No template run, no query: the plan is
    // built exactly as before.
    // A failed read plans with the trade's hours rather than failing the
    // plan: a job with no steps is a worse answer than steps with the book's
    // hours on them, and the log says which happened.
    const productIds = productIdsInGroups(job.quote.scopeGroups);
    let productionById = null;
    if (productIds.length) {
      try {
        productionById = productionMapFrom(
          await prisma.product.findMany({
            where: { companyId: job.companyId, id: { in: productIds } },
            select: { id: true, name: true, production: true },
          }),
        );
      } catch (err) {
        console.error("[buildPlan] production rates for job", jobId, "unread:", err?.message);
      }
    }

    const { specs, edges } = planFromQuote(job.quote, { productionById });
    if (!specs.length) return { ...result, ok: true, reason: "no_lines" };

    const createdById = byUserId || (await fallbackAuthorId(job.companyId, prisma));
    if (!createdById) return { ...result, reason: "no_author" };

    const existingRows = await prisma.task.findMany({
      where: { jobId: job.id, planStep: true },
      select: { id: true, sourceKey: true, sortOrder: true },
    });
    const bySource = new Map(existingRows.filter((t) => t.sourceKey).map((t) => [t.sourceKey, t]));
    let nextSort = existingRows.reduce((m, t) => Math.max(m, t.sortOrder), -1) + 1;

    const createdKeys = new Set();
    for (const spec of specs) {
      if (bySource.has(spec.sourceKey)) {
        result.existing += 1;
        continue;
      }
      try {
        const row = await prisma.task.create({
          data: {
            companyId: job.companyId,
            title: spec.title,
            description: spec.description,
            createdById,
            sourceKey: spec.sourceKey,
            clientId: job.clientId,
            quoteId: job.quote.id,
            jobId: job.id,
            planStep: true,
            clientVisible: true,
            sortOrder: nextSort,
            estimatedHours: spec.estimatedHours,
            quoteLineKey: spec.quoteLineKey,
            quoteLineNo: spec.quoteLineNo,
            categoryKey: spec.categoryKey,
            materialKeys: spec.materialKeys,
          },
          select: { id: true, sourceKey: true, sortOrder: true },
        });
        nextSort += 1;
        bySource.set(spec.sourceKey, row);
        createdKeys.add(spec.sourceKey);
        result.created += 1;
      } catch (err) {
        if (err?.code === "P2002") {
          // The index refused a second copy — another request got there
          // first. Read theirs so the edges below can still find it.
          const theirs = await prisma.task.findUnique({
            where: { sourceKey: spec.sourceKey },
            select: { id: true, sourceKey: true, sortOrder: true },
          });
          if (theirs) bySource.set(spec.sourceKey, theirs);
          result.existing += 1;
          continue;
        }
        throw err;
      }
    }

    // Default edges, only onto steps born in this run — see the header.
    const rows = [];
    for (const [fromKey, toKey] of edges) {
      if (!createdKeys.has(fromKey)) continue;
      const from = bySource.get(fromKey);
      const to = bySource.get(toKey);
      if (!from || !to || from.id === to.id) continue;
      rows.push({ taskId: from.id, dependsOnId: to.id });
    }
    if (rows.length) {
      const written = await prisma.taskDependency.createMany({ data: rows, skipDuplicates: true });
      result.edges = written?.count ?? rows.length;
    }

    result.ok = true;
    return result;
  } catch (err) {
    console.error("[buildPlan] plan for job", jobId, "failed:", err?.message);
    return { ...result, reason: err?.message || "failed" };
  }
}
