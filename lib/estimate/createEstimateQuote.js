// lib/estimate/createEstimateQuote.js
//
// Turn a computed instant estimate into a reviewable draft Quote. The homeowner
// saw a RANGE; this records it as a draft the company must approve before it
// can be sent. Everything client-facing about the number was already computed
// server-side from the company's saved config — this only persists it.
//
// The draft lands in `draft` status with needsReview=true, which is the ONLY
// way an auto-estimated quote enters the review queue. Nothing here sends
// anything or tells the homeowner a binding price.

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { attachUsTaxRate } from "@/lib/tax/usRates";
import { resolutionForDocument } from "@/lib/tax/taxResolution";
import { notifyEvent } from "@/lib/notifications/notify";
import { normaliseMediaList } from "@/lib/media/validate";
import { getNextQuoteNumber, LIVE_QUOTE_NUMBER_WHERE } from "@/lib/quotes/quoteNumber";
import { requireCreatedVia } from "@/lib/quotes/createdVia";
import { normaliseCountry } from "@/lib/tax/jurisdictions";
import { cleanAddressPart } from "@/lib/format/address";
import { resolveDocumentTax } from "@/lib/tax/documentTax";
import { quoteTotals } from "@/lib/quotes/totals";
import { buildQuoteCostingRow } from "@/app/api/quotes/costingWrite";
import {
  costBasisMissing,
  FALLBACK_LABOUR_RATE,
  FALLBACK_OVERHEAD_PCT,
} from "@/lib/costing/quoteCosting";
import { costingInputsForInstantTrade } from "@/lib/estimate/instantQuoteCosting";
import { cleanEmail } from "@/lib/validation";
import { withCapturedSatellite } from "@/lib/measure/satelliteCapture";
import { tradeAnswerLines } from "@/lib/leads/tradeQuestions";
import { serviceAreaCopy } from "@/lib/company/serviceArea";
import { lawnLinesFromEstimate } from "@/lib/quotes/lawnLines";
import { formatMoney } from "@/lib/currency";
import { lineItemsFromBreakdown, breakdownForRecord } from "@/lib/estimate/estimateLines";
import { soloEstimatorFor } from "@/lib/estimate/soloEstimator";
import { tradeLabel } from "@/lib/estimate/instantQuoteServer";
import { seedCatalogueAddOns } from "@/lib/quotes/offeredAddOns";

// Match an existing client by email within the company before creating a new
// one — a repeat visitor shouldn't spawn a duplicate. Falls back to a fresh
// record when there's no email to match on.
async function findOrCreateClient(companyId, contact, address, language, jurisdiction) {
  // Matched and STORED through the same normaliser — see convertLead.js for
  // the duplicate-client bug the old asymmetry produced.
  const email = cleanEmail(contact.email);
  if (email) {
    const existing = await db.client.findFirst({
      where: { companyId, email },
      select: { id: true },
    });
    if (existing) return existing.id;
  }
  const client = await db.client.create({
    data: {
      companyId,
      name: contact.name || "Website enquiry",
      email,
      phone: contact.phone || null,
      address: address || null,
      // The structured halves of that address, when the homeowner picked a
      // Places suggestion. Without them the client resolves to no jurisdiction
      // at all and every quote off this draft charges no tax silently — see
      // lib/tax/documentTax.js. Null, never invented, when they typed it.
      city: jurisdiction?.city || null,
      province: jurisdiction?.province || null,
      country: normaliseCountry(jurisdiction?.country),
      // The same two components the clients screen and the builder's quick-add
      // store (app/api/clients): the client this creates is the same record
      // whichever door it came through. Null when typed by hand.
      postalCode: cleanAddressPart(jurisdiction?.postalCode),
      county: cleanAddressPart(jurisdiction?.county),
      language: language || null,
    },
    select: { id: true },
  });
  return client.id;
}

