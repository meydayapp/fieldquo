// app/api/invoices/[id]/request-payment/route.js
//
// Emails the client a link to pay what's still owed on an invoice.
//
// The link goes to the client portal, not to a raw Stripe URL. Two reasons:
// a Stripe Checkout session expires after 24 hours, so a raw link in an inbox
// goes dead by the next morning; and the portal is where the client can see
// what they're paying for before they pay it. The portal mints a fresh
// checkout session at the moment they click Pay.
//
// ── What to ask for: three answers, all priced here ─────────────────────────
//
// The body's `mode` (lib/invoices/paymentRequest.js REQUEST_CHOICES):
//
//   "balance" (or no mode — every caller before 2026-10-07)
//       the chase as it always was: a reminder for the whole balance, the
//       plain invoice link. Unchanged, byte for byte.
//   "next_stage"
//       the job's next uncovered payment-schedule stage — the same stage, the
//       same amount, the same `?stage=` link and the same "deposit" wording
//       the invoice's Send button asks with (lib/invoices/sendAsk.js), and the
//       stage marked `requested` the same way.
//   "custom"
//       a different amount the OFFICE typed ("they want to pay $6,500").
//       Validated here against the balance this route computes — more than
//       nothing, no more than is owed, a plain number — and stored as an
//       InvoicePaymentRequest whose id is the only thing the client's link
//       carries (`?request=`). The client's pay routes read the amount from
//       that row; nothing the client's browser sends is ever a figure.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { planOrRefusal } from "@/lib/signup/planGate";
import { recordActivity } from "@/lib/activity/log";
import { sendEmail, SENDER_SELECT } from "@/lib/email/resend";
import { recordSentEmail, actorName } from "@/lib/email/sentEmailHistory";
import { resolveSender } from "@/lib/email/companySender";
import { ensurePortalToken, portalInvoiceUrl } from "@/lib/clientPortal";
import { buildInvoiceEmail } from "@/lib/email/invoiceEmail";
import { HOW_TO_PAY_COMPANY_SELECT } from "@/lib/payments/offlineMethods";
import { refreshFamilyLedger } from "@/lib/invoices/family";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { loadDocumentWording } from "@/lib/email/documentEmailCopies";
import { localisedCompany } from "@/lib/i18n/companyText";
import { loadPhrases } from "@/lib/i18n/phrases";
import {
  REQUEST_CHOICES,
  requestOptions,
  validateCustomAmount,
} from "@/lib/invoices/paymentRequest";

// The refusals the dialog turns into a sentence in the reader's language
// (app.invoiceDetail.requestRefused.<code>); `error` stays English for logs.
const CUSTOM_REFUSAL = {
  invalid_amount: "Type the amount as a number, like 6500 or 6500.50.",
  not_positive: "The amount has to be more than zero.",
  over_balance: "That is more than is owed on this invoice.",
  nothing_owed: "This invoice is already paid in full.",
};

