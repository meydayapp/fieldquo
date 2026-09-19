// app/api/invoices/[id]/send/route.js
//
// Actually emails the invoice to the client.
//
// ── The same bug as quotes, in the same shape ───────────────────────────────
//
// The invoice page's "Send" called PATCH { status: "sent" }. It changed a word
// on screen, then hid itself because the status was no longer draft, and
// nothing was ever sent. `Invoice.sentAt` recorded an intention rather than an
// event — a distinction that stops being academic the first time a client says
// "I never got an invoice" and the company points at a timestamp.
//
// ── Why this links to the portal, not to a PDF ──────────────────────────────
//
// The client portal shows what's owed, what's been paid, and mints a fresh
// Stripe checkout session at the moment they press Pay. A raw Stripe link
// expires in 24 hours; an attached PDF can't take a payment at all. Same
// reasoning as request-payment, which this deliberately mirrors so the two
// emails a client receives about one invoice behave identically.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { planOrRefusal } from "@/lib/signup/planGate";
import { recordActivity } from "@/lib/activity/log";
import { recordFeatureUse } from "@/lib/analytics/product/server";
import { sendEmail, SENDER_SELECT } from "@/lib/email/resend";
import { resolveSender } from "@/lib/email/companySender";
import { ensurePortalToken, portalInvoiceUrl } from "@/lib/clientPortal";
import { buildInvoiceEmail } from "@/lib/email/invoiceEmail";
import { loadDocumentCustomFields } from "@/lib/customFields/values";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { taxStatement, taxSendRefusal } from "@/lib/tax/documentTax";
import { attachUsTaxRate } from "@/lib/tax/usRates";
import { taskForSentInvoice } from "@/lib/tasks/autoCreate";
import { familyPayments } from "@/lib/invoices/family";
import { computeInvoiceState } from "@/lib/invoices/computeInvoiceState";
import { invoiceSendAsk } from "@/lib/invoices/sendAsk";
import { fileSentInvoiceDocument } from "@/lib/jobs/documentAutofile";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";

