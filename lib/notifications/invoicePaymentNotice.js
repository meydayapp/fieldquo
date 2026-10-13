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
//
// ── What it says (2026-10-13) ───────────────────────────────────────────
//
// The same two sentences as before, now on FieldQuo's team-notice layout
// (lib/email/teamNotice.js) with a facts card — client, invoice, amount paid,
// payment method, what is still owing, when — one button to the invoice, a
// plain-text part, and the line saying where this email is switched off. In
// each reader's own language (lib/notifications/teamReaders.js), with every
// amount in the COMPANY's currency: the "$" it used to hardcode told a UK
// contractor their client had paid dollars.

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/resend";
import { teamNoticeFrom, groupReaders, noticeOrigin } from "@/lib/email/teamNotice";
import { invoicePaidNotice } from "@/lib/notifications/teamEmails";

/**
 * @param {object} p
 * @param {string} p.invoiceId  the family's CURRENT invoice — the row whose
 *   balance recordStripePayment.js just rewrote. A checkout minted against v1
 *   and paid after the office amended it to v2 is recorded on v1 but owed on
 *   v2, and reading v1's amountDue printed a balance nobody had updated.
 * @param {number} p.amount   what THIS payment was, in the company's currency
 * @param {object} [p.payment] { method, feeRateLabel } — how it was paid, as
 *   the Payment row records it; named in the reader's language
 * @param {Date}   [p.paidAt]
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
export async function notifyInvoicePayment({ invoiceId, amount, payment = null, paidAt = new Date() }, deps = {}) {
  const prisma = deps.db || db;
  // The seam is sendEmail, not a Resend client: lib/email/resend.js is the
  // only module that constructs one now, so the demo interception has a single
  // place to sit.
  const mailer = deps.sendEmail || sendEmail;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      invoiceNumber: true,
      total: true,
      amountDue: true,
      companyId: true,
      company: { select: { name: true, currency: true, timezone: true, defaultLanguage: true } },
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

  // Lazily: the reader lookups load the app catalogue to know which language
  // codes exist, and this module sits on the Stripe webhook's import path.
  const { memberReaders, READER_MEMBER_SELECT } = await import("@/lib/notifications/teamReaders");
  const recipients = await prisma.member.findMany({
    where: { companyId: invoice.companyId, role: { in: ["owner", "admin"] }, active: true },
    select: READER_MEMBER_SELECT,
  });
  const readers = memberReaders(recipients, invoice.company);
  if (readers.length === 0) return { sent: 0, reason: "no_recipients" };

  const { receiptMethodLabel } = await import("@/lib/payments/receiptEmail");
  const origin = deps.origin || noticeOrigin();

  let sent = 0;
  // One email per reader, as before; grouped only so that two owners who
  // read the same language share one built letter.
  for (const group of groupReaders(readers)) {
    const mail = invoicePaidNotice({
      language: group.language,
      company: invoice.company || {},
      invoice,
      amount,
      methodLabel: payment ? receiptMethodLabel(payment, group.language) : null,
      paidAt,
      reader: group.reader,
      origin,
    });
    // A reader who may not see money is not told an amount was paid — the
    // in-app feed's money rule (lib/notifications/recipients.js).
    if (!mail) continue;
    for (const to of group.to) {
      await mailer({
        // The invoice's own company, read out of the row above rather than
        // accepted as an argument — same reasoning as the `isPaid` note.
        companyId: invoice.companyId,
        // Matches app/api/cron/large-quote-check/route.js's own convention for
        // an internal, staff-facing notice: the company's name as the display
        // name, FieldQuo's own fixed sending address. This is not a
        // client-facing document, so the white-label rule (AGENTS.md: every
        // document a HOMEOWNER sees carries the contractor's own identity)
        // doesn't apply here — the audience is the contractor's own team.
        from: teamNoticeFrom(invoice.company?.name),
        to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });
      sent++;
    }
  }

  return { sent, reason: sent ? "sent" : "no_recipients" };
}
