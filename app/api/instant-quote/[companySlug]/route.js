// app/api/instant-quote/[companySlug]/route.js
//
// Public. What the instant-quote page renders before the homeowner does
// anything: the company's brand, and the trades they've enabled with the
// material NAMES to choose from. Deliberately no rates — those are computed
// per property, never handed out as a list (non-negotiable #4).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { loadCompanyInstantTrades } from "@/lib/estimate/instantQuoteServer";

export async function GET(request, { params }) {
  const { companySlug } = await params;
  const data = await loadCompanyInstantTrades(companySlug);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { company, trades } = data;
  return NextResponse.json({
    company: {
      name: company.name,
      slug: company.slug,
      logoUrl: company.logoUrl,
      brandColor: company.brandColor,
    },
    // Google Maps key for the lawn-polygon map and the roof satellite still.
    // Public by design; should be HTTP-referrer restricted to fieldquo.com.
    mapsKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || null,
    language: company.defaultLanguage || "en",
    trades,
  });
}
