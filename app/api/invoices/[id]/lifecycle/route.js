// app/api/invoices/[id]/lifecycle/route.js
//
// Where this invoice sits in the project, and what to do about it.
//
// ── Why this is separate from /document ────────────────────────────────────
//
// /document answers "what does this invoice say" — prose, scope, terms, and
// nothing that isn't on the client's copy. This answers "what has happened and
// what hasn't" — the job, the visits, the crew's hours, the chase task, the
// margin. Two different questions with two different permission answers: the
// document is readable by anyone who may open the invoice, while the cost half
// of this response is gated on the `jobCosting` toggle exactly as
// /api/jobs/[id]/costing and /api/invoices/costing are. Folding them into one
// endpoint would mean one gate for two things, and the looser one would win.
//
// ── Everything here is derived, nothing is stored twice ────────────────────
//
// The banners come from lib/invoices/lifecycle.js, which is pure and checked by
// scripts/check-invoice-banners.mjs. The job link comes from
// lib/invoices/jobLink.js, which is the only rule. The chase task is looked up
// by the key lib/tasks/autoCreate.js owns. No new column records "this invoice
// is overdue" — a stored flag is a flag that goes stale overnight.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { quotedCostFor } from "@/lib/costing/quoteCostEstimate";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import {
  loadEnforceableMember,
  requireLevel,
  hasToggle,
  canSeeAllPay,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { selectInvoiceBanners, invoiceMoney } from "@/lib/invoices/lifecycle";
import { resolveInvoiceJob } from "@/lib/invoices/jobLink";
import { invoiceChaseKey } from "@/lib/tasks/autoCreate";
import { createJob } from "@/lib/jobs/createJob";
import { actualJobCost, compareJobCost } from "@/lib/costing/actualJobCost";

const num = (v) => (v == null ? null : Number(v));

// Loaded on both verbs — the invoice half of every answer below.
const INVOICE_SELECT = {
  id: true,
  companyId: true,
  invoiceNumber: true,
  status: true,
  clientId: true,
  quoteId: true,
  jobId: true,
  version: true,
  parentInvoiceId: true,
  total: true,
  subtotal: true,
  discount: true,
  amountPaid: true,
  amountDue: true,
  paidDate: true,
  paidVia: true,
  dueDate: true,
  sentAt: true,
  sentToEmail: true,
  client: { select: { id: true, name: true, email: true } },
  // `versions` is NOT selected here: the relation holds this row's CHILDREN,
  // which is the whole family only when you are looking at the root. GET
  // replaces it with a query over the family — see the note there.
};

