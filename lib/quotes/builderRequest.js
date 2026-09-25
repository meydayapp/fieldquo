// lib/quotes/builderRequest.js
//
// The body QuoteBuilder posts — POST /api/quotes on a create, PATCH
// /api/quotes/[id] on an edit — as one pure function of the screen's state.
//
// ── Why it left the component ───────────────────────────────────────────────
//
// The builder now has two layouts over one state (lib/quotes/builderLayout.js).
// The promise that makes the second layout safe is that it changes nothing
// about what reaches the API, and a promise about bytes is checked with
// bytes: scripts/check-doc-builder.mjs runs a fixture quote through this
// function and through a transcript of the assembly this replaced (commit
// f74a2d13's inline literal in runSave) and requires the two md5s to match.
// Neither layout builds a request of its own; both call runSave, and runSave
// calls this.
//
// Key ORDER is part of the shape — it is what the hash measures — so the
// object is written in exactly the order the inline literal wrote it.
//
// Non-negotiable #5 holds here as it did there: every money figure in the
// body is the clamped, server-recomputed-anyway total the screen showed
// (`discount` is the CLAMPED figure quoteTotals worked with), the scope
// groups carry their line items and the server reprices from its own rows,
// and the cost block is inputs only.

/**
 * @param {object} p
 * @param {boolean} p.isEdit
 * @param {Array}   p.groupsPayload   scopeGroupPayload() per group
 * @param {object=} p.costing         costingPayload(), or undefined to say
 *                                    nothing about costing at all
 * @param {boolean} p.canEditScope    false on a decided quote — PATCH refuses
 *                                    scopeGroups there, so they are omitted
 * @param {boolean} p.assignedToTouched
 * @param {string}  p.assignedToId
 * @param {string=} p.version         the updatedAt this screen loaded
 * @param {string=} p.againstVersion  a stale-write retry's target
 * @param {string=} p.clientId        create only
 * @param {number=} p.composeSeconds  create only
 * @param {string=} p.language        create only — fixed at creation
 */
export function quoteRequestBody({
  isEdit,
  subtotal,
  appliedDiscount,
  tax,
  taxEnabled,
  total,
  notes,
  reviewNotes,
  processNotes,
  validUntil,
  clientPhotos,
  siteAddress,
  costing,
  groupsPayload,
  canEditScope,
  assignedToTouched,
  assignedToId,
  version,
  againstVersion,
  clientId,
  composeSeconds,
  language,
  // The "Often added with this" clicks — references, never amounts (see
  // lib/quotes/builderOffers.js). Appended LAST and only when there is at
  // least one, so a request that clicked none is byte-identical to the
  // request before this existed — the md5s in scripts/check-doc-builder.mjs
  // and scripts/check-custom-factors.mjs hold it to that.
  offerAddOns = null,
}) {
  const offers =
    Array.isArray(offerAddOns) && offerAddOns.length ? { offerAddOns } : {};
  const shared = {
    subtotal,
    // The CLAMPED figure quoteTotals worked with, not the raw box. If someone
    // typed 50000 off a 4850 quote, the screen already showed 4850 off and a
    // total of 0; saving the 50000 would put a number on the document that
    // contradicts the total beside it.
    discount: appliedDiscount,
    tax,
    taxEnabled,
    total,
    notes,
    reviewNotes,
    processNotes,
    validUntil: validUntil || null,
    clientPhotos,
    siteAddress: String(siteAddress || "").trim() || null,
    ...(costing !== undefined ? { costing } : {}),
  };

  if (isEdit) {
    return {
      ...shared,
      // Omitted once the client has decided: the API refuses line-item
      // changes on a decided quote, and sending them would fail the whole
      // save including the notes and the expiry that are still legitimately
      // editable.
      ...(canEditScope ? { scopeGroups: groupsPayload } : {}),
      // Only when the picker was actually touched — a routine save (a note,
      // an expiry date) must not silently re-post the assignee and trip
      // quote:assign for someone who never meant to reassign anything.
      ...(assignedToTouched && { assignedToId: assignedToId || null }),
      // The version this screen is editing FROM. Omitted entirely when there
      // isn't one — the route reads a missing field as "unguarded".
      ...((againstVersion ?? version)
        ? { expectedUpdatedAt: againstVersion ?? version }
        : {}),
      // Not on a decided quote: the offer is settled there, and the route
      // would decline it anyway.
      ...(canEditScope ? offers : {}),
    };
  }

  return {
    ...shared,
    clientId,
    composeSeconds,
    scopeGroups: groupsPayload,
    // Always created as a draft. Only a confirmed send promotes it, in
    // app/api/quotes/[id]/send.
    status: "draft",
    language,
    // Omitted on the default "(unassigned)" pick — POST /api/quotes resolves
    // that to whoever is saving.
    ...(assignedToId && { assignedToId }),
    ...offers,
  };
}
