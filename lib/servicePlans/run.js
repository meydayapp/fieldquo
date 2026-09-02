// lib/servicePlans/run.js
//
// The engine. Everything that turns a service plan into money passes through
// here, and nothing else in the codebase may bill a plan.
//
// ── The two tiers, and why tier 1 must work on its own ──────────────────────
//
//   1. INVOICE PER OCCURRENCE. The occurrence raises a real invoice and emails
//      the client the existing pay link. No stored card, no mandate, no Stripe
//      Connect requirement beyond the one the pay link already has. This is the
//      default and it is the FALLBACK for every failure in tier 2.
//
//   2. AUTOMATIC CHARGE. The same invoice, plus an off-session PaymentIntent
//      against a payment method the client authorised in advance
//      (lib/servicePlans/consent.js, lib/servicePlans/stripeMandate.js).
//
// Tier 2 is built on top of tier 1, never instead of it. A declined card, a
// bank asking for authentication the absent client cannot give, a revoked
// mandate, a client who never finished the setup form — every one of those ends
// with the client holding a payable invoice and the contractor being told why.
// The one outcome that must never happen is an occurrence that quietly collects
// nothing and looks fine.
//
// ── Order of operations, and why it is this way round ───────────────────────
//
// The occurrence row is created BEFORE the invoice. It carries the unique
// (planId, seq) index, so claiming the sequence number is what makes a doubled
// cron run harmless. Creating the invoice first and the occurrence second would
// mean a lost race leaves a real invoice, addressed to a real client, that
// nothing owns.

import { db } from "@/lib/db";

import { sendEmail, SENDER_SELECT } from "@/lib/email/resend";
import { resolveSender } from "@/lib/email/companySender";
import { buildInvoiceEmail } from "@/lib/email/invoiceEmail";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { ensurePortalToken, portalInvoiceUrl } from "@/lib/clientPortal";
import { allocateInvoiceNumber } from "@/lib/invoices/invoiceNumber";
import { recordStripePayment } from "@/lib/invoices/recordStripePayment";
import { dueOccurrences, termIsFinished } from "@/lib/servicePlans/schedule";
import { occurrenceAmounts } from "@/lib/servicePlans/pricing";
import { isChargeable } from "@/lib/servicePlans/authorisation";
import {
  chargeOccurrenceOffSession,
  retrievePaymentIntent,
} from "@/lib/servicePlans/stripeMandate";


const COMPANY_SELECT = {
  ...SENDER_SELECT,
  id: true,
  logoUrl: true,
  brandColor: true,
  phone: true,
  currency: true,
  paymentTerms: true,
  paymentMethods: true,
  defaultLanguage: true,
  stripeAccountId: true,
  stripeChargesEnabled: true,
};

/** Everything the engine needs about one plan, in one read. */
function planInclude() {
  return {
    client: true,
    authorisation: true,
    occurrences: { select: { seq: true } },
  };
}

/**
 * Raise the invoice for one occurrence.
 *
 * Split out because the repair path (an occurrence whose process died between
 * claiming a sequence number and writing the invoice) needs exactly this and
 * must not be a second copy of it.
 */
async function raiseInvoice({ plan, company, occurrence, amounts }) {
  // The collision-checked allocator, not "one more than the last row" — a plan
  // raises invoices from a cron with no human watching, which is exactly where
  // two invoices in the same second would go unnoticed. There is no quote behind
  // a plan occurrence, so it takes the plain running sequence.
  const invoiceNumber = await allocateInvoiceNumber(db, {
    companyId: plan.companyId,
  });

  const invoice = await db.invoice.create({
    data: {
      companyId: plan.companyId,
      invoiceNumber,
      clientId: plan.clientId,
      createdById: plan.createdById || null,
      lineItems: [
        {
          description: `${plan.name} — ${plan.serviceName}`,
          quantity: 1,
          amount: amounts.gross,
        },
      ],
      // Same convention as every other invoice in this codebase: subtotal is
      // PRE-discount, the discount is its own column, tax applies after it.
      subtotal: amounts.gross,
      discount: amounts.discount,
      tax: amounts.tax,
      // A plan states its own tax rate, and `taxRatePct: null` means the
      // company said none applies to this arrangement — a decision, not a
      // gap. Recording it stops the invoice claiming tax applies and then
      // charging nothing, which is what the send gate refuses to post.
      taxEnabled: plan.taxRatePct !== null && plan.taxRatePct !== undefined,
      total: amounts.total,
      amountDue: amounts.total,
      // The occurrence date IS the billing date — it is the date the client was
      // told they would be charged on. Company.paymentTerms is free text ("50%
      // on completion"), not a day count, so there is no net-N to add here; and
      // inventing one would put a date on the document that nobody agreed to.
      dueDate: occurrence.dueDate,
      status: "sent",
      // A document keeps the language it was created in (AGENTS.md #6). The
      // plan's language was fixed when it was sold.
      language: plan.language || "en",
    },
    include: { client: true },
  });

  await db.servicePlanOccurrence.update({
    where: { id: occurrence.id },
    data: { invoiceId: invoice.id, status: "invoiced" },
  });

  return invoice;
}