export async function POST(request, { params }) {
  const { id } = await params;

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "invoices", "view_create_edit", "send invoices");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  // Same rule as the quote send, for the same reason: the invoice may be
  // built, and it may not go out under a company name FieldQuo has never been
  // paid to carry. See lib/signup/planGate.js.
  const { response: unpaid } = await planOrRefusal(member, "send this invoice");
  if (unpaid) return unpaid;

  const invoice = await db.invoice.findFirst({
    where: { id, companyId: member.companyId },
    include: { client: true },
  });
  if (!invoice)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // A past job entered after the fact — paid before it was typed in. The
  // page hides Send on these; the route refuses too, because a button hidden
  // in one place is not a rule.
  if (invoice.historicalImportedAt) {
    return NextResponse.json(
      { error: "This invoice was entered as a past job. Nothing is sent to the client for past jobs.", historical: true },
      { status: 409 },
    );
  }

  const to = invoice.client?.email?.trim();
  if (!to) {
    return NextResponse.json(
      {
        error: `${invoice.client?.name || "This client"} has no email address on file. Add one on their client record, then send.`,
      },
      { status: 400 },
    );
  }

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: {
      ...SENDER_SELECT,
      logoUrl: true,
      brandColor: true,
      phone: true,
      // Not optional, and its absence was silent. buildInvoiceEmail calls
      // documentFormatters(language, company?.currency), which falls back to
      // CAD — so a GBP company's invoice email printed "$1,000.00" for the
      // same job its quote email had priced at "£1,000.00". The quote send
      // route has always selected this; the two routes mirror each other
      // (AGENTS.md) and this one had drifted.
      currency: true,
      paymentTerms: true,
      paymentMethods: true,
      defaultLanguage: true,
      stripeAccountId: true,
      stripeChargesEnabled: true,
      // For the tax gate below.
      taxRate: true,
      autoApplyLocalTax: true,
      country: true,
      province: true,
      vatRegistered: true,
      usTaxOverrides: true,
    },
  });

  // ── The tax gate ─────────────────────────────────────────────────────────
  //
  // The same stop as app/api/quotes/[id]/send, for the same reason and in the
  // same shape — invoices mirror quotes (AGENTS.md), and an invoice is the
  // HARDER of the two numbers: it is what the household actually owes and what
  // the company will have to remit against. Three of the three invoices ever
  // sent from this deployment carried tax $0.00 on work in Ontario and Quebec.
  //
  // Placed before the portal token is minted so a refused send leaves nothing
  // behind, and it re-prices nothing — it reads the stored amount and refuses.
  const taxRates = await db.taxRate.findMany({
    where: { companyId: member.companyId },
  });
  const refusal = taxSendRefusal(
    taxStatement({
      taxEnabled: invoice.taxEnabled,
      tax: invoice.tax,
      // Inherited from the quote at creation; a stated zero there is a
      // "none" here too.
      stored: invoice.taxResolution,
      company: company || {},
      taxRates,
      client: await attachUsTaxRate(invoice.client),
      asOf: invoice.createdAt,
    }),
    { client: invoice.client },
  );
  if (refusal) return NextResponse.json(refusal, { status: 409 });

  // ── What this send asks for ──────────────────────────────────────────
  //
  // The stage the money received has not covered yet, when the job has a
  // payment schedule; the balance when it has none; a refusal when it is all
  // collected. lib/invoices/sendAsk.js says why the button and the 06:10
  // cron must agree on this. Payments are read family-wide, as the detail
  // page reads them, so a v2 does not forget what was paid on v1.
  const payments = await familyPayments(db, invoice.id);
  const money = computeInvoiceState({ total: invoice.total, payments, priorStatus: invoice.status });
  const stages = await db.jobPaymentStage.findMany({
    where: { companyId: member.companyId, invoiceId: invoice.id },
    select: { id: true, seq: true, label: true, amountCents: true, status: true },
  });
  const ask = invoiceSendAsk({ totalCents: Math.round(Number(invoice.total) * 100), paidCents: Math.round(money.amountPaid * 100), stages });
  if (ask.kind === "nothing_owed") {
    return NextResponse.json(
      { error: "Everything on this invoice has been collected, so there is nothing to ask the client for.", code: "nothing_owed", ask },
      { status: 409 },
    );
  }

  const token = await ensurePortalToken(db, invoice.clientId, member.companyId);
  if (!token) {
    return NextResponse.json(
      { error: "Couldn't create a portal link for this client." },
      { status: 500 },
    );
  }

  // Whether the Pay button in the email will actually work. Said plainly in
  // the email rather than shown as a button that 500s on tap.
  const canTakeCard = Boolean(
    company?.stripeAccountId && company?.stripeChargesEnabled,
  );

  const { from, replyTo } = await resolveSender(company || {}, member.companyId);
  // The company's own boxes flagged for the document (a PO number), the same
  // line the PDF and the portal print.
  const customFields = await loadDocumentCustomFields(db, member.companyId, "invoice", invoice.id);
  const { subject, html, text } = buildInvoiceEmail({
    invoice: { ...invoice, customFields },
    client: invoice.client,
    company: company || {},
    // Deep-link to the invoice itself (the page with the Pay button), not the
    // portal home — one click to pay instead of hunting through a list. With
    // `?stage=<id>` when a stage is asked for, so the portal's Pay button
    // takes THAT amount (app/api/portal/[token]/pay/route.js re-derives it
    // from the row and requires the row to be `requested`, which the write
    // below makes it).
    url: portalInvoiceUrl(token, invoice.id, request) + (ask.stage ? `?stage=${ask.stage.id}` : ""),
    canTakeCard,
    requestAmount: ask.requestCents / 100,
    note: ask.stage ? ask.stage.label : null,
    language: resolveClientLanguage({
      document: invoice,
      client: invoice.client,
      company,
    }),
  });

  const result = await sendEmail({ companyId: member.companyId, to, subject, html, text, from, replyTo });

  if (result?.skipped) {
    return NextResponse.json(
      {
        error:
          "Email isn't configured on this deployment yet — RESEND_API_KEY is missing, so nothing was sent.",
      },
      { status: 503 },
    );
  }

  if (result?.error) {
    const message =
      typeof result.error === "string"
        ? result.error
        : result.error?.message || "Send failed";
    return NextResponse.json(
      {
        error: /not verified|testing emails|can only send/i.test(message)
          ? "Resend only delivers to your own account address until a sending domain is verified. Set one up under Settings → Email Domain."
          : `The email couldn't be sent. ${message}`,
      },
      { status: 502 },
    );
  }

  // Only after the send is accepted.
  const updated = await db.invoice.update({
    where: { id: invoice.id },
    data: {
      sentAt: new Date(),
      sentToEmail: to,
      // Don't drag a paid or overdue invoice back to "sent" because someone
      // emailed a copy of it.
      ...(invoice.status === "draft" ? { status: "sent" } : {}),
    },
    select: { status: true, sentAt: true, sentToEmail: true },
  });

  // The stage asked for is marked requested, exactly as the cron marks it
  // (lib/paymentSchedule/run.js requestStagePayment), so the portal link
  // takes its amount and the cron does not ask for it a second time. Only a
  // pending stage changes: one already requested keeps its first stamp.
  if (ask.stage && ask.stage.status === "pending") {
    await db.jobPaymentStage.updateMany({
      where: { id: ask.stage.id, companyId: member.companyId, status: "pending" },
      data: { status: "requested", requestedAt: new Date() },
    });
  }

  // The invoice as it just went out, filed on the job it bills for — the
  // owner's "invoice as part of the documents". After sentAt is stamped,
  // because that stamp is in the document's key: this send is one row, and
  // the next send supersedes it (lib/jobs/documentAutofile.js). Only when
  // the invoice has a job; never a reason for the send to report failure.
  try {
    await fileSentInvoiceDocument({ invoiceId: invoice.id, byUserId: member.userId });
  } catch (err) {
    console.error("[invoice send] job document:", err?.message);
  }

  // Usage count — see lib/analytics/product/server.js.
  await recordFeatureUse("invoice_sent", { companyId: member.companyId, memberId: member.id });

  await recordActivity(member, {
    action: "invoice.sent",
    entityType: "invoice",
    entityId: invoice.id,
    summary: ask.stage
      ? `Sent invoice ${invoice.invoiceNumber} to ${to}, asking for ${ask.stage.label} (${(ask.requestCents / 100).toFixed(2)})`
      : `Sent invoice ${invoice.invoiceNumber} to ${to}`,
    metadata: { to, total: invoice.total, requested: ask.requestCents / 100, collected: ask.collectedCents / 100, stage: ask.stage ? ask.stage.label : null },
  });

  // A chase-it reminder a week out. After the send, never before: a task
  // telling someone to follow up an invoice that never left is worse than no
  // task. Keyed on the invoice id, so emailing a second copy doesn't produce a
  // second reminder about the same debt.
  await taskForSentInvoice(invoice.id);

  // See the same line in app/api/quotes/[id]/send/route.js: a demo's send is
  // recorded exactly like a real one, so this flag is the only thing that can
  // stop the UI claiming an email arrived.
  return NextResponse.json({
    ...updated,
    to,
    messageId: result?.id || null,
    simulated: result?.simulated === true,
    // What was asked for, so the screen can say "asked for Deposit: $1,500"
    // rather than "sent".
    ask: { kind: ask.kind, requested: ask.requestCents / 100, collected: ask.collectedCents / 100, remaining: ask.remainingCents / 100, stage: ask.stage ? { label: ask.stage.label, index: ask.stage.index, count: ask.stage.count } : null },
  });
}
