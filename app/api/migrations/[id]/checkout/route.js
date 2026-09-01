// app/api/migrations/[id]/checkout/route.js
//
//   POST                → a Stripe Checkout URL for this migration's price
//   GET  ?session_id=…  → confirm it and mark the migration paid
//
// Same "two doors, one settlement" shape as app/api/settings/voice/topup: the
// webhook (lib/stripe/settleCheckoutSession.js) and this return-trip GET both
// call lib/migrations/payment.js's settleMigrationPayment, which is the only
// place that writes `paid`, so neither door can double-credit and neither
// door is required on its own — a closed tab after paying still gets picked
// up by the webhook.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin } from "@/lib/billing/billingAdmin";
import { getAppOrigin } from "@/lib/appUrl";
import { createMigrationCheckoutSession, settleMigrationPayment } from "@/lib/migrations/payment";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

async function requireBillingAdmin(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return { response };
  if (member.impersonation) {
    return { response: bad("Support access can't pay on the company's behalf.", 403) };
  }
  if (!isBillingAdmin(member.role)) {
    return { response: bad("Only an owner or admin can pay for a migration.", 403) };
  }
  return { member };
}

export async function POST(request, { params }) {
  const { member, response } = await requireBillingAdmin(request);
  if (response) return response;

  const { id } = await params;
  const migration = await db.migrationRequest.findUnique({ where: { id } });
  if (!migration || migration.companyId !== member.companyId) return bad("Not found", 404);

  const company = await db.company.findUnique({ where: { id: member.companyId } });
  if (!company) return bad("Company not found", 404);

  try {
    const session = await createMigrationCheckoutSession({
      migrationRequest: migration,
      company,
      origin: getAppOrigin(request),
    });
    return NextResponse.json({ checkoutUrl: session.url });
  } catch (err) {
    return bad(err.message, err.status || 500);
  }
}

export async function GET(request, { params }) {
  const { member, response } = await requireBillingAdmin(request);
  if (response) return response;

  const { id } = await params;
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId) return bad("No session");

  const migration = await db.migrationRequest.findUnique({ where: { id } });
  if (!migration || migration.companyId !== member.companyId) return bad("Not found", 404);

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  // Belongs to THIS migration. Without this, anyone who saw a session id
  // could mark somebody else's migration paid.
  if (session?.metadata?.migrationRequestId !== id) {
    return bad("That payment isn't for this migration.", 403);
  }

  const result = await settleMigrationPayment(session);
  const updated = await db.migrationRequest.findUnique({ where: { id } });
  return NextResponse.json({ ...result, request: updated });
}
