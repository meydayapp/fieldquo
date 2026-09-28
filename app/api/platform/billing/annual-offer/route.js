// app/api/platform/billing/annual-offer/route.js
//
// The STANDING 1-year commitment offer — "pay 10 months, get 12" — set for
// every ladder plan at once.
//
// ══ Why it is a promotion that lives on the plan rows ═════════════════════
//
// The owner (2026-09-28): the monthly price is the only regular price, and
// the year's discount is a standing promotion for committing, managed with
// the other promotions. Its storage stays Plan.priceAnnual — the column the
// checkout (lib/billing/interval.js chargeFor), the schedule builder and
// every existing yearly subscription already read — because moving it would
// touch every path that sells a year for no change in what anybody pays.
// This route is the "edit it as a promotion" half: one statement ("2 months
// free" or "17% off twelve months") applied to every live ladder row and
// custom size, each row's year recomputed from its OWN monthly price.
//
// A time-limited sale on the year (a PlatformPromotion with appliesTo
// "year") replaces this for the first year and never stacks on it — see
// lib/pricing/planOffer.js. Existing yearly subscriptions keep the Stripe
// price they renew on; a new year sold after this edit is priced from it.
//
// Gated like the plan and promotion routes: plan:manage. Audit-logged with
// every row's before and after, because this changes the price of a year for
// everyone who buys one from now on.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { parseStandingOffer, standingAnnualFor } from "@/lib/pricing/planOffer";

export async function PATCH(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    requirePlatformPermission(admin.role, "plan:manage");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { data: offer, error } = parseStandingOffer(body);
  if (error) return NextResponse.json({ error }, { status: 400 });

  // Ladder rows and custom sizes — every row with a tierKey that is still
  // sold. A legacy or bespoke row (no tierKey) carries a negotiated rate and
  // is not the ladder's to reprice; a retired row is sold to nobody.
  const plans = await db.plan.findMany({
    where: { tierKey: { not: null }, retiredAt: null },
    select: { id: true, name: true, tierKey: true, currency: true, priceMonthly: true, priceAnnual: true },
  });
  const changes = plans
    .map((p) => ({ plan: p, next: standingAnnualFor(Number(p.priceMonthly), offer) }))
    .filter((c) => c.next !== null);
  if (!changes.length) {
    return NextResponse.json({ error: "No ladder plan has a monthly price to build a year from." }, { status: 409 });
  }

  await db.$transaction([
    ...changes.map((c) => db.plan.update({ where: { id: c.plan.id }, data: { priceAnnual: c.next } })),
    db.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: "annual_offer_updated",
        details: {
          offer,
          rows: changes.map((c) => ({
            planId: c.plan.id,
            name: c.plan.name,
            tierKey: c.plan.tierKey,
            currency: c.plan.currency,
            priceMonthly: String(c.plan.priceMonthly),
            previousPriceAnnual: c.plan.priceAnnual === null ? null : String(c.plan.priceAnnual),
            newPriceAnnual: String(c.next),
          })),
        },
      },
    }),
  ]);

  return NextResponse.json({ ok: true, offer, updated: changes.length });
}
