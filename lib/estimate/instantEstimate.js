// lib/estimate/instantEstimate.js
//
// The client-facing price BRAIN. Measurements + a material choice + the
// company's own saved sell rates → a low–high estimate range. Pure, no I/O,
// unit-tested against hostile input.
//
// ── This is a PRICE model, not the cost model ───────────────────────────────
//
// lib/costing/estimateJobCost.js estimates what a job COSTS the contractor, to
// flag margin. This estimates what the contractor CHARGES, to show a homeowner
// a "starting at" figure. They are deliberately separate: a sell price is a
// market decision the contractor makes, not cost × markup we invent for them.
//
// ── Rates are the company's, never ours ─────────────────────────────────────
//
// Non-negotiable #4 (public endpoints never publish OUR idea of a rate card)
// and #5 (the browser never sends money — it sends a material key, the server
// reprices). Both are satisfied by requiring `config` to come from the
// company's saved row: with no config, computeInstantEstimate returns
// { needsConfig: true } and the trade simply isn't offered as an instant
// quote. INSTANT_ESTIMATE_DEFAULTS below exists ONLY to seed the settings form
// with realistic starting points the company then edits — it is never the
// source of a published number. That's the difference between "a default the
// company reviewed and adopted" and "a price we invented and published",
// which is the padding-absent-data trap in AGENTS.md.
//
// ── Why a range, and what "starting at" means ───────────────────────────────
//
// An instant estimate sight-unseen is a range, honestly. The low end is the
// "starting at" figure (clean, accessible, no surprises); the high end carries
// the surcharges the measurement can justify (steep pitch, tear-off layers,
// poor surface). rangeBandPct widens both ends for the irreducible uncertainty
// of not having stood on the roof. The company confirms before any of it is
// binding — this number is a lead magnet with a human backstop, never a quote.

// priceJunk is pure (no I/O), so importing it keeps this module's contract.
import { priceJunk, normaliseJunkRates, DEFAULT_JUNK_RATES } from "@/lib/junk/pricing";

function num(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}
function round(n, step = 10) {
  // Round money to a tidy figure — a "starting at $14,410" reads as measured;
  // "$14,412.73" reads as a machine guessing.
  return Math.round((Number(n) || 0) / step) * step;
}
function clampPct(p) {
  const v = num(p, 0);
  return Math.min(2, Math.max(0, v)); // a surcharge over 200% is a typo, cap it
}

// Every list this module reads out of a saved config goes through here.
//
// InstantQuoteConfig.config is free-form JSON — the settings form writes the
// shape it happens to hold, so `materials` can arrive as a string, an object,
// or an array with a null in it. The estimators used to assume "array of
// objects" and threw when it wasn't, which turned a malformed saved row into a
// 500 on a public page. sanitiseInstantConfig in instantQuoteReadiness.js
// normalises at the boundary and still should — but the shape assumption lived
// in here, so the guarantee belongs in here too, where a caller that has never
// heard of the sanitiser still gets it.
//
// Non-objects are dropped rather than tolerated: an entry that isn't an object
// can't carry a rate, and keeping it only moves the crash along to `.label`.
// Always a fresh array, so a caller that sorts (lawn tiers) doesn't quietly
// reorder the company's stored config.
function configList(value) {
  return Array.isArray(value) ? value.filter((v) => v && typeof v === "object") : [];
}