const JOB_SELECT = {
  id: true,
  title: true,
  status: true,
  completedAt: true,
  quoteId: true,
  visits: {
    orderBy: { scheduledAt: "asc" },
    select: {
      id: true,
      scheduledAt: true,
      status: true,
      assignedToId: true,
      assignedTo: { select: { id: true, name: true } },
    },
  },
};

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const invoice = await db.invoice.findFirst({
    where: { id, companyId: member.companyId },
    select: INVOICE_SELECT,
  });
  if (!invoice)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const full = await loadEnforceableMember(db, member.id);

  // ── Sibling versions, not children ──────────────────────────────────────
  //
  // Invoice.versions is the CHILDREN of this row, which is only the whole
  // family when you are looking at the root. Every revision — v2, v3 — is a
  // child of the root, so v2's own `versions` is empty and it would have read
  // as current while v3 sat beside it. The family is what PATCH already walks
  // to work out the next version number, so it is walked the same way here.
  const rootId = invoice.parentInvoiceId || invoice.id;
  invoice.versions = await db.invoice.findMany({
    where: {
      companyId: member.companyId,
      OR: [{ id: rootId }, { parentInvoiceId: rootId }],
    },
    select: { id: true, version: true },
    orderBy: { version: "desc" },
  });

  const job = await resolveInvoiceJob(
    db,
    invoice,
    member.companyId,
    JOB_SELECT,
  );

  // findUnique on sourceKey — the column is unique, which is what makes the
  // task idempotent in the first place. Null simply means this invoice has
  // never been emailed, since the send route is the only thing that creates it.
  const chaseTask = await db.task.findUnique({
    where: { sourceKey: invoiceChaseKey(invoice.id) },
    select: { id: true, status: true, dueDate: true, title: true },
  });

  const banners = selectInvoiceBanners({ invoice, job, chaseTask });

  const body = {
    job: job
      ? {
          ...job,
          // Which rule found it, so the page can say "linked to this invoice"
          // rather than implying a link that is really the quote's.
          linkSource: invoice.jobId === job.id ? "invoice" : "quote",
        }
      : null,
    chaseTask,
    banners,
    money: invoiceMoney(invoice),
    // Not gated: this is the fact that a link is possible, not what it cost.
    canLinkJob: true,
    costing: null,
    payroll: null,
  };

  // ── The cost half ────────────────────────────────────────────────────────
  //
  // 403-equivalent by omission rather than by status code: the rest of this
  // response is legitimately readable without job costing, so the endpoint
  // answers what it may and leaves `costing` null. The page renders nothing,
  // which is the same thing it does when there is no job — and neither case
  // shows a zero, because a zero reads as "this job cost nothing".
  if (!hasToggle(full, "jobCosting")) return NextResponse.json(body);

  // The saved QuoteCosting row when there is one, and otherwise the same
  // derivation the quote's own cost panel shows. Reading the row alone meant an
  // invoice printed "this quote was never costed" for a quote whose cost the
  // quote page was displaying in full a click away — the estimator had priced
  // the job from the door counts and simply never opened the crew panel, which
  // is not the same as never costing it.
  const quotedCost = await quotedCostFor({
    companyId: member.companyId,
    quoteId: invoice.quoteId,
  });

  // Revenue is subtotal minus discount — the pre-tax money the work has to come
  // out of. Tax is the government's and a discount given away is not income;
  // counting either flatters the margin. Same basis POST /api/invoices costs
  // against, so the two figures answer the same question.
  const revenue =
    (Number(invoice.subtotal) || 0) - (Number(invoice.discount) || 0);

  let actual = null;
  let payroll = null;

  if (job) {
    const [expenses, timeEntries] = await Promise.all([
      db.expense.findMany({
        where: { projectId: job.id, companyId: member.companyId },
        select: { category: true, amount: true },
      }),
      db.timeEntry.findMany({
        where: { jobId: job.id, worker: { companyId: member.companyId } },
        select: {
          id: true,
          hours: true,
          status: true,
          clockIn: true,
          workerId: true,
          // userId only so the redaction below can recognise "this is you" and
          // leave your own rate alone — the same reason /api/invoices/costing
          // selects it.
          worker: {
            select: { id: true, name: true, hourlyRate: true, userId: true },
          },
        },
      }),
    ]);

    actual = actualJobCost(expenses, timeEntries);
    payroll = await payrollView({
      companyId: member.companyId,
      timeEntries,
      showRates: canSeeAllPay(full),
      ownUserId: member.userId,
    });
  }

  body.costing = {
    // What the quote predicted, read off the stored row rather than recomputed.
    // Recomputing would answer "what would this cost at today's rates", which
    // moves on an invoice nobody has touched — the exact reason QuoteCosting
    // stores it. Null when the quote was never costed, and the page says so.
    estimatedCost: quotedCost ? quotedCost.totalCost : null,
    // Null on a derivation: it has no moment it was recorded, and stamping it
    // "now" would tell a March quote it was estimated seconds ago.
    estimatedAt: quotedCost?.at || null,
    // "saved" or "derived", so the panel can mark a figure worked out just now
    // from today's price book rather than passing it off as a record.
    estimatedBasis: quotedCost?.source || null,
    revenue,
    actual,
    // Null actualCost when there is no job: "we have not measured this" is not
    // "this cost nothing", and compareJobCost refuses to invent the difference.
    comparison: compareJobCost({
      estimatedCost: quotedCost ? quotedCost.totalCost : null,
      actualCost: actual ? actual.total : null,
      revenue,
    }),
  };
  body.payroll = payroll;

  return NextResponse.json(body);
}

/**
 * Has the crew actually been paid for this job's hours?
 *
 * There is no column joining a TimeEntry to a PayRunLine — a payslip line is
 * one worker's whole period, not one job's share of it — so this answers the
 * question that IS answerable from real data: which pay periods the job's
 * approved hours fall inside, and how many approved hours fall in no period at
 * all. The second number is the actionable one: hours that have not been
 * through payroll are a cost the company still owes.
 *
 * Deliberately NOT presented as "this job cost $X in payroll". Apportioning a
 * run's gross across jobs would be a made-up number on a payroll screen.
 */
async function payrollView({ companyId, timeEntries, showRates, ownUserId }) {
  const approved = timeEntries.filter(
    (t) => t.status === "approved" && Number(t.hours) > 0,
  );
  if (approved.length === 0)
    return { periods: [], hoursNotInAnyRun: 0, crew: [] };

  const times = approved.map((t) => new Date(t.clockIn).getTime());
  const runs = await db.payRun.findMany({
    where: {
      companyId,
      periodStart: { lte: new Date(Math.max(...times)) },
      periodEnd: { gte: new Date(Math.min(...times)) },
    },
    orderBy: { periodStart: "asc" },
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      status: true,
      paidAt: true,
    },
  });

  const periods = runs.map((r) => ({ ...r, hours: 0 }));
  let hoursNotInAnyRun = 0;

  for (const t of approved) {
    const at = new Date(t.clockIn).getTime();
    const period = periods.find(
      (p) =>
        at >= new Date(p.periodStart).getTime() &&
        at <= new Date(p.periodEnd).getTime(),
    );
    if (period) period.hours += Number(t.hours);
    else hoursNotInAnyRun += Number(t.hours);
  }

  // Per-person hours, so the invoice can be checked against who was actually
  // there. Rates follow the SAME redaction /api/workers applies — someone who
  // may cost a job is not automatically someone who may read everyone's wage.
  const byWorker = new Map();
  for (const t of approved) {
    const key = t.workerId || "unknown";
    if (!byWorker.has(key))
      byWorker.set(key, {
        workerId: t.workerId || null,
        // Worker.userId, not Worker.id — the caller is a user, and comparing
        // the two ids would silently never match and hide everyone's own rate
        // from them.
        userId: t.worker?.userId || null,
        name: t.worker?.name || "Crew member",
        hours: 0,
        hourlyRate: t.worker?.hourlyRate == null ? null : Number(t.worker.hourlyRate),
        rateHidden: false,
      });
    byWorker.get(key).hours += Number(t.hours);
  }

  const crew = [...byWorker.values()].map((m) => {
    const round = (n) => Math.round(n * 100) / 100;
    if (showRates || (m.userId && m.userId === ownUserId))
      return { ...m, hours: round(m.hours) };
    // Marked hidden rather than nulled, for the same reason redactPay does:
    // a blank rate reads as "nobody has set one" and invites someone to fill
    // it in with a number they were not supposed to know.
    return { ...m, hours: round(m.hours), hourlyRate: null, rateHidden: true };
  });

  return {
    periods: periods.map((p) => ({
      ...p,
      hours: Math.round(p.hours * 100) / 100,
    })),
    hoursNotInAnyRun: Math.round(hoursNotInAnyRun * 100) / 100,
    crew,
  };
}