export async function POST(request, { params }) {
  const { id } = await params;

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Asking a client for money on the company's behalf is not a view-only act.
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "invoices", "view_create_edit", "request payment");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  // Emails a client a link that takes their money. Both halves — the send and
  // the payment — are the outward act a plan is required for.
  const { response: unpaid } = await planOrRefusal(
    member,
    "ask this client to pay",
  );
  if (unpaid) return unpaid;

  const invoice = await db.invoice.findFirst({
    where: { id, companyId: member.companyId },
    include: { client: true },
  });
  if (!invoice)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // A past job entered after the fact was paid before it was typed in; there
  // is no balance to chase and no client to chase it from. The page hides the
  // button; the route refuses, because a button hidden in one place is not a
  // rule.
  if (invoice.historicalImportedAt) {
    return NextResponse.json(
      { error: "This invoice was entered as a past job. Nothing is sent to the client for past jobs.", historical: true },
      { status: 409 },
    );
  }

  // The balance this email quotes is the FAMILY's — every payment across the
  // invoice's versions — recomputed now, not the cached columns the version
  // was created with. An invoice amended before the family ledger existed
  // kept a stale cache that healed only when money moved; this route read
  // it and emailed a homeowner $1,390.72 for a $1,190.72 balance (QA rerun,
  // 6 September). Refreshing here also writes the truth back to the row.
  const ledger = await refreshFamilyLedger(db, invoice.id);
  if (ledger) {
    invoice.amountPaid = ledger.state.amountPaid;
    invoice.amountDue = ledger.state.amountDue;
    invoice.amountRefunded = ledger.state.amountRefunded;
    invoice.status = ledger.state.status;
  }

  if (!invoice.client?.email) {
    return NextResponse.json(
      {
        error: `${invoice.client?.name || "This client"} has no email address on file. Add one on their client record first.`,
      },
      { status: 400 },
    );
  }

  const balance =
    Number(invoice.total || 0) - Number(invoice.amountPaid || 0);

  if (balance <= 0) {
    return NextResponse.json(
      { error: "This invoice is already paid in full." },
      { status: 400 },
    );
  }

  // ── Which money to ask for ─────────────────────────────────────────────
  //
  // Read once, here, before anything is minted or emailed: a refused figure
  // must leave nothing behind. No `mode` is the chase as it always was.
  const body = await request.json().catch(() => ({}));
  const note = String(body?.note || "").trim();
  const mode =
    body?.mode === undefined || body?.mode === null || body?.mode === "" ? "balance" : body.mode;
  if (!REQUEST_CHOICES.includes(mode)) {
    return NextResponse.json({ error: "Choose what to ask for.", code: "unknown_mode" }, { status: 400 });
  }
  let options = null;
  let customCents = null;
  if (mode !== "balance") {
    // The ledger just refreshed above is what is collected; the stages say
    // what was scheduled. lib/invoices/paymentRequest.js allocates the one
    // against the other in sequence — the rule the Send button already uses.
    const stages = await db.jobPaymentStage.findMany({
      where: { companyId: member.companyId, invoiceId: invoice.id },
      select: { id: true, seq: true, label: true, amountCents: true, status: true },
    });
    options = requestOptions({
      totalCents: Math.round(Number(invoice.total || 0) * 100),
      paidCents: Math.round(Number(invoice.amountPaid || 0) * 100),
      stages,
    });
    if (mode === "next_stage" && !options.nextStage) {
      return NextResponse.json(
        {
          error: "There is no scheduled payment left to ask for. Ask for the balance or a different amount.",
          code: "no_next_stage",
        },
        { status: 409 },
      );
    }
    if (mode === "custom") {
      const verdict = validateCustomAmount({ input: body?.amount, balanceCents: options.balanceCents });
      if (!verdict.ok) {
        return NextResponse.json(
          { error: CUSTOM_REFUSAL[verdict.code] || CUSTOM_REFUSAL.invalid_amount, code: verdict.code, balance: options.balanceCents / 100 },
          { status: 400 },
        );
      }
      customCents = verdict.cents;
    }
  }

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: {
      ...SENDER_SELECT,
      logoUrl: true,
      brandColor: true,
      phone: true,
      // Same omission as the send route had: without it buildInvoiceEmail
      // formats every amount as CAD, so a chaser could name a different
      // currency than the invoice it is chasing.
      currency: true,
      paymentTerms: true,
      defaultLanguage: true,
      // The "How to pay" block, when the invoice has none stored yet.
      ...HOW_TO_PAY_COMPANY_SELECT,
    },
  });

  // Say so plainly rather than sending an email whose only button 500s.
  const canTakeCard = Boolean(
    company?.stripeAccountId && company?.stripeChargesEnabled,
  );

  const token = await ensurePortalToken(db, invoice.clientId, member.companyId);
  if (!token) {
    return NextResponse.json(
      { error: "Couldn't create a portal link for this client." },
      { status: 500 },
    );
  }

  // Deep-link to THIS invoice, not the portal home. The button this URL sits
  // under says "Pay online", and the home page is a list — a client who
  // pressed it landed somewhere with no payment on it and reported that
  // nothing happened. Sending an invoice already links this way
  // (portalInvoiceUrl's own comment records the same bug being fixed there);
  // the chase was left behind.
  const url = portalInvoiceUrl(token, invoice.id, request);
  const { from, replyTo } = await resolveSender(company || {}, member.companyId);

  // A different amount is stored BEFORE the email, because its id is the
  // link. It is written "unsent" and becomes "open" — payable — only once
  // the email is accepted below; a send that fails leaves a row no link
  // will ever reach and no pay route will accept.
  let paymentRequest = null;
  if (mode === "custom") {
    paymentRequest = await db.invoicePaymentRequest.create({
      data: {
        companyId: member.companyId,
        invoiceId: invoice.id,
        amountCents: customCents,
        paidCentsAtRequest: Math.round(Number(invoice.amountPaid || 0) * 100),
        note: note ? note.slice(0, 1000) : null,
        status: "unsent",
        requestedById: member.userId || null,
      },
      select: { id: true },
    });
  }
  // The stage's link is the stage's (the portal re-derives its uncovered
  // share from the row); the request's is the request's; the balance's is
  // the plain invoice page it always was.
  const payUrl =
    mode === "next_stage"
      ? `${url}?stage=${options.nextStage.id}`
      : mode === "custom"
        ? `${url}?request=${paymentRequest.id}`
        : url;

  // Was a second, hand-rolled English template with its own layout and a
  // hardcoded dark button colour that vanished on a dark brand. A client
  // chasing one invoice would receive two emails that looked like they came
  // from different companies. Same builder now, in the client's language,
  // with `kind: "reminder"` changing only the framing.
  const reminderLanguage = resolveClientLanguage({
    document: invoice,
    client: invoice.client,
    company,
  });
  const companyText = await localisedCompany(db, company, { companyId: member.companyId, language: reminderLanguage });

  // The stage's name heads a stage request, in the client's language — the
  // company's schedule wording, drafted on save (lib/i18n/phrases.js), found
  // by its text; the office's own line follows it.
  const trStage =
    mode === "next_stage"
      ? await loadPhrases(db, member.companyId, reminderLanguage, [{ ns: "paymentStage", text: options.nextStage.label }])
      : null;
  const requestCents =
    mode === "next_stage" ? options.nextStage.requestCents : mode === "custom" ? customCents : null;

  const { subject, html, text } =
    mode === "balance"
      ? buildInvoiceEmail({
          invoice,
          client: invoice.client,
          company: companyText || {},
          url,
          canTakeCard,
          note,
          kind: "reminder",
          language: reminderLanguage,
          wording: await loadDocumentWording(db, {
            companyId: member.companyId,
            kind: "reminder",
            language: reminderLanguage,
          }),
        })
      : buildInvoiceEmail({
          invoice,
          client: invoice.client,
          company: companyText || {},
          url: payUrl,
          canTakeCard,
          // A stage request reads exactly as the Send button's does — the
          // stage's name, then whatever the office added.
          note:
            mode === "next_stage"
              ? [trStage("paymentStage", options.nextStage.label), note].filter(Boolean).join(" — ")
              : note,
          kind: "invoice",
          requestAmount: requestCents / 100,
          language: reminderLanguage,
          wording: await loadDocumentWording(db, {
            companyId: member.companyId,
            kind: mode === "next_stage" ? "deposit" : "invoice",
            language: reminderLanguage,
          }),
        });

  // Through sendEmail rather than a Resend client of its own — see that
  // file's header for why there is now exactly one. The result is CHECKED,
  // which the old `await resend.emails.send(...)` never had to be because it
  // threw; sendEmail returns its failures instead, and an unchecked call here
  // would stamp sentAt on an invoice the client never received. That is the
  // precise bug the comment below spends four paragraphs warning about,
  // reintroduced by the refactor that was meant to be mechanical.
  const result = await sendEmail({
    companyId: member.companyId,
    // A client email: through the company's own mailbox when it has switched
    // that on (lib/mailbox/send.js), else exactly as before.
    clientMail: true,
    from,
    replyTo,
    to: invoice.client.email,
    subject,
    html,
    text,
  });

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
      typeof result.error === "string" ? result.error : result.error?.message || "Send failed";
    return NextResponse.json({ error: `The email couldn't be sent. ${message}` }, { status: 502 });
  }

  // ── Chasing payment IS issuing the invoice ────────────────────────────────
  //
  // This route emailed the client a real link to pay and then recorded nothing
  // at all — no status, no sentAt. That was survivable while the portal showed
  // every invoice, and stops being survivable the moment it doesn't: the portal
  // now hides drafts (a draft is the contractor still deciding the figure, and
  // accepted quotes mint one automatically), so a payment request on a draft
  // sent the client to a page where their invoice did not exist. "Nothing
  // outstanding", under the contractor's logo, minutes after being asked to pay.
  //
  // Written only AFTER Resend accepts, for the same reason the send route does
  // it that way: sentAt is a record that something happened, not that somebody
  // intended it.
  //
  // Two deliberate narrowings, both copied from the send route's hard-won
  // shape. A paid or overdue invoice is not dragged back to "sent" because
  // someone chased it. And sentAt is stamped only when it is EMPTY — this
  // route is the reminder path, so overwriting would march the issue date
  // forward with every chase and lose when the client was first billed.
  //
  // Which is exactly why the chase needs a column of its own. With sentAt
  // frozen at the first send, a second chase changed nothing on the row and
  // wrote nothing to the activity log (the send route records `invoice.sent`;
  // this route recorded nothing), so "when did we last chase this" had no
  // answer anywhere in the product. lastChasedAt moves on EVERY accepted send
  // and chaseCount counts them — see the column comment in schema.prisma.
  const chasedAt = new Date();
  const stamped = await db.invoice.update({
    where: { id: invoice.id },
    data: {
      ...(invoice.sentAt ? {} : { sentAt: chasedAt, sentToEmail: invoice.client.email }),
      ...(invoice.status === "draft" ? { status: "sent" } : {}),
      lastChasedAt: chasedAt,
      chaseCount: { increment: 1 },
    },
    select: { lastChasedAt: true, chaseCount: true },
  });

  // The asked-for figure becomes payable only now the email is out.
  if (paymentRequest) {
    await db.invoicePaymentRequest.update({
      where: { id: paymentRequest.id },
      data: { status: "open", sentToEmail: invoice.client.email },
    });
    // One open request per invoice: an older link stops asking for a figure
    // the office has since replaced, and falls back to the balance.
    await db.invoicePaymentRequest.updateMany({
      where: {
        companyId: member.companyId,
        invoiceId: invoice.id,
        status: "open",
        id: { not: paymentRequest.id },
      },
      data: { status: "superseded" },
    });
  }
  // The stage asked for is marked requested, exactly as the Send button and
  // the 06:10 cron mark it, so its link takes its amount and the cron does
  // not ask for it again. Only a pending stage changes.
  if (mode === "next_stage" && options.nextStage.status === "pending") {
    await db.jobPaymentStage.updateMany({
      where: { id: options.nextStage.id, companyId: member.companyId, status: "pending" },
      data: { status: "requested", requestedAt: chasedAt },
    });
  }

  // The reminder as it went, for the History tab (lib/email/sentEmailHistory.js).
  const sentEmailId = await recordSentEmail(db, {
    companyId: member.companyId,
    kind: mode === "balance" ? "reminder" : mode === "next_stage" ? "deposit" : "invoice",
    clientId: invoice.clientId || null,
    jobId: invoice.jobId || null,
    quoteId: invoice.quoteId || null,
    invoiceId: invoice.id,
    mail: { to: invoice.client.email, from, replyTo, subject, html, text },
    result,
    sentByUserId: member.userId || null,
    sentByName: await actorName(db, member.userId),
    language: reminderLanguage,
  });

  // `manual: true` so the log can tell a person pressing the button apart from
  // the overdue cron, should the cron ever start writing here too.
  await recordActivity(member, {
    action: "invoice.chased",
    entityType: "invoice",
    entityId: invoice.id,
    summary:
      mode === "balance"
        ? `Chased invoice ${invoice.invoiceNumber} (${[balance.toFixed(2), company?.currency].filter(Boolean).join(" ")} owing) to ${invoice.client.email}`
        : `Asked ${invoice.client.email} for ${[(requestCents / 100).toFixed(2), company?.currency].filter(Boolean).join(" ")} on invoice ${invoice.invoiceNumber}` +
          (mode === "next_stage" ? ` (${options.nextStage.label})` : " (a different amount)"),
    metadata: {
      to: invoice.client.email,
      balance,
      manual: true,
      mode,
      ...(requestCents != null ? { requested: requestCents / 100 } : {}),
      ...(mode === "next_stage" ? { stage: options.nextStage.label } : {}),
      ...(paymentRequest ? { paymentRequestId: paymentRequest.id } : {}),
      ...(sentEmailId ? { sentEmailId } : {}),
    },
  });

  return NextResponse.json({
    sent: true,
    to: invoice.client.email,
    balance,
    // What this email asked for — the balance, a stage's share or the
    // office's figure — so the banner names the right number.
    mode,
    requested: requestCents != null ? requestCents / 100 : balance,
    stage: mode === "next_stage" ? { label: options.nextStage.label } : null,
    lastChasedAt: stamped.lastChasedAt,
    chaseCount: stamped.chaseCount,
    portalUrl: payUrl,
    // The UI warns when this is false — the client will get an email they
    // can't act on, which is worth knowing before you hit send.
    onlinePaymentsEnabled: canTakeCard,
  });
}