// Reference starting points to SEED the company's config form. Mid-market
// North-American figures (CAD/USD are close enough that the company edits to
// their market anyway). Every one is overridable; none is ever published as-is.
export const INSTANT_ESTIMATE_DEFAULTS = {
  roofing: {
    // $/roofing-square (100 sqft of SLOPED area — matches Solar's areaMeters2).
    materials: [
      { key: "asphalt_3tab", label: "3-tab asphalt shingles", ratePerSquare: 400 },
      { key: "asphalt_arch", label: "Architectural shingles", ratePerSquare: 550 },
      { key: "asphalt_premium", label: "Premium / designer shingles", ratePerSquare: 700 },
      { key: "metal_standing_seam", label: "Standing seam metal", ratePerSquare: 1300 },
      { key: "metal_corrugated", label: "Corrugated / ribbed metal", ratePerSquare: 850 },
    ],
    tearOffPerSquarePerLayer: 65,
    steepnessSurcharge: { standard: 0, moderate: 0.1, steep: 0.22, very_steep: 0.4 },
    rangeBandPct: 0.15,
    minCharge: 2500,
  },
  epoxy: {
    // $/sqft of floor, by coating system.
    materials: [
      { key: "epoxy_solid", label: "Solid-colour epoxy", ratePerSqft: 4 },
      { key: "epoxy_flake", label: "Epoxy + decorative flake", ratePerSqft: 6.5 },
      { key: "metallic", label: "Metallic epoxy", ratePerSqft: 10 },
      { key: "quartz", label: "Quartz broadcast", ratePerSqft: 9 },
      { key: "polyaspartic", label: "Full polyaspartic system", ratePerSqft: 8.5 },
    ],
    // Surface condition drives grinding/patching effort.
    prepSurcharge: { good: 0, fair: 0.12, poor: 0.3 },
    rangeBandPct: 0.15,
    minCharge: 1200,
  },
  parging: {
    materials: [{ key: "standard", label: "Cement parging", ratePerSqft: 7 }],
    // Height / access drives ladders vs scaffold — the parger's own list.
    accessSurcharge: { ground: 0, second_storey: 0.2, scaffold: 0.45 },
    // New parging over sound masonry vs patch-and-repair first.
    conditionSurcharge: { new_or_sound: 0, minor_repair: 0.15, major_repair: 0.35 },
    rangeBandPct: 0.18,
    minCharge: 800,
  },
  lawn_mowing: {
    // Per-visit price banded by lot size (sqft of ground the mower covers).
    tiers: [
      { maxSqft: 5000, pricePerVisit: 40 },
      { maxSqft: 10000, pricePerVisit: 55 },
      { maxSqft: 20000, pricePerVisit: 80 },
      { maxSqft: 43560, pricePerVisit: 130 }, // up to ~1 acre
    ],
    // Beyond the top tier, price per additional acre.
    pricePerAcreOver: 120,
    rangeBandPct: 0.12,
    minCharge: 35,
  },
  cabinet_refacing: {
    perDoor: 95,
    perDrawer: 55,
    perBoxLinearFt: 45, // veneer on exposed cabinet-box sides
    materialMultiplier: {
      laminate: 1,
      thermofoil: 1.1,
      wood_veneer: 1.35,
      solid_wood: 1.6,
    },
    rangeBandPct: 0.15,
    minCharge: 3000,
  },
  flooring: {
    // Installed $/sqft by material.
    materials: [
      { key: "carpet", label: "Carpet", ratePerSqft: 4 },
      { key: "laminate", label: "Laminate", ratePerSqft: 4.5 },
      { key: "vinyl_plank", label: "Luxury vinyl plank", ratePerSqft: 5.5 },
      { key: "engineered", label: "Engineered wood", ratePerSqft: 8 },
      { key: "tile", label: "Ceramic / porcelain tile", ratePerSqft: 12 },
      { key: "hardwood", label: "Solid hardwood", ratePerSqft: 13 },
    ],
    // Subfloor condition / tear-out of the old floor drives prep effort.
    prepSurcharge: { good: 0, fair: 0.1, poor: 0.25 },
    rangeBandPct: 0.15,
    minCharge: 600,
  },
  painting: {
    // $/sqft of surface (wall/ceiling) by paint grade.
    materials: [
      { key: "economy", label: "Economy", ratePerSqft: 2 },
      { key: "standard", label: "Standard", ratePerSqft: 2.75 },
      { key: "premium", label: "Premium / low-VOC", ratePerSqft: 3.75 },
    ],
    // Exterior carries height, weather and heavier prep.
    scopeSurcharge: { interior: 0, exterior: 0.3 },
    // Patching, priming, stains bleeding through.
    conditionSurcharge: { good: 0, fair: 0.12, poor: 0.3 },
    rangeBandPct: 0.15,
    minCharge: 400,
  },
  stair: {
    // $/tread by build complexity. Editable — these are seeds, not the price.
    materials: [
      { key: "standard", label: "Standard straight run", ratePerTread: 110 },
      { key: "moderate", label: "Winder / curved", ratePerTread: 145 },
      { key: "high", label: "Open-riser / hardwood feature", ratePerTread: 180 },
    ],
    railingPerFt: 60,
    rangeBandPct: 0.15,
    minCharge: 1200,
  },
  countertop: {
    // Installed $/sqft by material (slab + fabrication + basic install, the way
    // a countertop shop actually quotes — "quartz installed, $X a foot").
    materials: [
      { key: "laminate", label: "Laminate", ratePerSqft: 45 },
      { key: "butcher_block", label: "Butcher block / wood", ratePerSqft: 60 },
      { key: "granite", label: "Granite", ratePerSqft: 70 },
      { key: "quartz", label: "Quartz", ratePerSqft: 80 },
      { key: "porcelain", label: "Porcelain slab", ratePerSqft: 90 },
      { key: "quartzite", label: "Quartzite", ratePerSqft: 95 },
      { key: "marble", label: "Marble", ratePerSqft: 110 },
    ],
    // Additive extras, not percentages: an upgraded edge profile per linear ft,
    // each sink/cooktop cutout, and matching backsplash by the sqft. A standard
    // eased edge is included, so edge only bites when the homeowner asks for one.
    edgePerFt: 12,
    cutoutFee: 100,
    backsplashPerSqft: 40,
    rangeBandPct: 0.15,
    minCharge: 800,
  },
  // Junk removal doesn't have "materials" — it prices a list of items by volume,
  // with special-recycling fees and access surcharges. The rate card is the full
  // junk rate object (in cents); priceJunk owns that maths. Seeded here only to
  // fill the settings form; every figure is the company's to edit.
  junk_removal: {
    rates: DEFAULT_JUNK_RATES,
    rangeBandPct: 0.15,
  },
};

