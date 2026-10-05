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
// ══ The first pass (opts.firstPass — lib/planRead/firstPass.js) ════════════
//
// With the first pass's context, three things are added, all still priced by
// the same engine from the company's own rates:
//
//   height   a surface with area above the height its rates were measured at
//            carries one factor on its hours — the band-weighted factor of its
//            share in each working-height band (lib/pricing/paintHeightPrep.js,
//            the builder's own rule) — written inline on the row as the
//            company's rate ÷ the factor (the builder shows "custom rate on
//            this line only");
//   prep     the substrate/colour allowance — or a person's own prep hours,
//            which replace it — on the row's Prep hours, never in the rate;
//   setup    on an occupied or heritage building, an area of its own holding
//            the daily setup and clean-up hours.
//
// Access is priced: a person's price, else the company's rental rates, else
// the cited reference (firstPass.js priceAccessLine) — for the days the work
// it serves takes at the read's crew. A typed 0 is a price (owned equipment)
// and goes on no quote line. Without the first-pass context (older callers,
// the md5-pinned checks), everything prices exactly as it did.
//
// Pure.

import { paintTakeoff, newPaintArea, newPaintSubstrate } from "@/lib/pricing/paintTakeoff";
import { categoryForSubstrate, estimateTypeForSubstrate, EQUIPMENT_LABELS } from "./catalogue";
import { HEIGHT_BANDS, CREW_DEFAULTS } from "./referenceTables";
import { surfacePrep, surfaceSide, surfaceCondition, heightRow, daysFor, priceAccessLine, deliveryLine } from "./firstPass";
import { SUNDRIES_PCT_PRESET, LADDER_KINDS } from "@/lib/pricing/paintHeightPrep";

// Access that only high walls need; under LOW_WALL_FT inside, ladders and one
// tower reach (the coordinator, after the church's run 2).
const HIGH_ACCESS = new Set(["scissor_lift", "boom_lift", "swing_stage", "scaffold"]);
const LOW_WALL_FT = 13;

const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const AI_DRAFT_NOTE = "Drafted by FieldQuo AI from the drawings — check the quantities.";
export const SETUP_AREA_LABEL = "Daily setup, protection and clean-up";

/**
 * Group active surfaces into paint takeoffs and price them.
 *
 * @param computed  computeProject() output
 * @param books     { interior_painting, exterior_painting } — each the
 *                  company's PAINT book (getPriceBook(key, rates).takeoff)
 * @param opts.firstPass  { figures, crew (crewSettings), assumed, currency,
 *                  fx } — the first pass's height, prep, setup and access
 * @returns {{ groups, lines, access, subtotal, accessTotal, unpricedAccess,
 *             unpricedCount, skipped, plan? }}
 */
