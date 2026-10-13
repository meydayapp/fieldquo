// lib/payments/sendReceipt.js
//
// The ONE path that emails a client the receipt for a payment.
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// The owner, 2026-10-12, looking at INV-2026-0022: Maureen paid twice by
// e-transfer, "we have sent two receipts", and the job's email history showed
// none. Nothing had been sent. POST /api/payments recorded money and emailed
// nobody, and a Stripe payment told the company's own team
// (lib/notifications/invoicePaymentNotice.js) and not the client. His rule:
// FieldQuo sends a receipt automatically when a payment is recorded, one email
// per payment, in the client's language, and every receipt shows in the job
// and client email history.
//
// ── Who calls it ────────────────────────────────────────────────────────────
//
//   trigger "record"  app/api/payments/route.js — the "Email a receipt" box on
//                     Record payment, ticked by default from
//                     Company.emailPaymentReceipts
//   trigger "stripe"  lib/invoices/recordStripePayment.js — card, Klarna,
//                     Affirm, bank debit; only when the company setting is on
//   trigger "manual"  app/api/payments/[id]/receipt/route.js — the payment
//                     row's Send receipt / Resend receipt
//   trigger "retry"   app/api/cron/payment-receipts — failed attempts only
//
// ── Recorded, never blocking ────────────────────────────────────────────────
//
// sendPaymentReceipt never throws for a send problem; autoSendReceipt never
// throws at all. Every caller has already committed the payment, and a mail
// provider's bad minute must not turn money received into an error. But unlike
// the team notice it is not fire-and-forget into nowhere: every attempt writes
// the Payment's receipt columns, so the invoice page can say Sent / Failed /
// Not sent and the cron can retry exactly the ones that failed.
//
// ── Exactly once ────────────────────────────────────────────────────────────
//
// The send is CLAIMED before anything is built: a conditional update that
// matches only while receiptAttempts still holds the value this call read and
// no live claim is held. Postgres re-evaluates that WHERE after a concurrent
// writer commits, so of two cron runs, a cron run and a button, or a double
// click, one claims and the other gets count 0 and sends nothing. A receipt
// already sent is never sent again unless the caller asked for a RESEND (the
// confirmed button), and a resend inside a minute of the last send is refused
// as the double press it is.
//
// ── Tenancy ─────────────────────────────────────────────────────────────────
//
// The payment is read through its invoice's companyId and the invoice is read
// again by { id, companyId }; another company's payment id answers not_found
// and nothing is written. The demo gate is sendEmail's own (lib/email/
// resend.js): a demo company's receipt is simulated, recorded like a real one.

import { sendEmail as realSendEmail, SENDER_SELECT } from "@/lib/email/resend";
import { resolveSender as realResolveSender } from "@/lib/email/companySender";
import { recordSentEmail as realRecordSentEmail } from "@/lib/email/sentEmailHistory";
import { ensurePortalToken as realEnsurePortalToken, portalInvoiceUrl } from "@/lib/clientPortal";
import { latestInFamily, familyPayments } from "@/lib/invoices/family";
import { resolveInvoiceJob } from "@/lib/invoices/jobLink";
import { resolveReceiptLanguage } from "@/lib/i18n/clientLanguage";
import { buildReceiptEmail, receiptFigures, isRefundRow } from "@/lib/payments/receiptEmail";
import {
  RECEIPT_CLAIM_STALE_MS,
  RECEIPT_RESEND_GUARD_MS,
  RECEIPT_MAX_ATTEMPTS,
  RECEIPT_RETRY_WINDOW_MS,
  receiptRetryDue,
} from "@/lib/payments/receiptState";

export const RECEIPT_COMPANY_SELECT = Object.freeze({
  ...SENDER_SELECT,
  logoUrl: true,
  brandColor: true,
  phone: true,
  website: true,
  currency: true,
  defaultLanguage: true,
  taxIdName: true,
  taxIdNumber: true,
  emailPaymentReceipts: true,
});

