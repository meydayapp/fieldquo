// app/api/plan/[token]/route.js
//
// The CLIENT's side of a service plan authorisation. Public — no session, a
// stranger on a phone in a driveway — and reached only with the unguessable
// token emailed to them.
//
// GET  returns the plan's terms, exactly as they will be recorded.
// POST records the client's acceptance and hands back a Stripe setup URL.
//
// ── What this never returns ─────────────────────────────────────────────────
//
// Public endpoints never return prices in this codebase — for a rate card. This
// one deliberately DOES return one figure: the amount THIS client is being asked
// to authorise. Withholding it would mean asking somebody to agree to a payment
// without telling them what it is, which is the opposite failure. It returns no
// rate card, no other client's figures, and nothing about the company's costs.
//
// It also never returns a Stripe customer id, payment method id or mandate id.
// Those live on ServicePlanAuthorisation and are stripped by construction here.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAppOrigin } from "@/lib/appUrl";
import { buildAuthorisationTerms, canAuthoriseInLanguage } from "@/lib/servicePlans/consent";
import { occurrenceAmounts, termTotals } from "@/lib/servicePlans/pricing";
import { plannedOccurrenceCount } from "@/lib/servicePlans/schedule";
import {
  getOrCreateClientCustomer,
  createAuthorisationSetupSession,
  authorisableMethods,
} from "@/lib/servicePlans/stripeMandate";
import { recordAuthorisationFromSession, isChargeable } from "@/lib/servicePlans/authorisation";

const COMPANY_SELECT = {
  id: true,
  name: true,
  logoUrl: true,
  brandColor: true,
  phone: true,
  email: true,
  website: true,
  currency: true,
  taxIdName: true,
  taxIdNumber: true,
  stripeAccountId: true,
  stripeChargesEnabled: true,
};

async function loadPlan(token) {
  if (!token) return null;
  return db.servicePlan.findUnique({
    where: { authToken: token },
    include: { client: true, authorisation: true },
  });
}

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const { token } = await params;

  const plan = await loadPlan(token);
  if (!plan) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  const company = await db.company.findUnique({
    where: { id: plan.companyId },
    select: COMPANY_SELECT,
  });
  if (!company) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  const amounts = occurrenceAmounts(plan);
  const terms = buildAuthorisationTerms({
    plan,
    company,
    amounts,
    term: termTotals(plan, plannedOccurrenceCount(plan)),
  });

  return NextResponse.json({
    // Enough to render the page under the contractor's brand, and no more.
    company: {
      name: company.name,
      logoUrl: company.logoUrl,
      brandColor: company.brandColor,
      phone: company.phone,
      email: company.email,
    },
    plan: {
      name: plan.name,
      serviceName: plan.serviceName,
      language: plan.language,
      status: plan.status,
    },
    clientName: plan.client?.name || "",
    terms,
    // The state of THIS authorisation, said plainly. A client returning to a
    // link they already used must see that, not a form implying nothing happened.
    alreadyAuthorised: isChargeable(plan.authorisation),
    revoked: Boolean(plan.authorisation?.revokedAt),
    methods: authorisableMethods(company),
    // A cancelled plan's link keeps working and says so, rather than 404ing —
    // "this arrangement was cancelled" is a useful thing for a client to read.
    closed: plan.status !== "active",
  });
}

/**
 * The client agrees, and only then is a Stripe session created.
 *
 * The order is the point: acceptedAt, the client's IP, and the VERBATIM terms
 * are written to the database BEFORE Stripe is opened. Stripe's own compliance
 * guidance requires a record of the customer's agreement to the terms; a record
 * written after the card form would be a record of the card, not of the consent.
 *
 * A client who ticks the box and then closes the Stripe page leaves a row with
 * acceptedAt set and no payment method — which isChargeable correctly refuses,
 * and which the contractor's screen reads as "agreed, never finished".
 */
