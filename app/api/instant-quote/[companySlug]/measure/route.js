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
import { measureForTrade, priceAllMaterials, tradeLabel } from "@/lib/estimate/instantQuoteServer";
import { publicEstimate, gatedMessage } from "@/lib/estimate/visibility";
import { financingOffer } from "@/lib/estimate/financing";

export async function POST(request, { params }) {
  const { companySlug } = await params;
  const company = await db.company.findUnique({
    where: { slug: companySlug },
    select: { id: true, financing: true, defaultLanguage: true },
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
    // ── Two audiences, one failure ────────────────────────────────────────
    //
    // The homeowner is told WHICH service is unavailable and where to go
    // instead. WHY it's unavailable — off, unpriced, a band with no rate — is
    // the company's configuration, and a stranger comparing three contractors
    // never gets to read it (non-negotiable #4).
    //
    // The contractor's copy of "which thing is off" is on their own settings
    // screen, where every trade carries a readiness line computed from this
    // same pricing code. This log line is for support, who get a slug and a
    // trade and need the reason without asking for a screen-share.
    console.warn(
      `[instant-quote/measure] ${companySlug}/${trade} unavailable (${priced.reason}) — owner fixes it at /app/settings/instant-quotes`,
    );
    return NextResponse.json(
      { error: `${tradeLabel(trade)} isn't available for an instant estimate right now.` },
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

  const language = company.defaultLanguage || "en";
  const financing = financingOffer(company.financing, { language });

  // ── The visibility gate ───────────────────────────────────────────────────
  //
  // The prices are computed; whether they cross to the homeowner is the owner's
  // per-trade choice. Gated: return the measurement and a plain message, and NO
  // figures at all — not a stripped option, not a $0, nothing a screenshot could
  // turn into a promise. Range: the options as computed, each run through
  // publicEstimate so a material that couldn't price falls out rather than
  // showing a broken number.
  if (priced.visibility !== "range") {
    return NextResponse.json({
      measurement: measurementView,
      gated: true,
      message: gatedMessage(language, "prompt"),
      financing,
    });
  }

  const options = priced.options
    .map((o) => {
      const pub = publicEstimate({ low: o.low, high: o.high }, "range");
      return pub.show
        ? { materialKey: o.materialKey, label: o.label, low: pub.low, high: pub.high, unit: o.unit || null }
        : null;
    })
    .filter(Boolean);

  // Every material fell out (all unpriceable) — treat as gated rather than
  // returning an empty options array the UI would render as a blank estimate.
  if (!options.length) {
    return NextResponse.json({ measurement: measurementView, gated: true, message: gatedMessage(language, "prompt"), financing });
  }

  return NextResponse.json({ measurement: measurementView, options, financing });
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
