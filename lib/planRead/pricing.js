// lib/planRead/pricing.js
//
// The draft quote, priced by the company's OWN painting engine.
//
// The computed project (lib/planRead/projectModel.js) becomes the same
// `area_substrate` paint takeoff the builder's Painting card edits —
// one paint area per project area, one substrate row per surface, the
// quantity typed in from its source — and lib/pricing/paintTakeoff.js prices
// it from the company's book: its rate sets, production rates, hourly sell
// rate and paint costs. That is the whole of "the model never sets a price":
// no number the model produced is a rate or an amount, and the one engine
// that prices every hand-typed painting quote prices this one.
//
// The takeoff is also what "Create quote" hands the builder
// (GET /api/plan-reads/[id]/draft-quote), so the quote the estimator saves is
// priced by the builder from the same config — not copied from this preview.
//
// Access equipment has no rate in any price book today. It is drafted as an
// UNPRICED line (price null) until the estimator types a price on the screen,
// or the chat enters one they gave (priceSource "ai"). A typed 0 is a price —
// equipment the company owns — and counts as priced; it costs nothing and
// goes on no quote line (a lift line at $0 would read as free work).
//
// Pure.

import { paintTakeoff, newPaintArea, newPaintSubstrate } from "@/lib/pricing/paintTakeoff";
import { categoryForSubstrate, estimateTypeForSubstrate } from "./catalogue";

const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const AI_DRAFT_NOTE = "Drafted by FieldQuo AI from the drawings — check the quantities.";

/**
 * Group active surfaces into paint takeoffs and price them.
 *
 * @param computed  computeProject() output
 * @param books     { interior_painting, exterior_painting } — each the
 *                  company's PAINT book (getPriceBook(key, rates).takeoff)
 * @returns {{ groups, lines, access, subtotal, accessTotal, unpricedAccess,
 *             unpricedCount, skipped }}
 */