export async function POST(request, { params }) {
  const { token } = await params;

  const plan = await loadPlan(token);
  if (!plan) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  if (plan.status !== "active") {
    return NextResponse.json(
      { error: "This arrangement is no longer running." },
      { status: 400 },
    );
  }
  if (!canAuthoriseInLanguage(plan.language)) {
    // Should be impossible — the plan could not have been created this way —
    // but refusing here too means the terms can never be shown in a language we
    // have not reviewed, whatever route got us here.
    return NextResponse.json({ error: "This link isn't available." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  if (body?.accepted !== true) {
    return NextResponse.json(
      { error: "Tick the box to authorise these payments." },
      { status: 400 },
    );
  }

  const company = await db.company.findUnique({
    where: { id: plan.companyId },
    select: COMPANY_SELECT,
  });
  if (!company?.stripeAccountId || !company?.stripeChargesEnabled) {
    return NextResponse.json(
      { error: "This company can't take online payments yet." },
      { status: 400 },
    );
  }

  if (isChargeable(plan.authorisation)) {
    return NextResponse.json({ alreadyAuthorised: true });
  }

  const amounts = occurrenceAmounts(plan);
  const terms = buildAuthorisationTerms({
    plan,
    company,
    amounts,
    term: termTotals(plan, plannedOccurrenceCount(plan)),
  });

  const customerId =
    plan.authorisation?.stripeCustomerId ||
    (await getOrCreateClientCustomer({ client: plan.client, companyId: plan.companyId }));

  // ── The consent record, written first ────────────────────────────────────
  //
  // Upsert rather than create: a client who abandoned the Stripe form and came
  // back is re-consenting to the same (frozen) terms, and a second row is
  // impossible anyway — planId is unique. The Stripe id columns are left for
  // recordAuthorisationFromSession to fill.
  await db.servicePlanAuthorisation.upsert({
    where: { planId: plan.id },
    create: {
      planId: plan.id,
      stripeCustomerId: customerId,
      stripeSetupIntentId: "",
      stripePaymentMethodId: "",
      paymentMethodType: "",
      acceptedAt: new Date(),
      // Best-effort provenance. Behind a proxy these are the forwarded values;
      // absent, they are null rather than a placeholder — an invented IP on a
      // consent record is worse than none.
      acceptedIp:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      acceptedAgent: request.headers.get("user-agent")?.slice(0, 400) || null,
      termsText: terms.text,
      termsLanguage: terms.language,
    },
    update: {
      stripeCustomerId: customerId,
      acceptedAt: new Date(),
      acceptedIp:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      acceptedAgent: request.headers.get("user-agent")?.slice(0, 400) || null,
      termsText: terms.text,
      termsLanguage: terms.language,
      revokedAt: null,
      revokedReason: null,
    },
  });

  const origin = getAppOrigin(request);
  const session = await createAuthorisationSetupSession({
    plan,
    client: plan.client,
    company,
    customerId,
    successUrl: `${origin}/plan/${token}?setup={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/plan/${token}`,
  });

  return NextResponse.json({ setupUrl: session.url });
}

/**
 * The return leg from Stripe.
 *
 * Called by the page when it lands back with ?setup=<session id>. Does exactly
 * what the webhook does, so a missing or slow webhook delivery means the client
 * still sees "you're set up" on the screen in front of them rather than a page
 * that quietly disagrees with reality. Idempotent — whichever gets there first
 * wins.
 */
export async function PUT(request, { params }) {
  const { token } = await params;

  const plan = await loadPlan(token);
  if (!plan) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const sessionId = String(body?.sessionId || "");
  if (!sessionId) return NextResponse.json({ error: "Missing session" }, { status: 400 });

  const result = await recordAuthorisationFromSession(plan.id, sessionId);
  if (!result.ok) {
    return NextResponse.json({ authorised: false, reason: result.reason }, { status: 200 });
  }
  return NextResponse.json({ authorised: true });
}
