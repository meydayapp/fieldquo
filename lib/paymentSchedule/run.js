// lib/paymentSchedule/run.js
//
// Everything that turns a company's payment schedule into a real event on a
// real job: creating a job's frozen stage rows, firing the deposit the
// moment a quote is accepted, and recomputing + firing every later stage as
// a job's dates become known or change. Mirrors lib/servicePlans/run.js's
// shape (claim-then-act ordering, a tier-1 path that must always work on its
// own) adapted to this feature's own design decision — see
// JobPaymentStage's schema comment: ONE invoice per job, requested in
// stages, not one invoice per stage.
//
// ── Why stage creation is here and not inline in quoteLifecycle.js ─────────
//
// lib/quotes/quoteLifecycle.js already reads as "everything an accepted
// quote sets in motion" at a glance — job, invoice, task, lead sync. Payment
// schedule stages are a fifth thing it sets in motion, best-effort exactly
// like the other four, and belongs behind one function call there rather
// than growing that file's own logic. See the wiring in onQuoteAccepted.

import { db } from "@/lib/db";
import { Resend } from "resend";
import { lazyClient } from "@/lib/lazyClient";
import { SENDER_SELECT } from "@/lib/email/resend";
import { resolveSender } from "@/lib/email/companySender";
import { buildInvoiceEmail } from "@/lib/email/invoiceEmail";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { ensurePortalToken, portalInvoiceUrl } from "@/lib/clientPortal";
import {
  PAYMENT_SCHEDULE_TRIGGERS,
  resolveStageDueDate,
  isStageDue,
  allocateAmountCents,
  validateSchedulePercentages,
} from "@/lib/paymentSchedule/engine";

const resend = lazyClient(() => new Resend(process.env.RESEND_API_KEY));

const COMPANY_SELECT = {
  ...SENDER_SELECT,
  id: true,
  logoUrl: true,
  brandColor: true,
  phone: true,
  currency: true,
  paymentMethods: true,
  defaultLanguage: true,
  stripeAccountId: true,
  stripeChargesEnabled: true,
};

/**
 * The company's structured schedule, or null when it doesn't have a valid
 * one. "Valid" here means the same thing lib/paymentSchedule/validate.js
 * enforces on save (percentages sum to 100) — re-checked on READ too,
 * defensively, so a row that somehow got out of sync (a bug, a hand-edited
 * database) is treated as absent rather than used to bill something wrong.
 * This is the single gate that decides "does this company get the
 * structured schedule, or the original single-invoice behaviour" — see
 * onQuoteAccepted below and the fallback it guarantees.
 */
export async function companyScheduleTemplate(companyId, deps = {}) {
  const prisma = deps.db || db;
  const stages = await prisma.paymentScheduleStage.findMany({
    where: { companyId },
    orderBy: { seq: "asc" },
  });
  if (stages.length === 0) return null;
  const { valid } = validateSchedulePercentages(stages);
  if (!valid) {
    console.error(
      `[paymentSchedule] company ${companyId} has a stage set that no longer sums to 100 — ignoring it, falling back to the single-invoice path`,
    );
    return null;
  }
  return stages;
}

/**
 * Create a job's frozen stage rows from its company's template, and fire
 * whichever ones don't wait on a date (on_invoice_created — the deposit).
 *
 * Idempotent: a job that already has stage rows (a retried webhook, a
 * double-click) is left alone — @@unique([jobId, seq]) is the real
 * guarantee, this check is the fast path, same convention
 * ensureInvoiceForQuote/ensureJobForAcceptedQuote already use.
 *
 * @returns { created: boolean, stages: object[] } — created:false when the
 *   company has no valid template (the caller's signal to do nothing further
 *   — the ORIGINAL single-invoice behaviour already ran and stays exactly as
 *   it was) or when stages already existed.
 */
