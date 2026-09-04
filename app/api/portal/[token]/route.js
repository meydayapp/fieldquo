// app/api/portal/[token]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveClientLanguage } from "@/lib/i18n/resolveLanguage";
import { taxStatement } from "@/lib/tax/documentTax";

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const client = await db.client.findUnique({
    where: { portalToken: _params.token },
    // Allow-list, not `include`. This used to have no top-level `select` at
    // all — every scalar on Client, Quote, Invoice and Job reached a
    // homeowner's browser on an unauthenticated (token-only) endpoint,
    // Quote.reviewNotes included, whose own schema comment says it must
    // never reach a client-facing surface. An allow-list fails CLOSED when a
    // field is added to one of these models tomorrow: it has to be named
    // here to leave the building, where `include` would have shipped it by
    // default. See docs/SECURITY-FIXES.md.
    select: {
      // Only what this route itself reads (resolveClientLanguage,
      // taxStatement below) or hands straight back as `clientName`. Nothing
      // else on Client — email, phone, address, notes, portalToken, type,
      // contactName, city, createdAt — reaches this route at all now.
      name: true,
      language: true,
      country: true, // resolveDocumentTax's jurisdiction lookup
      province: true, // same
      company: {
        select: {
          name: true,
          logoUrl: true,
          // The client portal shows the invoice too, so the tax registration
          // number has to reach it — this narrowed select was the one surface
          // where the fields simply weren't loaded.
          taxIdName: true,
          taxIdNumber: true,
          brandColor: true,
          phone: true,
          email: true,
          currency: true,
          // The fallback in resolveClientLanguage, below the client's own
          // preference. The portal isn't tied to a single document, so there's
          // no frozen document language here — it's client.language → company
          // default → en, the same rule as any other correspondence.
          defaultLanguage: true,
          // Whether the Pay button can actually do anything, and what to say
          // instead when it can't. Both are stripped from the payload below —
          // see the note on `onlinePayments`.
          stripeAccountId: true,
          stripeChargesEnabled: true,
          paymentMethods: true,
          // ── For the tax line, and stripped from the payload below ────────
          //
          // Every invoice in this portal carries a tax row, and a row reading
          // "$0.00" is a claim the invoice may not be able to back — see
          // lib/tax/documentTax.js and Q-2026-0011. These decide which of the
          // three sentences that row makes; the homeowner receives the
          // sentence, never the settings.
          province: true,
          country: true,
          taxRate: true,
          autoApplyLocalTax: true,
          vatRegistered: true,
        },
      },
      // Drafts stay in the office, same rule the public quote page already
      // enforces by 404ing one ("A draft was never meant to leave the office").
      // The portal was the exception: it listed every quote with its total, so
      // an auto-generated instant estimate — flagged needsReview, priced by
      // nobody — appeared in the homeowner's own account as a figure from the
      // company. They could not approve it (that link is gated on `sent`), but
      // seeing it is enough: it is a number the contractor may then have to
      // argue down from, and they never agreed to it in the first place.
      quotes: {
        where: { status: { not: "draft" } },
        orderBy: { createdAt: "desc" },
        // Exactly what ClientPortal.js renders per quote: the number, the
        // total, the date, the status pill, and the share token that builds
        // its "review" link. Everything else on Quote — reviewNotes (whose
        // own schema comment says it must never reach a client-facing
        // surface), aiReview, aiReviewedAt, aiVisionPasses, autoEstimated,
        // needsReview, processNotes, declineReason, followUpCount,
        // followUpSentAt, estimateSource, estimateData, composeSeconds,
        // sourceCallId, createdById, assignedToId, reviewedById, and every
        // other internal column — stays on the server.
        select: {
          id: true,
          quoteNumber: true,
          total: true,
          createdAt: true,
          status: true,
          shareToken: true,
        },
      },
      // ── Only invoices that have actually been ISSUED ──────────────────
      //
      // This returned every invoice, drafts included, and ClientPortal counts
      // what it gets into "Balance owing" and the unpaid list. A draft is an
      // internal staging document — the contractor is still deciding the
      // figure — so a homeowner was being shown money owed on a bill nobody
      // had sent them, and could pay it.
      //
      // That was already possible; it becomes routine now that accepting a
      // quote creates a draft invoice automatically, so the predicate has to
      // be right rather than incidental.
      //
      // Issued means one of two things, because there are two honest routes to
      // it: `sentAt` is stamped only after Resend accepts the email (never by
      // a button that merely changes a word — see the field's own comment), and
      // a status past draft covers an invoice settled in person and marked paid
      // without email ever being involved. A draft with neither is not a bill
      // yet, and the client's own copy should not be where they find out
      // otherwise.
      invoices: {
        where: { OR: [{ sentAt: { not: null } }, { status: { not: "draft" } }] },
        orderBy: { createdAt: "desc" },
        // What PortalInvoice.js and ClientPortal.js render, plus taxEnabled
        // and createdAt, which never leave this route — they only feed
        // taxStatement() below to compute taxKind/taxAssumedRegion. The old
        // `include: { payments: true }` shipped every Payment row (processor
        // ids included) to the browser; nothing in either portal component
        // reads `invoice.payments`, so it's dropped rather than narrowed.
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          amountPaid: true,
          dueDate: true,
          lineItems: true,
          notes: true,
          subtotal: true,
          discount: true,
          tax: true,
          taxEnabled: true,
          createdAt: true,
          // Payment-schedule stages this invoice carries — only the fields
          // safe for a stranger's browser: a label and an amount, never the
          // internal trigger/percentage/job link. `requested` only: a
          // `pending` stage hasn't been asked for yet (nothing to show), and
          // once `waived` there is nothing to pay. Lets PortalInvoice.js show
          // "Deposit — $X due now" instead of the invoice's full remaining
          // balance when the client arrived via a stage's own email link
          // (?stage=<id>) — see lib/paymentSchedule/run.js.
          jobPaymentStages: {
            where: { status: "requested" },
            orderBy: { seq: "asc" },
            select: { id: true, label: true, amountCents: true },
          },
        },
      },
      // `jobs` used to be fetched here (with its `visits`, technician ids and
      // checklists) and shipped whole. Nothing in ClientPortal.js or
      // PortalInvoice.js reads `data.jobs` — docs/TODO.md is explicit that
      // "the client portal shows invoices only" is the current, intended
      // scope. Dropped rather than select-narrowed: the correct allow-list
      // for a field nothing reads is no field at all. Add it back with a
      // real `select` the day the portal actually shows job status.
    },
  });

  if (!client)
    return NextResponse.json(
      { error: "Portal link not found" },
      { status: 404 },
    );

  // ── Can this company actually take a card? ────────────────────────────────
  //
  // Both portal surfaces used to render "Pay $X" for any unpaid invoice, with
  // no way to know: the POST to /pay then 400'd with "This company can't accept
  // online payments yet" under the contractor's own logo. That's a control that
  // appears to work and doesn't, on the one surface a stranger sees.
  //
  // Derived here rather than shipped raw: `stripeAccountId` is a Stripe
  // connected-account id on a PUBLIC, token-only endpoint, and the homeowner
  // needs the answer, not the account. So the two Stripe fields are destructured
  // off and never reach the response.
  //
  // The five tax settings go the same way and for the same reason: what the
  // homeowner needs is what each invoice's tax line SAYS, resolved below.
  const {
    stripeAccountId,
    stripeChargesEnabled,
    taxRate: _taxRate,
    autoApplyLocalTax: _autoApply,
    vatRegistered: _vatRegistered,
    ...companyView
  } = client.company || {};
  const onlinePayments = Boolean(stripeAccountId && stripeChargesEnabled);

  // Per invoice, because each was raised on its own day with its own decision
  // about tax. `asOf` is the invoice's creation date so a rate change last
  // month cannot re-explain a bill sent before it.
  const invoices = client.invoices.map((invoice) => {
    const statement = taxStatement({
      taxEnabled: invoice.taxEnabled,
      tax: invoice.tax,
      company: client.company || {},
      client,
      asOf: invoice.createdAt,
      lang: resolveClientLanguage(client, client.company),
    });
    // Explicit allow-list, not `...invoice`: taxEnabled and createdAt above
    // are read to COMPUTE taxKind, not to be forwarded, and spreading the
    // row would ship them to the browser anyway — the same "select is the
    // real fix" reasoning as the query above, applied to the one place a
    // field could still sneak back in after it.
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      dueDate: invoice.dueDate,
      lineItems: invoice.lineItems,
      notes: invoice.notes,
      subtotal: invoice.subtotal,
      discount: invoice.discount,
      tax: invoice.tax,
      // The allow-list is the right shape and it is also the thing that has to
      // be kept in step: the query above gained `jobPaymentStages` when the
      // payment-schedule engine landed, and this map — written earlier, to stop
      // `...invoice` shipping columns nobody asked for — silently dropped it
      // again. PortalInvoice.js looked for the stage, never found one, and fell
      // through to the invoice's full remaining balance.
      //
      // Which meant the deposit email's own link (?stage=<id>, minted in
      // lib/paymentSchedule/run.js) opened a page headed BALANCE DUE $12,000
      // with a "Pay $12,000" button — while the pay route, re-deriving the
      // figure from the stage row, charged the $3,000 the email had asked for.
      // The number the client agreed to and the number they were shown were
      // different numbers, on the payment screen.
      //
      // Already narrow at the source: id, label and amountCents only, and only
      // `requested` stages. Nothing further to strip here.
      jobPaymentStages: invoice.jobPaymentStages,
      taxKind: statement.kind,
      taxAssumedRegion: statement.assumed ? statement.assumedRegion : null,
    };
  });

  return NextResponse.json({
    clientName: client.name,
    // Resolved once, server-side, so both portal components read the same
    // language the client was written to elsewhere. client.language is
    // selected explicitly above for exactly this.
    language: resolveClientLanguage(client, client.company),
    company: companyView,
    onlinePayments,
    quotes: client.quotes,
    invoices,
    // No `jobs` — see the comment on the query above.
  });
}
