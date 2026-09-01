// lib/notifications/invoicePaymentNotice.js
//
// Tells the contractor's own team a client just paid — the one question the
// pre-launch money audit named as unanswerable without going to look
// (app/api/stripe/webhook/route.js handled payment_intent.succeeded for
// service-plan occurrences only; nothing anywhere sent a notification for an
// ordinary Stripe invoice payment).
//
// Scoped to Stripe payments on purpose. A MANUALLY recorded payment (cash,
// e-transfer, cheque — POST /api/payments) needs no notice: a staff member is
// literally on the invoice page typing it in when it happens, and telling
// them "you just did that" is noise. A Stripe payment settles with nobody
// from the company in the loop, which is the actual gap.
//
// ── The preference model ────────────────────────────────────────────────
//
// Reuses the existing NotificationRule catalog
// (app/api/settings/notification-rules/route.js's RULE_TYPES — large_quote's
// sibling) rather than inventing a second preferences surface. Default is ON:
// nobody could have opted into a rule type that didn't exist before this fix
// shipped, and "off by default" would leave every existing company exactly as
// blind as before. A company that wants it off creates the rule (the same
// settings screen large_quote already uses) and switches it off — the same
// mechanic, inverted defaults.
//
// ── Never blocks the payment it's reporting ─────────────────────────────
//
// Called fire-and-forget from lib/invoices/recordStripePayment.js, the same
// pattern app/api/jobs/[id]/visits/[visitId]/route.js uses for the "on my
// way" SMS: wrapped in its own try/catch so a Resend outage can never turn a
// real, already-recorded payment into a retried webhook.

import { db } from "@/lib/db";
import { Resend } from "resend";
import { lazyClient } from "@/lib/lazyClient";

const resend = lazyClient(() => new Resend(process.env.RESEND_API_KEY));

/**
 * @param {object} p
 * @param {string} p.invoiceId
 * @param {number} p.amount   what THIS payment was, in dollars
 * @param {object} [deps]     injection seam for scripts/check-money-flow.mjs
 *   and friends — same reason recordStripePayment.js takes its db as an
 *   argument rather than importing it.
 *
 * No `isPaid` parameter, deliberately: whether the invoice is now settled is
 * re-read from `invoice.amountDue` below, fetched fresh in the same query as
 * everything else this needs. Accepting it as a caller-supplied flag would be
 * a second copy of a fact recordStripePayment.js already computed a moment
 * earlier (AGENTS.md failure class #4) — cheap to recompute, and one less
 * place the two could disagree if a future caller passed a stale value.
 */
export async function notifyInvoicePayment({ invoiceId, amount }, deps = {}) {
  const prisma = deps.db || db;
  const mailer = deps.resend || resend;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      invoiceNumber: true,
      total: true,
      amountDue: true,
      companyId: true,
      company: { select: { name: true } },
      client: { select: { name: true } },
    },
  });
  if (!invoice) return { sent: 0, reason: "invoice_missing" };

  const rule = await prisma.notificationRule.findFirst({
    where: { companyId: invoice.companyId, type: "invoice_paid" },
  });
  // No rule row at all = never configured = default ON (see header). A rule
  // row that exists and is explicitly turned off is the only way to mute
  // this.
  if (rule && !rule.active) return { sent: 0, reason: "muted" };

  const recipients = await prisma.member.findMany({
    where: { companyId: invoice.companyId, role: { in: ["owner", "admin"] }, active: true },
    include: { user: true },
  });
  const addresses = recipients.map((m) => m.user?.email).filter(Boolean);
  if (addresses.length === 0) return { sent: 0, reason: "no_recipients" };

  const amountText = `$${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const dueText = Number(invoice.amountDue || 0) > 0.005
    ? `$${Number(invoice.amountDue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} still owing.`
    : "Invoice is now paid in full.";

  let sent = 0;
  for (const to of addresses) {
    await mailer.emails.send({
      // Matches app/api/cron/large-quote-check/route.js's own convention for
      // an internal, staff-facing notice: the company's name as the display
      // name, FieldQuo's own fixed sending address. This is not a
      // client-facing document, so the white-label rule (AGENTS.md
      // non-negotiable #: every document a HOMEOWNER sees carries the
      // contractor's own identity) doesn't apply here — the audience is the
      // contractor's own team.
      from: `${invoice.company?.name || "FieldQuo"} <notifications@fieldquo.com>`,
      to,
      subject: `Payment received — Invoice ${invoice.invoiceNumber}`,
      html: `<p>${amountText} was just paid on <strong>Invoice ${invoice.invoiceNumber}</strong> for <strong>${invoice.client?.name || "a client"}</strong>.</p><p>${dueText}</p>`,
    });
    sent++;
  }

  return { sent, reason: "sent" };
}
