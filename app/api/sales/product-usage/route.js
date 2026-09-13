// app/api/sales/product-usage/route.js
//
// "What contractors use most" — the top ten /app features by views over the
// last 30 days, for the rep's home card and the Playbook.
//
// ══ The 150-view gate, and why it is enforced here ═════════════════════════
//
// The owner's rule: reps see this only once there are at least 150 /app
// views behind it, so a top ten drawn from one company's first afternoon
// never becomes a talking point. lib/analytics/product/aggregate.js
// salesTopFeatures() applies the gate and this route returns the count and
// the threshold below it — the card says "appears at 150 views (62 so
// far)" rather than drawing nothing, so a rep knows the card is not broken.
//
// ══ What a rep can and cannot learn from this ══════════════════════════════
//
// Only `surface = app` page views, never the marketing site, the help
// centre or a client-facing page (the owner: "they don't need the stats for
// the static pages"), demo companies excluded, and no company is named —
// `companies` is a count. The rep gets the feature's sidebar label key and
// its pricing-page summary key, both resolved in their own language on the
// client from the catalogue, plus the registry blurb (English) for a page
// the pricing page does not claim.
//
// Read-only, on requireSalesRep — every /api/sales GET rides it.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireSalesRep } from "@/lib/sales/gate";
import { rangeFor, dailyRows } from "@/lib/analytics/product/queries";
import { salesTopFeatures, SALES_MIN_APP_VIEWS, SALES_TOP_N } from "@/lib/analytics/product/aggregate";
import { featureEntry } from "@/lib/features/registry";

export async function GET(request) {
  const { refusal } = await requireSalesRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const range = rangeFor(30);
  const rows = await dailyRows({ start: range.start, end: range.end, surface: "app" });
  const top = salesTopFeatures(rows, { threshold: SALES_MIN_APP_VIEWS, limit: SALES_TOP_N });

  return NextResponse.json({
    days: range.days,
    eligible: top.eligible,
    totalViews: top.totalViews,
    threshold: top.threshold,
    items: top.items.map((it) => ({
      rank: it.rank,
      navKey: it.navKey,
      summaryKey: it.matrix ? `feature.${it.matrix}.summary` : null,
      // English, from lib/features/registry.js — the console's own words,
      // used only when the pricing page has no sentence for this page.
      registryBlurb: it.feature ? featureEntry(it.feature)?.blurb || null : null,
      views: it.views,
      companies: it.companies,
    })),
  });
}
