// app/api/marketing/plans/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { partitionPlans } from "@/lib/platform/sellablePlans";
import { recordError } from "@/lib/platform/errorLog";

// Public — the signup page needs to show plans without a session. This is
// deliberately separate from /api/platform/billing/plans (which is platform-admin-
// only and includes internal fields like stripePriceId).
export async function GET() {
  const plans = await db.plan.findMany({
    orderBy: { priceMonthly: "asc" },
    select: {
      id: true,
      name: true,
      priceMonthly: true,
      maxUsers: true,
      maxQuotesPerMonth: true,
      aiCopilotEnabled: true,
      // Selected only to decide whether the plan may be OFFERED. Stripped
      // before the response — a price id is an internal identifier and this
      // endpoint is public.
      stripePriceId: true,
    },
  });

  // A plan with no Stripe price renders fine and fails at checkout. Offering
  // it is worse than not listing it: the visitor blames their card, retries,
  // and every retry has been creating another company record.
  const { sellable, withheld, allWithheld } = partitionPlans(plans);

  // ── Nobody was being told ────────────────────────────────────────────────
  //
  // The platform admin screen has printed "No Stripe price ID — checkout will
  // fail" on every plan card for weeks. Nothing turned that into a signal
  // anyone would see, so the pricing page kept offering four plans that could
  // not be bought, and the first person to find out was the customer whose
  // checkout failed.
  //
  // Recorded once per request rather than per plan: the fault is "there is
  // nothing to sell", not four separate faults. Best-effort — a logging
  // failure must never take down the page that sells the product.
  if (allWithheld) {
    recordError({
      area: "billing",
      code: "no_sellable_plans",
      message:
        `The pricing page has nothing to offer: all ${withheld.length} plan(s) ` +
        "are missing a Stripe price ID, so checkout cannot open. Visitors are " +
        "being shown the contact fallback.",
      detail: { planNames: withheld.map((p) => p.name) },
    }).catch(() => {});
  }

  return NextResponse.json({
    plans: sellable.map(({ stripePriceId, ...plan }) => plan),
    // The signup page needs to tell "we have no plans configured" apart from
    // "these plans exist but none can be bought right now". They look
    // identical as an empty array and mean completely different things.
    unavailable: allWithheld,
  });
}
