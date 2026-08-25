// lib/costing/tradeMaterials.js
//
// The bill of materials behind a takeoff: what to buy, how much of it, and —
// where a price is known — what it costs. Pure arithmetic, no I/O.
//
// ── Two jobs, one list ──────────────────────────────────────────────────────
//
// This feeds the internal cost panel AND the job's sourcing list. They are the
// same list: "what does this job consume" is the question behind both "is this
// price above my costs" and "have we bought everything before the crew leaves
// the yard". Deriving them separately is how the two end up disagreeing.
//
// ── Quantities are known; prices mostly are not ─────────────────────────────
//
// Everything here splits cleanly in two, and the split is deliberate:
//
//   PACKAGING is product spec. Three bundles of asphalt shingle to a square, a
//   4x8 sheet is 32 square feet, a roll of ice and water is two squares. These
//   do not vary by market and they are stated as constants.
//
//   UNIT COST is a market. Paving was read from two Ottawa suppliers; roofing,
//   siding and insulation were read off Home Depot Canada (Gatineau store) on
//   25 August 2026 — see the citations in app/data/tradePriceBooks.js. What is
//   still unsourced ships as NULL rather than as a plausible number.
//
// Reading real products moved several of the PACKAGING constants, which is the
// point of reading them: a starter bundle is 120 linear feet, not 100, and a
// house wrap roll here is 900 square feet, not 1,350. Each correction names
// the product it came from.
//
// A null unit cost produces a line with a quantity and no money, flagged
// `unpriced`, and the caller reports how many there are. It does NOT produce a
// line costed at zero. Costing a roof's shingles at $0 makes the margin panel
// say 100% margin on the biggest input in the job, which is worse than saying
// nothing — this is the padding-absent-data failure the codebase gets swept
// for, and the sourcing list is useful with no prices at all.
//
// Every unit cost is on the rate card, so filling one in is one edit.

import { getPriceBook } from "@/app/data/tradePriceBooks";
import { roofLabour, SQFT_PER_SQUARE } from "@/lib/pricing/roofLabour";
import {
  paverCount,
  baseMaterials,
  polySandBags,
  polygonPerimeterFt,
} from "@/lib/pricing/paverTakeoff";
import { estimatedPerimeterFt } from "@/lib/pricing/paverLabour";
import { insulationTakeoff } from "@/lib/pricing/insulation";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const positive = (v) => {
  const n = num(v);
  return n > 0 ? n : 0;
};
const ceil = (v) => {
  const n = positive(v);
  return n > 0 ? Math.ceil(n) : 0;
};
const round2 = (n) => {
  const v = num(n);
  if (!Number.isFinite(v)) return 0;
  return Math.abs(v) > 1e12 ? v : Math.round(v * 100) / 100;
};
const own = (map, key) =>
  map && Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;

/**
 * One line of the bill.
 *
 * `unitCost` of null means nobody has said what it costs, and that is carried
 * through as `unpriced: true` with `cost: 0` — the caller must report the count
 * rather than let a zero sum look like a cheap job.
 */
function item(name, qty, unit, unitCost) {
  const q = positive(qty);
  if (q <= 0) return null;
  const priced =
    unitCost != null &&
    Number.isFinite(Number(unitCost)) &&
    Number(unitCost) > 0;
  return {
    name,
    qty: round2(q),
    unit,
    unitCost: priced ? round2(unitCost) : null,
    cost: priced ? round2(q * Number(unitCost)) : 0,
    unpriced: !priced,
  };
}

/* ── Roofing ───────────────────────────────────────────────────────────── */

/**
 * Packaging constants. Product spec, not market — a bundle is a third of a
 * square wherever you buy it.
 *
 * Every figure below was checked against a real Home Depot Canada SKU on
 * 25 Aug 2026. Four of them were wrong and are corrected here; the named
 * product is the evidence, and a company buying a different brand overrides
 * the constant on the rate card rather than editing this file.
 *
 * A material may carry its own `bundlesPerSquare` — metal panels and low-slope
 * membrane do not come three to a square, and pretending they do would order
 * a third more roof than the job needs.
 */
