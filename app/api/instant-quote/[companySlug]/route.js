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

  const { company, trades, booking } = data;
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
    // The company's currency, so the range on the page is quoted in the money
    // they actually bill in. A currency CODE is not a rate: it says nothing
    // about what anything costs, which is why it can cross to a public
    // endpoint while non-negotiable #4 keeps the rate card behind it.
    //
    // It was missing, and the page's own money() filled the gap with a
    // hardcoded "$" — so a company billing in EUR published a dollar figure
    // under its own name. The funnel route beside this one has always sent it
    // (app/api/funnels/public/[companySlug]/[funnelSlug]/route.js); this is the
    // half that was never wired up.
    currency: company.currency,
    trades,
    booking,
  });
}
