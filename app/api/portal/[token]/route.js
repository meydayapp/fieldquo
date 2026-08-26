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
    include: {
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
        include: { payments: true },
        orderBy: { createdAt: "desc" },
      },
      jobs: { include: { visits: true }, orderBy: { createdAt: "desc" } },
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
    return {
      ...invoice,
      taxKind: statement.kind,
      taxAssumedRegion: statement.assumed ? statement.assumedRegion : null,
    };
  });

  return NextResponse.json({
    clientName: client.name,
    // Resolved once, server-side, so both portal components read the same
    // language the client was written to elsewhere. client.language is a
    // scalar on the row (no select narrowing above), so it's already loaded.
    language: resolveClientLanguage(client, client.company),
    company: companyView,
    onlinePayments,
    quotes: client.quotes,
    invoices,
    jobs: client.jobs,
  });
}
