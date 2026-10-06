// app/api/portal/[token]/card-pay/route.js
//
// The portal's own card form — the one card flow where a client paying by
// CREDIT card can be charged the company's credit-card fee
// (Company.clientCardSurcharge). Three steps, each a POST with `step`:
//
//   review    { invoiceId, stageId?, confirmationTokenId }
//             → the lines the client is shown BEFORE paying: invoice amount,
//               "Credit card fee 2.4%" (credit cards only), total.
//   confirm   { invoiceId, stageId?, intentId }
//             → charges exactly what was reviewed, after re-checking it all.
//   finalize  { invoiceId, stageId?, intentId }
//             → after 3-D Secure in the browser: Stripe's own answer.
//
// The browser never sends an amount (non-negotiable #5): an invoice id, a
// stage id (a hint, re-derived from the stage row), a Stripe token id and a
// Stripe intent id. The figures come from lib/portal/payableInvoice.js and
// lib/stripe/clientCardSurcharge.js; the card's funding type from Stripe.
// See lib/stripe/clientCardCharge.js for the whole flow and why it exists.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolvePortalCharge } from "@/lib/portal/payableInvoice";
import {
  reviewCardPayment,
  confirmCardPayment,
  finalizeCardPayment,
  stripePublishableKey,
} from "@/lib/stripe/clientCardCharge";
import { getAppOrigin } from "@/lib/appUrl";
import { resolveClientLanguage } from "@/lib/i18n/resolveLanguage";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";
import { recordError } from "@/lib/platform/errorLog";

const STEPS = new Set(["review", "confirm", "finalize"]);

// Every refusal code this route can answer with → the client-language
// sentence. A code with no sentence falls to the generic one.
function sentenceFor(code, copy, companyName) {
  switch (code) {
    case "declined":
      return copy.cardFee.declined;
    case "changed":
      return copy.cardFee.changed;
    case "token_expired":
    case "token_used":
    case "token_missing":
    case "not_card":
      return copy.cardFee.reenterCard;
    case "nothing_owed":
      return copy.demoPayNothingOwed;
    default:
      return copy.paymentNotStarted(companyName);
  }
}

export async function POST(request, { params }) {
  const { token } = await params;
  const body = await request.json().catch(() => null);
  if (!body || !STEPS.has(body.step)) {
    return NextResponse.json({ error: "We couldn't read that request. Please try again." }, { status: 400 });
  }
  const resolved = await resolvePortalCharge(db, {
    token,
    invoiceId: body.invoiceId,
    stageId: body.stageId || null,
  });
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });

  const language = resolveClientLanguage(resolved.client, resolved.company);
  const copy = clientDocCopy(language);
  const baseUrl = getAppOrigin(request);

  // No card form exists without Stripe.js's key, and a demo's pay step is
  // the demo screen (the regular pay route), never a card form. The portal
  // renders neither; this refuses a hand-made request the same way.
  if (!stripePublishableKey() || resolved.company.isDemo) {
    return NextResponse.json({ error: copy.paymentNotStarted(resolved.company.name) }, { status: 400 });
  }

  try {
    if (body.step === "review") {
      const r = await reviewCardPayment(db, {
        resolved,
        stageId: body.stageId || null,
        confirmationTokenId: body.confirmationTokenId,
      });
      if (!r.ok) {
        return NextResponse.json({ error: sentenceFor(r.code, copy, resolved.company.name), code: r.code }, { status: r.status });
      }
      return NextResponse.json({ review: r.review });
    }

    const run = body.step === "confirm" ? confirmCardPayment : finalizeCardPayment;
    const r = await run(db, {
      resolved,
      intentId: body.intentId,
      returnUrl: `${baseUrl}/portal/${token}?paid=true`,
    });
    if (!r.ok) {
      return NextResponse.json({ error: sentenceFor(r.code, copy, resolved.company.name), code: r.code }, { status: r.status });
    }
    return NextResponse.json({
      status: r.status,
      // Only for 3-D Secure: Stripe.js needs the intent's client secret to
      // open the bank's window. Never sent otherwise.
      ...(r.status === "requires_action" ? { clientSecret: r.clientSecret } : {}),
    });
  } catch (err) {
    // Never a 500 on the payment screen — same rule as the pay route:
    // recorded with Stripe's request id for /platform/errors, answered with
    // one plain sentence in the client's language.
    if (Number.isInteger(err?.status) && err.status >= 400 && err.status < 500) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    await recordError({
      area: "stripe_card_pay",
      code: err?.code || err?.type || "card_pay_failed",
      message: err?.message || "Portal card payment failed",
      companyId: resolved.company.id,
      detail: {
        step: body.step,
        invoiceId: resolved.current?.id || null,
        requestId: err?.requestId || null,
        statusCode: err?.statusCode || null,
      },
    });
    return NextResponse.json(
      { error: copy.paymentNotStarted(resolved.company.name) },
      { status: err?.type === "StripeInvalidRequestError" ? 400 : 502 },
    );
  }
}