/**
 * @param {object} p
 * @param {{id:string}} p.company
 * @param {string} p.trade            estimator trade key
 * @param {string} p.categoryId       ServiceCategory id to file the scope under
 * @param {object} p.contact          { name, email, phone }
 * @param {object} p.measurement      snapshot shown to the homeowner
 * @param {string} p.materialKey
 * @param {object} p.estimate         { low, point, high, breakdown, ... }
 * @param {string} p.source           "google_solar" | "lawn_polygon" | "manual"
 * @param {string} [p.address]
 * @param {string} [p.city]      structured halves of that address, from Places.
 * @param {string} [p.province]  Absent when it was typed by hand, and absent is
 * @param {string} [p.country]   the correct record of that — see findOrCreateClient.
 * @param {string} [p.postalCode] The rest of the Places components, for the
 * @param {string} [p.county]     client record only (never for a price).
 * @param {string} [p.language]
 * @param {object} [p.homeowner]    What the homeowner said on the public form
 *        that the estimate does not price: `whenNeeded`, the trade's own
 *        `answers`, their `notes`, the `trade` key and `outsideServiceArea`
 *        (lib/leads/tradeQuestions.js). Kept on estimateData.homeowner and
 *        written into reviewNotes as staff-readable lines, so the reviewer
 *        sees "Active leak: Yes" without opening the lead.
 * @param {string} [p.reviewNotes]  INTERNAL. What the caller asked for that
 *        this estimate does not carry. Lands in Quote.reviewNotes, which no
 *        client-facing surface reads — see the schema comment.
 * @param {string} [p.clientId]   A client the CALLER has already been resolved
 *        to. See the note at the resolution below.
 * @param {string} [p.sourceCallId]  The VoiceCall this was drafted from. An id,
 *        never a recording URL — see the Quote.sourceCallId schema comment.
 * @param {string} [p.assignedToId]  A staff member already known to be working
 *        this draft — a User id, proven to belong to this company by the
 *        CALLER before it reaches here (see lib/tenant/ownedIds.js). Absent
 *        for both current callers: the public instant-quote form and the
 *        phone estimator both run with nobody signed in. When absent, the
 *        draft is assigned the way a hand-built quote would default — to the
 *        one person who can write quotes, when the company has exactly one
 *        (lib/estimate/soloEstimator.js) — and left null otherwise, for the
 *        review queue to claim; needsReview puts it in front of a human
 *        either way.
 */
