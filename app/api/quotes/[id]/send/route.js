// app/api/quotes/[id]/send/route.js
//
// Actually emails the quote to the client.
//
// ── What was here before ────────────────────────────────────────────────────
//
// Nothing. The "Send" button called PATCH { status: "sent" }, which changed a
// word on screen and then hid the button because the status was no longer
// draft. Every signal the user had said the quote went out. No email was ever
// constructed, no send was ever attempted, and no error was ever possible —
// because nothing was tried.
//
// ── Rules this route holds to ───────────────────────────────────────────────
//
//  1. sentAt is written AFTER Resend accepts the message, never before. A
//     timestamp that records an intention rather than an event is worse than
//     no timestamp: it's a claim the company will repeat to a client.
//  2. A failed send returns a real error and leaves the status alone. The
//     quote stays a draft, the Send button stays visible, and the person can
//     try again — rather than being left with a "sent" quote and an empty
//     inbox.
//  3. The share token is minted here if it doesn't exist, so sending always
//     produces a working link. The old follow-up cron emailed `/q/undefined`
//     for exactly this reason.
export const runtime = "nodejs";

import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { onQuoteSent } from "@/lib/quotes/quoteLifecycle";
import { onQuoteEmailed } from "@/lib/voice/triggers";
import { recordActivity } from "@/lib/activity/log";
import { recordError, errorDetail } from "@/lib/platform/errorLog";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { getAppOrigin } from "@/lib/appUrl";
import { sendEmail, SENDER_SELECT } from "@/lib/email/resend";
import { renderDocumentPdfBuffer } from "@/app/admin/lib/pdf/renderDocumentPdf";
import { getDefaultSections } from "@/app/admin/lib/pdf/defaultSections";
import { usableSections } from "@/lib/documents/templateKind";
import { attachServiceSettings } from "@/lib/documents/loadServiceSettings";
import { resolveSender } from "@/lib/email/companySender";
import { SANDBOX_ADDRESS } from "@/lib/email/platformSender";
import { buildQuoteEmail } from "@/lib/email/quoteEmail";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { taxStatement, taxSendRefusal } from "@/lib/tax/documentTax";
import {
  quoteEmailSectionGate,
  QUOTE_EMAIL_COMPANY_SELECT,
} from "@/lib/quotes/emailSections";

