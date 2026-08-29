// app/api/analytics/estimate-accuracy/route.js
//
// The job-costing comparison, rolled up across a range instead of one job.
//
// ══ Who may read it ════════════════════════════════════════════════════════
//
// This is margin data. The per-job version (app/api/jobs/[id]/costing) gates on
// `jobs: view_only` AND the `jobCosting` toggle, and this cannot be weaker than
// the thing it aggregates — so those two are the floor. Two more are added on
// top, and both are about the difference between one job and many:
//
//   * `showPricing`. One job's variance is an internal cost figure. A range of
//     them, segmented by trade, IS the rate card in reverse: "kitchens cost you
//     $3,100 to deliver" is what a competitor pays for. lib/permissions/
//     costBasis.js and the statements route make the same call.
//
//   * NOT scoped to their own jobs. A member narrowed by seesOnlyAssignedJobs
//     would get a report over the three jobs they had a visit on, presented as
//     the company's estimating accuracy. That is not a redaction, it is a wrong
//     number — the only honest options are the whole board or a refusal, and a
//     refusal is the one that matches the toggle a Crew member already fails.
//     Belt and braces: the Crew preset has jobCosting off, so this line refuses
//     nobody today. It exists so that a company turning jobCosting ON for one
//     foreman grants them their own job's costing, not a company roll-up built
//     from a third of the evidence.
//
// Where that lands against the presets as shipped:
//
//   Crew        jobCosting:false, scoped   → refused (twice over)
//   Estimator   jobCosting:false           → refused
//   Dispatcher  jobCosting:false           → refused
//   Manager     holds all of it            → allowed
//   owner/admin unrestricted               → allowed
//
// Two SEGMENTS are gated separately rather than the whole report, because each
// leaks a different thing and refusing the page for either would take the
// labour figure away from the person whose job it is to read it:
//
//   * by client — client names beside what their work cost, which is the
//     `clientsProperties` dial's whole subject.
//   * by crew — "Dani's jobs run 22% over" is other people's performance,
//     which is the `timeTracking: everyone's` dial's subject.
//
// An ungranted segment is ABSENT from the payload rather than empty, so the
// screen can say "your access doesn't include this" instead of rendering a
// section that reads as "you have no clients".
//
// ══ Which jobs count ═══════════════════════════════════════════════════════
//
// `completed`, with a `completedAt` inside the range. Three deliberate choices:
//
//   * status, because a job still running has costs still arriving and would
//     score as under budget every time — "a job still running is not evidence".
//   * completedAt rather than createdAt, because the question is "the work I
//     FINISHED this period"; a five-month job would otherwise be judged against
//     the quarter it was sold in.
//   * archived jobs are included. Archiving is filing, not cancelling — see
//     Job.archivedAt — and a contractor who tidies up their board every month
//     would otherwise watch this report empty itself.
//
// Cancelled jobs are excluded by the status filter, which is right: they have
// partial costs against an estimate for work nobody finished.
//
// An INVOICE is deliberately NOT required. This measures cost estimating, not
// margin, and a completed job's costs are settled whether or not the paperwork
// went out — requiring one would silently drop every contractor who bills
// monthly in arrears.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { hasLevel, hasToggle, seesOnlyAssignedJobs } from "@/lib/permissions/enforce";
import { buildEstimateAccuracy, MIN_SAMPLE } from "@/lib/analytics/estimateAccuracy";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The instant a day ends, so a range includes its last day. */
const endOfDay = (key) => new Date(`${key}T23:59:59.999Z`);
const startOfDay = (key) => new Date(`${key}T00:00:00.000Z`);

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(
    member,
    "jobs",
    "view_only",
    "see jobs",
  );
  if (denied) return denied;

  // One sentence whichever half failed, for the reason costBasis.js gives:
  // naming the missing key hands a map of the permission model to whoever is
  // probing it. The keys stay on the server side of the response.
  const missing = [];
  if (!hasToggle(full, "jobCosting")) missing.push("jobCosting");
  if (!hasToggle(full, "showPricing")) missing.push("showPricing");
  if (seesOnlyAssignedJobs(full)) missing.push("company_wide_jobs");
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error:
          "You don't have access to estimate accuracy — what the company's jobs were estimated to cost against what they did cost. Ask an owner or admin.",
      },
      { status: 403 },
    );
  }

  // A route handler gets a real URL. `searchParams` is a Promise on a PAGE's
  // props in Next 16 and not here, and getting that backwards yields
  // "[object Promise]" as a date.
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Shape-checked before a Date constructor ever sees them: `new Date("banana")`
  // is an Invalid Date, and an Invalid Date inside a Prisma `gte` is a query
  // error with a stack trace in it rather than a sentence the caller can act on.
  if (!DAY_RE.test(from || "") || !DAY_RE.test(to || "")) {
    return NextResponse.json(
      { error: "Give a start and end date as from=YYYY-MM-DD&to=YYYY-MM-DD." },
      { status: 400 },
    );
  }
  // Refused here as well as inside the builder. The builder throws because it
  // is pure and cannot answer; this is a 400 because a backwards range is a
  // caller mistake, and an empty report would look exactly like a quiet quarter.
  if (from > to) {
    return NextResponse.json(
      { error: `The period runs backwards (${from} to ${to}).` },
      { status: 400 },
    );
  }

  const companyId = member.companyId;

  const [company, jobs] = await Promise.all([
    db.company.findUnique({ where: { id: companyId }, select: { currency: true } }),
    db.job.findMany({
      where: {
        companyId,
        status: "completed",
        completedAt: { gte: startOfDay(from), lte: endOfDay(to) },
      },
      select: {
        id: true,
        title: true,
        completedAt: true,
        client: { select: { id: true, name: true } },
        quote: {
          select: {
            id: true,
            // ── The SAVED estimate only ──────────────────────────────────
            //
            // quotedCostFor falls back to deriving a cost from the quote's own
            // scope when no row was saved, and the per-job screen is right to
            // use it: something beats nothing on one job. A ROLL-UP must not.
            // A derivation re-costs against TODAY's price book, so a quarter
            // built partly from derivations measures "what would we think now"
            // mixed with "what we thought then", and the trend would move when
            // somebody edited a rate card and touched no job at all.
            //
            // Also: one derivation is three queries, and this loads a range.
            //
            // So a quote with no saved costing is not comparable, is counted,
            // and the reason is named — which is a sentence a contractor can
            // act on ("fill in Cost & margin before you send it").
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
    }),
  ]);

  // Never defaulted to CAD. Company.currency is nullable, and this report puts
  // dollar overruns on screen — the statements route refuses the same way and
  // for the same reason.
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

  const jobIds = jobs.map((j) => j.id);

  // Loaded in two queries rather than as nested relations on the job, because
  // an `include` here would fan out one row per time entry per expense per job.
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

  const shaped = jobs.map((job) => ({
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

  let report;
  try {
    report = buildEstimateAccuracy({
      from,
      to,
      currency: company.currency,
      jobs: shaped,
      minSample: MIN_SAMPLE,
      segments: {
        client: hasLevel(full, "clientsProperties", "full_view"),
        crew: hasLevel(full, "timeTracking", "view_record_edit_all"),
      },
    });
  } catch (err) {
    if (err?.status === 400 || err?.status === 409) {
      return NextResponse.json(
        { error: err.message, code: err.code || "bad_request" },
        { status: err.status },
      );
    }
    throw err;
  }

  return NextResponse.json({
    ...report,
    // What the screen may draw, stated rather than inferred from an absent key
    // — so "you can't see this" and "there is nothing here" stay different.
    segmentAccess: {
      client: hasLevel(full, "clientsProperties", "full_view"),
      crew: hasLevel(full, "timeTracking", "view_record_edit_all"),
    },
  });
}
