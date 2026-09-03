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

import { db } from "@/lib/db";
import { notifyEvent } from "@/lib/notifications/notify";
import { normaliseMediaList } from "@/lib/media/validate";
import { getNextQuoteNumber } from "@/lib/quotes/quoteNumber";
import { normaliseCountry } from "@/lib/tax/jurisdictions";
import { resolveDocumentTax } from "@/lib/tax/documentTax";
import { quoteTotals } from "@/lib/quotes/totals";
import { buildQuoteCostingRow } from "@/app/api/quotes/costingWrite";
import { costBasisMissing } from "@/lib/costing/quoteCosting";
import { costingInputsForInstantTrade } from "@/lib/estimate/instantQuoteCosting";

// Match an existing client by email within the company before creating a new
// one — a repeat visitor shouldn't spawn a duplicate. Falls back to a fresh
// record when there's no email to match on.
async function findOrCreateClient(companyId, contact, address, language, jurisdiction) {
  const email = contact.email ? String(contact.email).trim().toLowerCase() : null;
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
      email: contact.email || null,
      phone: contact.phone || null,
      address: address || null,
      // The structured halves of that address, when the homeowner picked a
      // Places suggestion. Without them the client resolves to no jurisdiction
      // at all and every quote off this draft charges no tax silently — see
      // lib/tax/documentTax.js. Null, never invented, when they typed it.
      city: jurisdiction?.city || null,
      province: jurisdiction?.province || null,
      country: normaliseCountry(jurisdiction?.country),
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
 * @param {string} [p.language]
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
 *        phone estimator both run with nobody signed in, so there is no
 *        honest name to put here. Left null rather than guessed — needsReview
 *        already puts the draft in front of a human, which is where "who
 *        should pick this up" gets decided.
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
  language,
  media,
  budget,
  reviewNotes,
  clientId: resolvedClientId = null,
  sourceCallId = null,
  assignedToId = null,
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
    }));

  // The homeowner's attached photos/videos. Re-normalised here (not trusted from
  // the browser) so clientPhotos only ever holds https media URLs the reviewer
  // and the AI review can safely open.
  const clientMedia = normaliseMediaList(media);

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
  const taxClient = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, province: true, country: true },
  });
  const taxResolution = resolveDocumentTax({
    company,
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
  if (categoryId) {
    const { takeoff, intakeValues } = costingInputsForInstantTrade(
      trade,
      materialKey,
      measurement,
    );
    const built = await buildQuoteCostingRow({
      companyId: company.id,
      costing: {},
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

  const lastQuote = await db.quote.findFirst({
    where: { companyId: company.id },
    orderBy: { createdAt: "desc" },
    select: { quoteNumber: true },
  });
  const quoteNumber = getNextQuoteNumber(lastQuote?.quoteNumber);

  // Line items from the estimate breakdown so the draft renders like any other
  // quote; the authoritative range/measurements live in estimateData.
  const lineItems = (estimate.breakdown || []).map((b) => ({
    description: b.label,
    quantity: 1,
    rate: b.amount,
    amount: b.amount,
  }));

  const quote = await db.quote.create({
    data: {
      companyId: company.id,
      quoteNumber,
      clientId,
      quoteType: trade,
      language: language || "en",
      // The midpoint is the working figure; the reviewer confirms or edits it.
      // low/high are preserved in estimateData so "what the homeowner saw" is
      // never lost to a later edit of total.
      subtotal: estimate.point || 0,
      tax: totals.tax,
      taxEnabled: true,
      // subtotal + tax — the same arithmetic quoteTotals runs everywhere else.
      // A draft that resolved tax and still totalled at the bare subtotal
      // would be the "wrote it, never applied it" failure one field over.
      total: totals.total,
      lineItems,
      autoEstimated: true,
      needsReview: true,
      // See the note above the resolution: null when nobody was signed in to
      // name — both current callers pass nothing, and this stays honest about
      // it rather than guessing an owner.
      assignedToId: assignedToId || null,
      ...(costingRow && { costing: { create: costingRow } }),
      // Null rather than "" when there is nothing to review: an empty note
      // renders an empty box, and an empty box people learn to skip.
      reviewNotes: reviewNotes || null,
      // The call this came off, so the estimator can hear it. An id — the
      // recording URL is a bearer link and must never sit on a Quote row.
      sourceCallId: sourceCallId || null,
      estimateSource: source,
      ...(clientMedia.length && { clientPhotos: clientMedia }),
      estimateData: {
        trade,
        materialKey,
        measurement,
        range: { low: estimate.low, point: estimate.point, high: estimate.high },
        unit: estimate.unit || null,
        breakdown: estimate.breakdown || [],
        assumptions: estimate.assumptions || [],
        // What they SAID they could spend, next to what the job actually prices
        // at — the reviewer needs both in one place before picking up the phone.
        // Resolved server-side from the band index the form posted; omitted
        // entirely when unanswered, because a missing budget is not a budget of
        // zero and must not read as one on the review screen.
        ...(budget && { budget }),
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
            },
          ],
        },
      }),
    },
    select: { id: true, quoteNumber: true },
  });

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
