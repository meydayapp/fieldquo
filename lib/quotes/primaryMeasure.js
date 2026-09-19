// lib/quotes/primaryMeasure.js
//
// The one measured quantity a scope group is priced on — 1,240 sq ft of wall,
// 14 treads, 180 linear ft of gutter, 32 doors and drawer fronts — read off
// the takeoff (or the intake answers, for the trades that price from those).
//
// ── Why a price per unit, and why this file ────────────────────────────────
//
// The review's price check compared a quote's TOTAL against the median total
// of the company's accepted quotes in the same trade. The owner, on that: "if
// they have a bigger project it is normal to have a bigger price". Right —
// and the hedge the sentence carried ("a bigger job is a bigger number") was
// the honest admission that the comparison could not tell size from price.
// Dividing by the measured work can. $1.90 a square foot against a usual
// $2.95 is a statement about the RATE, and a bigger kitchen is no answer to
// it.
//
// Every trade stores its quantity under its own name (`sqft`, `gutterFt`,
// `sections[].treads`, `areas[].surfaceSqft`, `intakeValues.doorCount`) and
// nothing in the repo answered "what is this group's headline quantity" in
// one place — lib/costing/labourCalibration.js's takeoffSqft covers the
// area trades only, and the document captions cover four satellite trades.
// This is that one place. PURE: a group-shaped object in, a quantity and a
// unit out, so the review can run it over three hundred stored groups and
// scripts/check-quote-price-check.mjs can run it over hostile ones.
//
// ── A unit is a key, never a label ─────────────────────────────────────────
//
// "sqft" here is not what the panel prints. The panel translates the key
// (app.quoteReview.unit_sqft → "sq ft" / "pi²"), and two groups compare only
// when their KEYS match: a stair group measured in treads is never held
// against one an older quote measured in square feet, whatever the trade.

import { areaGeometry } from "@/lib/pricing/paintTakeoff";
import { SQFT_PER_SQUARE, slopedAreaSqft } from "@/lib/pricing/roofLabour";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const sum = (list, pick) =>
  (Array.isArray(list) ? list : []).reduce((s, x) => s + num(pick(x)), 0);

/** The unit keys this file can emit. The panel carries a label for each. */
export const MEASURE_UNITS = ["sqft", "linear_ft", "tread", "door_drawer", "door", "square"];

/**
 * @param categoryKey  the trade (ServiceCategory.key)
 * @param takeoff      QuoteScopeGroup.takeoff, or null
 * @param intakeValues QuoteScopeGroup.intakeValues, or null
 * @returns {{ quantity: number, unit: string } | null} null when the group
 *          carries nothing measured — a flat-priced trade, a snow contract, a
 *          countertop priced off supplier slabs, or a takeoff somebody left
 *          empty. Never a guessed quantity: absence here is what sends the
 *          price check back to the total-vs-total comparison, and a made-up
 *          denominator would produce a confident rate about nothing.
 */
export function primaryMeasure(categoryKey, takeoff, intakeValues) {
  const t = takeoff && typeof takeoff === "object" ? takeoff : null;
  const iv = intakeValues && typeof intakeValues === "object" ? intakeValues : {};
  const measure = (quantity, unit) => (quantity > 0 ? { quantity, unit } : null);

  switch (categoryKey) {
    case "cabinet_refinishing":
    case "cabinet_refacing":
      // Doors and drawer fronts are priced as one run at one rate per piece
      // (app/data/cabinetPricing.js groupUnits), so one unit for both.
      return measure(num(iv.doorCount) + num(iv.drawerCount), "door_drawer");

    case "stairs": {
      const fromSections = sum(t?.sections, (s) => s?.treads) + num(t?.basementTreads);
      return measure(fromSections || num(iv.treads) || num(iv.stepCount), "tread");
    }

    case "flooring":
      return measure(
        sum(t?.sections, (s) => s?.sqft) || num(iv.areaSqft) || num(iv.squareFootage),
        "sqft",
      );

    case "interior_painting":
    case "exterior_painting": {
      if (t?.model === "area_substrate") {
        // The same geometry the takeoff prices from: a measured surface, a
        // wall run, or a room's four walls. Ceilings are not walls, and a
        // wall rate is what the comparison is about.
        const walls = sum(t.areas, (a) => areaGeometry(a).wallSqft);
        return measure(walls, "sqft");
      }
      const legacy = sum(t?.rooms, (r) => r?.sqft);
      if (legacy) return measure(legacy, "sqft");
      return measure(
        num(iv.areaSqft) || num(iv.wallSquareFootage) || num(iv.squareFootage),
        "sqft",
      );
    }

    case "garage_door":
      return measure(sum(t?.doors, (d) => d?.quantity), "door");

    case "roofing_service": {
      // Squares, the trade's own unit — a roofer reads "$410 a square" and
      // "$4.10 a sq ft" as two different sentences, and only one is theirs.
      let squares = num(t?.squares);
      if (!squares && num(t?.areaSqft)) squares = num(t.areaSqft) / SQFT_PER_SQUARE;
      if (!squares && num(t?.footprintSqft)) {
        squares = slopedAreaSqft(num(t.footprintSqft), num(t.pitchRise)) / SQFT_PER_SQUARE;
      }
      return measure(Math.round(squares * 100) / 100, "square");
    }

    case "gutter_services":
      return measure(num(t?.gutterFt), "linear_ft");

    case "paving":
      return measure(
        num(t?.patioSqft) + num(t?.walkwaySqft) + num(t?.drivewaySqft) ||
          num(t?.measuredAreaSqft) ||
          num(iv.squareFootage),
        "sqft",
      );

    case "lawn_care":
    case "lawn_mowing":
      return measure(num(t?.lawn?.areaSqft) || num(iv.lotSize), "sqft");

    case "siding":
    case "insulation":
    case "driveway_sealing":
    case "home_inspection":
      return measure(num(t?.sqft) || num(iv.wallSquareFootage) || num(iv.squareFootage), "sqft");

    case "epoxy":
    case "parging":
    case "countertop":
      // Intake-priced by area; a countertop with only supplier slabs on it
      // has no area and gets null, which is correct.
      return measure(num(iv.areaSqft) || num(iv.squareFootage), "sqft");

    default:
      return null;
  }
}

/**
 * Price per unit for a group, or null.
 *
 * Kept beside the measure so both sides of the comparison — the quote being
 * reviewed and every accepted group in the history — divide the same way.
 * `subtotal` is the group's own subtotal (QuoteScopeGroup.subtotal); a group
 * priced at nothing has no rate, not a rate of zero.
 */
export function pricePerUnit({ categoryKey, takeoff, intakeValues, subtotal }) {
  const m = primaryMeasure(categoryKey, takeoff, intakeValues);
  const price = num(subtotal);
  if (!m || !price) return null;
  return { ...m, perUnit: Math.round((price / m.quantity) * 100) / 100 };
}