const TRIGGERS = new Set(["record", "stripe", "manual", "retry"]);
const clip = (v, n) => String(v ?? "").slice(0, n);

function realDeps(deps = {}) {
  return {
    sendEmail: deps.sendEmail || realSendEmail,
    resolveSender: deps.resolveSender || realResolveSender,
    recordSentEmail: deps.recordSentEmail || realRecordSentEmail,
    ensurePortalToken: deps.ensurePortalToken || realEnsurePortalToken,
    portalUrl: deps.portalUrl || ((token, invoiceId) => portalInvoiceUrl(token, invoiceId)),
  };
}

async function logActivity(db, { companyId, actor, action, invoiceId, summary, metadata }) {
  try {
    if (!db?.activityLog?.create) return;
    await db.activityLog.create({
      data: {
        companyId,
        actorUserId: actor?.userId || null,
        actorMemberId: actor?.id || null,
        actorName: actor?.name || null,
        actorRole: actor?.role || null,
        viaImpersonation: false,
        action,
        entityType: "invoice",
        entityId: invoiceId,
        summary,
        metadata,
      },
    });
  } catch (err) {
    console.error("[receipt] activity not logged:", err?.message);
  }
}

/**
 * Send (or resend) the receipt for one payment.
 *
 * @param companyId  the tenant asking — the caller's own, never off a row
 * @param paymentId
 * @param trigger    "record" | "stripe" | "manual" | "retry"
 * @param resend     true only from the confirmed Resend button
 * @param actor      { id, userId, name, role } of the member who pressed, or
 *                   null for an automatic send
 * @returns {Promise<{ sent: boolean, reason?: string, status?: number, to?: string,
 *                     sentEmailId?: string|null, simulated?: boolean, error?: string }>}
 */
