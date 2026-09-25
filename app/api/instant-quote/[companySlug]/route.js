// app/api/instant-quote/[companySlug]/route.js
//
// Public. What the instant-quote page renders before the homeowner does
// anything: the company's brand, and the trades they've enabled with the
// material NAMES to choose from. Deliberately no rates — those are computed
// per property, never handed out as a list (non-negotiable #4).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { loadCompanyInstantTrades } from "@/lib/estimate/instantQuoteServer";
import { db } from "@/lib/db";
import { effectivePixels } from "@/lib/funnels/pixels";

export async function GET(request, { params }) {
  const { companySlug } = await params;
  // ?lang=fr|es|en — the visitor's pick (the pills on the form, or a link a
  // contractor put on their French page). Anything else falls back to the
  // company's language inside loadCompanyInstantTrades.
  const requested = new URL(request.url).searchParams.get("lang");
  const data = await loadCompanyInstantTrades(companySlug, { language: requested });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { company, trades, booking, language } = data;

  // The company's own ad pixels (Settings → Instant quotes → Ad tracking).
  // Public identifiers — the platforms put them in page source everywhere —
  // and only this company's. Read apart from loadCompanyInstantTrades so the
  // pricing loader's select stays about pricing.
  const tracking = await db.company
    .findUnique({
      where: { slug: company.slug },
      select: { metaPixelId: true, tiktokPixelId: true, ga4Id: true, pixelConsentRequired: true },
    })
    .catch(() => null);

  return NextResponse.json({
    company: {
      name: company.name,
      slug: company.slug,
      logoUrl: company.logoUrl,
      brandColor: company.brandColor,
      // For the "Call us" half of the this-doesn't-look-right control under
      // a measured figure. Null hides the button; a phone number is not a
      // rate and is on the company's own website already.
      phone: company.phone || null,
    },
    // Google Maps key for the lawn-polygon map and the roof satellite still.
    // Public by design; should be HTTP-referrer restricted to fieldquo.com.
    mapsKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || null,
    // The language every label in this payload was built in: the visitor's
    // when they picked one, else the company's. The page seeds its selector
    // from it and sends it back on /measure and /request, so the document is
    // created in the language the form was read in (non-negotiable #6).
    language,
    // Whether the company itself is French/Spanish/English — the selector's
    // default before the visitor touches it, kept apart from `language` so a
    // ?lang= link does not make a French company look English-by-default.
    companyLanguage: company.defaultLanguage || "en",
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
    pixels: effectivePixels({}, tracking || {}),
    pixelConsentRequired: Boolean(tracking?.pixelConsentRequired),
  });
}