export const ROOF_PACKAGING = {
  // GAF Timberline HDZ: 33.3 sqft per bundle, so 3 to a square. Unchanged.
  bundlesPerSquare: 3,
  // GAF FeltBuster and OC ProArmor are both 1,000 sqft rolls. Unchanged.
  underlaymentSquaresPerRoll: 10,
  // GAF WeatherWatch, GAF StormGuard and OC WeatherLock G are all 200 sqft.
  // (Henry Eaveguard and RESISTO are 36" x 65' = 195; close enough that the
  // 200 is the honest round number rather than a brand choice.)
  iceWaterSqftPerRoll: 200,
  // Peak Gutters drip edge, confirmed 10 ft on the product page. Unchanged.
  dripEdgeFtPerLength: 10,
  // WAS 100. GAF Pro-Start is 120 linear feet per bundle; OC Starter Strip
  // Plus is 105. Neither is 100, and 100 was quietly buying an extra bundle
  // on every job long enough to matter.
  starterFtPerBundle: 120,
  // WAS 20. GAF Seal-A-Ridge — the cap that goes with Timberline HDZ — is 25
  // linear feet. GAF TimberTex is 20 and OC ProEdge is 33, so a company that
  // switches cap brand edits this and the price together.
  ridgeCapFtPerBundle: 25,
  // GAF Snow Country Advanced is 11.5" x 48". Unchanged.
  ridgeVentFtPerSection: 4,
  // WAS `stepFlashingPerBox: 100`. Nobody sells step flashing by a 100-foot
  // box; it is sold one piece at a time, and the count follows the shingle
  // exposure rather than the wall length — one piece per course, 12/5 at a
  // standard 5" exposure.
  stepFlashingPiecesPerFt: 2.4,
  // A 7,200-count coil box at the 6-nail high-wind pattern (480 nails to a
  // square) is 15 squares. Unchanged, and now it has a product behind it.
  squaresPerNailBox: 15,
};

/**
 * Waste, applied to the QUANTITY and never to the unit cost.
 *
 * Hips, valleys, rakes and the starter course all send offcuts to the skip,
 * and the crew pays for the offcuts. Folding that into the unit cost would be
 * the same arithmetic and a worse number: the sourcing list would then say
 * "buy 72 bundles" while the money said 79, and the yard goes by the list.
 * Moving the count keeps one answer, visible to whoever does the buying.
 *
 * Counted things — vents, boots, skylights, deck sheets — are deliberately
 * NOT wasted. Nobody buys a tenth of a vent boot because the shingles were cut.
 */
function wasteFactor(book) {
  const pct = num(book.wastePct);
  return pct > 0 ? 1 + pct : 1;
}

