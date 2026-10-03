// lib/paymentSchedule/poHold.js
//
// "No PO, no invoice" — the owner's decision of 3 October 2026, the industry
// standard for a client whose payables desk rejects an invoice without their
// purchase-order number.
//
//   Client requires a PO, quote accepted with none:
//     the job's invoice is still CREATED (a draft, carrying everything else)
//     but the deposit request is HELD — not emailed — and the office is told:
//     "Northline requires a PO — add it to send the deposit request".
//   The PO is entered on the quote, the job or the invoice:
//     the held request goes out, automatically, ONCE.
//   Every other client: unchanged — the request goes the moment it is due.
//   An invoice already sent: unchanged — stage requests and reminders keep
//     going whatever the PO says; they are about a document the client holds.
//
// ══ Exactly once ═════════════════════════════════════════════════════════════
//
// A held stage carries JobPaymentStage.heldForPoAt. Release is a CLAIM: one
// conditional write, `heldForPoAt: not null → null` on a still-pending row.
// Two saves of the PO racing each other (the job page and the invoice editor,
// a double-click) both read the stage as held; only one of them can flip the
// column, and only the one whose write counted sends. The deposit trigger
// (`on_invoice_created`) is never fired by the cron (isStageDue refuses it),
// so the claim is the only door it has.
//
// Everything here takes the Prisma client as an argument, so
// scripts/check-client-po.mjs runs the real hold and the real release against
// a recording fake. `fire` is injectable for the same reason: the real one is
// lib/paymentSchedule/run.js requestStagePayment, which sends email.

import { appSentence } from "@/lib/notify/push";
import { fallbackAuthorId } from "@/lib/tasks/autoCreate";
import { holdPaymentRequestForPo, poHoldTaskKey } from "@/lib/documents/clientPo";
import { isStageDue } from "@/lib/paymentSchedule/engine";

/**
 * Hold this stage if its invoice's client requires a PO and has none yet.
 *
 * @param prisma  Prisma client or transaction
 * @param stage   a JobPaymentStage row with `invoice: { …, client }` loaded —
 *                exactly what requestStagePayment already reads
 * @returns {Promise<boolean>} true when held (the caller must NOT send)
 */
export async function holdStageIfPoMissing(prisma, stage) {
  const invoice = stage?.invoice;
  if (!stage || !invoice) return false;
  if (!holdPaymentRequestForPo({ client: invoice.client, invoice })) return false;

  // First hold stamps the time; a later re-hold (the cron finding the same
  // stage due again) leaves the first stamp — it says how long it has waited.
  await prisma.jobPaymentStage.updateMany({
    where: { id: stage.id, status: "pending", heldForPoAt: null },
    data: { heldForPoAt: new Date() },
  });
  await taskForHeldRequest(prisma, { stage, invoice });
  return true;
}

/**
 * The office's prompt: one open task per invoice, in the company's language.
 * The unique index on Task.sourceKey makes a second hold of the same invoice
 * a no-op (P2002), so a deposit and a later stage held on the same invoice
 * are one thing to do, not two. Never throws — a missing task must not turn a
 * held request into a sent one.
 */
async function taskForHeldRequest(prisma, { stage, invoice }) {
  try {
    const companyId = invoice.companyId || stage.companyId;
    const createdById = await fallbackAuthorId(companyId, prisma);
    if (!createdById) return null;
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { defaultLanguage: true } });
    const language = company?.defaultLanguage || "en";
    const params = { client: invoice.client?.name || "", stage: stage.label || "", number: invoice.invoiceNumber || "" };
    const title = await appSentence(language, "app.autoTask.poHold.title", params);
    const description = await appSentence(language, "app.autoTask.poHold.desc", params);
    return await prisma.task.create({
      data: {
        companyId,
        title: title || `${params.client} requires a PO — add it to send the ${params.stage} request`,
        description,
        priority: "high",
        createdById,
        sourceKey: poHoldTaskKey(invoice.id),
        clientId: invoice.clientId || null,
        invoiceId: invoice.id,
        jobId: stage.jobId || null,
      },
      select: { id: true },
    });
  } catch (err) {
    if (err?.code === "P2002") return null;
    console.error("[poHold] task:", err?.message);
    return null;
  }
}

/**
 * A PO has just been written somewhere: send what was held for it.
 *
 * @param prisma
 * @param p.invoiceIds  the invoices that may now carry a PO (the caller's
 *                      document, or the job's invoices). Stages on other
 *                      invoices are never touched.
 * @param p.fire        (stageId) => Promise<{ fired, … }> — requestStagePayment
 *                      in production; injected by the check
 * @param p.now
 * @returns {Promise<Array<{ stageId, result }>>} one entry per stage this call
 *          CLAIMED; a stage another caller claimed first is not in it
 */
export async function releaseHeldPaymentRequests(prisma, { invoiceIds = [], fire, now = new Date() } = {}) {
  const ids = [...new Set((Array.isArray(invoiceIds) ? invoiceIds : []).filter(Boolean))];
  if (!ids.length || typeof fire !== "function") return [];

  const held = await prisma.jobPaymentStage.findMany({
    where: { invoiceId: { in: ids }, status: "pending", heldForPoAt: { not: null } },
    orderBy: { seq: "asc" },
    select: { id: true, invoiceId: true, trigger: true, dueDate: true },
  });

  const out = [];
  for (const stage of held) {
    // The claim. Whoever's write counts sends; everyone else stops here.
    const claim = await prisma.jobPaymentStage.updateMany({
      where: { id: stage.id, status: "pending", heldForPoAt: { not: null } },
      data: { heldForPoAt: null },
    });
    if (claim.count !== 1) continue;
    // The deposit is always due the moment it is released. A later stage
    // held by the cron is sent only if it is still due; one that is not
    // simply waits for its date like any other pending stage.
    const due = stage.trigger === "on_invoice_created" || isStageDue(stage, { now });
    const result = due ? await fire(stage.id) : { fired: false, reason: "not_due" };
    out.push({ stageId: stage.id, result });
  }

  // The prompt is answered — for every invoice whose PO is now in, whether or
  // not a stage was claimed here (a parallel save may have sent it).
  for (const invoiceId of ids) {
    try {
      await prisma.task.updateMany({ where: { sourceKey: poHoldTaskKey(invoiceId), status: "open" }, data: { status: "done" } });
    } catch (err) {
      console.error("[poHold] resolve task:", err?.message);
    }
  }
  return out;
}

/**
 * The invoices a PO on this job can release: its own, and those raised from
 * its quote with no job link — the same family draftInvoicesFollowingJobPo
 * (lib/documents/clientPo.js) copies a job's PO onto. Roots only.
 */
export async function jobInvoiceIds(prisma, job) {
  if (!job?.id) return [];
  const rows = await prisma.invoice.findMany({
    where: {
      companyId: job.companyId,
      parentInvoiceId: null,
      OR: [{ jobId: job.id }, ...(job.quoteId ? [{ jobId: null, quoteId: job.quoteId }] : [])],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
