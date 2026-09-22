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
import { lawnPublicView } from "@/lib/estimate/lawnPublicView";
import { publicEstimate, gatedMessage, effectiveVisibility } from "@/lib/estimate/visibility";
import { bandForIndex, estimateExceedsBudget, scoreKeyForBandIndex } from "@/lib/estimate/budgetBands";
import { financingOffer } from "@/lib/estimate/financing";
import { createScoredLead } from "@/lib/leads/createLead";
import { emailRefusal } from "@/lib/validation";
import { buildLeadIntake } from "@/lib/leads/intakeShape";
import { createEstimateDraft } from "@/lib/estimate/createEstimateQuote";
import { normaliseCountry } from "@/lib/tax/jurisdictions";
import { publishEstimateReport } from "@/lib/estimate/report/publish";
import { recordConsent, DISCLOSURE } from "@/lib/voice/outbound";
import { instantQuoteCopy, instantQuoteLanguage } from "@/lib/i18n/instantQuoteCopy";
import { measureErrorMessage } from "@/lib/estimate/measureErrorMessage";
import { cleanTradeAnswers, tradeAnswerLines } from "@/lib/leads/tradeQuestions";
import { checkServiceArea, serviceAreaConfigured, postalCodeFromAddress } from "@/lib/company/serviceArea";
import { geocodeAddress } from "@/lib/measure/roofMeasurement";

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
      // The estimate email prints the figure in the company's currency.
      currency: true,
      financing: true,
      slug: true, bookingSlug: true, bookingModes: true,
      eventTypes: { where: { active: true }, select: { id: true } },
      // What createEstimateDraft needs to resolve tax the same way every
      // other document does — see lib/tax/resolveTaxRate.js's precedence
      // ladder. Without these fields resolveDocumentTax silently reads an
      // empty company and always falls through to "no tax resolved", which
      // is the exact defect this select exists to close.
      taxRate: true,
      autoApplyLocalTax: true,
      taxMode: true,
      taxRates: { select: { name: true, rate: true } },
      country: true,
      province: true,
      vatRegistered: true,
      // The service area, for the one honest line the lead carries when the
      // job is outside it (lib/company/serviceArea.js). city is in the
      // sentence; latitude/longitude are the base of the radius.
      city: true,
      latitude: true,
      longitude: true,
      serviceRadiusKm: true,
      servicePostalPrefixes: true,
    },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const {
    trade, address, polygon, intake, materialKey, name, email, phone,
    media, budgetBandIndex,
    // The structured halves of `address` when the homeowner picked a Places
    // suggestion. Not trusted — normaliseCountry drops anything that isn't ISO
    // alpha-2 — and absent when they typed the address by hand, which is the
    // honest "we don't know" rather than a guess.
    city, province, country,
    // The rest of the Places components — the postal code and the county
    // (administrative_area_level_2) — for the client record, so the client
    // this creates carries what a hand-added one does. Strings, capped and
    // trimmed on the write; never read for a price.
    postalCode, county,
    // "When do you need this done?", the trade's own question(s) and the
    // free-text note — validated below against lib/leads/tradeQuestions.js.
    whenNeeded, answers, notes,
  } = body || {};

  // ── The document's language is the visitor's choice ──────────────────────
  //
  // The form carries three pills; whichever was lit when they pressed submit
  // is the language the draft, the lead and the email are created in, and
  // it never changes afterwards (non-negotiable #6). Validated to the three
  // the page offers rather than trusted — `language || company.default…`
  // would have stored whatever string a hand-crafted POST sent — and the
  // company's language stands in when the browser sent nothing.
  const language = instantQuoteLanguage(body?.language) || company.defaultLanguage || "en";
  const t = instantQuoteCopy(language);

  if (!trade) return NextResponse.json({ error: t.missingService }, { status: 400 });
  if (!name || (!email && !phone)) {
    return NextResponse.json({ error: t.missingContact }, { status: 400 });
  }

  // The "when" question is required on the form; a POST around the form
  // gets the same refusal the form would have shown. Unknown answers to the
  // trade questions are dropped, never stored (cleanTradeAnswers).
  const homeowner = cleanTradeAnswers(trade, { whenNeeded, answers, notes });
  if (!homeowner.whenNeeded) return NextResponse.json({ error: t.missingWhen }, { status: 400 });

  // The address a quote will be sent to. Manny Conto typed
  // `Macksab  1@hotmail.com`; the quote bounced and nobody was told. Refused
  // while they are still on the form, rather than stored — see
  // lib/validation.js's emailProblem for why the refusal names the fault.
  const badEmail = emailRefusal(email);
  if (badEmail) return NextResponse.json(badEmail, { status: 400 });

  // Re-measure and re-price from scratch — the authoritative numbers.
  const measured = await measureForTrade(trade, { address, polygon, intake, companyId: company.id });
  if (!measured.ok) {
    // A gutter measurement the model refused is not a retry: the sentence
    // says to request a quote for an on-site measure, in the language the
    // form is in. Every other miss is the generic line it always was.
    return NextResponse.json(
      { error: measureErrorMessage(measured.reason, language, trade), reason: measured.reason },
      { status: 422 },
    );
  }

  const priced = await priceOneMaterial({
    companyId: company.id,
    trade,
    materialKey,
    measurement: measured.measurement,
    // The assumptions an estimator writes for the homeowner (gutters) are
    // in the language the email and the confirmation page use.
    language,
  });
  if (!priced.ok) {
    return NextResponse.json({ error: t.optionUnavailable }, { status: 422 });
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

  // What was PRICED, not what was posted: priceOneMaterial settles painting's
  // scope against the company's services, and the draft must record the scope
  // its figure was computed at.
  const pricedMeasurement = priced.measurement || measured.measurement;

  // ── Inside the company's service area? ───────────────────────────────────
  //
  // Only asked when the company has said where they go; a company with no
  // area set gets no check and no sentence. A roof measurement already
  // carries the pin; every other trade's address is geocoded here — one
  // Google call, only for companies that configured an area. An address
  // that will not geocode and carries no postal code answers `null`, and
  // null is written nowhere: "we don't know" must never read as "outside".
  const jobAddress = address || measured.measurement.formattedAddress || null;
  let outsideServiceArea = false;
  if (serviceAreaConfigured(company) && jobAddress) {
    let point =
      Number.isFinite(Number(pricedMeasurement?.lat)) && Number.isFinite(Number(pricedMeasurement?.lng))
        ? { lat: Number(pricedMeasurement.lat), lng: Number(pricedMeasurement.lng) }
        : null;
    if (!point) {
      const hit = await geocodeAddress(jobAddress).catch(() => null);
      if (hit) point = { lat: hit.lat, lng: hit.lng };
    }
    const verdict = checkServiceArea(company, { ...(point || {}), postalCode: postalCodeFromAddress(jobAddress) });
    outsideServiceArea = verdict.inside === false;
  }

  const draft = await createEstimateDraft({
    company,
    trade,
    categoryId: priced.categoryId,
    contact: { name, email, phone },
    measurement: sanitiseMeasurement(pricedMeasurement),
    materialKey: materialKey || null,
    estimate: priced.estimate,
    source: priced.source,
    address: address || measured.measurement.formattedAddress || null,
    // The client this draft creates gets a jurisdiction, so the estimator
    // reviewing it sees a real tax rate instead of a silent 0%.
    city: city || null,
    province: province || null,
    country: normaliseCountry(country),
    postalCode: typeof postalCode === "string" ? postalCode : null,
    county: typeof county === "string" ? county : null,
    language,
    // What the homeowner said about timing and the trade's own questions,
    // plus their note — kept on the draft and put in front of the reviewer
    // (see createEstimateDraft's `homeowner`).
    homeowner: { ...homeowner, trade, outsideServiceArea },
    // The homeowner's attached photos/videos — re-normalised server-side (https
    // only, count-capped) so the browser can't stash anything but real media URLs.
    media,
    budget: budgetBand
      ? { min: budgetBand.min, max: budgetBand.max, label: budgetBand.label, exceeded: budgetGap }
      : null,
    // Nobody is signed in on this route — a homeowner on the contractor's own
    // website produced this draft. See lib/quotes/createdVia.js.
    createdVia: "instant_quote",
  });

  const emailLanguage = language;

  // ── The report: the page, the PDF and the emailed copy ───────────────────
  //
  // Once the price is out, the estimate becomes a report (app/estimate-report/
  // [token]): a branded page at a tokenised public URL, the PDF, and an
  // emailed copy in the language the form was read in — with the option
  // cards, the measurement summary, the property still and the three
  // buttons. publishEstimateReport mints the share token, renders, sends
  // (to the client email the draft was created with — nothing to send when
  // the homeowner gave a phone only) and returns the URL; a PDF or mail
  // hiccup inside it logs and still returns the URL, because the homeowner
  // is about to be sent to that page and the on-screen result stands. A
  // failure of the publish itself must not fail the request either.
  let report = null;
  try {
    report = await publishEstimateReport({ quoteId: draft.id, companyId: company.id, request });
  } catch (err) {
    console.error("[instant-quote/request] report publish failed:", err?.message);
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
    // Still readable, and no longer the ONLY home for the address. The line
    // below it stayed a summary; the address moved into `intake` where
    // convertLead can actually find it (see the intake note below).
    message: [address || measured.measurement.formattedAddress, `Instant estimate — ${trade}`]
      .filter(Boolean)
      .join("\n\n"),
    source: "instant_quote",
    clientPhotos: media,
    budgetBand: scoreKeyForBandIndex(budgetBand?.index),
    // The scorer's key for the "when" they tapped — the form now asks it, so
    // NOT_ASKED_BY_SOURCE in lib/leads/qualifiers.js no longer lists this
    // source for timeline.
    timeline: homeowner.timeline,
    // ── What the homeowner typed, kept ───────────────────────────────────
    //
    // This route passed no intake at all, so two things were lost.
    //
    // The address went into the `message` prose only, which meant converting
    // an instant-quote lead created a client with a blank address and no
    // jurisdiction — the identical defect the self-quote path was fixed for,
    // repeated because each caller hand-built its own blob. Built through
    // buildLeadIntake now, in the ONE shape convertLead reads.
    //
    // And the room dimensions, door counts, item lists and access answers the
    // homeowner typed reached the draft quote and never the lead, so "What
    // they told us" was empty for exactly the leads where they typed most.
    //
    // The MEASUREMENT is deliberately not copied in beside them. It is derived,
    // not told, it is already on the draft this lead links to by `quoteId`
    // (the panel shows a "View quote" button for it), and a derived number in
    // two places is a number waiting to disagree with itself.
    //
    // city/province/country only when a Places pick returned them: a typed
    // address, and every roof-address trade — geocodeAddress returns a
    // formatted string and no components — honestly has none.
    intake: buildLeadIntake({
      address: address || measured.measurement.formattedAddress,
      city,
      province,
      // Stored as it arrived, exactly like the self-quote form stores it.
      // normaliseCountry runs once, on the READ side in convertLead, so there
      // is one place that decides what a country code is.
      country,
      details: {
        ...enteredDetails(intake, materialKey),
        // The option actually tapped (the lead card prints its label), the
        // trade's answers, the note, and the area verdict — only when it is
        // a real "outside"; `false` is not written, absence is the record.
        whenNeeded: homeowner.whenNeeded,
        ...homeowner.answers,
        ...(homeowner.notes && { notes: homeowner.notes }),
        ...(outsideServiceArea && { outsideServiceArea: true }),
        // The report the homeowner was sent to, so the lead card links it.
        ...(report?.url && { reportUrl: report.url }),
      },
    }),
    // NOT a timeline. This form does not ask when they want the work done —
    // see NOT_ASKED_BY_SOURCE in lib/leads/qualifiers.js, which is what stops
    // the leads screen printing "Not stated" at a household nobody asked.
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
        // Lawn care: the program and add-ons this total is made of, priced
        // by the server — so the confirmation can list what was bought.
        ...(trade === "lawn_care" && Array.isArray(priced.estimate.lines) && { lines: priced.estimate.lines }),
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
    // Where the browser goes next: the report page. Null when the draft is
    // not one a report can be built for, and the form's own confirmation
    // stands in.
    reportUrl: report?.url || null,
    estimate: shown,
    // The measured facts behind the figure — squares, sq ft, pitch, and the
    // satellite still. The single-page form has no earlier round trip to get
    // these from, and a range with nothing behind it invites "where did that
    // come from?" as the first question on the call.
    measurement: {
      ...sanitiseMeasurement(pricedMeasurement),
      // Lawn care: the size and the sentences the panel shows under it, the
      // same words /measure sent before submit.
      ...(trade === "lawn_care" && { lawn: lawnPublicView(pricedMeasurement, emailLanguage) }),
    },
    // The company's own financing offer, same rule as everywhere else: their
    // words or their provider link, never a monthly figure from us.
    financing: financingOffer(company.financing, { language: emailLanguage }),
    message: shown ? null : gatedMessage(emailLanguage, "confirmed"),
  });
}