// Wrap a point estimate in a range + tidy the ends. Shared by every trade so
// "starting at" means the same thing everywhere.
function toRange(point, { rangeBandPct = 0.15, minCharge = 0 } = {}) {
  const raw = num(point);
  const floor = num(minCharge);
  const p = Math.max(raw, floor);
  const band = clampPct(rangeBandPct);
  return {
    low: round(p * (1 - band)),
    point: round(p),
    high: round(p * (1 + band)),
    // ── Say when the floor is what they're looking at ────────────────────
    //
    // The clamp was invisible. With a $3,000 minimum, one cabinet door and
    // twenty produce the identical "$2,550 – $3,450", because both are under
    // the floor — and the owner reported exactly that as a broken estimator.
    // It wasn't broken, it was mute: the number stopped responding to the
    // form and nothing said a minimum existed.
    //
    // A boolean, not the minimum itself. The homeowner needs to know their
    // job priced below a floor; publishing the floor is publishing a rate,
    // which a public surface must not do (non-negotiable #4).
    minimumApplied: floor > 0 && raw < floor,
  };
}

// ── Roofing ─────────────────────────────────────────────────────────────────
export function estimateRoofing(measurements, materialKey, config) {
  const squares = num(measurements?.squares);
  if (squares <= 0) return { ok: false, reason: "no_measurement" };
  const material = configList(config?.materials).find((m) => m.key === materialKey);
  if (!material || !(num(material.ratePerSquare) > 0)) {
    return { ok: false, reason: "material_not_configured" };
  }

  const base = squares * num(material.ratePerSquare);
  const layers = Math.max(0, Math.floor(num(measurements?.tearOffLayers)));
  const tearOff = layers * squares * num(config.tearOffPerSquarePerLayer);
  const subtotal = base + tearOff;

  const tier = measurements?.steepness || "standard";
  const steepPct = clampPct(config?.steepnessSurcharge?.[tier]);
  const steep = subtotal * steepPct;

  const point = subtotal + steep;
  const range = toRange(point, config);

  const breakdown = [
    { label: `${squares} squares of ${material.label}`, amount: round(base) },
  ];
  if (tearOff > 0)
    breakdown.push({ label: `Tear off ${layers} existing layer${layers === 1 ? "" : "s"}`, amount: round(tearOff) });
  if (steep > 0)
    breakdown.push({ label: `Steep pitch (${measurements?.predominantPitch?.rise}/12)`, amount: round(steep) });

  return {
    ok: true,
    ...range,
    breakdown,
    assumptions: [
      `${squares} roofing squares (${num(measurements?.areaSqft)} sqft), measured from satellite`,
      measurements?.predominantPitch ? `${measurements.predominantPitch.rise}/12 predominant pitch` : null,
    ].filter(Boolean),
  };
}

