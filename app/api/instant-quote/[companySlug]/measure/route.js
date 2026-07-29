// app/api/instant-quote/[companySlug]/measure/route.js
//
// Public, no lead created. Measures the property and returns the estimate RANGE
// for each enabled material, plus a satellite still where we have one. This is
// the "here's your roof: 22 squares, and GAF from $X, metal from $Y" step.
//
// No money comes from the browser and none is echoed as a rate: the request
// carries an address / polygon / intake and a trade; the server measures and
// prices from the company's saved config.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { measureForTrade, priceAllMaterials } from "@/lib/estimate/instantQuoteServer";

export async function POST(request, { params }) {
  const { companySlug } = await params;
  const company = await db.company.findUnique({
    where: { slug: companySlug },
    select: { id: true },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { trade, address, polygon, intake } = body || {};
  if (!trade) return NextResponse.json({ error: "Pick a service first." }, { status: 400 });

  const measured = await measureForTrade(trade, { address, polygon, intake });
  if (!measured.ok) {
    return NextResponse.json(
      { error: measureErrorMessage(measured.reason), reason: measured.reason, partial: measured.partial || null },
      { status: 422 },
    );
  }

  const priced = await priceAllMaterials({
    companyId: company.id,
    trade,
    measurement: measured.measurement,
  });
  if (!priced.ok) {
    return NextResponse.json(
      { error: "This service isn't taking instant quotes right now." },
      { status: 422 },
    );
  }

  // Only the measurement facts the homeowner should see — not the whole Solar
  // payload.
  const m = measured.measurement;
  const measurementView = {
    areaSqft: m.areaSqft ?? null,
    squares: m.squares ?? null,
    predominantPitch: m.predominantPitch ?? null,
    footprintSqft: m.footprintSqft ?? null,
    satelliteImageUrl: m.satelliteImageUrl ?? null,
    formattedAddress: m.formattedAddress ?? null,
  };

  return NextResponse.json({ measurement: measurementView, options: priced.options });
}

function measureErrorMessage(reason) {
  switch (reason) {
    case "no_roof_coverage":
      return "We couldn't measure that roof automatically — check the address, or request a quote and we'll measure it by hand.";
    case "geocode_failed":
      return "We couldn't find that address. Try including the city and postal code.";
    case "no_polygon":
      return "Trace the area on the map first.";
    case "no_area":
      return "Enter the area to get an estimate.";
    case "no_units":
      return "Enter how many doors and drawers.";
    case "no_key":
      return "Automatic measurement isn't set up yet. Request a quote and we'll measure it by hand.";
    default:
      return "We couldn't measure that. Request a quote and we'll follow up.";
  }
}
