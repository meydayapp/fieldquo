// lib/leads/scopeEstimate.js
//
// A quick estimate of what a lead is worth, from the scope the homeowner gave
// and the COMPANY's own prices. Pure: the caller loads the company's services
// and price books (loadScopePricing below is the one read) and hands them in.
//
// ══ Why (owner, 2026-10-05) ════════════════════════════════════════════════
//
// "If we have enough information, like leads from instant estimates or the
// client giving actual numbers of drawers, doors and boxes, it should create a
// quick estimate of the potential revenue from that lead." And the corollary:
// a lead that gave nothing shows nothing. The "average" basis that priced a
// triple-tapped ice-breaker at the company's mean won quote is gone
// (lib/leads/potentialValue.js).
//
// ══ Whose prices ═══════════════════════════════════════════════════════════
//
// Only the company's: its price book for that service (app/data/
// tradePriceBooks.js merged with CompanyServiceCategory.rates — exactly what
// its quote builder prices from), or the single rate it set on the service
// (`defaultRate` + `unit`). A service the company has not ENABLED has no
// price here, whatever the code defaults say: an estimate in a trade the
// company does not sell is an invented number. And never another company's
// (non-negotiable #8) — the read below is scoped to one companyId.
//
// ══ The arithmetic ═════════════════════════════════════════════════════════
//
//   cabinet_refinishing / cabinet_refacing   doors × perDoor + drawers ×
//                                            perDrawer, at the book's standard
//                                            complexity, then the book's job
//                                            minimum ("Job minimum") if higher
//   flooring                                 sq ft × the standard price per sq ft
//   any service with a single rate per sq ft / door / room / piece
//                                            count × that rate
//
// Boxes are counted but priced only where the company's book prices them; a
// count the book cannot price is named, never guessed at. Before tax, and the
// screen says "estimate".

import { getPriceBook, hasPriceBook } from "@/app/data/tradePriceBooks";

const UNIT_PRICED = Object.freeze(["cabinet_refinishing", "cabinet_refacing"]);

const money = (n) => {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : null;
};
const round = (n) => Math.round(n * 100) / 100;

/** A single rate's unit → the scope count it multiplies. */
const RATE_UNIT_TO_COUNT = Object.freeze({
  sqft: "sqft", "sq ft": "sqft", "sq. ft": "sqft", "sq. ft.": "sqft", "square foot": "sqft", "square feet": "sqft", sf: "sqft", ft2: "sqft",
  door: "doors", doors: "doors",
  drawer: "drawers", drawers: "drawers",
  room: "rooms", rooms: "rooms",
  piece: "pieces", pieces: "pieces", pc: "pieces", unit: "pieces",
});

/**
 * Which of the company's services a scope belongs to, when the lead names
 * none. Pure. Doors and drawers point at a per-piece cabinet service — only
 * when exactly ONE is enabled, or the conversation named which ("refinish",
 * "paint" → refinishing; "reface", "new doors" → refacing).
 *
 * @param services  [{ categoryId, key, label }]
 * @param counts    scope counts
 * @param text      the person's words (flattened or not)
 */
export function inferService(services = [], counts = {}, text = "") {
  const list = Array.isArray(services) ? services : [];
  if (Number(counts.doors) > 0 || Number(counts.drawers) > 0) {
    const cab = list.filter((s) => UNIT_PRICED.includes(s.key));
    if (cab.length === 1) return cab[0];
    if (cab.length > 1) {
      const t = String(text || "").toLowerCase();
      if (/refac|new doors|replace the doors/.test(t)) return cab.find((s) => s.key === "cabinet_refacing") || null;
      if (/refinish|paint|spray|repaint|stain/.test(t)) return cab.find((s) => s.key === "cabinet_refinishing") || null;
      return null;
    }
  }
  if (Number(counts.sqft) > 0) {
    const floors = list.filter((s) => s.key === "flooring");
    if (floors.length === 1) return floors[0];
  }
  return null;
}

/**
 * The quick estimate. Pure.
 *
 * @param counts   { doors, drawers, boxes, pieces, rooms, sqft }
 * @param service  { categoryId, key, label, book, defaultRate, unit } — one
 *                 entry from loadScopePricing(), or null
 * @returns {{ amount: number|null, why?: string, service?: string,
 *             counts?: object, minimumApplied?: boolean, unpriced?: string[] }}
 *   `why` is set whenever amount is null: "no_scope" (nothing counted),
 *   "no_service" (no service to price it under), "no_pricing" (the company
 *   has no price for these counts in that service).
 */
export function estimateFromScope(counts = {}, service = null) {
  const c = {};
  for (const [k, v] of Object.entries(counts || {})) if (Number(v) > 0) c[k] = Number(v);
  if (!Object.keys(c).length) return { amount: null, why: "no_scope" };
  if (!service) return { amount: null, why: "no_service", counts: c };

  const label = service.label || service.key || "";
  const used = {};
  let total = 0;
  let minimumApplied = false;

  if (UNIT_PRICED.includes(service.key) && service.book) {
    const perDoor = money(service.book.perDoor);
    const perDrawer = money(service.book.perDrawer);
    if (c.doors && perDoor) {
      total += c.doors * perDoor;
      used.doors = c.doors;
    }
    if (c.drawers && perDrawer) {
      total += c.drawers * perDrawer;
      used.drawers = c.drawers;
    }
    if (total > 0) {
      const minimum = money(service.book.minimumTotal);
      if (minimum && total < minimum) {
        total = minimum;
        minimumApplied = true;
      }
    }
  } else if (service.key === "flooring" && service.book && c.sqft) {
    const rate = money(service.book?.complexity?.standard?.pricePerSqft);
    if (rate) {
      total += c.sqft * rate;
      used.sqft = c.sqft;
    }
  }

  // The company's single rate for the service, when it is per a counted unit
  // and the book did not already price that count.
  if (!total) {
    const unit = String(service.unit || "").trim().toLowerCase();
    const countKey = RATE_UNIT_TO_COUNT[unit];
    const rate = money(service.defaultRate);
    if (countKey && rate && c[countKey]) {
      total += c[countKey] * rate;
      used[countKey] = c[countKey];
    }
  }

  const unpriced = Object.keys(c).filter((k) => !(k in used));
  if (!total) return { amount: null, why: "no_pricing", service: label, counts: c, unpriced };
  return { amount: round(total), service: label, counts: used, minimumApplied, unpriced };
}

/**
 * The company's own priced services, keyed by ServiceCategory id. The one
 * database read behind the estimate — scoped to `companyId` in the query.
 *
 * @returns {Promise<Record<string, { categoryId, key, label, book, defaultRate, unit }>>}
 */
export async function loadScopePricing(db, companyId) {
  if (!companyId) return {};
  const rows = await db.companyServiceCategory.findMany({
    where: { companyId, enabled: true },
    select: {
      categoryId: true,
      rates: true,
      defaultRate: true,
      unit: true,
      category: { select: { id: true, key: true, label: true } },
    },
  });
  const out = {};
  for (const r of rows) {
    const key = r.category?.key || null;
    out[r.categoryId] = {
      categoryId: r.categoryId,
      key,
      label: r.category?.label || null,
      book: key && hasPriceBook(key) ? getPriceBook(key, r.rates) : null,
      defaultRate: r.defaultRate === null || r.defaultRate === undefined ? null : Number(r.defaultRate),
      unit: r.unit || null,
    };
  }
  return out;
}