// ── Per-square-foot area trades (epoxy, parging) ─────────────────────────────
function estimateAreaTrade({ measurements, materialKey, config, surcharges = [] }) {
  const areaSqft = num(measurements?.areaSqft);
  if (areaSqft <= 0) return { ok: false, reason: "no_measurement" };
  const materials = configList(config?.materials);
  const material = materials.find((m) => m.key === materialKey) || materials[0];
  if (!material || !(num(material.ratePerSqft) > 0)) {
    return { ok: false, reason: "material_not_configured" };
  }

  const base = areaSqft * num(material.ratePerSqft);
  const breakdown = [{ label: `${areaSqft} sqft of ${material.label}`, amount: round(base) }];

  let point = base;
  for (const s of surcharges) {
    const pct = clampPct(s.map?.[s.value]);
    if (pct > 0) {
      const amt = base * pct;
      point += amt;
      breakdown.push({ label: s.label, amount: round(amt) });
    }
  }

  return { ok: true, ...toRange(point, config), breakdown, base: round(base) };
}

export function estimateEpoxy(measurements, materialKey, config) {
  return estimateAreaTrade({
    measurements,
    materialKey,
    config,
    surcharges: [
      {
        label: `Surface prep (${measurements?.surfaceCondition || "fair"})`,
        map: config?.prepSurcharge,
        value: measurements?.surfaceCondition || "fair",
      },
    ],
  });
}

export function estimateParging(measurements, materialKey, config) {
  return estimateAreaTrade({
    measurements,
    materialKey,
    config,
    surcharges: [
      { label: `Access (${measurements?.access || "ground"})`, map: config?.accessSurcharge, value: measurements?.access || "ground" },
      { label: `Condition (${measurements?.condition || "new_or_sound"})`, map: config?.conditionSurcharge, value: measurements?.condition || "new_or_sound" },
    ],
  });
}

// Flooring: installed $/sqft by material, plus a subfloor-prep surcharge —
// structurally epoxy with a different word for the prep. Old-floor tear-out and
// levelling are the effort the "condition" captures.
export function estimateFlooring(measurements, materialKey, config) {
  return estimateAreaTrade({
    measurements,
    materialKey,
    config,
    surcharges: [
      { label: `Subfloor / removal (${measurements?.surfaceCondition || "fair"})`, map: config?.prepSurcharge, value: measurements?.surfaceCondition || "fair" },
    ],
  });
}

// Stairs: priced per TREAD by build complexity, plus railing by the linear ft.
// The old calculator hard-coded { standard: 110, moderate: 145, high: 180 } —
// one shop's numbers. Here each is a company-editable material rate (per tread),
// so nobody inherits a stranger's pricing (AGENTS.md: never invent a number the
// business is held to).
export function estimateStair(measurements, materialKey, config) {
  const treads = num(measurements?.treads);
  if (treads <= 0) return { ok: false, reason: "no_measurement" };
  const tiers = configList(config?.materials);
  const tier = tiers.find((m) => m.key === materialKey) || tiers[0];
  if (!tier || !(num(tier.ratePerTread) > 0)) {
    return { ok: false, reason: "material_not_configured" };
  }

  const base = treads * num(tier.ratePerTread);
  const breakdown = [{ label: `${treads} treads — ${tier.label}`, amount: round(base) }];

  const railingFt = Math.max(0, num(measurements?.railingFt));
  const railCost = railingFt * num(config?.railingPerFt);
  if (railCost > 0) breakdown.push({ label: `Railing (${railingFt} ft)`, amount: round(railCost) });

  const point = base + railCost;
  return { ok: true, ...toRange(point, config), breakdown };
}

