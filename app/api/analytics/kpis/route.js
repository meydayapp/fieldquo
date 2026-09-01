// app/api/analytics/kpis/route.js
//
// The KPI dashboard — one screen combining sales, profit, execution and cash,
// where every figure already has a builder that computes it correctly and most
// of them have never had a screen. See lib/analytics/kpis.js for the reasoning
// behind every number; this file's only job is the plumbing: load the rows the
// pure builder needs, in the shapes it already expects, and refuse to answer a
// caller who cannot see all of what it draws from.
//
// ══ Who may read it ══════════════════════════════════════════════════════════
//
// This is the union of every gate the reports it reuses already carry, because
// it reuses all of them at once and cannot be weaker than any one:
//
//   quotes: view_only        win rate, average job value (win-loss's own gate)
//   jobs: view_only,
//   company-wide (not
//   seesOnlyAssignedJobs)    estimate accuracy, on-time completion, margin,
//                            customer satisfaction — piggybacks on this same
//                            gate rather than adding one of its own; it reads
//                            SatisfactionResponse rows scoped to the same
//                            completedJobIds every other execution figure on
//                            this page already uses
//                            (estimate-accuracy's own gate, word for word)
//   invoices: view_only      AR aging, revenue (receivables' own gate)
//   requests: view_only      lead-to-quote conversion
//   showPricing              every figure on this page is money
//   jobCosting               margin, labour %, revenue/employee — the cost
//                            basis, gated exactly as burnRate is in
//                            lib/permissions/costBasis.js
//
// Where that lands against the presets as shipped: the same as
// estimate-accuracy's own table — Crew, Estimator and Dispatcher are refused
// (jobCosting is false for all three); Manager and owner/admin see the whole
// page. There is no partial render here the way estimate-accuracy offers
// client/crew segments behind their own dials — a KPI dashboard that shows
// four of six cards and silently drops two is exactly the "control that
// appears to work" AGENTS.md forbids, so this is all-or-nothing.
//
// The safety incident rate rides the SAME jobCosting gate, deliberately not a
// separate check against the "safety" category — Dispatcher holds
// safety:view_edit_all but is refused this whole page by jobCosting already,
// and adding a second passing gate here would let a Dispatcher see incident
// counts on a page every OTHER card on it says they may not open. Full detail
// on individual incidents (who, what happened) still lives behind
// GET /api/safety-incidents, gated on "safety" on its own — this page only
// ever returns a rate and a raw count, never a name or a description.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  hasLevel,
  hasToggle,
  seesOnlyAssignedJobs,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { invoiceFamilies } from "@/lib/export/accountingExport";
import { weeksBetween } from "@/lib/costing/utilisation";
import { calculateMinimumPrice } from "@/lib/analytics/minimumPrice";
import { buildKpis, detectMaterialsBuyListTrap, mergeCallbackReasons } from "@/lib/analytics/kpis";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const startOfDay = (key) => new Date(`${key}T00:00:00.000Z`);
const endOfDay = (key) => new Date(`${key}T23:59:59.999Z`);

// The three statuses that mean a quote left the building — win-loss's own
// constant, restated because that file does not export it and this is not
// that change's to make one.
const QUOTE_OUT_STATUSES = ["sent", "accepted", "declined"];
const OPEN_JOB_STATUSES = ["unscheduled", "scheduled", "in_progress"];