// ── The homeowner's own answers, for the lead board ────────────────────────
//
// `intake` here is whatever the trade's own fields were (doorCount,
// stairsFlights, the junk-removal item list, a jobType) — typed by the person,
// not derived by us, which is what "What they told us" means.
//
// Scalars and the item list only. Anything deeper is a shape this form does not
// produce, and letting an arbitrary posted object through into a Json column
// that a staff screen renders is how a public endpoint becomes a way to write
// whatever you like onto somebody's lead. Values are length-capped for the same
// reason; the count of keys is capped because the browser chooses them.
function enteredDetails(intake, materialKey) {
  const out = {};
  if (intake && typeof intake === "object" && !Array.isArray(intake)) {
    for (const [k, v] of Object.entries(intake).slice(0, 40)) {
      if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(k)) continue;
      if (k === "items") continue; // handled below — it is the one list
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
      else if (typeof v === "boolean") out[k] = v;
      else if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 200);
    }
    // The lawn add-ons picked — keys the company's own card names, so the
    // reviewer sees "aeration_fall" beside the program without opening the
    // quote. Strings only, capped.
    if (Array.isArray(intake.addOnKeys)) {
      const keys = intake.addOnKeys.filter((k) => typeof k === "string" && k).slice(0, 24).map((k) => k.slice(0, 60));
      if (keys.length) out.addOnKeys = keys;
    }
    if (Array.isArray(intake.items)) {
      const items = intake.items
        .filter((it) => it && typeof it.key === "string" && Number(it.quantity) > 0)
        .slice(0, 60)
        .map((it) => ({ key: it.key.slice(0, 60), quantity: Math.round(Number(it.quantity)) }));
      if (items.length) out.items = items;
    }
  }
  // Which option they picked, when the trade offered more than one. The price
  // came from it, so the reviewer should not have to open the quote to see it.
  if (typeof materialKey === "string" && materialKey.trim()) {
    out.material = materialKey.trim().slice(0, 60);
  }
  return out;
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
    // Painting's interior/exterior, as settled by the server. It was never
    // stored, and once the company's services can fix it without the
    // homeowner being asked, the reviewer needs to see which one was priced.
    scope: m.scope ?? null,
    access: m.access ?? null,
    condition: m.condition ?? null,
    doorCount: m.doorCount ?? null,
    drawerCount: m.drawerCount ?? null,
    boxLinearFt: m.boxLinearFt ?? null,
    // The condition tier the homeowner picked for cabinet refinishing. Kept
    // for the same reason doorCount/drawerCount are: it's what the reviewer's
    // cost estimate is derived from (costingInputsForInstantTrade reads it),
    // not just what's shown on screen.
    complexityLevel: m.complexityLevel ?? null,
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
    // Gutters: what the draft's takeoff is built from (costingInputsFor-
    // InstantTrade reads the run, the count, the basis, the imagery and the
    // flags) and what the reviewer reads on the row. Facts only — the
    // measurement never carried a rate.
    gutterFt: m.gutterFt ?? null,
    downspouts: m.downspouts ?? null,
    basis: m.basis ?? null,
    imagery: m.imagery ?? null,
    flags: Array.isArray(m.flags) ? m.flags : null,
    trustworthy: m.trustworthy ?? null,
    // Lawn care: the size, where it came from (parcel / traced / minimum —
    // the reviewer must know a minimum-band figure was never measured), the
    // parcel and roof figures it was derived from, the outline when there
    // is one, and the pick. Read by costingInputsForInstantTrade for the
    // takeoff and by the review screen. The parcel's vertices are kept; the
    // raw provider response is not.
    source: m.source ?? null,
    estimated: m.estimated ?? null,
    minSqft: m.minSqft ?? null,
    // Also the outline of a lawn_polygon / area_polygon trace (lib/estimate/
    // tracedArea.js): the shape the price was computed from, saved on the
    // draft and drawn on the document (lib/documentSections/traceOutline.js).
    vertices: Array.isArray(m.vertices) ? m.vertices : null,
    parcel: m.parcel
      ? { areaSqft: m.parcel.areaSqft ?? null, lotNumber: m.parcel.lotNumber ?? null, vertices: Array.isArray(m.parcel.vertices) ? m.parcel.vertices : null }
      : null,
    roof: m.roof ? { footprintSqft: m.roof.footprintSqft ?? null, areaSqft: m.roof.areaSqft ?? null } : null,
    driveway: m.driveway ?? null,
    provider: m.provider ? { key: m.provider.key, reason: m.provider.reason ?? null } : null,
    programKey: m.programKey ?? null,
    addOnKeys: Array.isArray(m.addOnKeys) ? m.addOnKeys : null,
  };
}