export async function POST(request, { params }) {
  const { id } = await params;

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Emailing a client is the same weight as editing the quote — it puts a
  // priced offer in front of someone on the company's behalf.
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "quotes", "view_create_edit", "send quotes");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const body = await request.json().catch(() => ({}));
  const isFollowUp = body?.kind === "follow_up";

  const quote = await db.quote.findFirst({
    where: { id, companyId: member.companyId },
    include: { client: true },
  });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The review gate. An instant estimate the homeowner saw as a RANGE cannot
  // be emailed as a real quote until someone with quote:approve-estimate has
  // signed off the price in Estimate Reviews. Without this check the whole
  // review queue would be cosmetic — the exact "control that appears to work
  // and doesn't" this codebase forbids.
  if (quote.needsReview) {
    return NextResponse.json(
      {
        error:
          "This instant estimate hasn't been approved yet. Confirm the price in Estimate Reviews, then send.",
        needsReview: true,
      },
      { status: 409 },
    );
  }

  const to = quote.client?.email?.trim();
  if (!to) {
    return NextResponse.json(
      {
        error: `${quote.client?.name || "This client"} has no email address on file. Add one on their client record, then send.`,
      },
      { status: 400 },
    );
  }

  // A follow-up on something never sent is just a confusing first contact.
  if (isFollowUp && !quote.sentAt) {
    return NextResponse.json(
      { error: "This quote hasn't been sent yet — send it first." },
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
      currency: true,
      defaultLanguage: true,
      // Everything the tax gate below needs to work out whether this quote's
      // zero is a decision or a hole. Selected here rather than in a second
      // query because the gate runs on every send.
      taxRate: true,
      autoApplyLocalTax: true,
      country: true,
      province: true,
      vatRegistered: true,
      // Without these the optional sections resolve to "off" for every quote
      // this route sends, silently. buildQuoteEmail refuses to run on a
      // company row that is missing them rather than guessing — see
      // assertSectionFieldsLoaded.
      ...QUOTE_EMAIL_COMPANY_SELECT,
    },
  });

  // ── The empty-section gate ───────────────────────────────────────────────
  //
  // A section switched on with nothing in it must not reach a homeowner, and
  // must not be dropped behind the sender's back either. So the send stops
  // here, BEFORE the share token is minted and before a PDF is rendered, and
  // the 409 names each offending section and carries both ways out: fill it
  // (a link to the settings page) or remove it from this quote (a PATCH the
  // UI can fire and then retry the send).
  //
  // 409 rather than 400 for the same reason the needsReview gate above uses
  // it: nothing about the request is malformed, the quote simply isn't in a
  // state where this can happen yet.
  //
  // This is the first of two enforcement points. The second is inside
  // buildQuoteEmail, which throws — see lib/quotes/emailSections.js for why a
  // check here alone would not survive the next send path someone writes.
  const gate = quoteEmailSectionGate({ company: company || {}, quote });
  if (!gate.ok) {
    return NextResponse.json(
      {
        error:
          "This quote's email has a section switched on with nothing in it. Add the content, or take the section off this quote, then send.",
        code: "email_sections_empty",
        blocked: gate.blocked,
      },
      { status: 409 },
    );
  }

  // ── The tax gate ─────────────────────────────────────────────────────────
  //
  // Q-2026-0011 went to a homeowner reading "Tax $0.00 / TOTAL $5,250.00" with
  // taxEnabled TRUE. The quote asserted tax applied and then charged none. On
  // Ontario work that is $682.50 of HST the contractor either eats or goes
  // back to the customer for, after they have already seen a total.
  //
  // The tax library was never the fault — resolveTaxRate refused to invent a
  // rate for a client with no location, which is correct. The defect was that
  // the quote was sent anyway. This is the moment the number stops being a
  // draft and becomes a promise, so it is the moment to stop.
  //
  // HARD refusal, not confirm-anyway. A dialog on the way to a stranger's
  // inbox is a button people learn to click, and there is no unsend. It is
  // only defensible because it is never a dead end — see taxSendRefusal, and
  // TaxUnresolvedModal, which fixes the client's address in place and retries.
  //
  // Placed after the section gate and BEFORE the share token is minted, for
  // the same reason that one is: a refused send should leave nothing behind.
  //
  // Nothing here re-prices anything. It reads the stored amount and refuses;
  // a quote that gets through keeps exactly the tax it was written with.
  const taxRates = await db.taxRate.findMany({
    where: { companyId: member.companyId },
  });
  const refusal = taxSendRefusal(
    taxStatement({
      taxEnabled: quote.taxEnabled,
      tax: quote.tax,
      company: company || {},
      taxRates,
      client: quote.client,
      asOf: quote.createdAt,
    }),
    { client: quote.client },
  );
  if (refusal) return NextResponse.json(refusal, { status: 409 });

  // Mint the link if this quote has never been shared. Doing it here rather
  // than expecting the caller to have pressed "Get approved" first means the
  // email can never contain a dead URL.
  let shareToken = quote.shareToken;
  if (!shareToken) {
    shareToken = randomBytes(32).toString("base64url");
    await db.quote.update({ where: { id: quote.id }, data: { shareToken } });
  }

  const url = `${getAppOrigin(request)}/q/${shareToken}`;
  const { from, replyTo } = await resolveSender(company || {}, member.companyId);

  // The scope groups, with any per-company wording attached. Loaded here
  // rather than inside the PDF block below because the EMAIL now prints the
  // same breakdown the attachment does, and the two reading different rows is
  // the kind of divergence attachServiceSettings exists to prevent. The PDF
  // block reuses this array.
  //
  // Not best-effort: the email is built from it. If the groups can't be read
  // the send should fail loudly rather than post a quote email with no scope
  // in it, which is the same silent hollowing-out the section gate refuses.
  const scopeGroups = await attachServiceSettings(
    db,
    member.companyId,
    await db.quoteScopeGroup.findMany({
      where: { quoteId: quote.id },
      include: { category: true },
      orderBy: { sortOrder: "asc" },
    }),
  );

  const { subject, html, text } = buildQuoteEmail({
    quote,
    client: quote.client,
    company: company || {},
    url,
    scopeGroups,
    kind: isFollowUp ? "follow_up" : "quote",
    // The quote's own language wins — the covering note must match the
    // document it's carrying. See lib/i18n/clientLanguage.js.
    language: resolveClientLanguage({
      document: quote,
      client: quote.client,
      company,
    }),
  });

  // Attach the quote PDF so the client keeps the document itself, not just a
  // link they have to click. Best-effort: a PDF hiccup must never stop the
  // email — a quote that arrives without an attachment still beats one that
  // never arrives. Uses the same renderer as Download PDF, so the attachment
  // and the on-screen document are the same thing.
  let attachments;
  try {
    const [fullCompany, template] = await Promise.all([
      db.company.findUnique({ where: { id: member.companyId } }),
      db.documentTemplate.findFirst({
        where: { companyId: member.companyId, type: "quote_pdf", isDefault: true },
      }),
    ]);
    const sections = usableSections("quote_pdf", template?.sections || getDefaultSections("quote_pdf")).sections;
    const pdfBuffer = await renderDocumentPdfBuffer({
      sections,
      // Same client-aware precedence as the covering email above — the PDF and
      // the email must never disagree. Reading quote.language alone skipped the
      // client's own language, so a French client got an English PDF.
      language: resolveClientLanguage({
        document: quote,
        client: quote.client,
        company: fullCompany,
      }),
      data: { ...quote, client: quote.client, scopeGroups },
      company: fullCompany,
    });
    if (pdfBuffer?.length) {
      attachments = [{ filename: `Quote-${quote.quoteNumber}.pdf`, content: pdfBuffer }];
    }
  } catch (err) {
    console.error("[quote send] PDF attach failed:", err?.message);
    // Support can see this without the company noticing a missing attachment.
    await recordError({
      area: "pdf",
      code: "quote_pdf_attach_failed",
      message: `Quote ${quote.quoteNumber} sent without its PDF attachment: ${err?.message || "unknown"}`,
      companyId: member.companyId,
      detail: errorDetail(err, { quoteId: quote.id }),
    });
  }

  const result = await sendEmail({ to, subject, html, text, from, replyTo, attachments });

  // sendEmail returns { skipped } rather than throwing when RESEND_API_KEY is
  // absent. Treating that as success is how a deployment with no mail
  // configured ends up with a database full of quotes marked sent.
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
    return NextResponse.json(
      { error: explainSendError(result.error, from) },
      { status: 502 },
    );
  }

  // Only now. See rule 1.
  const updated = await db.quote.update({
    where: { id: quote.id },
    data: isFollowUp
      ? {
          followUpSentAt: new Date(),
          followUpCount: { increment: 1 },
        }
      : {
          sentAt: new Date(),
          sentToEmail: to,
          // A quote already accepted or declined shouldn't be dragged back to
          // "sent" by someone re-emailing a copy of it.
          ...(quote.status === "draft" ? { status: "sent" } : {}),
        },
    select: {
      status: true,
      sentAt: true,
      sentToEmail: true,
      followUpSentAt: true,
      followUpCount: true,
    },
  });

  // The homeowner has now actually been reached, so the lead this quote came
  // from is no longer untouched. Only after Resend accepted the message, for the
  // same reason sentAt is written here and not earlier: a lead that says
  // "contacted" because a send failed is a lie a rep will act on.
  if (!isFollowUp) {
    await onQuoteSent(quote.id).catch((err) =>
      console.error("[quotes/send] lead sync:", err?.message),
    );

    // ── And only now may the assistant ring them about it ─────────────────
    //
    // The client has the quote in writing, so a call can refer to a document
    // rather than invent a figure — which is the whole reason the callback
    // waits for this moment and not for the approval. The gate in
    // lib/voice/triggers.js refuses everything else (a draft, a hand-typed
    // quote, a company that never opted in), and consent, calling hours and the
    // stop list are still checked at dial time.
    //
    // Best-effort, after the send: a queuing hiccup must never fail an email
    // that has already gone out.
    await onQuoteEmailed(quote.id).catch((err) =>
      console.error("[quotes/send] couldn't queue the callback:", err?.message),
    );
  }

  await recordActivity(member, {
    action: isFollowUp ? "quote.followed_up" : "quote.sent",
    entityType: "quote",
    entityId: quote.id,
    summary: `${isFollowUp ? "Sent a follow-up for" : "Sent"} quote ${quote.quoteNumber} to ${to}`,
    metadata: { to, total: quote.total },
  });

  return NextResponse.json({ ...updated, to, messageId: result?.id || null });
}