/**
 * Email the client their invoice with the pay link — tier 1, and the fallback
 * for every tier-2 failure.
 *
 * `kind` picks the framing: "invoice" when we are asking for money, "paid" when
 * the money has already been taken under the client's authorisation and this is
 * their receipt. Same builder, same brand, same language — a client who has
 * agreed to automatic payments still gets a document from the contractor rather
 * than only a Stripe receipt from a company they have never heard of.
 */
async function emailInvoice({ plan, company, invoice, client, kind }) {
  if (!client?.email) {
    return { sent: false, reason: "no_client_email" };
  }

  const token = await ensurePortalToken(db, plan.clientId, plan.companyId);
  if (!token) return { sent: false, reason: "no_portal_token" };

  const canTakeCard = Boolean(company.stripeAccountId && company.stripeChargesEnabled);
  const { from, replyTo } = await resolveSender(company, plan.companyId);
  const { subject, html, text } = buildInvoiceEmail({
    invoice,
    client,
    company,
    url: portalInvoiceUrl(token, invoice.id),
    canTakeCard,
    kind,
    language: resolveClientLanguage({ document: invoice, client, company }),
  });

  const sent = await sendEmail({
    companyId: plan.companyId,
    from,
    replyTo,
    to: client.email,
    subject,
    html,
    text,
  });

  // The rule stated immediately below is enforced here rather than assumed.
  // `resend.emails.send()` used to throw a rejection, which aborted before the
  // write; sendEmail returns it, so an unchecked call would stamp sentAt on a
  // recurring invoice the client never got — every month, silently.
  if (sent?.error || sent?.skipped) {
    return { sent: false, reason: "send_failed" };
  }

  // sentAt records that something HAPPENED, not that somebody intended it — so
  // it is written only after Resend accepts, the same rule the send and
  // request-payment routes follow.
  await db.invoice.update({
    where: { id: invoice.id },
    data: { sentAt: new Date(), sentToEmail: client.email },
  });

  return { sent: true, to: client.email };
}

/**
 * Try to collect for one occurrence automatically.
 *
 * Returns the occurrence's new status. Never throws for a payment failure —
 * see chargeOccurrenceOffSession.
 */
async function collectAutomatically({ plan, company, invoice, occurrence, amounts }) {
  const result = await chargeOccurrenceOffSession({
    company,
    authorisation: plan.authorisation,
    amountCents: amounts.totalCents,
    description: `${plan.name} — ${invoice.invoiceNumber}`,
    metadata: {
      invoiceId: invoice.id,
      companyId: plan.companyId,
      servicePlanId: plan.id,
      servicePlanOccurrenceId: occurrence.id,
    },
    // One key per occurrence, for ever. A retried cron invocation cannot create
    // a second charge for the same visit even before the database is consulted.
    idempotencyKey: `fq-plan-occ-${occurrence.id}`,
  });

  const intentId = result.paymentIntent?.id || null;

  if (result.outcome === "succeeded") {
    await recordStripePayment(db, {
      invoiceId: invoice.id,
      paymentIntentId: intentId,
      amountCents: result.paymentIntent.amount_received ?? amounts.totalCents,
    });
    await db.servicePlanOccurrence.update({
      where: { id: occurrence.id },
      data: {
        status: "paid",
        stripePaymentIntentId: intentId,
        chargeAttemptedAt: new Date(),
        chargeFailureCode: null,
        chargeFailureMessage: null,
      },
    });
    return "paid";
  }

  if (result.outcome === "processing") {
    // Pre-authorized debit. The money is on its way and takes ~5 business days;
    // marking the invoice paid now would show a settled bill against money that
    // has not moved. Stripe sends the client the debit notification the mandate
    // requires, so they are not left uninformed while this sits.
    await db.servicePlanOccurrence.update({
      where: { id: occurrence.id },
      data: {
        status: "charging",
        stripePaymentIntentId: intentId,
        chargeAttemptedAt: new Date(),
      },
    });
    return "charging";
  }

  await db.servicePlanOccurrence.update({
    where: { id: occurrence.id },
    data: {
      status: "failed",
      ...(intentId ? { stripePaymentIntentId: intentId } : {}),
      chargeAttemptedAt: new Date(),
      chargeFailureCode: result.code || null,
      chargeFailureMessage: result.message || null,
    },
  });
  return "failed";
}