function roofingMaterials(config, book) {
  const take = roofLabour(
    { ...config, materials: book.materials },
    book.labour,
  );
  if (take.incomplete) return { materials: [], summary: [] };

  const p = { ...ROOF_PACKAGING, ...(book.packaging || {}) };
  const c = book.materialCosts || {};
  const material =
    own(book.materials, config.materialKey) ||
    own(book.materials, book.defaultMaterial);
  const squares = take.squares;

  // The measured roof is what the summary and the labour engine talk about;
  // the ORDER is what the yard loads. They differ by the waste factor, and
  // keeping both named stops one being mistaken for the other.
  const waste = wasteFactor(book);
  const orderSquares = squares * waste;
  const orderFt = (v) => positive(v) * waste;

  // Metal panels and low-slope membrane do not come three to a square. The
  // count is a property of the product, so it rides with the material and
  // falls back to the asphalt default.
  const bundlesPerSquare =
    positive(material?.bundlesPerSquare) || positive(p.bundlesPerSquare);

  const out = [
    item(
      `${material?.label || "Roofing material"} — bundles`,
      ceil(orderSquares * bundlesPerSquare),
      "bundle",
      material?.materialCostPerBundle,
    ),
    item(
      "Synthetic underlayment",
      ceil(orderSquares / positive(p.underlaymentSquaresPerRoll)),
      "roll",
      c.underlaymentPerRoll,
    ),
    item(
      "Ice & water membrane",
      ceil((orderFt(config.iceWaterFt) * 3) / positive(p.iceWaterSqftPerRoll)),
      "roll",
      c.iceWaterPerRoll,
    ),
    item(
      "Drip edge",
      ceil(orderFt(config.dripEdgeFt) / positive(p.dripEdgeFtPerLength)),
      "length",
      c.dripEdgePerLength,
    ),
    item(
      "Starter strip",
      ceil(orderFt(config.starterFt) / positive(p.starterFtPerBundle)),
      "bundle",
      c.starterPerBundle,
    ),
    item(
      "Hip & ridge cap",
      ceil(orderFt(config.ridgeHipFt) / positive(p.ridgeCapFtPerBundle)),
      "bundle",
      c.ridgeCapPerBundle,
    ),
    item(
      "Ridge vent",
      ceil(orderFt(config.ridgeVentFt) / positive(p.ridgeVentFtPerSection)),
      "section",
      c.ridgeVentPerSection,
    ),
    item(
      "Step flashing",
      ceil(
        orderFt(config.stepFlashingFt) * positive(p.stepFlashingPiecesPerFt),
      ),
      "piece",
      c.stepFlashingEach,
    ),
    // Counted, not measured: waste does not apply. See wasteFactor().
    item("Plumbing vent boots", config.ventBoots, "each", c.ventBootEach),
    item("Roof vents", config.boxVents, "each", c.boxVentEach),
    item("Skylight flashing kits", config.skylights, "each", c.skylightKitEach),
    item("Chimney flashing", config.chimneys, "each", c.chimneyFlashingEach),
    item("Sheathing", config.deckSheets, "sheet", c.deckSheetEach),
    item(
      "Roofing nails",
      ceil(orderSquares / positive(p.squaresPerNailBox)),
      "box",
      c.nailBoxEach,
    ),
  ];

  // Ice & water is sold by area and specified by the foot: a 36" course down a
  // 90 ft eave is 270 sqft, not 90. The x3 above is that, and it is here rather
  // than in a constant because the width is the product's, not the roof's.
  return {
    materials: out.filter(Boolean),
    summary: [
      `${squares} squares`,
      `${take.pitch.rise}/12`,
      // Said out loud, because a bundle count that does not divide by three is
      // otherwise read as an arithmetic mistake.
      waste > 1 ? `+${Math.round((waste - 1) * 100)}% waste` : null,
    ].filter(Boolean),
  };
}

/* ── Siding ────────────────────────────────────────────────────────────── */

/**
 * As above: checked against Home Depot Canada SKUs, 25 Aug 2026.
 *
 * `sqftPerBox` is the DEFAULT. Cladding that does not come 200 square feet to
 * a box — stone veneer, panel goods, cedar shingles — carries its own on the
 * material, because the box is the product's and not the trade's.
 */
export const SIDING_PACKAGING = {
  // ABTCO TimberCrest Plus D4.5D: 22 panels of 4.5" double x 145.5", which is
  // 200.1 sqft. Two squares of vinyl to a box, confirmed. Unchanged.
  sqftPerBox: 200,
  // WAS 1350 ("9' x 150'"). No such roll is sold here: DuPont Tyvek HomeWrap
  // is 9 ft x 100 ft = 900 sqft, and the house-brand roll is 10 x 100 = 1,000.
  // A 1,350 constant under-ordered wrap on every job by a third.
  housewrapSqftPerRoll: 900,
  // WAS 12. ABTCO vinyl J-channel is 5/8" x 150", i.e. 12.5 ft. Vinyl trim
  // here comes in 120" and 150" lengths; 12 ft is neither.
  trimFtPerLength: 12.5,
  // Split out of trimFtPerLength, which it used to borrow. Aluminum fascia
  // cover (Peak Gutters, 6" and 8" profiles) is a 10 ft length, not 12.5 —
  // sharing one constant quietly under-ordered fascia by 20%.
  fasciaFtPerLength: 10,
};