/**
 * Resend's failures are mostly configuration, and each has a different fix.
 *
 * The one that will bite hardest in practice is the unverified-domain case:
 * until a domain is verified, Resend's shared `onboarding@resend.dev` sender
 * only delivers to the address on the Resend account itself. Mail to anyone
 * else is accepted by the API and silently dropped — which looks exactly like
 * a working send that never arrives.
 */
function explainSendError(error, from) {
  const message =
    typeof error === "string" ? error : error?.message || "Send failed";

  // Whether this deployment is on Resend's sandbox sender. It changes WHO the
  // message is for: on the sandbox nothing about the company's own setup is
  // wrong, and telling them to go verify a domain sends them to configure
  // something that won't help. That's a platform problem wearing a tenant's
  // error message.
  const onSandbox = String(from || "").includes(SANDBOX_ADDRESS);

  if (/testing emails|own email address|can only send|not verified/i.test(message)) {
    return onSandbox
      ? "Emails can't reach clients yet — FieldQuo's own sending domain isn't verified, so nothing is delivered beyond the account owner. This is on us, not your setup; support has been alerted."
      : `Resend won't send from ${from} — that domain isn't verified yet. Finish the DNS records under Settings → Email Domain.`;
  }

  if (/api key|unauthorized|invalid.*key/i.test(message)) {
    return "Resend rejected the API key. Check RESEND_API_KEY in your Vercel settings.";
  }

  if (/rate|too many/i.test(message)) {
    return "Resend is rate-limiting sends right now. Wait a moment and try again.";
  }

  return `The email couldn't be sent. ${message}`;
}
