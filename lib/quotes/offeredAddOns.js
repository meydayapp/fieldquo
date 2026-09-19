// lib/quotes/offeredAddOns.js
//
// The optional extras a quote OFFERS the client — the rows they tick on their
// copy — pre-filled from the company's own Products & Services catalogue.
//
// ── What the "Offered" section is, and why it was empty ────────────────────
//
// QuoteAddOn rows are the extras printed at the bottom of a quote with a
// checkbox: the client ticks the ones they want on /q/<token>, the server
// reprices from its own rows (non-negotiable #5), and the ticked ones join
// the accepted total. Three things fed that list: an estimator typing one,
// the AI review's "often sold alongside" suggestions, and a painting
// takeoff's optional rooms (lib/quotes/takeoffAddOns.js). Nothing fed it
// for a cabinet quote — instant or hand-built — so the owner opened
// Q-2026-0003 to "Nothing offered yet" under a section he could not place:
// "there should be either some AI recommendations for that — I'm assuming
// some of the add-ons? I don't know if it's client-entered."
//
// The company already owns the answer. Settings > Products & Services holds
// the add-ons FieldQuo seeded for each trade (app/data/standardAddOns.js —
// soft-close hinges $35/door, a two-tone finish $600 flat) at the company's
// OWN prices, linked to the categories they belong to. This turns those into
// offered rows when a quote is created, priced from the company's rows and
// this quote's own counts, so both an instant draft and a hand-built quote
// open with the trade's extras already offered, each removable.
//
// ── Only what this quote can honestly price ────────────────────────────────
//
// A per-door product needs a door count. The cabinet group's intake carries
// one (doorCount / drawerCount), so "Soft-Close Hinges, 25 doors" is $875 —
// the number the client would be charged. A per-unit product whose unit this
// quote cannot count (per hole, per sq ft, per hour) is NOT offered at the
// unit price: a homeowner ticking "$12" and being charged $300 is the wrong
// surprise, and ticking "$12" and getting $12 of handles is the other. Flat
// products are offered as-is. The estimator adds anything else by hand,
// priced by hand — which is what the "Add another" button is for.
//
// ── Seeded ONCE, at creation ───────────────────────────────────────────────
//
// Never on read, never on re-save: an estimator who removes the hinges and
// saves must not find them back on the next open. The PUT route replaces the
// non-takeoff rows wholesale (app/api/quotes/[id]/add-ons), so a removed
// catalogue row stays removed. The rows carry `source: "catalog"` so the
// panel can say where they came from.

const CAP = 8; // the editor's own cap — more than a handful is a second quote

export const CATALOGUE_ADD_ON_SOURCE = "catalog";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Which intake count a product's unit multiplies, if any. */
const COUNT_BY_UNIT = {
  door: "doorCount",
  doors: "doorCount",
  "per door": "doorCount",
  drawer: "drawerCount",
  drawers: "drawerCount",
  "per drawer": "drawerCount",
};
const FLAT_UNITS = new Set(["flat", "job", "each job", "per job", "lump sum", "fixed", ""]);

/**
 * The offered rows a quote's scope groups and the company's catalogue imply.
 *
 * Pure. `products` are Product rows with their categories inline
 * (`categories: [{ id }]`); `groups` are scope groups with `categoryId` and
 * `intakeValues`.
 *
 * @param {object} p
 * @param {Array<{categoryId:string, intakeValues?:object}>} p.groups
 * @param {Array<{id:string, name:string, description?:string, unit?:string, unitPrice?:number|string, active?:boolean, categories?:Array<{id:string}>}>} p.products
 * @param {number} [p.room]  how many rows may still be added (CAP minus what exists)
 * @returns {Array<{description:string, detail:string|null, amount:number, taxable:boolean, source:string, sortOrder:number}>}
 */
export function catalogueAddOnsFor({ groups, products, room = CAP }) {
  const rows = [];
  const seen = new Set();
  const list = Array.isArray(products) ? products : [];

  for (const g of Array.isArray(groups) ? groups : []) {
    if (!g?.categoryId) continue;
    const intake = g.intakeValues && typeof g.intakeValues === "object" ? g.intakeValues : {};
    for (const p of list) {
      if (!p || p.active === false) continue;
      const price = num(p.unitPrice);
      if (!(price > 0)) continue;
      const linked = (Array.isArray(p.categories) ? p.categories : []).some((c) => c?.id === g.categoryId);
      if (!linked) continue;
      const name = String(p.name || "").trim();
      if (!name || seen.has(name.toLowerCase())) continue;

      const unit = String(p.unit || "").trim().toLowerCase();
      let quantity = null;
      if (FLAT_UNITS.has(unit)) quantity = 1;
      else if (COUNT_BY_UNIT[unit]) {
        const n = Math.floor(num(intake[COUNT_BY_UNIT[unit]]));
        if (n > 0) quantity = n;
      }
      // A unit this quote cannot count: not offered at a price that is not
      // the price — see the header.
      if (!quantity) continue;

      seen.add(name.toLowerCase());
      const amount = Math.round(price * quantity * 100) / 100;
      rows.push({
        description: quantity > 1 ? `${name} (${quantity} × ${String(p.unit).trim()})` : name,
        detail: p.description ? String(p.description).trim().slice(0, 400) : null,
        amount,
        taxable: true,
        source: CATALOGUE_ADD_ON_SOURCE,
        sortOrder: 50 + rows.length,
      });
      if (rows.length >= room) return rows;
    }
  }
  return rows;
}

/**
 * Seed a NEW quote's offered extras from the catalogue. Returns how many rows
 * were written. Writes nothing when the quote already offers something the
 * estimator or the review put there — this is a starting point, never a
 * reset.
 *
 * Best-effort by contract, like syncTakeoffAddOns: the quote is committed by
 * the time this runs, and a failure here must not fail the save.
 *
 * @param {object} prisma
 * @param {{ companyId: string, quoteId: string, scopeGroups: Array }} p
 */
export async function seedCatalogueAddOns(prisma, { companyId, quoteId, scopeGroups }) {
  const groups = (Array.isArray(scopeGroups) ? scopeGroups : []).filter((g) => g?.categoryId);
  if (!groups.length) return 0;

  const existing = await prisma.quoteAddOn.count({
    where: { quoteId, source: { not: "takeoff" } },
  });
  if (existing > 0) return 0;

  const products = await prisma.product.findMany({
    where: { companyId, active: true },
    select: { id: true, name: true, description: true, unit: true, unitPrice: true, active: true, categories: { select: { id: true } } },
  });
  const rows = catalogueAddOnsFor({ groups, products, room: CAP }).map((r) => ({ ...r, quoteId }));
  if (!rows.length) return 0;
  await prisma.quoteAddOn.createMany({ data: rows });
  return rows.length;
}