// Painting: $/sqft of surface by paint grade, with two surcharges — interior vs
// exterior (height, weather, prep) and surface condition (patching, primer).
export function estimatePainting(measurements, materialKey, config) {
  return estimateAreaTrade({
    measurements,
    materialKey,
    config,
    surcharges: [
      { label: `Scope (${measurements?.scope || "interior"})`, map: config?.scopeSurcharge, value: measurements?.scope || "interior" },
      { label: `Surface (${measurements?.surfaceCondition || "good"})`, map: config?.conditionSurcharge, value: measurements?.surfaceCondition || "good" },
    ],
  });
}

// ── Lawn mowing (per-visit, banded by lot size) ──────────────────────────────
// Countertops are area-priced like epoxy, but the extras are ADDITIVE dollars
// (edge per ft, per cutout, backsplash per sqft), not percentage surcharges —
// so this doesn't reuse estimateAreaTrade's percent model. Material rate is the
// installed $/sqft; the homeowner picks the material and sees a range per one.
export function estimateCountertop(measurements, materialKey, config) {
  const sqft = num(measurements?.areaSqft);
  if (sqft <= 0) return { ok: false, reason: "no_measurement" };
  const materials = configList(config?.materials);
  const material = materials.find((m) => m.key === materialKey) || materials[0];
  if (!material || !(num(material.ratePerSqft) > 0)) {
    return { ok: false, reason: "material_not_configured" };
  }

  const edgeFt = Math.max(0, num(measurements?.edgeFt));
  const cutouts = Math.max(0, Math.floor(num(measurements?.cutouts)));
  const backsplashSqft = Math.max(0, num(measurements?.backsplashSqft));

  const matCost = sqft * num(material.ratePerSqft);
  const edgeCost = edgeFt * num(config?.edgePerFt);
  const cutoutCost = cutouts * num(config?.cutoutFee);
  const backsplashCost = backsplashSqft * num(config?.backsplashPerSqft);

  const breakdown = [{ label: `${sqft} sqft ${material.label}, installed`, amount: round(matCost) }];
  if (edgeCost > 0) breakdown.push({ label: `Upgraded edge (${edgeFt} ft)`, amount: round(edgeCost) });
  if (cutoutCost > 0) breakdown.push({ label: `Cutouts (${cutouts})`, amount: round(cutoutCost) });
  if (backsplashCost > 0) breakdown.push({ label: `Backsplash (${backsplashSqft} sqft)`, amount: round(backsplashCost) });

  const point = matCost + edgeCost + cutoutCost + backsplashCost;
  return { ok: true, ...toRange(point, config), breakdown };
}

export function estimateLawnMowing(measurements, config) {
  const areaSqft = num(measurements?.areaSqft);
  if (areaSqft <= 0) return { ok: false, reason: "no_measurement" };

  // configList already copies, so sorting here can't reorder the saved config.
  const tiers = configList(config?.tiers).sort((a, b) => num(a.maxSqft) - num(b.maxSqft));
  let perVisit = 0;
  const top = tiers[tiers.length - 1];
  const matched = tiers.find((t) => areaSqft <= num(t.maxSqft));
  if (matched) {
    perVisit = num(matched.pricePerVisit);
  } else if (top) {
    // Over the largest band — top price plus per-acre for the overage.
    const overAcres = (areaSqft - num(top.maxSqft)) / 43560;
    perVisit = num(top.pricePerVisit) + Math.ceil(overAcres) * num(config?.pricePerAcreOver);
  }
  if (perVisit <= 0) return { ok: false, reason: "material_not_configured" };

  const range = toRange(perVisit, config);
  return {
    ok: true,
    ...range,
    unit: "per visit",
    breakdown: [{ label: `Mowing ~${areaSqft} sqft of lawn`, amount: range.point }],
    assumptions: [`~${areaSqft} sqft mowed area, traced on the map`],
  };
}

