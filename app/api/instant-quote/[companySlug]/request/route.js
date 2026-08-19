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
import { publicEstimate, gatedMessage, effectiveVisibility } from "@/lib/estimate/visibility";
import { bandForIndex, estimateExceedsBudget, scoreKeyForBandIndex } from "@/lib/estimate/budgetBands";
import { financingOffer } from "@/lib/estimate/financing";
import { canBookVisit } from "@/lib/booking/canBookVisit";
import { getAppOrigin } from "@/lib/appUrl";
import { createScoredLead } from "@/lib/leads/createLead";
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
      slug: true, bookingSlug: true, bookingModes: true,
      eventTypes: { where: { active: true }, select: { id: true } },
    },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { trade, address, polygon, intake, materialKey, name, email, phone, language, media, budgetBandIndex } = body || {};

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

  // This whole route is the other side of the submit: it only runs once the
  // homeowner has given a name and a way to reach them, which is exactly the
  // price of admission "after_submit" charges. So the mode resolves to "range"
  // here and the figure they were promised is finally allowed out — on the
  // screen and in the email, which must not disagree with each other.
  const visibility = effectiveVisibility(priced.visibility, "confirmed");

  // The browser posted an INDEX, not an amount. The dollars come from the
  // company's own saved thresholds — same rule as add-on pricing (#5), and here
  // it also stops a lead scoring itself richer than it is. An index that isn't
  // one of the bands resolves to null, i.e. "didn't answer", rather than being
  // clamped to the nearest real band and recorded as something they never said.
  const budgetBand = bandForIndex(priced.budgetThresholds, budgetBandIndex);
  const budgetGap = estimateExceedsBudget(budgetBand, priced.estimate);

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
    budget: budgetBand
      ? { min: budgetBand.min, max: budgetBand.max, label: budgetBand.label, exceeded: budgetGap }
      : null,
  });

  const emailLanguage = language || company.defaultLanguage || "en";

  // Whether a booking button belongs in the email at all. Read from the same
  // helper the public page uses rather than re-derived, because an email that
  // offers a visit the company cannot take is a dead link with a long life.
  const bookable = canBookVisit(company) ? { slug: company.bookingSlug || company.slug } : null;

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
        visibility,
        // Moves the company's own financing note up under the figure. Does
        // nothing at all when they haven't enabled financing.
        budgetGap,
        // Only when there is a calendar behind it. loadCompanyInstantTrades
        // answers the same question for the result screen, so the email and
        // the page cannot disagree about whether a visit can be booked.
        bookingUrl: bookable ? `${getAppOrigin(request)}/book/${bookable.slug}` : null,
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

  // ── The lead ──────────────────────────────────────────────────────────────
  //
  // This route created a Client and a draft Quote and no LeadRequest, so an
  // instant estimate never reached /app/leads at all. Every other inbound
  // source lands there; this one — the one that arrives pre-qualified, with a
  // budget and photos — was invisible on the board, unscored, and absent from
  // any export of inbound demand.
  //
  // Created AFTER the draft so it can carry `quoteId`, which is the same link
  // convertLead writes in the other direction. That makes the pair legible
  // from either end and lets the lifecycle move this lead on send/accept/
  // decline like any other.
  //
  // Best-effort: the homeowner has their estimate and the company has the
  // quote by this point. A lead-board row failing to write must not turn a
  // successful submission into an error.
  //
  // The budget is translated by POSITION, not by the dollars on the label. The
  // owner sets these thresholds per trade, so the top band means "the biggest
  // job this contractor does" — reading "$10,000+" as an absolute figure scored
  // that lead a tier below a roofer's, for picking the highest option a cabinet
  // shop offers. See scoreKeyForBandIndex. Unanswered stays null: absence is
  // not a small budget.
  await createScoredLead({
    companyId: company.id,
    name,
    email: email || null,
    phone: phone || null,
    categoryId: priced.categoryId || null,
    message: [address || measured.measurement.formattedAddress, `Instant estimate — ${trade}`]
      .filter(Boolean)
      .join("\n\n"),
    source: "instant_quote",
    clientPhotos: media,
    budgetBand: scoreKeyForBandIndex(budgetBand?.index),
    language: emailLanguage,
  })
    .then((lead) =>
      db.leadRequest.update({ where: { id: lead.id }, data: { quoteId: draft.id } }),
    )
    .catch((err) =>
      console.error("[instant-quote/request] lead not recorded:", err?.message),
    );

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
  //
  // Run through publicEstimate rather than reading low/high directly, so this
  // agrees with /measure and with the confirmation email on what counts as a
  // showable figure. A "range" trade whose estimate didn't resolve falls back to
  // the gated wording instead of shipping a NaN.
  const pub = publicEstimate(priced.estimate, visibility);
  const shown = pub.show
    ? {
        low: pub.low,
        high: pub.high,
        unit: priced.estimate.unit || null,
        assumptions: priced.estimate.assumptions || [],
      }
    : null;

  // When no figure is shown, SAY so. Returning `{ estimate: null }` and nothing
  // else left the confirmation page looking like the estimate had failed — the
  // owner hit exactly that and assumed the flow was broken. The message carries
  // no figure and no configuration detail; it's the same white-label sentence
  // the confirmation email uses.
  return NextResponse.json({
    ok: true,
    reference: draft.quoteNumber,
    // The handle the "book a visit" panel needs to tie the visit to this
    // estimate. An unguessable cuid, handed only to the person who just
    // created the document — the same shape as a quote's shareToken, and it
    // confers nothing on its own: the booking route re-checks that the quote
    // belongs to that company AND that the client email matches before it will
    // attach anything. `reference` stays the human-readable quote number,
    // because that is what a homeowner reads back over the phone.
    quoteId: draft.id,
    estimate: shown,
    // The measured facts behind the figure — squares, sq ft, pitch, and the
    // satellite still. The single-page form has no earlier round trip to get
    // these from, and a range with nothing behind it invites "where did that
    // come from?" as the first question on the call.
    measurement: sanitiseMeasurement(measured.measurement),
    // The company's own financing offer, same rule as everywhere else: their
    // words or their provider link, never a monthly figure from us.
    financing: financingOffer(company.financing, { language: emailLanguage }),
    message: shown ? null : gatedMessage(emailLanguage, "confirmed"),
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
