// app/data/defaultLineItems.js
//
// The line items a trade almost always bills, offered as one tap.
//
// ── What this fixes ─────────────────────────────────────────────────────────
//
// Adding a countertop to a quote produced exactly one line: "Countertop", at
// the category's default rate. Every real countertop job also bills a
// backsplash, a sink cutout, removal of the old top, disposal, and often a
// waterfall edge or a travel fee. Those got typed by hand every single time,
// which means on a busy day they get forgotten — and a forgotten disposal fee
// is money the company already spent and won't recover.
//
// So each trade ships the extras it habitually bills, as chips inside the
// scope group. Nothing is added automatically: an unwanted line on a quote is
// worse than a missing one, because the client sees it. They're offers.
//
// ── Prices are deliberately absent ──────────────────────────────────────────
//
// `rate: null` on almost everything. A default disposal fee of $150 would be
// wrong in most of the country, and a wrong number on a document a client
// signs is worse than a blank one the contractor fills in. What's shipped is
// the LIST — knowing what to bill for is the hard part; knowing your own
// price isn't.
//
// Companies that want their own prices remembered use Products & Services
// (the Product model), which already feeds the same table from the dropdown
// beside these chips.

// unit values match what the builder writes onto a line item.
const FLAT = "flat";
const EACH = "each";
const SQFT = "sqft";
const LF = "linear_ft";

export const DEFAULT_LINE_ITEMS = {
  countertop: [
    { description: "Countertop supply & installation", unit: SQFT },
    { description: "Backsplash", unit: LF },
    { description: "Sink cutout (undermount)", unit: EACH },
    { description: "Cooktop cutout", unit: EACH },
    { description: "Waterfall edge", unit: EACH },
    { description: "Edge profile upgrade", unit: LF },
    { description: "Removal of existing countertop", unit: FLAT },
    { description: "Disposal fee", unit: FLAT },
    { description: "Travel fee", unit: FLAT },
  ],

  cabinet_refinishing: [
    { description: "New handle holes (drilling)", unit: EACH },
    { description: "Soft-close hinges — supply & install", unit: EACH },
    { description: "Two-tone finish (second colour)", unit: FLAT },
    { description: "Cabinet interior painting", unit: FLAT },
    { description: "Crown moulding — supply & install", unit: LF },
    { description: "Toe kick replacement", unit: LF },
  ],

  cabinet_refacing: [
    { description: "New door & drawer fronts", unit: EACH },
    { description: "Soft-close hinges — supply & install", unit: EACH },
    { description: "Finished end panel", unit: EACH },
    { description: "Filler strip", unit: EACH },
    { description: "Crown moulding — supply & install", unit: LF },
  ],

  interior_painting: [
    { description: "Ceiling", unit: FLAT },
    { description: "Trim & baseboards", unit: FLAT },
    { description: "Doors", unit: EACH },
    { description: "Closet interior", unit: EACH },
    { description: "Popcorn / stipple ceiling removal", unit: SQFT },
    { description: "Drywall repair & prep", unit: FLAT },
    { description: "Furniture moving & protection", unit: FLAT },
  ],

  exterior_painting: [
    { description: "Pressure washing", unit: FLAT },
    { description: "Trim & soffit", unit: SQFT },
    { description: "Fascia boards", unit: LF },
    { description: "Front door", unit: EACH },
    { description: "Garage door", unit: EACH },
    { description: "Shutters", unit: EACH },
    { description: "Prime coat", unit: SQFT },
  ],

  flooring: [
    { description: "Stain colour change", unit: SQFT },
    { description: "Water damage repair", unit: FLAT },
    { description: "Gap filling", unit: SQFT },
    { description: "Furniture moving", unit: FLAT },
    { description: "Stair blending", unit: FLAT },
    { description: "Quarter round / shoe moulding", unit: LF },
  ],

  stairs: [
    { description: "Risers", unit: EACH },
    { description: "Balusters / spindles", unit: EACH },
    { description: "Newel posts", unit: EACH },
    { description: "Handrail", unit: LF },
    { description: "Landing", unit: SQFT },
    { description: "Two-tone finish", unit: FLAT },
  ],

  roofing_service: [
    { description: "Tear-off & disposal", unit: SQFT },
    { description: "Decking replacement", unit: SQFT },
    { description: "Ice & water shield", unit: LF },
    { description: "Drip edge", unit: LF },
    { description: "Ridge vent", unit: LF },
    { description: "Chimney flashing", unit: EACH },
    { description: "Skylight flashing", unit: EACH },
  ],

  fence_services: [
    { description: "Removal of existing fence", unit: LF },
    { description: "Gate — supply & install", unit: EACH },
    { description: "Post replacement", unit: EACH },
    { description: "Staining / sealing", unit: LF },
    { description: "Disposal fee", unit: FLAT },
  ],

  landscaping_design: [
    { description: "Site preparation & grading", unit: FLAT },
    { description: "Topsoil", unit: SQFT },
    { description: "Sod", unit: SQFT },
    { description: "Mulch", unit: SQFT },
    { description: "Edging", unit: LF },
    { description: "Disposal fee", unit: FLAT },
  ],

  // Applies to nearly every trade, so it's offered when a category has no
  // list of its own rather than being repeated into all sixty.
  _generic: [
    { description: "Travel / call-out fee", unit: FLAT },
    { description: "Disposal fee", unit: FLAT },
    { description: "Materials", unit: FLAT },
    { description: "Additional labour", unit: FLAT },
  ],
};

/** Suggestions for a category, falling back to the ones common to all trades. */
export function getDefaultLineItems(categoryKey) {
  return DEFAULT_LINE_ITEMS[categoryKey] || DEFAULT_LINE_ITEMS._generic;
}
