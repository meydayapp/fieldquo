// lib/quotes/estimateKindRouting.js
//
// Which calculator a painting estimate kind opens — the "What kind of
// estimate is this?" cards (EstimateTypeFirst.js, and the same cards inside
// the painting takeoff, PaintAreas.js).
//
// ── Why this exists (owner, 2026-10-03) ─────────────────────────────────────
//
// TrueFinish added Interior Painting, pressed "Cabinets & millwork" on the
// cards INSIDE the takeoff, and got a room: Width × Length × Height, then
// tick cabinet doors. The card on the first screen already opened the
// cabinet trade (QuoteBuilder addPaintingEstimate, 2026-09-22) — the card in
// the takeoff only ever re-filtered the room's substrates. Same for
// Staining: kitchen cabinets and stairs are priced by the cabinet and stair
// calculators the company already sells, not by a room's geometry.
//
// So both sets of cards ask THIS module, and the answer is one of:
//
//   a route  { calculator: "cabinet" | "stairs", category, stain }
//            open that trade's own group — its doors / drawers / boxes, its
//            Refinish | Reface switch, its staircases — exactly as the trade's
//            own tile or "Add service" opens it (addScopeGroup).
//   null     the painting takeoff, as it always was. Interior, exterior and
//            commercial; and cabinets or staining for a painter who does not
//            sell the cabinet or stair trade, whose book carries the cabinet
//            and staining substrates for exactly that case.
//
// Only what the company sells: a route exists only when the company's
// enabled categories (the builder's `categories`) include the trade.
//
// Nothing stored changes. A route decides which group a FRESH pick creates;
// every saved takeoff renders and prices from what it stored.
//
// Later the same day (owner): the cabinets that stay in the painting takeoff
// are COUNTED, not a room (usesCountCalculator); Siding & trim and Trim
// boards never share an area (EXCLUSIVE_SUBSTRATES); and Staining → Cabinets
// opens with the refinishing book's stain finish ticked (routedAddOns).

import { UNIT_PRICED_CATEGORIES } from "@/app/data/cabinetPricing";
import { isGeometryOverride, PAINT_GEOMETRY_OVERRIDES } from "@/lib/pricing/paintTakeoff";

const list = (categories) => (Array.isArray(categories) ? categories : []);
const findCat = (categories, key) => list(categories).find((c) => c && c.key === key) || null;

/** The cabinet trade a pick opens: refinishing first, the higher-volume trade (owner, 2026-09-22). */
export function cabinetCategoryOf(categories) {
  return UNIT_PRICED_CATEGORIES.map((key) => findCat(categories, key)).find(Boolean) || null;
}

/** The stair trade, when the company sells it. */
export function stairsCategoryOf(categories) {
  return findCat(categories, "stairs");
}

/**
 * What "Staining" can open, in order. `surfaces` — decks, fences, a front
 * door: the painting book's staining substrates — is always offered; cabinets
 * and stairs only when the company sells that trade. A list of one means
 * there is nothing to ask, and the card behaves as it always did.
 */
export function stainingChoices(categories) {
  const out = [];
  if (cabinetCategoryOf(categories)) out.push("cabinets");
  if (stairsCategoryOf(categories)) out.push("stairs");
  out.push("surfaces");
  return out;
}

/**
 * The trade calculator a kind (and, for staining, the choice under it) opens,
 * or null for the painting takeoff. See the header.
 */
export function routeEstimateKind(kind, categories, choice = null) {
  if (kind === "cabinets" || (kind === "staining" && choice === "cabinets")) {
    const category = cabinetCategoryOf(categories);
    return category ? { calculator: "cabinet", category, stain: kind === "staining" } : null;
  }
  if (kind === "staining" && choice === "stairs") {
    const category = stairsCategoryOf(categories);
    return category ? { calculator: "stairs", category, stain: true } : null;
  }
  return null;
}

/**
 * The add-ons a routed pick opens ticked. Staining → Cabinets is the cabinet
 * refinishing calculator with its stain finish on — every piece priced at the
 * all-in stained rate (the painting rate plus app/data/tradePriceBooks.js
 * addOns.stainFinishPerUnit, lib/pricing/stainFinish.js) — so a stain job is
 * not quietly priced as a paint job. newScopeGroup ticks only an add-on this company's book prices,
 * so a company that zeroed it, or the refacing trade (which has none), opens
 * with nothing ticked. Every other route ticks nothing.
 */
export function routedAddOns(route) {
  return route && route.stain === true && route.calculator === "cabinet" ? ["stainFinish"] : [];
}

/**
 * A routed group as it opens. Staining → Stairs opens its staircases on a
 * liquid (penetrating) stain — the stain a stair refinish already sands the
 * treads for (lib/pricing/stainFinish.js) — so the estimator sees the choice
 * made and can switch it to gel. Every other route, and a null one, comes
 * back untouched.
 */
export function routedGroup(route, group) {
  if (!route || route.stain !== true || route.calculator !== "stairs" || !group) return group;
  const sections = group?.takeoff?.sections;
  if (!Array.isArray(sections)) return group;
  return {
    ...group,
    takeoff: { ...group.takeoff, sections: sections.map((s) => ({ ...s, stainType: "liquid" })) },
  };
}

/**
 * Does this area take the exterior SURFACE calculator — siding sqft, trim
 * linear feet, counted doors, window frames and shutters — rather than a
 * room's W × L × H? Exterior work, and a commercial area set to exterior
 * (commercial is the same two calculators under its own rate set).
 *
 * Only while nothing room-shaped is stored on it. The surface form writes
 * `measurement: "surface"` — the style the recovered exterior job was
 * measured in (scripts/check-takeoff-render.jsx) — and an area saved with
 * dimensions, a wall run or a typed-over figure keeps the form it was
 * written in, because showing different boxes over the same stored numbers
 * would hide what the price is reading.
 */
