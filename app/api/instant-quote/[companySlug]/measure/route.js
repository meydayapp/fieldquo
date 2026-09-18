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
import {
  publicEstimate,
  gatedMessage,
  effectiveVisibility,
} from "@/lib/estimate/visibility";
import { financingOffer } from "@/lib/estimate/financing";
import { gutterEstimateCopy } from "@/lib/i18n/gutterEstimateCopy";
import { lawnEstimateCopy } from "@/lib/i18n/lawnEstimateCopy";
import { lawnPublicView } from "@/lib/estimate/lawnPublicView";
import { INSTANT_ESTIMATE_TRADES } from "@/lib/estimate/instantEstimate";
import { isPolygonMeasure } from "@/lib/estimate/tracedArea";

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

  const language = company.defaultLanguage || "en";

  const measured = await measureForTrade(trade, { address, polygon, intake, companyId: company.id });
  if (!measured.ok) {
    // `partial` is stripped to what a stranger may see: the satellite still
    // and the address it resolved to. The measurement's flags say things like
    // "15,730 sqft of roof" about a building that may be a neighbour's, and
    // the wording that goes to the homeowner is the one sentence below.
    const partial = measured.partial
      ? {
          satelliteImageUrl: measured.partial.satelliteImageUrl ?? null,
          formattedAddress: measured.partial.formattedAddress ?? null,
        }
      : null;
    // A refused lawn still says what size it found and why it will not
    // price it — a homeowner looking at a strip mall under the pin fixes
    // the address; one looking at their own lawn asks for the call back.
    if (trade === "lawn_care" && measured.partial?.areaSqft) {
      partial.lawn = lawnPublicView(measured.partial, language);
    }
    return NextResponse.json(
      { error: measureErrorMessage(measured.reason, language, trade), reason: measured.reason, partial },
      { status: 422 },
    );
  }

  const priced = await priceAllMaterials({
    companyId: company.id,
    trade,
    measurement: measured.measurement,
    language,
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
    // A traced trade (lawn_polygon, area_polygon): the outline the area was
    // computed from, back to the browser that drew it — so the panel can
    // show the shape it priced beside the still. Vertices are not a rate.
    ...(isPolygonMeasure(INSTANT_ESTIMATE_TRADES[trade]?.measure) && {
      polygon: Array.isArray(m.vertices) ? m.vertices : null,
    }),
    // Gutters: the run, the count and the imagery date — facts, not rates —
    // plus the two sentences the range is shown under, in the company's
    // language (lib/i18n/gutterEstimateCopy.js). Absent for every other trade.
    ...(trade === "gutters" && {
      gutterFt: m.gutterFt ?? null,
      downspouts: m.downspouts ?? null,
      imagery: m.imagery ? { date: m.imagery.date ?? null, quality: m.imagery.quality ?? null } : null,
      notes: [
        gutterEstimateCopy(language).measuredFrom(m.imagery?.date || null),
        gutterEstimateCopy(language).notAContract,
      ],
    }),
  };

  // Lawn care: the estimated size, where it came from and the sentence that
  // says so — facts, never rates. The PRICED cards travel separately below,
  // behind the same gate as every other figure.
  if (trade === "lawn_care") measurementView.lawn = lawnPublicView(m, language);

  const financing = financingOffer(company.financing, { language });

  // ── The visibility gate ───────────────────────────────────────────────────
  //
  // The prices are computed; whether they cross to the homeowner is the owner's
  // per-trade choice. Gated: return the measurement and a plain message, and NO
  // figures at all — not a stripped option, not a $0, nothing a screenshot could
  // turn into a promise. Range: the options as computed, each run through
  // publicEstimate so a material that couldn't price falls out rather than
  // showing a broken number.
  // This endpoint is ALWAYS the pre-submit side: it is public, it creates no
  // lead, and nobody has left a name by the time it answers. So "after_submit"
  // resolves to gated here, every time, and the figure simply never leaves the
  // server — which is what makes the lock on the screen real rather than a blur
  // over a number that's sitting in the response.
  const mode = effectiveVisibility(priced.visibility, "prompt");

  if (mode !== "range") {
    // Nothing but the plain gated response crosses here.
    //
    // This briefly also carried a `locked` flag, the material list and the
    // locked wording, from when the flow was a wizard and this call was how
    // the panel first learned what to render. The form is one page now: the
    // materials and the locked copy arrive with the page itself (see
    // loadCompanyInstantTrades), and only a "range" trade calls this endpoint
    // at all. Keeping the branch meant a second source for labels the page
    // already had, on the one response that has to be provably empty of
    // pricing — so it goes, rather than being maintained for a caller that no
    // longer exists.
    return NextResponse.json({
      measurement: measurementView,
      gated: true,
      message: gatedMessage(language, "prompt"),
      financing,
    });
  }

  const options = priced.options
    .map((o) => {
      // minimumApplied has to be carried in, not left behind: rebuilding a bare
      // {low, high} here dropped the one field that explains why two different
      // job sizes can quote the same figure.
      const pub = publicEstimate(
        { low: o.low, high: o.high, minimumApplied: o.minimumApplied },
        "range",
      );
      return pub.show
        ? {
            materialKey: o.materialKey,
            label: o.label,
            low: pub.low,
            high: pub.high,
            unit: o.unit || null,
            minimumApplied: pub.minimumApplied,
          }
        : null;
    })
    .filter(Boolean);

  // Every material fell out (all unpriceable) — treat as gated rather than
  // returning an empty options array the UI would render as a blank estimate.
  if (!options.length) {
    return NextResponse.json({ measurement: measurementView, gated: true, message: gatedMessage(language, "prompt"), financing });
  }

  // Lawn care in "range" mode: every program and add-on priced for THIS
  // lawn, so the cards carry their figures and the panel can total a pick
  // from the server's own numbers. Only here — the gated branches above
  // return the measurement and no offer.
  const offer =
    trade === "lawn_care" && priced.offer
      ? { programs: priced.offer.programs, addOns: priced.offer.addOns, lawn: priced.offer.lawn }
      : undefined;

  return NextResponse.json({ measurement: measurementView, options, financing, ...(offer && { offer }) });
}

function measureErrorMessage(reason, language = "en", trade = null) {
  switch (reason) {
    case "needs_site_visit":
      return (trade === "lawn_care" ? lawnEstimateCopy(language) : gutterEstimateCopy(language)).needsSiteVisit;
    case "polygon_too_small":
      return lawnEstimateCopy(language).traceHint;
    case "no_address":
      return "Enter the property address to size the lawn.";
    case "no_linear_geometry":
      return "We couldn't read the roof edges at that address automatically — request a quote and we'll measure it on site.";
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
