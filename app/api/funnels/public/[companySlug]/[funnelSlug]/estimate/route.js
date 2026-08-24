// app/api/funnels/public/[companySlug]/[funnelSlug]/estimate/route.js
//
// Public — one band, one price, no lead. The visitor taps a size on an
// instant-estimate step and this answers with the range for it.
//
// ══ This endpoint is ALWAYS the pre-submit side ════════════════════════════
//
// It creates nothing and nobody has left a name by the time it answers, so the
// stage it prices at is "prompt", hard-coded. A trade set to "show the range
// after they submit" therefore resolves to gated HERE, every time, and the
// figure never leaves the server — which is what makes that lock real rather
// than a blur over a number sitting in the response.
//
// The post-submit reveal is not a second mode on this route with a "confirmed"
// flag the browser could type; it comes back from /submit, which by
// construction only answers when a lead was actually created. There is nothing
// on this endpoint to forge.
//
// No money comes in and no rate goes out: the body carries a step id and a band
// id, and the measurement behind that band is read from the company's own
// stored funnel row (non-negotiable #5, and see funnelEstimate.js for #4).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import { sanitiseFunnelSteps, resolveEstimateBand } from "@/app/data/funnelBlocks";
import {
  loadFunnelTradeConfigs,
  priceFunnelBand,
  publicFunnelEstimate,
} from "../../../funnelEstimate";

export async function POST(request, { params }) {
  // Pricing is cheap but it is a database read plus a dry-run per material, on
  // an unauthenticated route. Same bucket shape as the other public funnel
  // intakes: the route, not the funnel. The limit is higher than submit's
  // because tapping through sizes is a normal thing to do twice.
  const limited = rateLimit(request, "funnel-estimate", { limit: 30 });
  if (limited) return limited;

  const { companySlug, funnelSlug } = await params;
  const body = await request.json().catch(() => ({}));

  const company = await findBookingCompany(companySlug, {
    id: true,
    currency: true,
    defaultLanguage: true,
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const funnel = await db.funnel.findFirst({
    where: { companyId: company.id, slug: funnelSlug, status: "published" },
    select: { id: true, steps: true },
  });
  if (!funnel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const steps = sanitiseFunnelSteps(funnel.steps);
  const step = steps.find(
    (s) => s.kind === "instant_estimate" && s.id === body.stepId,
  );
  if (!step) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const band = resolveEstimateBand(step, body.bandId);
  if (!band) return NextResponse.json({ error: "Pick a size first." }, { status: 400 });

  const configs = await loadFunnelTradeConfigs(company.id, [step.trade]);
  const priced = await priceFunnelBand({ step, band, config: configs.get(step.trade) });
  if (!priced.ok) {
    console.warn(
      `[funnel/estimate] ${companySlug}/${funnelSlug} ${step.trade || "no trade"} unpriceable (${priced.reason}) — owner fixes it at /app/settings/instant-quotes`,
    );
  }

  const language = company.defaultLanguage || "en";
  return NextResponse.json({
    stepId: step.id,
    bandId: band.id,
    currency: company.currency,
    ...publicFunnelEstimate({ priced, stage: "prompt", language, tradeKey: step.trade }),
  });
}