export async function ensurePaymentScheduleForJob({ jobId, quoteId, invoiceId }, deps = {}) {
  const prisma = deps.db || db;
  if (!jobId || !quoteId || !invoiceId) return { created: false, stages: [] };

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true, companyId: true, startDate: true, endDate: true },
  });
  if (!job) return { created: false, stages: [] };

  const existing = await prisma.jobPaymentStage.findMany({ where: { jobId } });
  if (existing.length > 0) return { created: false, stages: existing };

  const template = await companyScheduleTemplate(job.companyId, { db: prisma });
  if (!template) return { created: false, stages: [] };

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: { acceptedTotal: true, total: true },
  });
  // The accepted total is what the client agreed to (extras included) —
  // exactly the figure lib/invoices/createInvoiceFromQuote.js already
  // prefers for the invoice itself, for the same reason: it must match the
  // number on the page the client clicked. Falls back to the quote's own
  // total for a quote marked accepted by hand, before acceptedTotal existed.
  const total = quote?.acceptedTotal ?? quote?.total ?? 0;
  const totalCents = Math.round(Number(total) * 100);

  const amounts = new Map(
    allocateAmountCents(template, totalCents).map((a) => [a.seq, a.amountCents]),
  );

  const rows = template.map((stage) => {
    const { dueDate, blockedReason } = resolveStageDueDate(stage.trigger, job);
    return {
      companyId: job.companyId,
      jobId: job.id,
      quoteId,
      templateStageId: stage.id,
      seq: stage.seq,
      label: stage.label,
      trigger: stage.trigger,
      percentage: stage.percentage,
      amountCents: amounts.get(stage.seq) ?? 0,
      dueDate,
      blockedReason,
      invoiceId,
    };
  });

  // skipDuplicates: the existence check above isn't inside a row lock (unlike
  // ensureJobForAcceptedQuote/ensureInvoiceForQuote, which both take one on
  // the Quote row), so two concurrent calls for the same job could both pass
  // it. @@unique([jobId, seq]) is the real guarantee; this just makes a lost
  // race a silent no-op instead of an unhandled P2002 that would otherwise
  // surface as a swallowed "payment schedule:" error in onQuoteAccepted's log
  // for no reason — the winning call already created every row correctly.
  await prisma.jobPaymentStage.createMany({ data: rows, skipDuplicates: true });
  const created = await prisma.jobPaymentStage.findMany({
    where: { jobId },
    orderBy: { seq: "asc" },
  });

  // Fire the deposit(s) now — not date-based, waits on nothing. Best-effort
  // per stage: one email failing must not stop the others, and must not
  // undo the rows already created (the schedule exists either way; a failed
  // send just means requestStagePayment gets tried again — see the cron,
  // which also retries any `pending` on_invoice_created row it finds, same
  // repair pattern lib/servicePlans/run.js uses for an orphaned occurrence).
  for (const stage of created) {
    if (stage.trigger === "on_invoice_created" && stage.status === "pending") {
      try {
        await requestStagePayment(stage.id, { db: prisma });
      } catch (err) {
        console.error(`[paymentSchedule] deposit stage ${stage.id}:`, err?.message);
      }
    }
  }

  return { created: true, stages: created };
}

/**
 * Fire ONE stage: email the client a request for exactly its share, via a
 * Stripe Checkout link capped to that figure (never the invoice's full
 * balance — see lib/stripe.js's createInvoiceCheckoutSession).
 *
 * A 0%-amount stage is "waived" instead — see the schema comment on
 * JobPaymentStage.status for why a $0 email is worse than none.
 *
 * Idempotent: a stage not in `pending` is left alone, so a retried cron run
 * or a doubled call from ensurePaymentScheduleForJob can't email a client
 * the same request twice.
 */
