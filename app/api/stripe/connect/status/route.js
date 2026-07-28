// app/api/stripe/connect/status/route.js
//
// Asks STRIPE whether this company can take payments, rather than trusting
// what's in our own database.
//
// ── Why this route exists ───────────────────────────────────────────────────
//
// stripeChargesEnabled was written in exactly one place: the `account.updated`
// webhook. That makes the settings page correct only when three things all
// hold — STRIPE_CONNECT_WEBHOOK_SECRET is set, an endpoint exists, and that
// endpoint is configured to receive events on CONNECTED accounts (a plain
// account webhook never sees account.updated for a Connect account at all).
//
// Miss any one and the outcome is the same: the company finishes onboarding,
// Stripe is perfectly happy, and FieldQuo goes on telling them "onboarding
// incomplete" forever. There is nothing they can do from their side to fix
// it, which is the worst kind of bug — it looks like their mistake.
//
// So the webhook stays (it's how the flag updates when nobody is looking),
// but the page no longer depends on it. This route retrieves the account,
// writes what Stripe actually said, and reports the specific requirements
// still outstanding so the message can name them.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { getCurrentMember } from "@/lib/currentMember";

// Stripe's requirement keys are machine names — "company.verification.document"
// means nothing to a contractor. Only the ones that actually come up for
// Canadian Express accounts are translated; anything unmapped falls through to
// a tidied version of the key rather than being hidden, because a requirement
// you can't see is one you can't clear.
const REQUIREMENT_LABELS = {
  "business_profile.url": "A business website or product description",
  "business_profile.mcc": "Your industry",
  "business_profile.product_description": "A description of what you sell",
  "business_profile.support_phone": "A customer support phone number",
  "company.verification.document":
    "A document verifying the business (incorporation papers, CRA notice, or a registry search result)",
  "company.tax_id": "Your business number (BN)",
  "company.directors_provided":
    "Confirmation that you've listed every director",
  "company.owners_provided":
    "Confirmation that you've listed everyone owning 25% or more",
  "company.executives_provided": "Confirmation that you've listed executives",
  "external_account": "A bank account for payouts",
  "tos_acceptance.date": "Accepting Stripe's terms of service",
  "individual.verification.document": "A photo of your ID",
  "individual.verification.additional_document": "A second piece of ID",
};

function humanise(key) {
  if (REQUIREMENT_LABELS[key]) return REQUIREMENT_LABELS[key];

  // person_1TyErf.verification.document — the prefix is an opaque id, and
  // showing it helps nobody.
  const cleaned = key.replace(/^person_[A-Za-z0-9]+\./, "A director or owner: ");
  return cleaned.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: {
      id: true,
      stripeAccountId: true,
      stripeOnboarded: true,
      stripeChargesEnabled: true,
    },
  });

  if (!company)
    return NextResponse.json({ error: "Company not found" }, { status: 404 });

  // Nothing to sync — they've never started.
  if (!company.stripeAccountId) {
    return NextResponse.json({
      connected: false,
      chargesEnabled: false,
      detailsSubmitted: false,
      requirements: [],
      pendingVerification: false,
    });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      {
        error:
          "Stripe isn't configured on this deployment yet (STRIPE_SECRET_KEY is missing).",
      },
      { status: 503 },
    );
  }

  try {
    const account = await stripe.accounts.retrieve(company.stripeAccountId);

    const chargesEnabled = Boolean(account.charges_enabled);
    const detailsSubmitted = Boolean(account.details_submitted);

    // Write it back, so the rest of the app — invoice pay links, the platform
    // company view — sees the same truth without each having to call Stripe.
    if (
      chargesEnabled !== company.stripeChargesEnabled ||
      detailsSubmitted !== company.stripeOnboarded
    ) {
      await db.company.update({
        where: { id: company.id },
        data: {
          stripeChargesEnabled: chargesEnabled,
          stripeOnboarded: detailsSubmitted,
        },
      });
    }

    const req = account.requirements || {};

    // currently_due  — needed now, blocking
    // past_due       — overdue, definitely blocking
    // pending_verification — submitted, Stripe is checking. NOT the company's
    //                        problem, and telling them to "provide more
    //                        information" while Stripe reviews what they
    //                        already sent is how people end up submitting the
    //                        same document four times.
    const outstanding = [
      ...new Set([...(req.currently_due || []), ...(req.past_due || [])]),
    ];

    return NextResponse.json({
      connected: true,
      accountId: account.id,
      chargesEnabled,
      payoutsEnabled: Boolean(account.payouts_enabled),
      detailsSubmitted,
      requirements: outstanding.map((key) => ({
        key,
        label: humanise(key),
      })),
      eventuallyDue: (req.eventually_due || []).length,
      pendingVerification: (req.pending_verification || []).length > 0,
      disabledReason: req.disabled_reason || null,
      // Stripe's own wording for why an account is restricted, when it has
      // one. More specific than anything we could infer.
      currentDeadline: req.current_deadline || null,
    });
  } catch (err) {
    console.error("[stripe/connect/status]", err);
    return NextResponse.json(
      {
        error:
          err?.raw?.message ||
          err?.message ||
          "Couldn't check the Stripe account status.",
      },
      { status: err?.statusCode || 502 },
    );
  }
}
