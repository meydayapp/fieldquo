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
// UNPRICED line until the estimator types a price on the screen; a lift line
// at $0 would read as free work.
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
    if (s.coats) sub.coats = s.coats;
    if (s.productKey && book.products && Object.prototype.hasOwnProperty.call(book.products, s.productKey)) sub.productKey = s.productKey;
    if (s.label && s.label !== slot.area.label) sub.label = s.label;
    slot.area.substrates.push(sub);
    slot.surfaces.push(s);
    // The source travels with the line into the builder — crew-only text,
    // never printed on the client's copy (crewNote, not clientNote).
    slot.area.crewNote = `${AI_DRAFT_NOTE}\n${slot.surfaces
      .map((x) => `• ${x.label}: ${x.quantity.value} ${x.quantity.unit} — ${x.quantity.sourceText}`)
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
          hours: l.hours,
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
      price: typeof a.price === "number" && a.price > 0 ? money(a.price) : null,
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