export function priceProject(computed, books) {
  const empty = { groups: [], lines: [], access: [], subtotal: 0, accessTotal: 0, unpricedAccess: 0, unpricedCount: 0, skipped: [] };
  if (!computed) return empty;
  const commercial = computed.commercial === true;
  const buckets = new Map();
  const skipped = [];

  for (const s of computed.surfaces || []) {
    if (!s.active) continue;
    if (!(s.quantity?.value > 0)) {
      skipped.push({ surfaceId: s.id, label: s.label, reason: "no_quantity" });
      continue;
    }
    const categoryKey = categoryForSubstrate(s.itemKey);
    const book = books?.[categoryKey];
    if (!book) {
      skipped.push({ surfaceId: s.id, label: s.label, reason: "no_book" });
      continue;
    }
    const estimateType = estimateTypeForSubstrate(s.itemKey, book, { commercial });
    const key = `${categoryKey}|${estimateType}`;
    if (!buckets.has(key)) buckets.set(key, { categoryKey, estimateType, book, areas: new Map() });
    const bucket = buckets.get(key);
    const areaKey = s.areaId || `solo:${s.id}`;
    if (!bucket.areas.has(areaKey)) {
      const area = newPaintArea(estimateType === "exterior" ? "exterior" : "den", book, { estimateType });
      area.label = s.areaName || s.label;
      area.measurement = "surface";
      area.crewNote = AI_DRAFT_NOTE;
      bucket.areas.set(areaKey, { area, surfaces: [] });
    }
    const slot = bucket.areas.get(areaKey);
    const sub = newPaintSubstrate(s.itemKey, book, { estimateType });
    if (!sub) {
      skipped.push({ surfaceId: s.id, label: s.label, reason: "not_in_book" });
      continue;
    }
    // Typed quantity: the source's number, never the geometry driver.
    sub.quantity = s.quantity.value;
    // Coats move the paint only — the production rate is per finished
    // surface, whatever the coats (paintTakeoff.js, "the rate is not per
    // coat"), exactly as on a typed quote. Slow or high work is the line's
    // own prep hours, which the chat or the estimator set (set_prep_hours).
    if (s.coats) sub.coats = s.coats;
    if (typeof s.prepHours === "number" && s.prepHours > 0) sub.prepHours = s.prepHours;
    if (s.productKey && book.products && Object.prototype.hasOwnProperty.call(book.products, s.productKey)) sub.productKey = s.productKey;
    if (s.label && s.label !== slot.area.label) sub.label = s.label;
    slot.area.substrates.push(sub);
    slot.surfaces.push(s);
    // The source travels with the line into the builder — crew-only text,
    // never printed on the client's copy (crewNote, not clientNote).
    slot.area.crewNote = `${AI_DRAFT_NOTE}\n${slot.surfaces
      .map((x) => `• ${x.label}: ${x.quantity.value} ${x.quantity.unit} — ${x.quantity.sourceText}${x.prepHours > 0 ? ` · +${x.prepHours} h prep${x.prepNote ? ` (${x.prepNote})` : ""}` : ""}`)
      .join("\n")}`.slice(0, 2000);
  }

  const groups = [];
  const lines = [];
  let subtotal = 0;
  let unpricedCount = 0;
  for (const b of buckets.values()) {
    const config = { model: "area_substrate", estimateType: b.estimateType, areas: [...b.areas.values()].map((x) => x.area), notes: "" };
    const result = paintTakeoff(config, b.book);
    unpricedCount += result.unpricedCount || 0;
    subtotal = money(subtotal + result.total);
    const slots = [...b.areas.values()];
    result.areas.forEach((ra, ai) => {
      const surfaces = slots[ai]?.surfaces || [];
      const priced = ra.lines.filter((l) => l.kind !== "prep");
      priced.forEach((l, li) => {
        const s = surfaces[li];
        lines.push({
          surfaceId: s?.id || null,
          area: ra.label,
          label: l.label,
          quantity: l.quantity,
          unit: l.unit,
          coats: l.coats ?? null,
          hours: l.hours,
          prepHours: l.prepHours || 0,
          prepNote: s?.prepNote || null,
          prepSource: s?.prepSource || null,
          labour: l.labour,
          material: l.material,
          amount: l.amount,
          estimated: Boolean(s?.quantity?.estimated),
          source: s?.quantity?.source || null,
          sourceText: s?.quantity?.sourceText || null,
        });
      });
    });
    groups.push({
      categoryKey: b.categoryKey,
      estimateType: b.estimateType,
      takeoff: config,
      total: result.total,
      hours: result.hours,
      labour: result.labour,
      material: result.material,
    });
  }

  const access = (computed.access || [])
    .filter((a) => a.included !== false)
    .map((a) => ({
      id: a.id,
      label: a.label,
      areaName: a.areaName,
      heightFt: a.heightFt,
      // 0 is a price — owned equipment — not "unpriced"; null is no price.
      price: typeof a.price === "number" && Number.isFinite(a.price) && a.price >= 0 ? money(a.price) : null,
      // "ai" when the chat entered it from the estimator's own figure — the
      // screen and the quote's review notes say so.
      priceSource: a.price === null || a.price === undefined ? null : a.priceSource || "person",
    }));
  const accessTotal = money(access.reduce((n, a) => n + (a.price || 0), 0));

  return {
    groups,
    lines,
    access,
    subtotal: money(subtotal + accessTotal),
    paintTotal: subtotal,
    accessTotal,
    unpricedAccess: access.filter((a) => a.price === null).length,
    unpricedCount,
    skipped,
  };
}

/** Total measured area across active square-foot surfaces — the
 *  denominator for "$ per sq ft" against the company's past jobs. */
export function paintedSqft(computed) {
  return Math.round(
    (computed?.surfaces || [])
      .filter((s) => s.active && s.quantity?.unit === "sqft")
      .reduce((n, s) => n + (s.quantity.value || 0), 0),
  );
}
