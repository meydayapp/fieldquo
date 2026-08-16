// app/api/portal/[token]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveClientLanguage } from "@/lib/i18n/resolveLanguage";

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
        },
      },
      quotes: { orderBy: { createdAt: "desc" } },
      invoices: { include: { payments: true }, orderBy: { createdAt: "desc" } },
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
  const {
    stripeAccountId,
    stripeChargesEnabled,
    ...companyView
  } = client.company || {};
  const onlinePayments = Boolean(stripeAccountId && stripeChargesEnabled);

  return NextResponse.json({
    clientName: client.name,
    // Resolved once, server-side, so both portal components read the same
    // language the client was written to elsewhere. client.language is a
    // scalar on the row (no select narrowing above), so it's already loaded.
    language: resolveClientLanguage(client, client.company),
    company: companyView,
    onlinePayments,
    quotes: client.quotes,
    invoices: client.invoices,
    jobs: client.jobs,
  });
}