function sidingMaterials(config, book) {
  const sqft = positive(config.sqft);
  if (sqft <= 0) return { materials: [], summary: [] };
  const p = { ...SIDING_PACKAGING, ...(book.packaging || {}) };
  const c = book.materialCosts || {};
  const material =
    own(book.materials, config.materialKey) ||
    own(book.materials, book.defaultMaterial);

  // Stone veneer boxes are ~49 sqft and a 4x8 panel is 32; only vinyl and
  // aluminum are the 200 sqft "two squares" the default assumes.
  const sqftPerBox = positive(material?.sqftPerBox) || positive(p.sqftPerBox);

  const out = [
    item(
      `${material?.label || "Cladding"}`,
      ceil(sqft / sqftPerBox),
      "box",
      material?.materialCostPerBox,
    ),
    config.housewrap
      ? item(
          "House wrap",
          ceil(sqft / positive(p.housewrapSqftPerRoll)),
          "roll",
          c.housewrapPerRoll,
        )
      : null,
    item(
      "Trim",
      ceil(positive(config.trimFt) / positive(p.trimFtPerLength)),
      "length",
      c.trimPerLength,
    ),
    item(
      "Fascia",
      ceil(positive(config.fasciaFt) / positive(p.fasciaFtPerLength)),
      "length",
      c.fasciaPerLength,
    ),
    item("Soffit", positive(config.soffitSqft), "sqft", c.soffitPerSqft),
    item(
      "Sheathing",
      ceil(positive(config.rotRepairSqft) / 32),
      "sheet",
      c.deckSheetEach,
    ),
    item(
      "Fasteners",
      ceil(sqft / SQFT_PER_SQUARE),
      "square",
      c.fastenersPerSquare,
    ),
  ];
  return { materials: out.filter(Boolean), summary: [`${sqft} sqft of wall`] };
}

/* ── Insulation ────────────────────────────────────────────────────────── */

function insulationMaterials(config, book) {
  const material =
    own(book.materials, config.materialKey) ||
    own(book.materials, book.defaultMaterial);
  const take = insulationTakeoff(config, material, book.labour);
  if (take.incomplete || !material) return { materials: [], summary: [] };

  const c = book.materialCosts || {};
  const sqft = take.sqft;
  const out = [];

  // Three packaging models, because insulation genuinely has three. Which one
  // applies is a property of the product, so it lives on the material.
  if (positive(material.sqftInchesPerBag) > 0) {
    // Blown. Coverage is printed on the bag as square feet at a stated R, which
    // is square-foot-inches once you divide by the R per inch — and it is
    // editable here for exactly that reason: it is the bag's number, not ours.
    out.push(
      item(
        `${material.label} — bags`,
        ceil((sqft * take.inches) / positive(material.sqftInchesPerBag)),
        "bag",
        material.materialCostPerBag,
      ),
    );
  } else if (positive(material.sqftPerBundle) > 0) {
    out.push(
      item(
        `${material.label} — bundles`,
        ceil(sqft / positive(material.sqftPerBundle)),
        "bundle",
        material.materialCostPerBundle,
      ),
    );
  } else if (positive(material.boardFeetPerSet) > 0) {
    // Spray foam is sold as a set and measured in board feet — a board foot IS
    // a square foot one inch thick, which is why the depth engine and the
    // purchase order speak the same unit.
    const boardFeet = sqft * take.inches;
    out.push(
      item(
        `${material.label} — sets`,
        ceil(boardFeet / positive(material.boardFeetPerSet)),
        "set",
        material.materialCostPerSet,
      ),
    );
  } else if (positive(material.sqftPerSheet) > 0) {
    out.push(
      item(
        `${material.label} — sheets`,
        ceil(sqft / positive(material.sqftPerSheet)),
        "sheet",
        material.materialCostPerSheet,
      ),
    );
  } else if (take.rated === false) {
    out.push(item(material.label, sqft, "sqft", material.materialCostPerSqft));
  }

  if (take.needsVapourBarrier && config.vapourBarrier !== false) {
    out.push(
      item(
        "Vapour barrier — 6 mil poly",
        ceil(sqft / positive(book.packaging?.vapourBarrierSqftPerRoll || 1000)),
        "roll",
        c.vapourBarrierPerRoll,
      ),
    );
  }
  out.push(item("Soffit baffles", config.baffles, "each", c.bafflePerUnit));
  if (config.airSeal) {
    out.push(
      item(
        "Spray foam & caulk for air sealing",
        ceil(sqft / 500),
        "case",
        c.airSealCasePerUnit,
      ),
    );
  }

  return {
    materials: out.filter(Boolean),
    summary: [
      `${sqft} sqft`,
      take.rated ? `${take.inches}" to R${take.finalR}` : material.label,
    ],
  };
}

/* ── Paving ────────────────────────────────────────────────────────────── */

