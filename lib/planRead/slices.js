// lib/planRead/slices.js
//
// One drawing set → several quotes. The owner's live test (2026-10-05): the
// church set held the interior AND the exterior, and getting the second quote
// meant reading the set again — which replaced the first result. Now a read
// whose scope covers more than one service is cut into SCOPED DRAFTS in code:
// exterior painting, interior painting, and each other trade, every one with
// its own areas, access, crew plan, price and "Create quote". No model call,
// no re-read: the same read, filtered.
//
// What goes in which slice:
//   painting   by the side of each surface — its area's side, else its item's
//              category (siding is outside, walls inside); access by its
//              area's side, and access with no area to the outside (lifts and
//              towers are an outside matter far more often than not — and the
//              estimator can move it by giving it an area in the chat).
//   trades     each trade beyond painting on its own.
//
// Pure.

import { tradesFromScope, scopeHasPainting, TRADE_LABELS } from "./tradeCatalogue";
import { surfaceSide } from "./firstPass";
import { priceProject, paintedSqft } from "./pricing";
import { readPricing } from "./readPricing";
import { compareToPast } from "./similar";

export const PAINT_SIDES = Object.freeze({ interior_painting: "interior", exterior_painting: "exterior" });
const SIDE_LABEL = { interior: "Interior painting", exterior: "Exterior painting" };

/**
 * The read's scoped drafts. Pure.
 * @returns {{ key, kind: "painting"|"trade", label, side?, categoryKey?, tradeKey? }[]}
 */
export function readSlices(read, computed) {
  const out = [];
  const scope = tradesFromScope(read?.scope);
  const areaSide = new Map((computed?.areas || []).map((a) => [a.id, a.side]));
  const live = (computed?.surfaces || []).filter((s) => s.active);
  const sidesPresent = new Set(live.map((s) => surfaceSide(s, areaSide.get(s.areaId))));
  if (computed && computed.painting !== false && scopeHasPainting(read?.scope)) {
    const painting = scope.trades.find((t) => t.tradeKey === "painting");
    const stated = painting ? painting.categories.filter((k) => Object.hasOwn(PAINT_SIDES, k)) : [];
    const keys = stated.length ? stated : ["exterior_painting", "interior_painting"].filter((k) => sidesPresent.has(PAINT_SIDES[k]));
    for (const k of ["exterior_painting", "interior_painting"]) {
      if (!keys.includes(k)) continue;
      out.push({ key: k, kind: "painting", side: PAINT_SIDES[k], categoryKey: k, label: (read?.scope?.categories || []).find((c) => c.key === k)?.label || SIDE_LABEL[PAINT_SIDES[k]] });
    }
  }
  for (const t of computed?.trades || []) {
    if (t.included === false) continue;
    out.push({ key: `trade:${t.tradeKey}`, kind: "trade", tradeKey: t.tradeKey, label: TRADE_LABELS[t.tradeKey] || t.tradeKey });
  }
  return out;
}

/** The computed project, cut to one slice. Pure. */
export function sliceComputed(computed, slice) {
  if (!computed || !slice) return null;
  if (slice.kind === "trade") {
    return { ...computed, surfaces: [], access: [], areas: [], trades: (computed.trades || []).filter((t) => t.tradeKey === slice.tradeKey) };
  }
  const areaSide = new Map((computed.areas || []).map((a) => [a.id, a.side]));
  const side = slice.side;
  const surfaces = (computed.surfaces || []).filter((s) => surfaceSide(s, areaSide.get(s.areaId)) === side);
  const access = (computed.access || []).filter((a) => (a.areaId ? areaSide.get(a.areaId) === side : side === "exterior"));
  const areaIds = new Set([...surfaces.map((s) => s.areaId), ...access.map((a) => a.areaId)].filter(Boolean));
  return {
    ...computed,
    areas: (computed.areas || []).filter((a) => areaIds.has(a.id) || a.side === side),
    surfaces,
    access,
    trades: [],
    unmeasured: (computed.unmeasured || []).filter((u) => surfaces.some((s) => s.id === u.id)),
  };
}

/** What a priced slice is made of, for the past-job comparison. Pure. */
export function sliceMetrics(computed, priced, slice) {
  const sqft = paintedSqft(computed);
  const sqftSurfaces = (computed?.surfaces || []).filter((s) => s.active && s.quantity?.unit === "sqft" && s.quantity.value > 0);
  const high = sqftSurfaces.reduce((n, s) => n + s.quantity.value * (Array.isArray(s.bands) ? 1 - (s.bands[0] || 0) : 0), 0);
  const est = sqftSurfaces.filter((s) => s.quantity.estimated).reduce((n, s) => n + s.quantity.value, 0);
  const hours = (priced?.lines || []).reduce((n, l) => n + (Number(l.hours) || 0), 0);
  const prep = (priced?.lines || []).reduce((n, l) => n + (Number(l.prepHours) || 0), 0);
  const subtotal = Number(priced?.subtotal) || 0;
  return {
    categoryKey: slice?.categoryKey || null,
    sqft,
    perSqft: sqft > 0 && subtotal > 0 ? Math.round((subtotal / sqft) * 100) / 100 : null,
    hoursPerSqft: sqft > 0 && hours > 0 ? Math.round((hours / sqft) * 10000) / 10000 : null,
    highShare: sqft > 0 ? high / sqft : 0,
    estimatedShare: sqft > 0 ? est / sqft : 0,
    prepShare: hours > 0 ? prep / hours : 0,
    accessShare: subtotal > 0 ? (Number(priced?.accessTotal) || 0) / subtotal : 0,
    unpricedAccess: Number(priced?.unpricedAccess) || 0,
    commercial: computed?.commercial === true,
  };
}

/**
 * Every slice, priced: its own paint takeoff and access (priceProject with
 * the first pass), its recommendation at the target margin (readPricing, when
 * the company's pricing context is there — a member who may see prices), and
 * where it sits against the company's own past jobs of the same trade. Pure.
 */
export function priceSlices({ read, computed, books, firstPass, pctx = null, similar = null }) {
  return readSlices(read, computed).map((slice) => {
    const part = sliceComputed(computed, slice);
    const priced = slice.kind === "painting" ? priceProject(part, books, { firstPass }) : null;
    let pricing = null;
    if (pctx) {
      try {
        pricing = readPricing({ computed: part, pricedPaint: priced, model: read.model, ctx: pctx });
      } catch (err) {
        console.error("[planRead] slice pricing:", err?.message);
      }
    }
    const metrics = priced ? sliceMetrics(part, priced, slice) : null;
    const past = slice.categoryKey ? similar?.byCategory?.[slice.categoryKey] || null : null;
    const pastSqft = past?.jobs?.length ? past.jobs.reduce((n, j) => n + (j.sqft || 0), 0) / past.jobs.length : null;
    return {
      ...slice,
      computed: part,
      priced,
      pricing,
      metrics,
      compare: metrics && pctx ? compareToPast(past, { ...metrics, pastSqft }) : null,
    };
  });
}