// ── Cabinet refacing (unit-based, no measurement API) ────────────────────────
export function estimateCabinetRefacing(intake, materialKey, config) {
  const doors = Math.max(0, Math.floor(num(intake?.doorCount)));
  const drawers = Math.max(0, Math.floor(num(intake?.drawerCount)));
  const boxLf = Math.max(0, num(intake?.boxLinearFt));
  if (doors + drawers === 0) return { ok: false, reason: "no_measurement" };

  const mult = num(config?.materialMultiplier?.[materialKey], 1) || 1;
  const doorCost = doors * num(config?.perDoor) * mult;
  const drawerCost = drawers * num(config?.perDrawer) * mult;
  const boxCost = boxLf * num(config?.perBoxLinearFt) * mult;
  const point = doorCost + drawerCost + boxCost;

  const breakdown = [
    { label: `${doors} ${doors === 1 ? "door" : "doors"} refaced`, amount: round(doorCost) },
    { label: `${drawers} ${drawers === 1 ? "drawer front" : "drawer fronts"}`, amount: round(drawerCost) },
  ];
  if (boxCost > 0) breakdown.push({ label: `${boxLf} lf box veneer`, amount: round(boxCost) });

  return { ok: true, ...toRange(point, config), breakdown };
}

// Junk removal: no area, no material — a list of items (each with a volume) plus
// a job type and access surcharges. priceJunk owns the volume-discount maths and
// works in CENTS; this bridges it into the same dollar range model every other
// trade uses. The range band is honest here too — nobody has seen the pile.
function estimateJunk(measurements, config) {
  const priced = priceJunk(
    {
      jobType: measurements?.jobType,
      items: Array.isArray(measurements?.items) ? measurements.items : [],
      stairsFlights: measurements?.stairsFlights,
      disassembly: measurements?.disassembly,
      demolition: measurements?.demolition,
      longCarry: measurements?.longCarry,
      noElevator: measurements?.noElevator,
      outOfArea: measurements?.outOfArea,
      heavyLoads: measurements?.heavyLoads,
    },
    // Company's saved rates, defaults filled — never NaN, never divide-by-zero.
    normaliseJunkRates(config?.rates),
  );
  if (!(priced.total > 0)) return { ok: false, reason: "no_items" };

  const breakdown = priced.lines.map((l) => ({ label: l.label, amount: round(l.cents / 100) }));
  return {
    ok: true,
    ...toRange(priced.total / 100, config),
    breakdown,
    // Surfaced by the flow: what won't be taken (hazards) and what needs a
    // separate run (fridges/electronics). Never silently dropped.
    warnings: priced.warnings,
  };
}

// Which trades are wired for an instant estimate, and whether the measurement
// comes from an address (roof), a drawn polygon (lawn), typed intake, or a
// picked list of items (junk).
export const INSTANT_ESTIMATE_TRADES = {
  roofing: { measure: "roof_address", fn: estimateRoofing, hasMaterials: true },
  epoxy: { measure: "manual_area", fn: estimateEpoxy, hasMaterials: true },
  parging: { measure: "manual_area", fn: estimateParging, hasMaterials: true },
  lawn_mowing: { measure: "lawn_polygon", fn: estimateLawnMowing, hasMaterials: false },
  cabinet_refacing: { measure: "manual_units", fn: estimateCabinetRefacing, hasMaterials: true },
  countertop: { measure: "manual_area", fn: estimateCountertop, hasMaterials: true },
  flooring: { measure: "manual_area", fn: estimateFlooring, hasMaterials: true },
  painting: { measure: "manual_area", fn: estimatePainting, hasMaterials: true },
  stair: { measure: "stair_count", fn: estimateStair, hasMaterials: true },
  junk_removal: { measure: "item_picker", fn: estimateJunk, hasMaterials: false },
};

/**
 * The one entry point. Dispatches by trade, but ALWAYS requires config — a
 * trade with no saved company config returns { needsConfig: true } and is not
 * offered. This is the choke point that keeps an un-reviewed price off a public
 * page.
 */
export function computeInstantEstimate({ trade, measurements, materialKey, config }) {
  const spec = INSTANT_ESTIMATE_TRADES[trade];
  if (!spec) return { ok: false, reason: "unknown_trade" };
  if (!config || config.enabled === false) return { ok: false, needsConfig: true };

  if (spec.hasMaterials) return spec.fn(measurements, materialKey, config);
  return spec.fn(measurements, config);
}