/**
 * Link this invoice to a job, or raise the job it should have had.
 *
 * ── Why this does not go through PATCH /api/invoices/[id] ──────────────────
 *
 * That route versions a sent invoice: editing one writes a NEW row so the
 * document the client received is preserved. That is right for money and wrong
 * for this — `jobId` is an internal cross-reference that changes nothing on the
 * client's copy, and versioning the invoice to record which job it belongs to
 * would mint a second INV-2026-0007 every time somebody linked one.
 */
export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  let full = null;
  try {
    full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "invoices", "view_create_edit", "link a job to an invoice");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const invoice = await db.invoice.findFirst({
    where: { id, companyId: member.companyId },
    select: INVOICE_SELECT,
  });
  if (!invoice)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const payload = await request.json().catch(() => ({}));
  const action = String(payload?.action || "");

  if (action === "createJob") {
    // Creating work is a jobs permission, not an invoices one. Both are checked
    // — the invoice gate above says you may change this invoice, this one says
    // you may put a job on the board.
    try {
      requirePermission(member.role, "job:create");
      requireLevel(full, "jobs", "view_create_edit", "create jobs");
    } catch (err) {
      const { body, status } = permissionErrorResponse(err);
      return NextResponse.json(body, { status });
    }

    const title = String(payload?.title || "").trim().slice(0, 200);
    if (!title)
      return NextResponse.json(
        { error: "Give the job a title." },
        { status: 400 },
      );

    const { job, error, status } = await createJob(db, {
      companyId: member.companyId,
      createdByUserId: member.userId,
      clientId: invoice.clientId,
      // Carried across so the job traces back to the quote too, which is what
      // every other surface (job costing, the accepted-quote task) matches on.
      quoteId: invoice.quoteId,
      title,
    });
    if (error) return NextResponse.json({ error }, { status });

    await db.invoice.update({
      where: { id: invoice.id },
      data: { jobId: job.id },
    });

    return NextResponse.json({ job: await reloadJob(job.id, member.companyId) }, {
      status: 201,
    });
  }

  if (action === "linkJob") {
    const jobId = String(payload?.jobId || "");
    const job = await db.job.findFirst({
      where: { id: jobId, companyId: member.companyId },
      select: { id: true, clientId: true },
    });
    if (!job)
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    // Refused rather than allowed with a warning: an invoice pointed at another
    // client's job would put that client's timesheets and expenses on this
    // invoice's cost panel, and the margin would be wrong in a way nobody could
    // see from the screen.
    if (job.clientId !== invoice.clientId)
      return NextResponse.json(
        { error: "That job belongs to a different client." },
        { status: 400 },
      );

    await db.invoice.update({
      where: { id: invoice.id },
      data: { jobId: job.id },
    });
    return NextResponse.json({ job: await reloadJob(job.id, member.companyId) });
  }

  if (action === "unlinkJob") {
    await db.invoice.update({
      where: { id: invoice.id },
      data: { jobId: null },
    });
    // The quote's job, if there is one, is still the answer — unlinking removes
    // the explicit override, it does not sever the pipeline.
    const fallback = await resolveInvoiceJob(
      db,
      { ...invoice, jobId: null },
      member.companyId,
      JOB_SELECT,
    );
    return NextResponse.json({
      job: fallback ? { ...fallback, linkSource: "quote" } : null,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

/**
 * The job as GET would return it, linkSource included.
 *
 * Merged onto the job rather than returned beside it, because that is where GET
 * puts it and the panel reads `job.linkSource`. Returned as a sibling field, a
 * freshly created job would have arrived with linkSource undefined and rendered
 * as "found through the quote" — which is the wrong sentence and would have hidden
 * the Unlink button for the link that had just been made.
 */
async function reloadJob(jobId, companyId) {
  const job = await db.job.findFirst({
    where: { id: jobId, companyId },
    select: JOB_SELECT,
  });
  return job ? { ...job, linkSource: "invoice" } : null;
}
