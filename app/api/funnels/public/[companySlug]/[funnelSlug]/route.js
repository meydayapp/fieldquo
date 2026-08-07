// app/api/funnels/public/[companySlug]/[funnelSlug]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import { sanitiseFunnelSteps } from "@/app/data/funnelBlocks";

// Public — the funnel a stranger taps through. Branding + steps only. No prices,
// no response data, no admin fields. Pixel IDs are returned because the pixel
// scripts fire in the visitor's browser; they're public identifiers, not secrets.
export async function GET(request, { params }) {
  const { companySlug, funnelSlug } = await params;

  const company = await findBookingCompany(companySlug, {
    id: true,
    name: true,
    logoUrl: true,
    brandColor: true,
    phone: true,
    currency: true,
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

  return NextResponse.json({
    company: {
      name: company.name,
      logoUrl: company.logoUrl,
      brandColor: company.brandColor,
      phone: company.phone,
    },
    funnel: {
      id: funnel.id,
      name: funnel.name,
      slug: funnel.slug,
      // Re-sanitised on the way out, so even a funnel saved before a schema
      // tightening can't serve a stale unsafe field.
      steps: sanitiseFunnelSteps(funnel.steps),
      theme: funnel.theme || null,
      pixels: {
        meta: funnel.metaPixelId || null,
        tiktok: funnel.tiktokPixelId || null,
        ga4: funnel.ga4Id || null,
      },
    },
  });
}