export function priceProject(computed, books, opts = {}) {
  const fp = opts.firstPass || null;
  const empty = { groups: [], lines: [], access: [], subtotal: 0, accessTotal: 0, unpricedAccess: 0, unpricedCount: 0, skipped: [] };
  if (!computed) return empty;
  const commercial = computed.commercial === true;
  const buckets = new Map();
  const skipped = [];
  const areaSide = new Map((computed.areas || []).map((a) => [a.id, a.side]));

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
      bucket.areas.set(areaKey, { area, entries: [], areaId: s.areaId || null });
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
    // own prep hours, or (first pass) its height band.
    if (s.coats) sub.coats = s.coats;
    let prep = null;
    if (fp) {
      const side = surfaceSide(s, areaSide.get(s.areaId));
      prep = surfacePrep(s, { side, assumed: fp.assumed || {}, figures: fp.figures });
      if (prep.hours > 0) sub.prepHours = prep.hours;
      // The condition the read priced on goes on the row itself, so the
      // engine counts its prep materials (primer, filler, tape…) — and the
      // builder, and the job's sourcing list, count the same.
      const cond = surfaceCondition(s, side, fp.assumed || {});
      if (cond) sub.prepCondition = cond;
    } else if (typeof s.prepHours === "number" && s.prepHours > 0) sub.prepHours = s.prepHours;
    if (s.productKey && book.products && Object.prototype.hasOwnProperty.call(book.products, s.productKey)) sub.productKey = s.productKey;
    if (s.label && s.label !== slot.area.label) sub.label = s.label;
    // The working height: one factor on the row's hours, inline (firstPass.js heightRow).
    const hr = fp && Array.isArray(s.bands) ? heightRow(sub, { shares: s.bands, itemKey: s.itemKey, book, estimateType, unit: s.quantity.unit }) : { row: sub, height: null };
    slot.area.substrates.push(hr.row);
    slot.entries.push({ s, height: hr.height, prep, first: true });
    // The source travels with the line into the builder — crew-only text,
    // never printed on the client's copy (crewNote, not clientNote).
    const seen = new Set();
    slot.area.crewNote = `${AI_DRAFT_NOTE}\n${slot.entries
      .filter((e) => e.first && !seen.has(e.s.id) && seen.add(e.s.id))
      .map((e) => {
        const x = e.s;
        const prepText = e.prep ? (e.prep.hours > 0 ? ` · +${e.prep.hours} h prep (${e.prep.why})` : "") : x.prepHours > 0 ? ` · +${x.prepHours} h prep${x.prepNote ? ` (${x.prepNote})` : ""}` : "";
        const bandText = x.heightBasis && fp ? ` · height: ${x.heightBasis}` : "";
        return `• ${x.label}: ${x.quantity.value} ${x.quantity.unit} — ${x.quantity.sourceText}${prepText}${bandText}`;
      })
      .join("\n")}`.slice(0, 2000);
  }

  const run = () => {
    const groups = [];
    const lines = [];
    const hoursByArea = new Map();
    const paintBuy = [];
    const prepBuy = new Map();
    let subtotal = 0;
    let unpricedCount = 0;
    let hours = 0;
    for (const b of buckets.values()) {
      const config = { model: "area_substrate", estimateType: b.estimateType, areas: [...b.areas.values()].map((x) => x.area), notes: "" };
      const result = paintTakeoff(config, b.book);
      for (const p of result.purchase || []) paintBuy.push(p);
      for (const p of result.prepPurchase || []) {
        const cur = prepBuy.get(p.key);
        if (cur) cur.fractionalQty += p.fractionalQty;
        else prepBuy.set(p.key, { ...p });
      }
      unpricedCount += result.unpricedCount || 0;
      subtotal = money(subtotal + result.total);
      hours += Number(result.hours) || 0;
      const slots = [...b.areas.values()];
      result.areas.forEach((ra, ai) => {
        const slot = slots[ai];
        hoursByArea.set(slot?.areaId || "*", (hoursByArea.get(slot?.areaId || "*") || 0) + (Number(ra.hours) || 0));
        for (const l of ra.lines) {
          if (l.kind === "prep") {
            if (slot?.setup) lines.push({ surfaceId: null, setup: true, area: ra.label, label: ra.label, quantity: l.quantity, unit: "hour", hours: l.hours, prepHours: l.hours, labour: l.labour, material: null, amount: l.amount, why: slot.setupWhy });
            continue;
          }
          const e = slot?.entries?.[l.rowIndex] || null;
          const s = e?.s;
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
            ...(fp
              ? {
                  height: e?.height || null,
                  workHours: l.workHours,
                  rateText: l.rateLabel || null,
                  confidence: s?.quantity?.confidence || (s?.quantity?.estimated ? "low" : "high"),
                  heightBasis: s?.heightBasis || null,
                  prep: e?.prep || null,
                }
              : {}),
          });
        }
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
    return { groups, lines, subtotal, unpricedCount, hours, hoursByArea, paintBuy, prepBuy };
  };

  let priced = run();
  let plan = null;
  let accessPriced;
  if (fp) {
    const crew = fp.crew || { size: CREW_DEFAULTS.crewSize, hoursPerDay: CREW_DEFAULTS.hoursPerDay, setupPerDay: 0 };
    const workHours = priced.hours;
    const d = daysFor(workHours, crew.size, crew.hoursPerDay, crew.setupPerDay);
    // The daily setup is time on site the crew is not painting: its own area
    // of prep hours, on the first takeoff, re-priced by the same engine.
    if (d.setupHours > 0 && buckets.size) {
      const first = buckets.values().next().value;
      const area = newPaintArea(first.estimateType === "exterior" ? "exterior" : "den", first.book, { estimateType: first.estimateType });
      area.label = SETUP_AREA_LABEL;
      area.measurement = "surface";
      area.prepHours = d.setupHours;
      area.crewNote = `${AI_DRAFT_NOTE}\n${crew.setupWhy || ""} — ${d.days} days × ${crew.size} painters`.slice(0, 2000);
      first.areas.set("__setup", { area, entries: [], areaId: null, setup: true, setupWhy: `${crew.setupWhy} — ${d.days} days × ${crew.size} painters × ${crew.setupPerDay} h` });
      priced = run();
    }
    const priceAll = (size) => {
      const out = [];
      let towerKept = false;
      for (const a of (computed.access || []).filter((x) => x.included !== false)) {
        const areaWork = a.areaId ? priced.hoursByArea.get(a.areaId) || 0 : workHours;
        const days = daysFor(areaWork || workHours, size, crew.hoursPerDay, crew.setupPerDay).wholeDays || 1;
        const served = (computed.surfaces || []).filter((s) => s.active && (!a.areaId || s.areaId === a.areaId));
        const maxTop = Math.max(0, ...served.map((s) => Number(s.topFt) || 0));
        // The face a frame scaffold would cover — only used at the company's
        // own per-100-sq-ft rate (no cited figure exists).
        const faceSqft = served.filter((s) => s.quantity?.unit === "sqft").reduce((n, s) => n + (Number(s.quantity.value) || 0), 0);
        // Access follows the INSIDE wall height. When every wall it serves
        // has a known inside height (a section's or a photo's — not the
        // outside eaves' lower bound) and they top out under 13 ft, lifts and
        // extra towers are not needed: ladders and ONE rolling tower reach
        // them, and the line says so. A typed or confirmed line is the
        // estimator's and stands.
        const typedLine = typeof a.price === "number" || a.confirmed;
        const known = served.length > 0 && served.every((s) => ["section", "photo"].includes(s.wallSource));
        const lowerBound = served.some((s) => s.wallCap?.lowerBound);
        if (!typedLine && HIGH_ACCESS.has(a.equipment) && known && maxTop > 0 && maxTop < LOW_WALL_FT) {
          if (!towerKept) {
            towerKept = true;
            const tower = priceAccessLine({ ...a, equipment: "scaffold", heightFt: maxTop }, { days, currency: fp.currency, fx: fp.fx, figures: fp.figures, maxHeightFt: maxTop, faceSqft });
            out.push({ ...tower, areaName: a.areaName || null, reason: a.reason || null, auto: Boolean(a.auto), resized: a.equipment, why: `One rolling tower for the walls: they top out at ${Math.round(maxTop * 10) / 10} ft inside${a.equipment !== "scaffold" ? ` — instead of the ${String(EQUIPMENT_LABELS[a.equipment] || a.equipment).toLowerCase()} listed` : ""}. ${tower.why}` });
          } else {
            out.push({ id: a.id, label: EQUIPMENT_LABELS[a.equipment] || a.equipment, equipment: a.equipment, areaName: a.areaName || null, heightFt: maxTop, days, price: 0, priceSource: "not_needed", confirmed: false, reason: a.reason || null, auto: Boolean(a.auto), zeroReason: a.zeroReason || null, why: `Not needed: the inside walls top out at ${Math.round(maxTop * 10) / 10} ft (${served.some((s) => s.wallSource === "photo") ? "estimated from the photos" : "from the section"}) — ladders and the one tower reach them. Put it back if the job needs it.` });
          }
          continue;
        }
        // A lower-bound wall height (the outside eaves) would size the access
        // to the walls' LEAST height: it is sized instead to the height the
        // drawings show above them (what the read cited), and kept — said.
        const cited = lowerBound ? Math.max(0, ...served.map((s) => (s.wallCap?.lowerBound ? Number(s.wallCap.fromFt) || 0 : 0))) : 0;
        const accessTop = !typedLine && HIGH_ACCESS.has(a.equipment) && cited > maxTop ? cited : maxTop;
        const line = priceAccessLine(a, { days, currency: fp.currency, fx: fp.fx, figures: fp.figures, maxHeightFt: accessTop || null, faceSqft });
        if (!typedLine && HIGH_ACCESS.has(a.equipment) && lowerBound && line.why) line.why = `${line.why} — kept${accessTop > maxTop ? `, sized to the ${Math.round(accessTop * 10) / 10} ft the drawings show above the walls,` : ""} because the inside wall height is only a lower bound (the outside eaves, ${Math.round(maxTop * 10) / 10} ft); measure it, and drop or resize this if the walls are low`;
        out.push({ ...line, areaName: a.areaName || null, reason: a.reason || null, auto: Boolean(a.auto) });
      }
      // One set of ladders per job, not one per room: the first ladder line
      // of a kind stands for the job (its days the longest, its height the
      // tallest); the others fold into it and are named on it.
      const merged = [];
      const firstOf = new Map();
      for (const l of out) {
        if (!LADDER_KINDS.has(l.equipment) || l.priceSource === "person" || l.priceSource === "ai") {
          merged.push(l);
          continue;
        }
        const head = firstOf.get(l.equipment);
        if (!head) {
          const copy = { ...l, covers: [l.areaName].filter(Boolean) };
          firstOf.set(l.equipment, copy);
          merged.push(copy);
          continue;
        }
        if (l.areaName && !head.covers.includes(l.areaName)) head.covers.push(l.areaName);
        head.mergedIds = [...(head.mergedIds || []), l.id];
        if ((l.days || 0) > (head.days || 0) || (l.heightFt || 0) > (head.heightFt || 0)) {
          const days = Math.max(head.days || 1, l.days || 1);
          const heightFt = Math.max(head.heightFt || 0, l.heightFt || 0) || null;
          Object.assign(head, priceAccessLine({ id: head.id, equipment: head.equipment, heightFt, areaName: head.areaName, zeroReason: head.zeroReason }, { days, currency: fp.currency, fx: fp.fx, figures: fp.figures }), { covers: head.covers, mergedIds: head.mergedIds, areaName: head.areaName, reason: head.reason, auto: head.auto });
        }
      }
      for (const h of firstOf.values()) if (h.covers.length > 1) h.why = `${h.why} — one set for the job, covering ${h.covers.length} areas`;
      return merged;
    };
    accessPriced = priceAll(crew.size);
    const delivery = deliveryLine(accessPriced, fp.figures);
    if (delivery?.price > 0) accessPriced.push({ id: "delivery", label: "Delivery and pickup", equipment: "delivery", price: delivery.price, priceSource: "company", confirmed: false, why: delivery.why });
    const sizes = [...new Set([...CREW_DEFAULTS.options])];
    plan = {
      crew,
      workHours: money(workHours),
      setupHours: d.setupHours,
      hours: money(priced.hours),
      days: d.days,
      wholeDays: d.wholeDays,
      productivePerDay: d.productive,
      deliveryNote: delivery && delivery.price === null ? delivery.why : null,
      bands: HEIGHT_BANDS.map((b, i) => ({ key: b.key, label: b.label, factor: fp.figures?.bands?.[i]?.factor ?? b.factor })),
      bandsSource: fp.figures?.bandsSource || null,
      options: sizes.map((n) => {
        const dn = daysFor(workHours, n, crew.hoursPerDay, crew.setupPerDay);
        const eq = priceAll(n).reduce((t, x) => t + (Number(x.price) || 0), 0) + (delivery?.price || 0);
        return { crew: n, days: dn.days, wholeDays: dn.wholeDays, hours: money(workHours + dn.setupHours), equipmentCost: money(eq), current: n === crew.size };
      }),
    };
  } else {
    accessPriced = (computed.access || [])
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
  }
  const accessTotal = money(accessPriced.reduce((n, a) => n + (a.price || 0), 0));

  return {
    groups: priced.groups,
    lines: priced.lines,
    access: accessPriced,
    subtotal: money(priced.subtotal + accessTotal),
    paintTotal: priced.subtotal,
    accessTotal,
    unpricedAccess: accessPriced.filter((a) => a.price === null).length,
    unpricedCount: priced.unpricedCount,
    skipped,
    ...(plan ? { plan } : {}),
    ...(fp ? { materials: materialList(priced, fp) } : {}),
  };
}