export function usesSurfaceCalculator(estimateType, area) {
  if (!area || typeof area !== "object") return false;
  const exterior =
    estimateType === "exterior" || (estimateType === "commercial" && area.surface === "exterior");
  if (!exterior) return false;
  if (area.measurement === "surface") return true;
  return !roomShaped(area);
}

/** Has a room's geometry been stored on this area — dimensions, a wall run, or a typed-over figure? */
function roomShaped(area) {
  const n = (v) => Number(v) > 0;
  const measured =
    area.measurement === "wall"
      ? n(area.linearFt) || n(area.heightFt)
      : n(area.lengthFt) || n(area.widthFt) || n(area.heightFt);
  const overridden = Object.values(PAINT_GEOMETRY_OVERRIDES).some((k) => isGeometryOverride(area[k]));
  return measured || overridden;
}

/**
 * Does this area take the COUNT calculator — doors, drawer fronts, linear
 * feet of cabinet box, square feet of built-ins — rather than a room's
 * W × L × H? (Owner, 2026-10-03: for a painter who does not sell the cabinet
 * trade, "Cabinets & millwork" must not be a room.)
 *
 * Every substrate a Cabinets & millwork estimate offers (`cab_door`,
 * `cab_drawer`, `cab_box`, `cab_builtin`) is counted — none has a geometry
 * driver — so a room's dimensions on a cabinets area priced nothing and only
 * asked questions that do not apply. A company that DOES sell the cabinet
 * trade never gets here for a fresh pick: routeEstimateKind sends it to the
 * cabinet calculator itself.
 *
 * Only while nothing room-shaped is stored, for the reason on
 * usesSurfaceCalculator: an area saved with dimensions or a typed-over figure
 * keeps the form it was written in.
 */
export function usesCountCalculator(estimateType, area) {
  if (!area || typeof area !== "object") return false;
  if (estimateType !== "cabinets") return false;
  if (area.surface && area.surface !== "cabinets") return false;
  if (area.measurement === "surface" || area.measurement === "wall") return false;
  return !roomShaped(area);
}

/* ── Trim is counted once ──────────────────────────────────────────────── */
//
// "Siding & trim" (siding_trim, the owner's recovered exterior rate) is the
// siding WITH its trim — 100 sqft an hour over the whole wall, corner boards
// and window casings included. "Trim boards" (ext_trim) is trim on its own,
// by the linear foot. On one area the two would bill the same boards twice,
// so they exclude each other (owner, 2026-10-03): ticking one disables the
// other there, and an area that is trim only — a porch, a garage with no
// siding work — takes Trim boards.

/** Pairs of substrates that price the same work and never share an area. */
export const EXCLUSIVE_SUBSTRATES = Object.freeze([Object.freeze(["siding_trim", "ext_trim"])]);

const substrateKeys = (area) =>
  new Set(
    (Array.isArray(area?.substrates) ? area.substrates : [])
      .map((s) => (s && typeof s === "object" ? s.key : null))
      .filter((k) => typeof k === "string"),
  );

/** The substrate already on `area` that rules `key` out, or null. */
export function excludedBy(area, key) {
  const have = substrateKeys(area);
  for (const pair of EXCLUSIVE_SUBSTRATES) {
    if (!pair.includes(key)) continue;
    const other = pair.find((k) => k !== key);
    if (have.has(other)) return other;
  }
  return null;
}

/**
 * An area stored with both of a pair — possible only for one written before
 * the rule. Its price is KEPT (the rows are what was quoted); the builder
 * says so above the table rather than silently dropping a row.
 */
export function trimCountedTwice(area) {
  const have = substrateKeys(area);
  return EXCLUSIVE_SUBSTRATES.some((pair) => pair.every((k) => have.has(k)));
}

const blankArea = (a) =>
  a &&
  typeof a === "object" &&
  !(Array.isArray(a.substrates) && a.substrates.length) &&
  !(Array.isArray(a.options) && a.options.length) &&
  !(Array.isArray(a.media) && a.media.length) &&
  !["lengthFt", "widthFt", "heightFt", "linearFt", "surfaceSqft"].some((k) => Number(a[k]) > 0) &&
  !a.clientNote &&
  !a.crewNote;

/**
 * A painting group nothing has been put in yet: no line, and no area with
 * anything in it (exterior_painting opens with one blank area). Only such a
 * group is REPLACED by a routed pick; one with work in it is left alone and
 * the routed group goes in after it.
 */
export function isUntouchedPaintGroup(group) {
  const t = group?.takeoff;
  if (!group || group.persisted || !t || typeof t !== "object" || t.model !== "area_substrate") return false;
  if (Array.isArray(group.lineItems) && group.lineItems.length) return false;
  return (Array.isArray(t.areas) ? t.areas : []).every(blankArea);
}

/**
 * The builder's group list after a routed pick from inside group `fromTempId`.
 * Replacing keeps the painting group's tempId, so a layout that had it open
 * (DocumentBuilder's openGroup) shows the new calculator in the same place.
 */
export function placeRoutedGroup(groups, fromTempId, fresh) {
  const all = Array.isArray(groups) ? groups : [];
  const i = all.findIndex((g) => g && g.tempId === fromTempId);
  if (i < 0) return [...all, fresh];
  if (isUntouchedPaintGroup(all[i])) return all.map((g, j) => (j === i ? { ...fresh, tempId: fromTempId } : g));
  return [...all.slice(0, i + 1), fresh, ...all.slice(i + 1)];
}