export async function createEstimateDraft({
  company,
  trade,
  categoryId,
  contact,
  measurement,
  materialKey,
  estimate,
  source,
  address,
  city,
  province,
  country,
  postalCode = null,
  county = null,
  language,
  media,
  budget,
  homeowner = null,
  reviewNotes,
  clientId: resolvedClientId = null,
  sourceCallId = null,
  assignedToId = null,
  // ── Which of this function's two callers is asking ───────────────────────
  //
  // REQUIRED, and deliberately not defaulted. The same estimate draft is
  // created from two completely different places — the public instant
  // estimator on a contractor's website, and the phone assistant pricing a
  // call — and `source` above cannot stand in for it: that column records how
  // the NUMBERS were derived ("google_solar", "lawn_polygon", "manual"), which
  // is a different question and is already the same string for both callers on
  // a manual trade.
  //
  // Defaulting it to either value would silently file every call under the
  // website, or every website enquiry under the phone, on the one screen that
  // exists to tell them apart. requireCreatedVia throws on undefined, so a
  // third caller has to decide rather than inherit.
  createdVia,
}) {
  // ── A caller who has already been matched is not matched again ───────────
  //
  // findOrCreateClient below matches on EMAIL only, which is right for the
  // public instant form — a homeowner types one. It is wrong for a phone call,
  // where most callers give a name and a number and never an address, so every
  // priced call created a fresh client no matter how many times the same person
  // had rung. lib/ai/callQuoteDraft.js now resolves the caller properly —
  // email, the number they gave, and the number they rang from, all normalised
  // — and hands the answer in. Doing that work and then letting this function
  // create a second row anyway is the duplicate it exists to prevent.
  const clientId =
    resolvedClientId ||
    (await findOrCreateClient(company.id, contact, address, language, {
      city,
      province,
      country,
      postalCode,
      county,
    }));

  // The homeowner's attached photos/videos. Re-normalised here (not trusted from
  // the browser) so clientPhotos only ever holds https media URLs the reviewer
  // and the AI review can safely open.
  const clientMedia = normaliseMediaList(media);

  // ── Keep the satellite still, not a link to one ──────────────────────────
  //
  // The measurement arrives holding a Static Maps URL with a public key in it.
  // Stored as-is it is a hotlink that breaks on a key rotation, is re-billed on
  // every open of the review, and shows next year's imagery rather than the
  // photograph this price was worked out from. Captured once here, so the
  // review screen and the quote both point at an image that cannot change
  // under them. Falls through unchanged on any failure — see the module.
  //
  // Deliberately NOT added to clientPhotos: that array is what the HOMEOWNER
  // sent, and quotes/completeness.js counts it to decide whether there is site
  // media. Putting our own aerial in there would make an empty submission
  // report photos nobody took.
  const measurementSaved = await withCapturedSatellite(measurement, {
    companyId: company.id,
  });

  // ── Tax, resolved the way every other document resolves it ───────────────
  //
  // This function used to leave `tax` and `taxEnabled` off the create entirely
  // — not "resolved to $0", genuinely never attempted — so every auto-estimated
  // draft entered review already wrong: taxEnabled defaulted true (the column's
  // own default) while tax sat at 0, which is exactly the `unresolved` state
  // lib/tax/documentTax.js exists to catch and never show as a settled "no tax
  // owed". Q-2026-0011 was the sent-quote version of this; here it was
  // happening on every single instant estimate, silently, before a human ever
  // saw it.
  //
  // Read off the CLIENT ROW rather than the `city`/`province`/`country`
  // arguments above: a repeat visitor matches an EXISTING client by email
  // (findOrCreateClient), whose jurisdiction may be fuller than whatever this
  // particular request happened to carry — or the request may have typed an
  // address by hand and carry no structured jurisdiction at all while the
  // client record already has one from an earlier visit. The stored row is
  // the same fact resolveDocumentTax reads for every other quote against this
  // client, so this document and the next one against the same client cannot
  // disagree about where they live.
  // With the ZIP rate row attached and the company's per-state overrides
  // read here rather than demanded of every caller's select — a caller that
  // forgot one would silently get the state floor, or ignore an override.
  const [taxClient, taxCompanyExtra] = await Promise.all([
    db.client
      .findUnique({
        where: { id: clientId },
        select: { id: true, name: true, address: true, province: true, postalCode: true, country: true },
      })
      .then(attachUsTaxRate),
    db.company.findUnique({ where: { id: company.id }, select: { usTaxOverrides: true } }),
  ]);
  const taxResolution = resolveDocumentTax({
    company: { ...company, usTaxOverrides: taxCompanyExtra?.usTaxOverrides ?? null },
    taxRates: company.taxRates,
    client: taxClient,
    // Never inferred — see resolveTaxRate's own doc comment. Nobody was asked
    // "does this qualify for a reduced renovation rate" at instant-quote time,
    // so nothing here claims they were.
    workType: null,
    lang: language || company.defaultLanguage || "en",
  });
  const totals = quoteTotals({
    subtotal: estimate.point || 0,
    discount: 0,
    taxRate: taxResolution.rate,
    // Always true, matching the Quote.taxEnabled column's own default: nobody
    // has switched tax off on a draft nobody has looked at yet, so leaving it
    // on is the honest reading of "unset" rather than a claim the estimator
    // made a decision.
    taxEnabled: true,
  });

  // ── Costing, from the SAME server module the normal builder saves through ──
  //
  // Not a second calculation: buildQuoteCostingRow is the exact function
  // POST /api/quotes and PATCH /api/quotes/[id] call when an estimator's cost
  // panel has something to say. Here the "estimator" is the instant flow
  // itself, and what it has to say is whatever costingInputsForInstantTrade
  // could honestly translate from the measurement — real labour hours for
  // roofing and cabinet trades, nothing for the rest (see that file's header
  // for why those two and not the others).
  //
  // A row is only PERSISTED when it has a real cost basis. Saving one built
  // from zero takeoff hours and zero materials would write a "costed"
  // QuoteCosting row whose margin is overhead-only — exactly the misleading
  // green-margin bug costBasisMissing exists to catch (see the comment on
  // deriveQuoteCosting). That check only runs on the RECOMPUTE fallback,
  // never on a saved row (GET /api/quotes/[id]/costing trusts a saved row
  // unconditionally) — so writing a basis-free row here would bypass the very
  // guard that makes an empty cost panel safe everywhere else. Leaving the
  // row unwritten in that case is not a regression: deriveQuoteCosting already
  // recomputes on read and already labels it costBasisMissing, precisely the
  // same honest state a hand-typed quote with no takeoff shows today.
  let costingRow = null;
  // The takeoff and intake values the measurement translates to, in the
  // builder's own field names — stored ON the scope group below, not only
  // fed to the costing row, so the editor opens this quote with the same
  // cost panel, hours, materials and overhead as a hand-built one (see the
  // header of instantQuoteCosting.js for what was wrong before).
  let groupTakeoff = null;
  let groupIntake = null;
  // The category's own label, for the lines below: a builder-shaped line
  // reads "<service> — doors", and the service name is the category's, the
  // same text the scope card shows over the group (label null → category).
  let categoryLabel = "";
  if (categoryId) {
    const category = await db.serviceCategory.findUnique({ where: { id: categoryId }, select: { key: true, label: true } }).catch(() => null);
    categoryLabel = category?.label || tradeLabel(trade);
    const { takeoff, intakeValues } = costingInputsForInstantTrade(
      trade,
      materialKey,
      measurementSaved,
      { categoryKey: category?.key || null },
    );
    groupTakeoff = takeoff;
    groupIntake = intakeValues;
    const built = await buildQuoteCostingRow({
      companyId: company.id,
      // ── The same assumptions a hand-built quote is costed on ─────────────
      //
      // This was `{}`, and normaliseQuoteCosting reads an absent rate as 0.
      // The row it wrote carried the roof's real labour hours — 71.76 on one
      // demo estimate — at $0.00 an hour, and 0% overhead, so the quote page
      // showed a job whose labour cost nothing and a margin fattened by the
      // whole wage bill; the editor then opened the same quote with "0" in
      // the rate box. Reported by the owner as the estimate reviews "not
      // having the same costing and labour applied" as a builder quote — and
      // they didn't. The builder opens at FALLBACK_LABOUR_RATE and
      // FALLBACK_OVERHEAD_PCT (QuoteBuilder.js), and deriveQuoteCosting
      // recomputes an uncosted quote on exactly the same two figures, so an
      // instant estimate costs on them too. No crew: nobody has said who is
      // doing this job, and the workers on the payroll today are not an
      // answer to that question.
      costing: {
        labourRate: FALLBACK_LABOUR_RATE,
        overheadPct: FALLBACK_OVERHEAD_PCT,
      },
      price: estimate.point || 0,
      scopeGroups: [{ categoryId, label: null, takeoff, intakeValues }],
    });
    if (
      built &&
      !costBasisMissing({
        labourHours: built.labourHours,
        materialTotal: built.materialTotal,
        price: estimate.point || 0,
      })
    ) {
      costingRow = built;
    }
  }

  // ── Who it opens assigned to ─────────────────────────────────────────────
  //
  // The same default a hand-built quote gets: its author. Nobody authored
  // this one, so the nearest honest reading is the only person who COULD
  // have — a solo company's one estimator. With several, null: see the
  // module. Never overrides a caller that already named someone.
  const resolvedAssignedToId =
    assignedToId || (await soloEstimatorFor(db, company.id).catch(() => null)) || null;

  const lastQuote = await db.quote.findFirst({
    // Historical rows carry their own series — see lib/quotes/quoteNumber.js.
    where: { companyId: company.id, ...LIVE_QUOTE_NUMBER_WHERE },
    orderBy: { createdAt: "desc" },
    select: { quoteNumber: true },
  });
  const quoteNumber = getNextQuoteNumber(lastQuote?.quoteNumber);

  // Line items from the estimate breakdown so the draft renders like any other
  // quote; the authoritative range/measurements live in estimateData.
  //
  // Lawn care folds its breakdown into the builder's own shape — one line
  // per program with the included treatments in `detail`, one per add-on —
  // so the draft a homeowner's address produced opens in the editor and
  // prints for the client exactly like one an estimator picked by hand
  // (lib/quotes/lawnLines.js). Prices in the detail are in the company's
  // currency, in the document's language.
  const docLanguage = language || company.defaultLanguage || "en";

  // ── What the homeowner told us, for the reviewer ─────────────────────────
  //
  // Lines in the COMPANY's language — the reviewer's, not the document's —
  // because reviewNotes is internal (see the schema comment) and never
  // reaches the homeowner. The raw answers ride on estimateData so the AI
  // review (lib/ai/quoteReview.js) and the review screen can read the keys
  // rather than parse the prose back.
  const homeownerLines = homeowner
    ? [
        ...(homeowner.outsideServiceArea
          ? [serviceAreaCopy(company.defaultLanguage || "en").outsideBadge]
          : []),
        ...tradeAnswerLines(homeowner.trade || trade, homeowner, company.defaultLanguage || "en"),
      ]
    : [];
  const mergedReviewNotes = [reviewNotes, homeownerLines.join("\n")].filter((x) => x && x.trim()).join("\n\n");

  const lineItems =
    trade === "lawn_care" && Array.isArray(estimate.lines)
      ? lawnLinesFromEstimate(estimate.lines, {
          language: docLanguage,
          currencyFormat: (n) => formatMoney(n, company.currency, docLanguage === "fr" ? "fr-CA" : docLanguage === "es" ? "es" : "en-CA"),
        })
      : // Every other trade: the count × rate line an estimator would have
        // written, wherever the estimator said what it counted (cabinets:
        // doors and drawer fronts at the per-face rate, with the complexity
        // meta); the flat label line where it did not. See estimateLines.js.
        lineItemsFromBreakdown(estimate.breakdown, { label: categoryLabel });

  const quote = await db.quote.create({
    data: {
      companyId: company.id,
      quoteNumber,
      clientId,
      // Validated at the point of the write, so a caller that passed nothing
      // fails here rather than writing a null that reads as "created before
      // this column existed" — a lie about a row created today.
      createdVia: requireCreatedVia(createdVia),
      quoteType: trade,
      language: language || "en",
      // The midpoint is the working figure; the reviewer confirms or edits it.
      // low/high are preserved in estimateData so "what the homeowner saw" is
      // never lost to a later edit of total.
      subtotal: estimate.point || 0,
      tax: totals.tax,
      taxEnabled: true,
      // What the line said — recorded here so the reviewer's screen, the
      // PDF and the invoice raised later all explain the same figure. A
      // "depends" state got its stated default (nobody was asked); the
      // record carries assumedAnswer and the builder shows it.
      taxResolution:
        resolutionForDocument({
          resolution: taxResolution,
          tax: totals.tax,
          taxableBase: totals.taxableBase,
          taxEnabled: true,
        }) ?? Prisma.DbNull,
      // subtotal + tax — the same arithmetic quoteTotals runs everywhere else.
      // A draft that resolved tax and still totalled at the bare subtotal
      // would be the "wrote it, never applied it" failure one field over.
      total: totals.total,
      lineItems,
      autoEstimated: true,
      needsReview: true,
      // The caller's name, the solo estimator, or null — see the resolution
      // above. Never a guess between two people.
      assignedToId: resolvedAssignedToId,
      ...(costingRow && { costing: { create: costingRow } }),
      // Null rather than "" when there is nothing to review: an empty note
      // renders an empty box, and an empty box people learn to skip.
      reviewNotes: mergedReviewNotes || null,
      // The call this came off, so the estimator can hear it. An id — the
      // recording URL is a bearer link and must never sit on a Quote row.
      sourceCallId: sourceCallId || null,
      estimateSource: source,
      ...(clientMedia.length && { clientPhotos: clientMedia }),
      estimateData: {
        trade,
        materialKey,
        measurement: measurementSaved,
        range: { low: estimate.low, point: estimate.point, high: estimate.high },
        unit: estimate.unit || null,
        // What the homeowner SAW: labels and amounts. The builder-shaped
        // line each entry may carry lives on the scope group above, not here.
        breakdown: breakdownForRecord(estimate.breakdown),
        assumptions: estimate.assumptions || [],
        // What they SAID they could spend, next to what the job actually prices
        // at — the reviewer needs both in one place before picking up the phone.
        // Resolved server-side from the band index the form posted; omitted
        // entirely when unanswered, because a missing budget is not a budget of
        // zero and must not read as one on the review screen.
        ...(budget && { budget }),
        // The homeowner's timing, trade answers and note, as KEYS (labels are
        // rendered per reader). Absent when the caller had none (the phone
        // path), never an empty object pretending to be an answer.
        ...(homeowner && {
          homeowner: {
            whenNeeded: homeowner.whenNeeded || null,
            answers: homeowner.answers || {},
            notes: homeowner.notes || null,
            ...(homeowner.outsideServiceArea && { outsideServiceArea: true }),
            lines: homeownerLines,
          },
        }),
        capturedAt: new Date().toISOString(),
      },
      ...(categoryId && {
        scopeGroups: {
          create: [
            {
              categoryId,
              label: null,
              lineItems,
              subtotal: estimate.point || 0,
              sortOrder: 0,
              // The measured quantities, so the editor's cost panel and
              // TradeTakeoff read this group the way they read one an
              // estimator built. The PRICE stays the lines above — a
              // persisted group is edited as lines, never re-priced.
              ...(groupTakeoff && { takeoff: groupTakeoff }),
              ...(groupIntake && { intakeValues: groupIntake }),
            },
          ],
        },
      }),
    },
    select: { id: true, quoteNumber: true },
  });

  // ── The trade's extras, offered the way a hand-built quote offers them ───
  //
  // POST /api/quotes seeds the same rows from Settings > Products & Services;
  // without this an instant draft opened to "Nothing offered yet" beside a
  // hand-built quote of the same kitchen that offered the hinges. Best-effort
  // and after the create: the draft is the thing that matters.
  if (categoryId) {
    await seedCatalogueAddOns(db, {
      companyId: company.id,
      quoteId: quote.id,
      scopeGroups: [{ categoryId, intakeValues: groupIntake }],
    }).catch((err) => console.error("[createEstimateDraft] catalogue add-ons:", err?.message));
  }

  // ── Somebody has to sign this off, and until now nobody was told ─────────
  //
  // This is the ONE place Quote.needsReview is set (the other `needsReview` in
  // the codebase is VoiceCall's, a different flag on a different model), so it
  // covers both routes into the queue: the public instant estimate and a quote
  // drafted off a recorded call. The homeowner has ALREADY been shown a number
  // by the time we get here; a draft sitting unseen in /app/estimate-reviews
  // overnight is a price nobody has stood behind and a caller nobody has rung.
  //
  // Fire-and-forget after the create has committed, and never awaited: the
  // draft is the thing that matters and a notification must not be able to fail
  // it. notifyEvent never throws (see its header).
  notifyEvent({
    companyId: company.id,
    type: "quote.needsReview",
    entityId: quote.id,
    params: {
      quoteNumber: quote.quoteNumber || "",
      clientName: contact?.name || "",
      // Which door it came through, as the one binary that changes what the
      // reviewer does next: somebody is waiting for a call back, or somebody
      // filled in a form. Not the raw `source` — Quote.estimateSource is
      // free-form by design, so a param carrying it would print a raw token.
      fromCall: source === "phone_call",
    },
    // No actor and no amount, both deliberately. Nobody DID this — a form
    // submission or a phone call did — and the row says a draft is waiting,
    // never what it is worth. The figure is on the screen behind it, which has
    // its own showPricing gate.
    actorUserId: null,
  }).catch(() => {});

  return quote;
}