/**
 * The read's material list (the first pass): the paint to buy, the chosen
 * conditions' prep materials, and a sundries line — item, quantity, unit,
 * unit price and where it came from, total. A quantity the estimator changed
 * on the read (model.materialQty) replaces the computed one and is said.
 * Quantities are purchasable units (ceiled once across the job). Pure.
 */
export function materialList(priced, fp) {
  const own = fp?.materialQty && typeof fp.materialQty === "object" ? fp.materialQty : {};
  const items = [];
  const byKey = new Map();
  for (const p of priced.paintBuy || []) {
    const cur = byKey.get(p.productKey) || { key: `paint:${p.productKey}`, label: p.label, unit: "gal", qty: 0, unitPrice: p.costPerGal, priceSource: p.costPerGal === null ? "none" : "book", basis: [] };
    cur.qty += p.gallons;
    cur.basis.push(`${p.coatingSqft} sq ft of coating ÷ ${p.coverageSqftPerGal} sq ft/gal`);
    byKey.set(p.productKey, cur);
  }
  for (const v of byKey.values()) items.push({ ...v, basis: v.basis.join(" + ") });
  for (const p of (priced.prepBuy || new Map()).values()) {
    items.push({ key: `prep:${p.key}`, label: p.label, unit: p.unit, qty: Math.ceil(p.fractionalQty - 1e-9), unitPrice: p.unitPrice, priceSource: p.priceSource, priceLabel: p.priceLabel, basis: "the chosen condition's allowance (Settings → Services → Access, height and prep)" });
  }
  const out = items.map((i) => {
    const typed = Number(own[i.key]);
    const qty = Number.isFinite(typed) && typed >= 0 ? typed : i.qty;
    const total = i.unitPrice === null || i.unitPrice === undefined ? null : money(qty * i.unitPrice);
    return { ...i, computedQty: i.qty, qty, edited: qty !== i.qty, total };
  });
  const paintCost = out.filter((i) => i.key.startsWith("paint:")).reduce((n, i) => n + (i.total || 0), 0);
  const pct = Number.isFinite(Number(fp?.figures?.book?.sundriesPct)) ? Number(fp.figures.book.sundriesPct) : SUNDRIES_PCT_PRESET;
  const sundries = paintCost > 0 && pct > 0 ? { key: "sundries", label: "Sundries — rollers, covers, brushes, trays", unit: "lot", qty: 1, unitPrice: money((paintCost * pct) / 100), total: money((paintCost * pct) / 100), priceSource: pct === SUNDRIES_PCT_PRESET ? "default" : "yours", basis: `${pct}% of the paint (${pct === SUNDRIES_PCT_PRESET ? "FieldQuo default — set yours in Settings → Services" : "your figure"})` } : null;
  const all = sundries ? [...out, sundries] : out;
  // What the estimator's own quantities move the cost by, against the
  // computed list the cost panel prices — readPricing adds it.
  const delta = money(out.reduce((n, i) => n + (i.edited && i.unitPrice ? (i.qty - i.computedQty) * i.unitPrice : 0), 0));
  return { items: all, total: money(all.reduce((n, i) => n + (i.total || 0), 0)), sundries: sundries?.total || 0, editDelta: delta, unpriced: all.filter((i) => i.total === null).length };
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
