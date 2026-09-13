// lib/quotes/duplicateQuote.js
//
// The pure half of POST /api/quotes/[id]/duplicate: given a loaded quote,
// the `data` for a brand-new draft copied from it. No database in here, so
// scripts/check-quote-duplicate.mjs can run it against a hostile source row
// and assert, field by field, what a copy carries and what it must not.
//
// ── The rule ────────────────────────────────────────────────────────────────
//
// Copy the WORK, drop the HISTORY. Every column on Quote is one or the other,
// and this file is the list. A column added to the schema that is neither
// named in WORK below nor deliberately reset is simply absent from the copy —
// the database default applies — which is the safe direction: a new history
// column (a "viewedAt", say) will never leak onto a fresh draft by accident.

// The same toggle mayCost() in app/api/invoices/costingWrite.js reads. Read
// directly rather than through that module, which drags lib/db in behind
// lib/analytics/minimumPrice — this file is meant to load under bare node.
import { hasToggle } from "@/lib/permissions/enforce";

/**
 * A Prisma Decimal, a number, a string — the value as the client would type
 * it. Prisma accepts numbers and strings for Decimal columns; it does not
 * accept another row's Decimal instance in a nested create.
 */
function amount(value) {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Plain JSON cloned, so the copy shares no object with the source row. */
function cloneJson(value) {
  if (value === null || value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {object} source  the quote, with scopeGroups, addOns and costing
 * @param {object} p
 * @param {string} p.quoteNumber  the next live number — allocated by the caller
 * @param {string} p.userId       who pressed Duplicate
 * @param {object|null} p.member  the enforceable member, for the costing toggle
 * @returns {object} `data` for db.quote.create, minus companyId and createdVia,
 *   which the route stamps itself so the check script can assert they are
 *   never inherited.
 */
export function duplicateQuoteData(source, { quoteNumber, userId, member }) {
  if (!source || typeof source !== "object") {
    throw new TypeError("duplicateQuoteData: a source quote is required");
  }
  if (!quoteNumber) {
    throw new TypeError("duplicateQuoteData: a fresh quoteNumber is required");
  }

  // ── The kitchen design ───────────────────────────────────────────────────
  //
  // Lives in scopeDetails under serviceType "kitchen" and is copied whole:
  // the locked note on the designer is the reason Duplicate exists. The
  // CLIENT's own edits (clientKitchenConfig, clientDesignAt) are not — they
  // are what one homeowner drew on one sent document, and carrying them onto
  // a draft would show "your client saved their own version" of a quote no
  // client has opened.
  const scopeDetails = cloneJson(source.scopeDetails);

  const scopeGroups = Array.isArray(source.scopeGroups)
    ? source.scopeGroups.map((g, i) => ({
        categoryId: g.categoryId,
        label: g.label || null,
        lineItems: cloneJson(g.lineItems),
        takeoff: cloneJson(g.takeoff),
        intakeValues: cloneJson(g.intakeValues),
        subtotal: amount(g.subtotal),
        // Renumbered from the source order, not copied: the source was read
        // ordered by sortOrder, and a gap in the old numbering is nothing the
        // copy needs to preserve.
        sortOrder: i,
      }))
    : [];

  // Add-ons are OFFERS, so the offer is copied and the answer is not:
  // `selected` comes from the client ticking a box on the approval page, and
  // no client has seen this draft.
  const addOns = Array.isArray(source.addOns)
    ? source.addOns.map((a, i) => ({
        description: a.description,
        detail: a.detail || null,
        amount: amount(a.amount),
        taxable: a.taxable !== false,
        sortOrder: i,
        source: a.source || "manual",
        selected: false,
        selectedAt: null,
      }))
    : [];

  // The internal costing row, only for a member who may write one — the same
  // toggle POST /api/quotes consults before it will store a costing block.
  // Copied as the figures stood, not recomputed: the copy is a starting point,
  // and the editor reprices it the moment anything changes.
  const c = source.costing;
  const costing =
    c && hasToggle(member, "jobCosting")
      ? {
          crew: cloneJson(c.crew),
          addedLabourHours: amount(c.addedLabourHours),
          addedMaterialCost: amount(c.addedMaterialCost),
          labourRate: amount(c.labourRate),
          overheadPct: amount(c.overheadPct),
          note: c.note || null,
          labourHours: amount(c.labourHours),
          labourCost: amount(c.labourCost),
          materialTotal: amount(c.materialTotal),
          unpricedMaterials: Number(c.unpricedMaterials) || 0,
          overhead: amount(c.overhead),
          overheadBasis: c.overheadBasis || "pct_of_price",
          totalCost: amount(c.totalCost),
          price: amount(c.price),
          profit: amount(c.profit),
          marginPct: c.marginPct === null || c.marginPct === undefined ? null : amount(c.marginPct),
          marginTargetPct: amount(c.marginTargetPct) || 30,
          signal: c.signal || "none",
          costIncomplete: Boolean(c.costIncomplete),
          blendedRate: c.blendedRate === null || c.blendedRate === undefined ? null : amount(c.blendedRate),
          groups: cloneJson(c.groups),
        }
      : null;

  return {
    // ── WORK: what the estimator would otherwise retype ──────────────────
    quoteNumber,
    clientId: source.clientId,
    // Non-negotiable 6 — see the route header. Copied, never resolved.
    language: source.language || "en",
    quoteType: source.quoteType || null,
    lineItems: cloneJson(source.lineItems),
    clientPhotos: cloneJson(source.clientPhotos),
    scopeDetails,
    subtotal: amount(source.subtotal),
    discount: amount(source.discount),
    tax: amount(source.tax),
    total: amount(source.total),
    taxEnabled: source.taxEnabled !== false,
    notes: source.notes || null,
    processNotes: source.processNotes || null,
    // Internal review notes are about the CALL the original came from ("and
    // maybe new handles, I'm not sure"). The copy did not come from a call.
    reviewNotes: null,
    emailIncludeReferences: source.emailIncludeReferences ?? null,
    emailIncludeBeforeAfter: source.emailIncludeBeforeAfter ?? null,
    emailReferences: cloneJson(source.emailReferences),
    emailBeforeAfter: cloneJson(source.emailBeforeAfter),
    // A fresh draft is the duplicator's to work — the same default POST
    // /api/quotes applies when nobody is named.
    createdById: userId,
    assignedToId: userId,
    status: "draft",
    // Not copied: the original's validity was a promise about the original's
    // price on the original's date. The editor sets a new one.
    validUntil: null,
    ...(scopeGroups.length && { scopeGroups: { create: scopeGroups } }),
    ...(addOns.length && { addOns: { create: addOns } }),
    ...(costing && { costing: { create: costing } }),

    // ── HISTORY: explicitly reset, so a reader of this file sees the list ──
    // (All of these are also the column defaults; naming them is the point.)
    sentAt: null,
    sentToEmail: null,
    followUpSentAt: null,
    followUpCount: 0,
    shareToken: null,
    signature: null,
    acceptedTotal: null,
    acceptedSubtotal: null,
    acceptedTax: null,
    acceptedAt: null,
    declinedAt: null,
    declineReason: null,
    clientDesignSaved: false,
    clientDesignAt: null,
    clientKitchenConfig: null,
    aiReview: null,
    aiReviewedAt: null,
    aiVisionPasses: null,
    autoEstimated: false,
    needsReview: false,
    estimateSource: null,
    estimateData: null,
    reviewedById: null,
    reviewedAt: null,
    pdfUrl: null,
    calledAt: null,
    tierGroupId: null,
    tierLabel: null,
    sourceCallId: null,
    sourceThreadId: null,
    historicalImportedAt: null,
    composeSeconds: null,
  };
}
