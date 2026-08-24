// app/api/funnels/public/[companySlug]/[funnelSlug]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import { sanitiseFunnelSteps } from "@/app/data/funnelBlocks";
import { serveFunnelSteps } from "../../funnelEstimate";

// Public — the funnel a stranger taps through. Branding + steps only. No prices,
// no response data, no admin fields. Pixel IDs are returned because the pixel
// scripts fire in the visitor's browser; they're public identifiers, not secrets.
//
// An instant-estimate step is the one kind that touches money, and it still
// leaves here with none: band LABELS only, priced one tap at a time by the
// estimate endpoint. See funnelEstimate.js for why that is consistent with
// non-negotiable #4 rather than an exception to it.
export async function GET(request, { params }) {
  const { companySlug, funnelSlug } = await params;

  const company = await findBookingCompany(companySlug, {
    id: true,
    name: true,
    logoUrl: true,
    brandColor: true,
    phone: true,
    currency: true,
    defaultLanguage: true,
  });
  if (!company)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const funnel = await db.funnel.findFirst({
    where: { companyId: company.id, slug: funnelSlug, status: "published" },
    select: {
      id: true,
      name: true,
      slug: true,
      steps: true,
      theme: true,
      channel: true,
      metaPixelId: true,
      tiktokPixelId: true,
      ga4Id: true,
    },
  });
  if (!funnel)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Re-sanitised on the way out, so even a funnel saved before a schema
  // tightening can't serve a stale unsafe field. Then estimate steps are
  // resolved against the company's live rate card: one that can't price is
  // removed here rather than rendering an empty card in a driveway. The
  // contractor's copy of this news is in the builder, which refuses to publish a
  // funnel whose estimate step has nothing behind it; this log line is for
  // support, who get a slug and need the reason without a screen-share.
  const clean = sanitiseFunnelSteps(funnel.steps);
  const { steps, dropped } = await serveFunnelSteps({
    companyId: company.id,
    steps: clean,
    language: company.defaultLanguage || "en",
  });
  for (const d of dropped) {
    console.warn(
      `[funnel] ${companySlug}/${funnelSlug} dropped estimate step ${d.id} (${d.trade || "no trade"}: ${d.reason}) — owner fixes it at /app/settings/instant-quotes`,
    );
  }

  return NextResponse.json({
    company: {
      name: company.name,
      logoUrl: company.logoUrl,
      brandColor: company.brandColor,
      phone: company.phone,
      // The estimate step renders money, and a Michigan contractor quoting in
      // CA$ is a page that looks like it belongs to someone else.
      currency: company.currency,
    },
    funnel: {
      id: funnel.id,
      name: funnel.name,
      slug: funnel.slug,
      steps,
      theme: funnel.theme || null,
      pixels: {
        meta: funnel.metaPixelId || null,
        tiktok: funnel.tiktokPixelId || null,
        ga4: funnel.ga4Id || null,
      },
    },
  });
}