export async function sendPaymentReceipt(db, { companyId, paymentId, trigger = "manual", resend = false, actor = null, now = new Date() } = {}, deps = {}) {
  const d = realDeps(deps);
  if (!companyId || !paymentId || !TRIGGERS.has(trigger)) return { sent: false, reason: "bad_request", status: 400 };

  // ── Tenancy, then what kind of row this is ────────────────────────────────
  const payment = await db.payment.findFirst({ where: { id: String(paymentId), invoice: { companyId } } });
  if (!payment) return { sent: false, reason: "not_found", status: 404 };
  const own = await db.invoice.findFirst({ where: { id: payment.invoiceId, companyId }, select: { id: true, companyId: true } });
  if (!own || own.companyId !== companyId) return { sent: false, reason: "not_found", status: 404 };

  if (isRefundRow(payment)) return { sent: false, reason: "refund", status: 409 };

  const invoice = await latestInFamily(db, payment.invoiceId);
  if (!invoice || invoice.companyId !== companyId) return { sent: false, reason: "not_found", status: 404 };
  // A past job entered after the fact: nothing is sent to the client for it
  // (the same refusal app/api/invoices/[id]/send makes).
  if (invoice.historicalImportedAt) return { sent: false, reason: "historical", status: 409 };

  if (payment.receiptSentAt) {
    if (!resend) return { sent: false, reason: "already_sent", status: 200, to: payment.receiptSentTo || null };
    if (now.getTime() - new Date(payment.receiptSentAt).getTime() < RECEIPT_RESEND_GUARD_MS) {
      return { sent: false, reason: "just_sent", status: 409, to: payment.receiptSentTo || null };
    }
  }

  // ── The claim ─────────────────────────────────────────────────────────────
  //
  // A person's press starts a fresh round (attempt 1, a new 48-hour window),
  // so a press that fails is retried by the cron like any first attempt. An
  // automatic send or a retry continues the round it is in.
  const prevAttempts = Number(payment.receiptAttempts) || 0;
  const freshRound = trigger === "manual";
  const claim = await db.payment.updateMany({
    where: {
      id: payment.id,
      invoiceId: payment.invoiceId,
      receiptAttempts: prevAttempts,
      ...(resend ? {} : { receiptSentAt: null }),
      OR: [{ receiptClaimedAt: null }, { receiptClaimedAt: { lt: new Date(now.getTime() - RECEIPT_CLAIM_STALE_MS) } }],
    },
    data: {
      receiptClaimedAt: now,
      receiptAttempts: freshRound ? 1 : prevAttempts + 1,
      receiptFirstAttemptAt: freshRound || !payment.receiptFirstAttemptAt ? now : payment.receiptFirstAttemptAt,
      receiptLastAttemptAt: now,
    },
  });
  if (!claim?.count) {
    const again = await db.payment.findFirst({ where: { id: payment.id, invoiceId: payment.invoiceId }, select: { receiptSentAt: true, receiptSentTo: true } });
    if (again?.receiptSentAt && !resend) return { sent: false, reason: "already_sent", status: 200, to: again.receiptSentTo || null };
    return { sent: false, reason: "in_flight", status: 409 };
  }
  const attempt = freshRound ? 1 : prevAttempts + 1;

  const fail = async (code, extra = {}) => {
    const error = clip(code, 300);
    await db.payment.updateMany({
      where: { id: payment.id, invoiceId: payment.invoiceId, receiptClaimedAt: now },
      data: { receiptClaimedAt: null, receiptLastError: error },
    });
    // Logged when nothing automatic will follow: an address is missing, or
    // this was the last attempt. The ones in between are on the payment row.
    const final = code === "no_client_email" || attempt >= RECEIPT_MAX_ATTEMPTS || trigger === "manual";
    if (final) {
      await logActivity(db, {
        companyId,
        actor,
        action: "payment.receipt_failed",
        invoiceId: invoice.id,
        summary: `Receipt for a ${payment.method} payment of ${Number(payment.amount).toFixed(2)} on invoice ${invoice.invoiceNumber || invoice.id} was not sent (${error})`,
        metadata: { paymentId: payment.id, error, attempt, trigger },
      });
    }
    return { sent: false, reason: code === "no_client_email" ? "no_client_email" : "send_failed", status: code === "no_client_email" ? 400 : 502, error, ...extra };
  };

  try {
    const client = invoice.clientId
      ? await db.client.findFirst({ where: { id: invoice.clientId, companyId }, select: { id: true, name: true, email: true, language: true } })
      : null;
    const to = String(client?.email || "").trim();
    if (!client || !to) return await fail("no_client_email");

    const company = await db.company.findUnique({ where: { id: companyId }, select: RECEIPT_COMPANY_SELECT });
    if (!company) return await fail("company_missing");

    const token = await d.ensurePortalToken(db, client.id, companyId);
    if (!token) return await fail("no_portal_link");
    const url = d.portalUrl(token, invoice.id);

    const payments = await familyPayments(db, invoice.id);
    const figures = receiptFigures({ payment, payments, total: invoice.total });
    const language = resolveReceiptLanguage({ client, invoice, company });
    const { subject, html, text } = buildReceiptEmail({ payment, figures, invoice, client, company, url, language });

    const { from, replyTo } = await d.resolveSender(company, companyId);
    const result = await d.sendEmail({ companyId, to, subject, html, text, from, replyTo, clientMail: true });
    if (result?.skipped) return await fail("email_not_configured");
    if (!result || result.error) {
      const message = typeof result?.error === "string" ? result.error : result?.error?.message || "no answer from the mail provider";
      return await fail(`send_failed: ${message}`);
    }

    // ── It went. Keep the bytes, then mark the row. ────────────────────────
    const job = await resolveInvoiceJob(db, invoice, companyId).catch(() => null);
    const sentEmailId = await d.recordSentEmail(db, {
      companyId,
      kind: "receipt",
      clientId: client.id,
      jobId: job?.id || invoice.jobId || null,
      quoteId: invoice.quoteId || null,
      invoiceId: invoice.id,
      mail: { to, from, replyTo, subject, html, text },
      result,
      sentByUserId: actor?.userId || null,
      sentByName: actor?.name || null,
      language,
      now,
    });
    await db.payment.updateMany({
      where: { id: payment.id, invoiceId: payment.invoiceId },
      data: {
        receiptSentAt: now,
        receiptSentTo: clip(to, 320),
        receiptSentEmailId: sentEmailId || null,
        receiptLastError: null,
        receiptClaimedAt: null,
      },
    });
    await logActivity(db, {
      companyId,
      actor,
      action: "payment.receipt_sent",
      invoiceId: invoice.id,
      summary: `${resend ? "Resent" : "Sent"} the receipt for a ${payment.method} payment of ${Number(payment.amount).toFixed(2)} on invoice ${invoice.invoiceNumber || invoice.id} to ${to}`,
      // sentEmailId marks this row as a kept send, so the conversation
      // timeline lists the SentEmail and not this line as well.
      metadata: { paymentId: payment.id, to, trigger, resend: Boolean(resend), language, amount: Number(payment.amount), ...(sentEmailId ? { sentEmailId } : {}) },
    });
    return {
      sent: true,
      to,
      sentEmailId: sentEmailId || null,
      language,
      simulated: result?.simulated === true,
      simulatedReason: result?.simulatedReason || null,
      demoLive: result?.demoLive === true,
    };
  } catch (err) {
    console.error("[receipt] send failed:", err?.message);
    return fail(`error: ${err?.message || "unknown"}`);
  }
}