export async function requestStagePayment(stageId, deps = {}) {
  const prisma = deps.db || db;

  const stage = await prisma.jobPaymentStage.findUnique({
    where: { id: stageId },
    include: {
      invoice: { include: { client: true } },
      job: { select: { id: true, companyId: true } },
    },
  });
  if (!stage || stage.status !== "pending") {
    return { fired: false, reason: "not_pending" };
  }
  if (!stage.invoice) {
    return { fired: false, reason: "no_invoice" };
  }

  if (stage.amountCents <= 0) {
    await prisma.jobPaymentStage.update({
      where: { id: stage.id },
      data: { status: "waived", requestedAt: new Date() },
    });
    return { fired: true, outcome: "waived" };
  }

  const company = await prisma.company.findUnique({
    where: { id: stage.companyId },
    select: COMPANY_SELECT,
  });
  const client = stage.invoice.client;
  if (!company || !client?.email) {
    return { fired: false, reason: !company ? "no_company" : "no_client_email" };
  }

  const token = await ensurePortalToken(prisma, client.id, stage.companyId);
  if (!token) return { fired: false, reason: "no_portal_token" };

  const canTakeCard = Boolean(company.stripeAccountId && company.stripeChargesEnabled);
  const { from, replyTo } = await resolveSender(company, stage.companyId);
  // `?stage=<id>` tells the client-portal invoice page which stage this link
  // is for, so the pay button asks for THIS stage's amount, not the
  // invoice's full balance — see app/api/portal/[token]/pay/route.js, which
  // re-derives the amount from the stage row server-side rather than
  // trusting the query param for anything but which row to look up.
  const url = `${portalInvoiceUrl(token, stage.invoice.id)}?stage=${stage.id}`;

  const { subject, html, text } = buildInvoiceEmail({
    invoice: stage.invoice,
    client,
    company,
    url,
    canTakeCard,
    kind: "invoice",
    requestAmount: stage.amountCents / 100,
    note: stage.label,
    language: resolveClientLanguage({ document: stage.invoice, client, company }),
  });

  await resend.emails.send({ from, replyTo, to: client.email, subject, html, text });

  // The FIRST stage requested is what actually "sends" the invoice — see the
  // owner's own words for the deposit trigger: "that would be when the
  // invoice is created AND SENT." Written only if not already set, the same
  // once-only convention every sentAt column in this codebase keeps.
  if (!stage.invoice.sentAt) {
    await prisma.invoice.update({
      where: { id: stage.invoice.id },
      data: { sentAt: new Date(), sentToEmail: client.email, status: "sent" },
    });
  }

  await prisma.jobPaymentStage.update({
    where: { id: stage.id },
    data: { status: "requested", requestedAt: new Date() },
  });

  return { fired: true, outcome: "requested", to: client.email };
}

/**
 * Recompute every PENDING stage's dueDate/blockedReason from a job's
 * CURRENT dates, then fire whichever are now due.
 *
 * Recomputing every run (rather than trusting the stored dueDate) is what
 * makes a job's dates moving after the schedule was set actually move the
 * pending money with them — the owner's own answer to that question. A
 * stage already `requested` is never touched here: its dueDate is frozen the
 * moment it fires, on purpose (see the schema comment).
 */
export async function recomputeAndFirePendingStages(jobId, { now = new Date(), db: deps } = {}) {
  const prisma = deps || db;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true, startDate: true, endDate: true },
  });
  if (!job) return { jobId, checked: 0, fired: 0 };

  const pending = await prisma.jobPaymentStage.findMany({
    where: { jobId, status: "pending" },
    orderBy: { seq: "asc" },
  });

  let fired = 0;
  for (const stage of pending) {
    const { dueDate, blockedReason } = resolveStageDueDate(stage.trigger, job);

    const changed =
      (dueDate?.getTime() ?? null) !== (stage.dueDate?.getTime() ?? null) ||
      blockedReason !== stage.blockedReason;
    if (changed) {
      await prisma.jobPaymentStage.update({
        where: { id: stage.id },
        data: { dueDate, blockedReason },
      });
    }

    if (isStageDue({ ...stage, dueDate }, { now })) {
      const result = await requestStagePayment(stage.id, { db: prisma });
      if (result.fired) fired++;
    }
  }

  return { jobId, checked: pending.length, fired };
}

/**
 * The cron entry point: every job with at least one PENDING stage, brought
 * up to date. One malformed job must not stop the run for the others — same
 * rule app/api/cron/service-plans/route.js follows, money makes it more
 * important not less.
 */
export async function runPaymentSchedule({ now = new Date() } = {}) {
  const jobIds = await db.jobPaymentStage.findMany({
    where: { status: "pending" },
    select: { jobId: true },
    distinct: ["jobId"],
  });

  const results = [];
  let fired = 0;
  for (const { jobId } of jobIds) {
    try {
      const result = await recomputeAndFirePendingStages(jobId, { now });
      fired += result.fired;
      results.push(result);
    } catch (err) {
      console.error(`[paymentSchedule] job ${jobId}:`, err?.message);
      results.push({ jobId, error: err.message });
    }
  }

  return { jobsChecked: jobIds.length, stagesFired: fired, results };
}

export { PAYMENT_SCHEDULE_TRIGGERS };
