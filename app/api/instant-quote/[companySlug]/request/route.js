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
import { rateLimit } from "@/lib/rateLimit";
import { measureForTrade, priceOneMaterial } from "@/lib/estimate/instantQuoteServer";
import { createEstimateDraft } from "@/lib/estimate/createEstimateQuote";
import { buildEstimateEmail } from "@/lib/estimate/estimateEmail";
import { sendEmail } from "@/lib/email/resend";
import { resolveSender } from "@/lib/email/companySender";
import { recordConsent, DISCLOSURE } from "@/lib/voice/outbound";

export async function POST(request, { params }) {
  // The heaviest of the public intakes — it re-measures, re-prices, writes a
  // draft Quote and sends mail. Throttled first so none of that runs on a loop.
  const limited = rateLimit(request, "instant-quote-request");
  if (limited) return limited;

  const { companySlug } = await params;
  const company = await db.company.findUnique({
    where: { slug: companySlug },
    select: {
      id: true, name: true, logoUrl: true, brandColor: true, brandColors: true,
      email: true, phone: true, website: true, defaultLanguage: true,
      financing: true,
    },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { trade, address, polygon, intake, materialKey, name, email, phone, language, media } = body || {};

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
    // The homeowner's attached photos/videos — re-normalised server-side (https
    // only, count-capped) so the browser can't stash anything but real media URLs.
    media,
  });

  const emailLanguage = language || company.defaultLanguage || "en";

  // ── The white-label confirmation ──────────────────────────────────────────
  //
  // Sent from the company's own domain, in their brand, obeying the same
  // visibility gate the screen did — a gated trade's email shows no figure
  // either. Best-effort: a mail hiccup must not fail the request the homeowner
  // just made, and the on-screen result already confirmed it.
  if (email) {
    try {
      const { subject, html } = buildEstimateEmail({
        company,
        contact: { name },
        estimate: { low: priced.estimate.low, high: priced.estimate.high },
        visibility: priced.visibility,
        reference: draft.quoteNumber,
        language: emailLanguage,
      });
      await sendEmail({
        to: email,
        subject,
        html,
        ...(await resolveSender(company, company.id)),
      });
    } catch (err) {
      console.error("[instant-quote/request] estimate email failed:", err?.message);
    }
  }

  // They submitted a request that said someone would be in touch — record the
  // consent (attached to the draft quote) so a follow-up call is allowed.
  if (phone) {
    await recordConsent({
      companyId: company.id,
      phone,
      source: "self_quote",
      disclosure: DISCLOSURE.self_quote,
      quoteId: draft.id,
    }).catch((err) => console.error("[instant-quote/request] consent failed:", err?.message));
  }

  // Show the homeowner their range back, clearly as an estimate — never the
  // internal quote id, and never a "confirmed price". Respects the gate: a gated
  // trade returns no figure here either.
  const shown = priced.visibility === "range"
    ? {
        low: priced.estimate.low,
        high: priced.estimate.high,
        unit: priced.estimate.unit || null,
        assumptions: priced.estimate.assumptions || [],
      }
    : null;

  return NextResponse.json({ ok: true, reference: draft.quoteNumber, estimate: shown });
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
    // Junk removal: the reviewer needs to see WHAT was quoted, not just a total.
    // Keys + counts only — no prices were ever in the measurement.
    items: Array.isArray(m.items) ? m.items : null,
    jobType: m.jobType ?? null,
    stairsFlights: m.stairsFlights ?? null,
    disassembly: m.disassembly ?? null,
    demolition: m.demolition ?? null,
    longCarry: m.longCarry ?? null,
    noElevator: m.noElevator ?? null,
    outOfArea: m.outOfArea ?? null,
    heavyLoads: m.heavyLoads ?? null,
    satelliteImageUrl: m.satelliteImageUrl ?? null,
    formattedAddress: m.formattedAddress ?? null,
    imageryDate: m.imageryDate ?? null,
  };
}
