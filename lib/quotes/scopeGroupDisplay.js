// lib/quotes/scopeGroupDisplay.js
//
// What NOT to repeat when a scope group is drawn on screen.
//
// ── The bug this exists to fix ──────────────────────────────────────────────
//
// Every render of a scope group — the app quote page, the PDF, the covering
// email, the public approval page, the builder's read-only view of an
// imported cost — draws the same two rows: a card head with the group's
// LABEL and its SUBTOTAL, then each of the group's line items with its own
// description and amount underneath.
//
// That is correct for a real breakdown: "Cabinet Refinishing — $4,200" over
// "37 doors, thermofoil" and "8 drawer fronts" tells you something the header
// didn't. It stops being correct the moment a group has exactly ONE line item
// whose description is the group's own label, repeated — the head already
// said "Subcontracted work — $9,871.68"; drawing the single item then says
// it again, word for word, dollar for dollar, immediately below.
//
// That is exactly what buildGroupLines in lib/quotes/importQuote.js produces
// for a "blended" subcontractor import with no custom label: the group's
// label defaults to "Subcontracted work" AND the one line item's description
// is hardcoded to the same string. Reported live on quote Q-2026-0014 as
// "the line appears TWICE" — it is the same $9,871.68 drawn by two different
// parts of the same card, not two scope groups and not two dollars. See
// docs/SUBCONTRACT-DUPLICATION.md for the full reconciliation.
//
// ── Why this filters at render time, not at creation ────────────────────────
//
// The obvious "fix" is to have buildGroupLines return no line items at all
// for a blended import — the header already carries the one figure. That
// looks right until a saved quote is reopened: groupSubtotal(), the function
// every editor save recomputes a persisted group's subtotal from, sums
// group.lineItems — not group.subtotal (lib/quotes/builderPayload.js). An
// empty lineItems array would make the very first editor save after an
// import zero out the cost it just added, silently, on the next PATCH. That
// is a worse bug than the one being fixed: real money disappearing instead of
// a screen saying something twice.
//
// So the stored line item stays exactly as buildGroupLines wrote it —
// reconcileScopeGroups, recomputeQuoteTotals and groupSubtotal never see this
// file. Only the four places that draw a group's items for a person to read
// call this first, and it decides item-by-item whether an item repeats
// nothing but its own header.
export function visibleLineItems(group) {
  const items = Array.isArray(group?.lineItems) ? group.lineItems : [];
  if (items.length !== 1) return items;

  const only = items[0];
  const label = String(group?.label ?? "").trim().toLowerCase();
  const desc = String(only?.description ?? "").trim().toLowerCase();
  if (!label || !desc || label !== desc) return items;

  // Same text is not enough on its own — only skip the row when it would
  // tell the reader literally nothing the header didn't: no quantity beyond
  // one, no extra detail paragraph, and the amount matches the header's
  // subtotal to the cent (a mismatch would mean the item is disagreeing with
  // its own group, which is worth surfacing, not hiding).
  if ((Number(only?.quantity) || 1) > 1) return items;
  if (only?.detail) return items;
  const itemCents = Math.round(Number(only?.amount || 0) * 100);
  const groupCents = Math.round(Number(group?.subtotal || 0) * 100);
  if (itemCents !== groupCents) return items;

  return [];
}

const num = (v) => Number(v ?? 0);

/**
 * Quotes carry scopeGroups; invoices carry a flat lineItems array.
 *
 * Normalised here rather than in each caller. Lifted unchanged from
 * ScopeGroupsSection so both sides of the document keep grouping identically.
 *
 * Lives in this file, beside visibleLineItems, rather than in
 * lib/email/quoteSections.js where it started: the email template editor (a
 * client page) previews the itemised block through
 * lib/email/templateLineItems.js, which needs this grouping and nothing else,
 * and quoteSections.js drags the trade-content catalogue and the email copy
 * catalogue into any bundle that imports it. quoteSections.js re-exports it,
 * so every existing caller is unchanged and there is still one copy.
 */
export function toGroups(data = {}) {
  if (Array.isArray(data.scopeGroups) && data.scopeGroups.length) {
    return data.scopeGroups.map((g) => {
      const label = g.label || g.category?.label || "";
      const lineItems = Array.isArray(g.lineItems) ? g.lineItems : [];
      const subtotal =
        g.subtotal !== undefined && g.subtotal !== null
          ? num(g.subtotal)
          : lineItems.reduce((s, li) => s + num(li.amount), 0);
      return {
        label,
        categoryKey: g.category?.key || null,
        override: g.companySettings || null,
        // The estimator's takeoff, carried through so the scope paragraph can
        // describe the job that was actually sold — a refacing quote in
        // thermofoil is not the sanded-and-sprayed job painted MDF is. Consumed
        // by resolveServiceContent and never rendered: it holds supplier cost
        // and markup on some trades.
        takeoff: g.takeoff ?? null,
        // Not `g.lineItems` directly — see visibleLineItems above. A blended
        // subcontractor import's one line item repeats the card head word for
        // word, dollar for dollar; drawing it too is what made Q-2026-0014
        // read as "Subcontracted work $9,871.68" twice. Stored data is
        // untouched; this only decides what a reader sees.
        items: visibleLineItems({ label, subtotal, lineItems }),
        subtotal,
      };
    });
  }
  if (Array.isArray(data.lineItems) && data.lineItems.length) {
    return [
      {
        label: "",
        categoryKey: null,
        override: null,
        takeoff: null,
        items: data.lineItems,
        subtotal: data.lineItems.reduce((s, li) => s + num(li.amount), 0),
      },
    ];
  }
  return [];
}