/**
 * Bring one plan up to date. Idempotent, and safe to call twice.
 *
 * @returns a small report per plan, for the cron's response and the logs.
 */
export async function runServicePlan(planId, { now = new Date() } = {}) {
  const plan = await db.servicePlan.findUnique({
    where: { id: planId },
    include: planInclude(),
  });
  if (!plan) return { planId, skipped: "not_found" };

  const company = await db.company.findUnique({
    where: { id: plan.companyId },
    select: COMPANY_SELECT,
  });
  if (!company) return { planId, skipped: "no_company" };

  const existingSeqs = plan.occurrences.map((o) => o.seq);

  // ── Repair first ─────────────────────────────────────────────────────────
  //
  // An occurrence that claimed its sequence number and then lost its process
  // before the invoice was written. `dueOccurrences` will never return that seq
  // again — it is "already generated" — so without this the client is simply
  // never billed for that visit and nothing anywhere says so.
  const orphans = await db.servicePlanOccurrence.findMany({
    where: { planId: plan.id, invoiceId: null, status: "pending" },
    orderBy: { seq: "asc" },
  });
  for (const orphan of orphans) {
    const amounts = occurrenceAmounts(plan);
    const invoice = await raiseInvoice({ plan, company, occurrence: orphan, amounts });
    await deliver({ plan, company, invoice, occurrence: orphan, amounts });
  }

  const { due, blocked, exhausted } = dueOccurrences(plan, { now, existingSeqs });

  if (blocked) {
    // A cancelled or completed plan is not an error and not a warning — it is
    // the normal end state, and it is the reason cancelling actually stops the
    // money. Reported so the cron's output can be read as proof.
    return { planId, blocked, billed: 0, repaired: orphans.length };
  }

  const results = [];
  for (const { seq, dueDate } of due) {
    const amounts = occurrenceAmounts(plan);

    let occurrence;
    try {
      occurrence = await db.servicePlanOccurrence.create({
        data: {
          planId: plan.id,
          seq,
          dueDate,
          status: "pending",
          subtotal: amounts.gross,
          discount: amounts.discount,
          tax: amounts.tax,
          total: amounts.total,
        },
      });
    } catch (err) {
      // P2002 on (planId, seq): a concurrent run claimed this occurrence. It is
      // billing it; we must not. This is the guarantee, not the fast path.
      if (err?.code === "P2002") {
        results.push({ seq, outcome: "claimed_elsewhere" });
        continue;
      }
      throw err;
    }

    const invoice = await raiseInvoice({ plan, company, occurrence, amounts });
    const outcome = await deliver({ plan, company, invoice, occurrence, amounts });
    results.push({ seq, invoiceId: invoice.id, ...outcome });
  }

  // Finished? Say so, once. A plan that has billed all six of its six visits
  // must not sit in the active list for ever waiting for a seventh.
  const seqsNow = new Set([...existingSeqs, ...due.map((d) => d.seq)]);
  if (
    plan.status === "active" &&
    (exhausted || termIsFinished(plan, { now, existingSeqs: seqsNow }))
  ) {
    await db.servicePlan.update({
      where: { id: plan.id },
      data: { status: "completed", completedAt: new Date() },
    });
  }

  return { planId, billed: results.length, repaired: orphans.length, results };
}

/**
 * Collect for one occurrence and tell the client, by whichever route the plan
 * actually has available.
 *
 * The `automatic` branch is guarded by isChargeable, not by collectionMode
 * alone: asking for automatic collection is a request, having a live mandate is
 * a capability, and conflating them is how a plan comes to charge nothing while
 * appearing to be set up.
 */
async function deliver({ plan, company, invoice, occurrence, amounts }) {
  const wantsAutomatic = plan.collectionMode === "automatic";
  const canCharge = wantsAutomatic && isChargeable(plan.authorisation);

  if (canCharge) {
    const status = await collectAutomatically({ plan, company, invoice, occurrence, amounts });
    if (status === "paid") {
      // RE-READ before building the receipt. `invoice` was loaded before the
      // charge, so its amountPaid is still 0 and its balance is still the full
      // total — and buildInvoiceEmail guards its "paid" framing on the balance
      // (deliberately, so a receipt can never claim money that didn't arrive).
      // Passing the stale row would silently downgrade the receipt to "please
      // pay" for money already taken, which is the worst email in this feature.
      const settled = await db.invoice.findUnique({ where: { id: invoice.id } });
      const mail = await emailInvoice({
        plan, company, invoice: settled || invoice, client: plan.client, kind: "paid",
      });
      return { collected: "charged", emailed: mail.sent, emailReason: mail.reason };
    }
    if (status === "charging") {
      // Nothing to email yet: the client has not been billed and has not been
      // asked to pay. Stripe's own mandate notification covers the interim, and
      // the settle pass sends the receipt or the pay link once it resolves.
      return { collected: "processing", emailed: false };
    }
    // Declined, or the bank wants authentication the absent client can't give.
    // Fall through to the pay link — this is why tier 1 must stand alone.
    const mail = await emailInvoice({
      plan, company, invoice, client: plan.client, kind: "invoice",
    });
    return {
      collected: "charge_failed",
      emailed: mail.sent,
      emailReason: mail.reason,
    };
  }

  const mail = await emailInvoice({
    plan, company, invoice, client: plan.client, kind: "invoice",
  });
  return {
    // Names the reason rather than reporting a bare "invoiced": a contractor who
    // asked for automatic collection and is getting pay links needs to know it
    // is because there is no mandate, not because the plan is working.
    collected: wantsAutomatic ? "invoiced_no_mandate" : "invoiced",
    emailed: mail.sent,
    emailReason: mail.reason,
  };
}

