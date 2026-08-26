// app/api/service-plans/[id]/authorise/route.js
//
// POST   — mint the client's authorisation link and email it to them.
// DELETE — withdraw a payment method the client already gave.
//
// The contractor cannot authorise on the client's behalf, and there is no
// endpoint here that saves a card. All this does is create an unguessable link
// to /plan/<token>, where the CLIENT reads the terms, ticks the box, and is
// handed to Stripe. That separation is the whole point: consent has to come
// from the person whose money it is.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { lazyClient } from "@/lib/lazyClient";
import { memberOrRefusal } from "@/lib/apiMember";
import { SENDER_SELECT } from "@/lib/email/resend";
import { resolveSender } from "@/lib/email/companySender";
import { getAppOrigin } from "@/lib/appUrl";
import { newPortalToken } from "@/lib/clientPortal";
import {
  loadEnforceableMember,
  requireLevel,
  requireToggle,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { canAuthoriseInLanguage, buildAuthorisationTerms } from "@/lib/servicePlans/consent";
import { occurrenceAmounts, termTotals } from "@/lib/servicePlans/pricing";
import { plannedOccurrenceCount } from "@/lib/servicePlans/schedule";
import { revokeAuthorisation } from "@/lib/servicePlans/authorisation";
import { buildAuthorisationRequestEmail } from "@/lib/email/servicePlanEmail";

const resend = lazyClient(() => new Resend(process.env.RESEND_API_KEY));

export async function POST(request, { params }) {
  const { id } = await params;

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "invoices", "view_create_edit", "ask a client for a payment method");
    requireToggle(full, "payments", "set up recurring payments");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const plan = await db.servicePlan.findFirst({
    where: { id, companyId: member.companyId },
    include: { client: true, authorisation: true },
  });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (plan.status !== "active") {
    return NextResponse.json(
      { error: "This plan isn't running, so there's nothing to authorise." },
      { status: 400 },
    );
  }
  if (!canAuthoriseInLanguage(plan.language)) {
    return NextResponse.json(
      {
        error:
          "We only have reviewed authorisation wording in English and French, so this client can't be asked to agree to automatic payments. They can still pay each invoice.",
      },
      { status: 400 },
    );
  }
  if (!plan.client?.email) {
    return NextResponse.json(
      {
        error: `${plan.client?.name || "This client"} has no email address on file. Add one on their client record first.`,
      },
      { status: 400 },
    );
  }

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: {
      ...SENDER_SELECT,
      id: true,
      logoUrl: true,
      brandColor: true,
      phone: true,
      currency: true,
      stripeAccountId: true,
      stripeChargesEnabled: true,
    },
  });

  // Said plainly rather than sending a client an email whose only button 500s.
  if (!company?.stripeAccountId || !company?.stripeChargesEnabled) {
    return NextResponse.json(
      {
        error:
          "Connect Stripe under Settings → Payments before asking a client to save a payment method.",
      },
      { status: 400 },
    );
  }

  // 32 bytes of CSPRNG output, same generator as the portal token. This link is
  // the only thing between a stranger and a payment-method form under this
  // company's name.
  const authToken = plan.authToken || newPortalToken();
  if (!plan.authToken) {
    await db.servicePlan.update({
      where: { id: plan.id },
      data: { authToken, collectionMode: "automatic" },
    });
  } else if (plan.collectionMode !== "automatic") {
    await db.servicePlan.update({
      where: { id: plan.id },
      data: { collectionMode: "automatic" },
    });
  }

  const url = `${getAppOrigin(request)}/plan/${authToken}`;

  const amounts = occurrenceAmounts(plan);
  const terms = buildAuthorisationTerms({
    plan,
    company,
    amounts,
    term: termTotals(plan, plannedOccurrenceCount(plan)),
  });

  const { from, replyTo } = await resolveSender(company, member.companyId);
  const { subject, html, text } = buildAuthorisationRequestEmail({
    plan,
    client: plan.client,
    company,
    terms,
    url,
  });

  await resend.emails.send({
    from,
    replyTo,
    to: plan.client.email,
    subject,
    html,
    text,
  });

  return NextResponse.json({ sent: true, to: plan.client.email, url });
}

/**
 * Withdraw the stored payment method.
 *
 * Separate from cancelling the plan on purpose: a client whose card expired
 * should be able to drop back to pay-links and be asked again, without the
 * arrangement itself being torn down. The plan reverts to the invoice tier,
 * which is the tier that works with no mandate at all.
 */
export async function DELETE(request, { params }) {
  const { id } = await params;

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // The POST above asks for the `payments` toggle and this asked only for the
  // invoices level, so someone who could not SET UP a mandate could still tear
  // one down — and the plan silently drops to invoice collection, so the next
  // month simply doesn't get taken. A gate on the create and not the destroy
  // is the half-fix this codebase keeps finding; both halves are the same
  // authority over the client's stored card.
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "invoices", "view_create_edit", "remove a stored payment method");
    requireToggle(full, "payments", "remove a stored payment method");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const plan = await db.servicePlan.findFirst({
    where: { id, companyId: member.companyId },
  });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const revocation = await revokeAuthorisation(plan.id, "removed_by_company");
  await db.servicePlan.update({
    where: { id: plan.id },
    data: { collectionMode: "invoice" },
  });

  return NextResponse.json({
    revoked: revocation.revoked,
    paymentMethodRemoved: revocation.detached ?? false,
    paymentMethodRemovalReason: revocation.detachReason || null,
  });
}
