// app/api/instant-quote/[companySlug]/request/route.js
//
// Public. The homeowner has a range and wants it — this captures their contact
// details and creates a draft Quote flagged for review. It RE-measures and
// RE-prices server-side from the same inputs, so the stored figure can't be
// anything the browser chose. Nothing is sent to the homeowner here and no
// price is promised as binding: the company's review queue is the next step.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { measureForTrade, priceOneMaterial } from "@/lib/estimate/instantQuoteServer";
import { createEstimateDraft } from "@/lib/estimate/createEstimateQuote";

export async function POST(request, { params }) {
  const { companySlug } = await params;
  const company = await db.company.findUnique({
    where: { slug: companySlug },
    select: { id: true, defaultLanguage: true },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { trade, address, polygon, intake, materialKey, name, email, phone, language } = body || {};

  if (!trade) return NextResponse.json({ error: "Missing service." }, { status: 400 });
  if (!name || (!email && !phone)) {
    return NextResponse.json(
      { error: "Tell us your name and an email or phone so we can send your quote." },
      { status: 400 },
    );
  }

  // Re-measure and re-price from scratch — the authoritative numbers.
  const measured = await measureForTrade(trade, { address, polygon, intake });
  if (!measured.ok) {
    return NextResponse.json({ error: "We couldn't measure that. Please try again." }, { status: 422 });
  }

  const priced = await priceOneMaterial({
    companyId: company.id,
    trade,
    materialKey,
    measurement: measured.measurement,
  });
  if (!priced.ok) {
    return NextResponse.json({ error: "That option isn't available. Pick another." }, { status: 422 });
  }

  const draft = await createEstimateDraft({
    company,
    trade,
    categoryId: priced.categoryId,
    contact: { name, email, phone },
    measurement: sanitiseMeasurement(measured.measurement),
    materialKey: materialKey || null,
    estimate: priced.estimate,
    source: priced.source,
    address: address || measured.measurement.formattedAddress || null,
    language: language || company.defaultLanguage || "en",
  });

  // Show the homeowner their range back, clearly as an estimate — never the
  // internal quote id, and never a "confirmed price".
  return NextResponse.json({
    ok: true,
    reference: draft.quoteNumber,
    estimate: {
      low: priced.estimate.low,
      high: priced.estimate.high,
      unit: priced.estimate.unit || null,
      assumptions: priced.estimate.assumptions || [],
    },
  });
}

// Keep the stored snapshot small and free of the raw Solar dump — the facts
// shown to the homeowner and the reviewer, nothing more.
function sanitiseMeasurement(m) {
  return {
    areaSqft: m.areaSqft ?? null,
    squares: m.squares ?? null,
    predominantPitch: m.predominantPitch ?? null,
    steepness: m.steepness ?? null,
    footprintSqft: m.footprintSqft ?? null,
    tearOffLayers: m.tearOffLayers ?? null,
    surfaceCondition: m.surfaceCondition ?? null,
    access: m.access ?? null,
    condition: m.condition ?? null,
    doorCount: m.doorCount ?? null,
    drawerCount: m.drawerCount ?? null,
    boxLinearFt: m.boxLinearFt ?? null,
    satelliteImageUrl: m.satelliteImageUrl ?? null,
    formattedAddress: m.formattedAddress ?? null,
    imageryDate: m.imageryDate ?? null,
  };
}
