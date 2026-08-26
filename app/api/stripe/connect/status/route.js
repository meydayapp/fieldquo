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
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
// The requirement wording and the identity gate both live in lib/stripe/ now:
// this route is no longer the only place that names an outstanding
// requirement, and a private function in a route file is one a check script
// cannot execute without a database and a live secret key.
import {
  summariseConnectAccount,
  accountIdentityFor,
} from "@/lib/stripe/connectAccount";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // The read half of the same door. This returns the live Stripe account id
  // and the outstanding verification requirements — "a director or owner:
  // identity document", the company's own onboarding state — to anyone with a
  // session, while the only page that asks for it (/app/settings/payments) is
  // hidden behind the `billing` capability. A gate on the writes and an open
  // read is how three of these routes looked before this sweep.
  //
  // Not narrowed further than its one caller: this is the same set the
  // settings row is already drawn for, so nobody who could see this loses it.
  // Support reads it too — non-negotiable #3 is "view everything, edit
  // nothing", and "why can't this company take payments" is close to the most
  // common thing a support session is opened to answer. Refusing the one
  // diagnostic that holds the answer makes the console worse at its job while
  // protecting nothing: middleware already rejects every non-read method under
  // an impersonation cookie, so this cannot become a write.
  //
  // On the READ only. connect, disconnect, refresh and login-link keep the
  // plain billing gate — a support session must never be able to sever a
  // company's payment processing or walk into their Stripe dashboard.
  if (!member.impersonation && !isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

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
  //
  // accountIdentityFor still runs, and still answers an owner with an object.
  // That is deliberate: the settings block keyed on it then renders and says,
  // in a sentence, that there is no Stripe account to identify yet. The
  // alternative — omit the key and let the block vanish — leaves an owner who
  // wants "the number Stripe asks for" staring at a page that never mentions
  // one, which is the dash-instead-of-a-sentence failure.
  if (!company.stripeAccountId) {
    return NextResponse.json({
      connected: false,
      chargesEnabled: false,
      detailsSubmitted: false,
      requirements: [],
      pendingVerification: false,
      accountDetails: accountIdentityFor(member, null),
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
    const summary = summariseConnectAccount(account);

    // Write it back, so the rest of the app — invoice pay links, the platform
    // company view — sees the same truth without each having to call Stripe.
    if (
      summary.chargesEnabled !== company.stripeChargesEnabled ||
      summary.detailsSubmitted !== company.stripeOnboarded
    ) {
      await db.company.update({
        where: { id: company.id },
        data: {
          stripeChargesEnabled: summary.chargesEnabled,
          stripeOnboarded: summary.detailsSubmitted,
        },
      });
    }

    // ── accountId and email live behind accountIdentityFor, not at top level ─
    //
    // `accountId` used to sit here beside chargesEnabled and was rendered by
    // nothing at all. Now that a screen finally shows it, leaving a copy at the
    // top level would mean the owner-only block is drawn from a gated field
    // while the same value is handed to every admin on the same response — a
    // gate that reads as one and isn't. Verified unread elsewhere before it
    // moved: this route has exactly one caller.
    const { accountId, email, ...shared } = summary;

    return NextResponse.json({
      connected: true,
      ...shared,
      accountDetails: accountIdentityFor(member, summary),
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