function kpisRefusal(full) {
  const missing = [];
  if (!hasLevel(full, "quotes", "view_only")) missing.push("quotes");
  if (!hasLevel(full, "jobs", "view_only")) missing.push("jobs");
  if (seesOnlyAssignedJobs(full)) missing.push("company_wide_jobs");
  if (!hasLevel(full, "invoices", "view_only")) missing.push("invoices");
  if (!hasLevel(full, "requests", "view_only")) missing.push("requests");
  if (!hasToggle(full, "showPricing")) missing.push("showPricing");
  if (!hasToggle(full, "jobCosting")) missing.push("jobCosting");
  if (missing.length === 0) return null;

  // One sentence whichever half failed — naming the missing key hands a map of
  // the permission model to whoever is probing it, the same reasoning
  // win-loss's and estimate-accuracy's routes give.
  const err = new Error(
    "You don't have access to the KPI dashboard — it combines sales, margin, execution and cash figures, and needs everything those reports need on their own. Ask an owner or admin.",
  );
  err.status = 403;
  err.missing = missing;
  return err;
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  const denied = kpisRefusal(full);
  if (denied) {
    const { body, status } = permissionErrorResponse(denied);
    return NextResponse.json(body, { status });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!DAY_RE.test(from || "") || !DAY_RE.test(to || "")) {
    return NextResponse.json(
      { error: "Give a start and end date as from=YYYY-MM-DD&to=YYYY-MM-DD." },
      { status: 400 },
    );
  }
  if (from > to) {
    return NextResponse.json(
      { error: `The period runs backwards (${from} to ${to}).` },
      { status: 400 },
    );
  }

  const companyId = member.companyId;
  const gte = startOfDay(from);
  const lte = endOfDay(to);

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { currency: true },
  });
  // Never defaulted — every card on this page is money. Same refusal
  // estimate-accuracy's route makes, for the same reason.
  if (!company?.currency) {
    return NextResponse.json(
      {
        error:
          "Your company has no billing currency set, and this report will not assume one. Set it in Settings → Company.",
        code: "no_currency",
      },
      { status: 409 },
    );
  }

  // ── Sales: quotes for win rate + average job value ─────────────────────
  const QUOTE_SELECT = {
    id: true,
    quoteNumber: true,
    status: true,
    total: true,
    acceptedTotal: true,
    sentAt: true,
    acceptedAt: true,
    declinedAt: true,
    declineReason: true,
    tierGroupId: true,
    createdById: true,
    client: { select: { name: true } },
    createdBy: { select: { name: true } },
  };

  const [
    quotesInRange,
    undatedQuoteCount,
    leads,
    openJobs,
    workers,
    allInvoices,
    allPayments,
    safetyIncidentsInRange,
    approvedHoursAgg,
  ] = await Promise.all([
      db.quote.findMany({
        where: { companyId, status: { in: QUOTE_OUT_STATUSES }, sentAt: { gte, lte } },
        select: QUOTE_SELECT,
      }),
      db.quote.count({
        where: { companyId, status: { in: QUOTE_OUT_STATUSES }, sentAt: null },
      }),
      db.leadRequest.findMany({
        where: { companyId, createdAt: { gte, lte } },
        select: { id: true, quoteId: true },
      }),
      // Backlog: accepted work not yet completed. Value comes off the QUOTE, so
      // a job with none (a warranty callback, a manual entry) is counted and
      // excluded by lib/analytics/kpis.js rather than priced at zero.
      db.job.findMany({
        where: { companyId, status: { in: OPEN_JOB_STATUSES } },
        select: { id: true, quote: { select: { status: true, acceptedTotal: true, total: true } } },
      }),
      // Active workers, once — feeds both utilisation (which excludes office
      // workers itself, see lib/costing/utilisation.js) and the headcount
      // revenue/employee divides by.
      db.worker.findMany({
        where: { companyId, active: true },
        select: { id: true, name: true, workType: true, scheduledHoursPerWeek: true, hourlyRate: true },
      }),
      // AR aging: the whole invoice table, every version, unbounded — what a
      // company is owed has no period. A 2019 invoice nobody paid belongs on
      // this card exactly as lib/analytics/receivables.js argues.
      db.invoice.findMany({
        where: { companyId },
        select: {
          id: true,
          parentInvoiceId: true,
          version: true,
          invoiceNumber: true,
          status: true,
          total: true,
          dueDate: true,
          sentAt: true,
          createdAt: true,
        },
      }),
      db.payment.findMany({
        where: { invoice: { companyId } },
        select: { invoiceId: true, amount: true, date: true },
      }),
      // The safety rate's numerator — every incident REPORTED in the period,
      // not scoped to completed jobs or any one job: someone can be hurt on a
      // job that never finishes, or with no job at all. See lib/analytics/safety.js.
      db.safetyIncident.findMany({
        where: { companyId, occurredAt: { gte, lte } },
        select: { kind: true, workStopped: true },
      }),
      // The denominator — approved hours company-wide in the period, scoped
      // through the worker the same way TimeEntry always is (it carries no
      // companyId of its own). Not filtered to completed-job hours: the
      // exposure a rate divides by is every hour worked, whether or not the
      // job it was logged against has finished.
      db.timeEntry.aggregate({
        where: {
          status: "approved",
          clockIn: { gte, lte },
          worker: { companyId },
        },
        _sum: { hours: true },
      }),
    ]);

  // Tier siblings the range clipped, so a Good/Better/Best group is never
  // scored on two of its three rows. Same backfill win-loss's own route does.
  const groupIds = [...new Set(quotesInRange.map((q) => q.tierGroupId).filter(Boolean))];
  let quotes = quotesInRange;
  if (groupIds.length) {
    const siblings = await db.quote.findMany({
      where: { companyId, status: { in: QUOTE_OUT_STATUSES }, tierGroupId: { in: groupIds } },
      select: QUOTE_SELECT,
    });
    const byId = new Map(quotesInRange.map((q) => [q.id, q]));
    for (const s of siblings) if (!byId.has(s.id)) byId.set(s.id, s);
    quotes = [...byId.values()];
  }

  // ── Completed jobs: the shared population for estimate accuracy, on-time
  // completion, and the margin roll-up. One query, three uses — the same
  // job should not be fetched three different shapes for three different
  // KPIs that all mean "work finished this period".
  const completedJobs = await db.job.findMany({
    where: { companyId, status: "completed", completedAt: { gte, lte } },
    select: {
      id: true,
      title: true,
      completedAt: true,
      quoteId: true,
      // Whether THIS job is itself a callback — read by buildReworkCallbackRate's
      // caller below to exclude it from that rate's denominator; a warranty
      // return isn't "new work" being measured for whether it needed a return.
      originalJobId: true,
      client: { select: { id: true, name: true } },
      quote: {
        select: {
          id: true,
          status: true,
          acceptedTotal: true,
          total: true,
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
          scopeGroups: { select: { category: { select: { key: true, label: true } } } },
        },
      },
      // returnReason feeds buildReworkCallbackRate; onTimeJobs below only
      // reads scheduledAt off this same array, so one fetch serves both
      // rather than querying JobVisit a second time.
      visits: { select: { scheduledAt: true, returnReason: true } },
    },
  });

  const completedJobIds = completedJobs.map((j) => j.id);
  const completedQuoteIds = completedJobs.map((j) => j.quoteId).filter(Boolean);
  const quoteIdToJobId = new Map(
    completedJobs.filter((j) => j.quoteId).map((j) => [j.quoteId, j.id]),
  );

  const [
    expenses,
    timeEntries,
    jobMaterials,
    revenueInvoices,
    jobHoursGrouped,
    periodRevenueAgg,
    forecastResult,
    callbackJobs,
    changeOrders,
    satisfactionResponses,
  ] =
    completedJobIds.length
      ? await Promise.all([
          db.expense.findMany({
            where: { companyId, projectId: { in: completedJobIds } },
            select: { projectId: true, category: true, amount: true },
          }),
          // TimeEntry carries no companyId — scoped through the worker.
          db.timeEntry.findMany({
            where: { jobId: { in: completedJobIds }, worker: { companyId } },
            select: {
              jobId: true,
              hours: true,
              status: true,
              workerId: true,
              worker: { select: { id: true, name: true, hourlyRate: true } },
            },
          }),
          // The buy-list side of the materials trap — ticked-off purchases,
          // which actualJobCost never reads. See lib/analytics/kpis.js.
          db.jobMaterial.findMany({
            where: { jobId: { in: completedJobIds }, purchasedAt: { not: null } },
            select: { jobId: true, actualCost: true },
          }),
          // Every non-draft, non-cancelled invoice billing these jobs — by an
          // explicit Job link, or (when none) by the quote the job came from.
          // Mirrors lib/invoices/jobLink.js's own resolution order without an
          // N+1 per-invoice lookup.
          db.invoice.findMany({
            where: {
              companyId,
              status: { notIn: ["draft", "cancelled"] },
              OR: [
                { jobId: { in: completedJobIds } },
                { jobId: null, quoteId: { in: completedQuoteIds.length ? completedQuoteIds : ["__none__"] } },
              ],
            },
            select: { id: true, parentInvoiceId: true, version: true, status: true, total: true, jobId: true, quoteId: true },
          }),
          db.timeEntry.groupBy({
            by: ["workerId"],
            where: {
              worker: { companyId },
              status: "approved",
              jobId: { not: null },
              clockIn: { gte, lte },
            },
            _sum: { hours: true },
          }),
          // Answered surveys for jobs completed in the period — sent, not
          // necessarily answered, are excluded here rather than in
          // lib/analytics/kpis.js's buildCsat(), same "pure function receives
          // an already-correct population" split every other builder in this
          // route follows. jobId is already scoped to completedJobIds, which
          // is itself scoped to companyId, so there is no cross-tenant read.
          db.satisfactionResponse.findMany({
            where: { jobId: { in: completedJobIds }, respondedAt: { not: null } },
            select: { score: true },
          }),
          // Cash-basis revenue for the period — the SAME measure
          // lib/analytics/overview.js uses for "Revenue this month" (paid
          // invoices, by when they were marked paid), so this card and that
          // one can never quietly disagree.
          db.invoice.aggregate({
            where: { companyId, status: "paid", updatedAt: { gte, lte } },
            _sum: { total: true },
          }),
          // costPerJob only — see lib/analytics/minimumPrice.js. Never
          // defaulted: needsCapacity means ForecastSettings.jobsPerWeekCapacity
          // was never set, and netMarginPct stays null rather than guessing it.
          calculateMinimumPrice({ companyId, targetMargin: 0.2 }),
          // Jobs that point BACK at one of these as their originalJobId — the
          // "big enough to be its own job" shape of a callback (the other
          // shape, a same-job return visit, is already in `visits` above via
          // returnReason). Company-scoped explicitly rather than relying on
          // originalJobId alone being enough proof, matching every other
          // query on this route.
          db.job.findMany({
            where: { companyId, originalJobId: { in: completedJobIds } },
            select: { id: true, originalJobId: true, callbackReason: true },
          }),
          // Scope changes logged against these jobs — see the ChangeOrder
          // model's own header. Unbounded by date, same reasoning AR aging
          // uses: a change order agreed near the end of this job's life might
          // be logged the week after completedAt, and excluding it here would
          // undercount the very jobs this metric exists to catch.
          db.changeOrder.findMany({
            where: { jobId: { in: completedJobIds } },
            select: { jobId: true, priceDelta: true },
          }),
        ])
      : [
          [],
          [],
          [],
          [],
          [],
          [],
          await db.invoice.aggregate({
            where: { companyId, status: "paid", updatedAt: { gte, lte } },
            _sum: { total: true },
          }),
          await calculateMinimumPrice({ companyId, targetMargin: 0.2 }),
          [],
          [],
        ];

  const expensesByJob = new Map();
  let expenseTotalOnCompletedJobs = 0;
  for (const e of expenses) {
    if (!expensesByJob.has(e.projectId)) expensesByJob.set(e.projectId, []);
    expensesByJob.get(e.projectId).push({ category: e.category, amount: e.amount });
    expenseTotalOnCompletedJobs += Number(e.amount) || 0;
  }
  const entriesByJob = new Map();
  for (const t of timeEntries) {
    if (!entriesByJob.has(t.jobId)) entriesByJob.set(t.jobId, []);
    entriesByJob.get(t.jobId).push(t);
  }
  let buyListTotalOnCompletedJobs = 0;
  for (const m of jobMaterials) buyListTotalOnCompletedJobs += Number(m.actualCost) || 0;

  // Revenue per job, off the latest version of every family — draft and
  // cancelled were already excluded in the query above, so what's left is
  // real, sendable revenue.
  const revenueByJob = new Map();
  for (const family of invoiceFamilies(revenueInvoices)) {
    const latest = family.latest;
    const jobId = latest.jobId || quoteIdToJobId.get(latest.quoteId) || null;
    if (!jobId) continue;
    revenueByJob.set(jobId, (revenueByJob.get(jobId) || 0) + Number(latest.total || 0));
  }

  const jobHoursById = {};
  for (const g of jobHoursGrouped) {
    if (g.workerId) jobHoursById[g.workerId] = Number(g._sum.hours || 0);
  }

  const materialsTrap = detectMaterialsBuyListTrap({
    buyListTotal: buyListTotalOnCompletedJobs,
    expenseTotal: expenseTotalOnCompletedJobs,
  });

  const estimateAccuracyJobs = completedJobs.map((job) => ({
    id: job.id,
    title: job.title,
    completedAt: job.completedAt,
    clientId: job.client?.id || null,
    clientName: job.client?.name || null,
    tradeKeys: (job.quote?.scopeGroups || []).map((g) => g.category).filter((c) => c && c.key),
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

  const onTimeJobs = completedJobs.map((job) => ({
    id: job.id,
    title: job.title,
    completedAt: job.completedAt,
    visits: job.visits || [],
  }));

  const marginJobs = completedJobs.map((job) => ({
    id: job.id,
    revenue: revenueByJob.has(job.id) ? revenueByJob.get(job.id) : null,
    expenses: expensesByJob.get(job.id) || [],
    timeEntries: entriesByJob.get(job.id) || [],
  }));

  const throughputJobs = completedJobs.map((job) => ({ id: job.id, quote: job.quote }));

  // ── Callback reasons, merged from both shapes a return can take ──────────
  //
  // A same-job touch-up (JobVisit.returnReason, already in completedJobs.visits
  // above) and a bigger return that became its own Job (callbackJobs, queried
  // separately because it's a DIFFERENT job pointing back at this one) both
  // name a reason against the ORIGINAL job's id — merged by the same pure
  // function scripts/check-kpis.mjs exercises directly, including the "points
  // at a job outside this period" case a route-level test can't reach.
  const visitReturns = completedJobs.flatMap((job) =>
    (job.visits || []).map((v) => ({ jobId: job.id, returnReason: v.returnReason })),
  );
  const callbackReasonsByJob = mergeCallbackReasons({ visitReturns, callbackJobs });

  // Excludes jobs that are THEMSELVES a callback (originalJobId set) — see
  // buildReworkCallbackRate's own comment for why that denominator would be
  // wrong to include them in.
  const reworkJobs = completedJobs
    .filter((job) => !job.originalJobId)
    .map((job) => ({ id: job.id, callbackReasons: [...(callbackReasonsByJob.get(job.id) || [])] }));

  const changeOrdersByJob = new Map();
  for (const co of changeOrders) {
    if (!changeOrdersByJob.has(co.jobId)) changeOrdersByJob.set(co.jobId, []);
    changeOrdersByJob.get(co.jobId).push({ priceDelta: co.priceDelta });
  }
  const changeOrderJobs = completedJobs.map((job) => ({
    id: job.id,
    changeOrders: changeOrdersByJob.get(job.id) || [],
  }));

  const weeksInPeriod = weeksBetween(gte, lte);

  let payload;
  try {
    payload = buildKpis({
      from,
      to,
      currency: company.currency,
      weeksInPeriod,
      sales: {
        quotes,
        undatedCount: undatedQuoteCount,
        leads,
        openJobs,
        completedJobsForThroughput: throughputJobs,
      },
      profit: {
        completedJobsWithCost: marginJobs,
        overheadPerJob: forecastResult?.needsCapacity ? null : forecastResult?.costPerJob ?? null,
        materialsTrap,
        periodRevenue: Number(periodRevenueAgg._sum.total || 0),
        activeWorkerCount: workers.length,
      },
      execution: {
        estimateAccuracyJobs,
        onTimeJobs,
        utilisation: {
          workers: workers.map((w) => ({
            ...w,
            scheduledHoursPerWeek: w.scheduledHoursPerWeek === null ? null : Number(w.scheduledHoursPerWeek),
            hourlyRate: w.hourlyRate === null ? null : Number(w.hourlyRate),
          })),
          jobHoursById,
        },
      },
      quality: { reworkJobs, changeOrderJobs },
      cash: { invoices: allInvoices, payments: allPayments, asOf: new Date() },
      customer: { satisfactionResponses },
      safety: {
        incidents: safetyIncidentsInRange,
        approvedHours: Number(approvedHoursAgg._sum.hours || 0),
      },
    });
  } catch (err) {
    if (err?.status === 400 || err?.status === 409) {
      return NextResponse.json({ error: err.message, code: err.code || "bad_request" }, { status: err.status });
    }
    throw err;
  }

  return NextResponse.json(payload);
}