function pavingMaterials(config, book) {
  const c = book.materialCosts || {};
  const surfaces = [
    ["patio", positive(config.patioSqft)],
    ["walkway", positive(config.walkwaySqft)],
    ["driveway", positive(config.drivewaySqft)],
  ].filter(([, a]) => a > 0);
  const sqft = surfaces.reduce((s, [, a]) => s + a, 0);
  if (sqft <= 0) return { materials: [], summary: [] };

  let gravelCuYd = 0;
  let sandCuYd = 0;
  for (const [surface, area] of surfaces) {
    const m = baseMaterials({
      areaSqFt: area,
      surface,
      frostRegion: config.frostRegion !== false,
    });
    gravelCuYd += num(m.gravelCuYd);
    sandCuYd += num(m.sandCuYd);
  }

  const option = own(book.paverOptions, config.paverOption) || null;
  const paverCostPerSqft =
    positive(config.paverCostPerSqft) > 0
      ? positive(config.paverCostPerSqft)
      : positive(option?.costPerSqft);

  const drawn = Array.isArray(config.paverDesign?.points)
    ? polygonPerimeterFt(config.paverDesign.points)
    : 0;
  const perimeterFt =
    positive(config.perimeterFt) || drawn || estimatedPerimeterFt(sqft);

  // Loads, so the delivery charge lands once per truck rather than being
  // smeared per cubic yard. Greely Sand's own published ladder backs a $190
  // fixed charge out of every quantity from 1 to 16 cubic yards.
  const cuYdPerLoad = positive(c.cuYdPerLoad) || 16;
  const loads = ceil((gravelCuYd + sandCuYd) / cuYdPerLoad);

  const out = [
    // Pavers are bought by the square foot at retail, so no packaging
    // conversion — the count is reported alongside for the yard.
    item("Pavers", sqft, "sqft", paverCostPerSqft),
    item("Granular base", gravelCuYd, "cu yd", c.gravelPerCuYd),
    item("Bedding sand", sandCuYd, "cu yd", c.sandPerCuYd),
    item(
      "Polymeric sand",
      polySandBags({
        areaSqFt: sqft,
        joint: config.jointWidth || "narrow",
        coverageSqFtPerBag: c.polySandCoverageSqftPerBag,
      }).high,
      "bag",
      c.polySandPerBag,
    ),
    item(
      "Edge restraint",
      ceil(perimeterFt / 8),
      "length",
      c.edgeRestraintPerLength,
    ),
    item("Geotextile", ceil(sqft / 300), "roll", c.geotextilePerRoll),
    item("Aggregate delivery", loads, "load", c.deliveryPerLoad),
  ];

  const counted =
    positive(config.paverLengthIn) > 0 && positive(config.paverWidthIn) > 0
      ? paverCount({
          areaSqFt: sqft,
          paverLengthIn: config.paverLengthIn,
          paverWidthIn: config.paverWidthIn,
          pattern: config.pattern,
        })
      : null;

  return {
    materials: out.filter(Boolean),
    summary: [
      `${round2(sqft)} sqft`,
      `${round2(gravelCuYd)} cu yd base`,
      counted ? `${counted.order} pavers to order` : null,
    ].filter(Boolean),
  };
}

const BUILDERS = {
  roofing_service: roofingMaterials,
  siding: sidingMaterials,
  insulation: insulationMaterials,
  paving: pavingMaterials,
};

/** Does this trade derive its own bill of materials from the takeoff? */
export function hasTradeMaterials(categoryKey) {
  return Boolean(own(BUILDERS, categoryKey));
}

/**
 * The bill of materials for one scope group.
 *
 * Returns NO labour. These trades already answer "how long" through
 * tradeLabourHours(), which the quote page adds separately — returning hours
 * here as well would count every one of them twice.
 *
 * @returns {{materials:Array, materialTotal:number, unpricedCount:number,
 *            summaryParts:string[]}|null}
 */
export function tradeMaterialsFor(categoryKey, takeoff, rateOverrides) {
  const builder = own(BUILDERS, categoryKey);
  if (!builder || !takeoff || typeof takeoff !== "object") return null;
  const book = getPriceBook(categoryKey, rateOverrides);
  if (!book) return null;

  let result;
  try {
    result = builder(takeoff, book);
  } catch {
    // A throw here would take the cost panel down mid-edit. An empty bill is
    // recoverable and visibly wrong.
    return null;
  }

  const materials = (result.materials || []).filter(Boolean);
  return {
    categoryKey,
    materials,
    materialTotal: round2(materials.reduce((s, m) => s + num(m.cost), 0)),
    // The number that stops a null price reading as a cheap job.
    unpricedCount: materials.filter((m) => m.unpriced).length,
    summaryParts: result.summary || [],
  };
}