/**
 * Settle one occurrence from a PaymentIntent — the delayed-notification path.
 *
 * Called by the Stripe webhook AND by the cron's reconciliation pass, with the
 * same intent object shape, so a missing webhook subscription slows this down
 * rather than breaking it.
 */
export async function settleOccurrenceFromIntent(intent) {
  const occurrenceId = intent?.metadata?.servicePlanOccurrenceId;
  if (!occurrenceId) return { settled: false, reason: "no_occurrence" };

  const occurrence = await db.servicePlanOccurrence.findUnique({
    where: { id: occurrenceId },
    include: { plan: { include: { client: true } } },
  });
  if (!occurrence) return { settled: false, reason: "occurrence_missing" };
  if (occurrence.status === "paid") return { settled: true, reason: "already_paid" };
  if (!occurrence.invoiceId) return { settled: false, reason: "no_invoice" };

  const company = await db.company.findUnique({
    where: { id: occurrence.plan.companyId },
    select: COMPANY_SELECT,
  });

  if (intent.status === "succeeded") {
    await recordStripePayment(db, {
      invoiceId: occurrence.invoiceId,
      paymentIntentId: intent.id,
      amountCents: intent.amount_received ?? intent.amount,
    });
    await db.servicePlanOccurrence.update({
      where: { id: occurrence.id },
      data: { status: "paid", chargeFailureCode: null, chargeFailureMessage: null },
    });
    const invoice = await db.invoice.findUnique({ where: { id: occurrence.invoiceId } });
    if (invoice && company) {
      await emailInvoice({
        plan: occurrence.plan,
        company,
        invoice,
        client: occurrence.plan.client,
        kind: "paid",
      });
    }
    return { settled: true, status: "paid" };
  }

  // requires_payment_method / canceled — the debit came back. The invoice is
  // real and unpaid, so the client gets the pay link, which is tier 1 again.
  if (intent.status === "requires_payment_method" || intent.status === "canceled") {
    await db.servicePlanOccurrence.update({
      where: { id: occurrence.id },
      data: {
        status: "failed",
        chargeFailureCode: intent.last_payment_error?.code || intent.status,
        chargeFailureMessage:
          intent.last_payment_error?.message || "The payment did not clear.",
      },
    });
    const invoice = await db.invoice.findUnique({ where: { id: occurrence.invoiceId } });
    if (invoice && company) {
      await emailInvoice({
        plan: occurrence.plan,
        company,
        invoice,
        client: occurrence.plan.client,
        kind: "invoice",
      });
    }
    return { settled: true, status: "failed" };
  }

  return { settled: false, reason: intent.status };
}

/**
 * Reconcile every occurrence still in `charging` against Stripe.
 *
 * The webhook is an accelerator; this is the guarantee. Whether an endpoint is
 * subscribed to payment_intent.* is a dashboard setting we cannot read from
 * code, and "the invoice never got marked paid because a checkbox was off" is
 * exactly the class of silent money bug this codebase is swept for.
 */
export async function settlePendingCharges({ limit = 200 } = {}) {
  const pending = await db.servicePlanOccurrence.findMany({
    where: { status: "charging", stripePaymentIntentId: { not: null } },
    select: { id: true, stripePaymentIntentId: true },
    take: limit,
  });

  let settled = 0;
  for (const row of pending) {
    try {
      const intent = await retrievePaymentIntent(row.stripePaymentIntentId);
      const result = await settleOccurrenceFromIntent(intent);
      if (result.settled) settled += 1;
    } catch (err) {
      // One unreadable intent must not stop the pass for the others.
      console.error(`[service-plans] settle ${row.id}:`, err?.message);
    }
  }
  return { checked: pending.length, settled };
}