/**
 * The automatic send after a payment is recorded. Never throws — the payment
 * is already committed, and a receipt problem must not fail it.
 */
export async function autoSendReceipt(db, args, deps) {
  try {
    return await sendPaymentReceipt(db, args, deps);
  } catch (err) {
    console.error("[receipt] automatic send failed:", err?.message);
    return { sent: false, reason: "error", error: err?.message || "unknown" };
  }
}

/**
 * Does this company email clients a receipt automatically?
 *
 * Strictly `true`: the column is NOT NULL with a default of true, so a real
 * row always answers. Anything else — a test double, a row read without the
 * column — is absence, and absence is not consent to email a client.
 */
export async function companySendsReceipts(db, companyId) {
  try {
    const c = await db.company.findUnique({ where: { id: companyId }, select: { emailPaymentReceipts: true } });
    return c?.emailPaymentReceipts === true;
  } catch {
    return false;
  }
}

/**
 * The retry pass, for app/api/cron/payment-receipts. Only payments whose
 * receipt was ATTEMPTED and failed, still inside their window and under the
 * attempt cap, and due by the backoff — never one nobody tried.
 */
export async function retryFailedReceipts(db, { now = new Date(), limit = 50 } = {}, deps = {}) {
  const rows = await db.payment.findMany({
    where: {
      kind: "payment",
      receiptSentAt: null,
      receiptAttempts: { gte: 1, lt: RECEIPT_MAX_ATTEMPTS },
      receiptFirstAttemptAt: { gte: new Date(now.getTime() - RECEIPT_RETRY_WINDOW_MS) },
    },
    select: {
      id: true,
      kind: true,
      receiptSentAt: true,
      receiptAttempts: true,
      receiptFirstAttemptAt: true,
      receiptLastAttemptAt: true,
      receiptLastError: true,
      receiptClaimedAt: true,
      invoice: { select: { companyId: true } },
    },
    orderBy: { receiptLastAttemptAt: "asc" },
    take: limit,
  });
  const tally = { considered: rows.length, sent: 0, failed: 0, skipped: 0 };
  for (const row of rows) {
    if (!row.invoice?.companyId || !receiptRetryDue(row, now)) {
      tally.skipped++;
      continue;
    }
    const r = await autoSendReceipt(db, { companyId: row.invoice.companyId, paymentId: row.id, trigger: "retry", now }, deps);
    if (r.sent) tally.sent++;
    else if (r.reason === "send_failed" || r.reason === "no_client_email" || r.reason === "error") tally.failed++;
    else tally.skipped++;
  }
  return tally;
}
