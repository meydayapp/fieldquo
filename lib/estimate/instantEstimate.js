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
  const p = Math.max(num(point), num(minCharge));
  const band = clampPct(rangeBandPct);
  return {
    low: round(p * (1 - band)),
    point: round(p),
    high: round(p * (1 + band)),
  };
}

// ── Roofing ─────────────────────────────────────────────────────────────────
export function estimateRoofing(measurements, materialKey, config) {
  const squares = num(measurements?.squares);
  if (squares <= 0) return { ok: false, reason: "no_measurement" };
  const material = (config?.materials || []).find((m) => m.key === materialKey);
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
  const material = (config?.materials || []).find((m) => m.key === materialKey) || config?.materials?.[0];
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

// ── Lawn mowing (per-visit, banded by lot size) ──────────────────────────────
export function estimateLawnMowing(measurements, config) {
  const areaSqft = num(measurements?.areaSqft);
  if (areaSqft <= 0) return { ok: false, reason: "no_measurement" };

  const tiers = [...(config?.tiers || [])].sort((a, b) => num(a.maxSqft) - num(b.maxSqft));
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
    { label: `${doors} doors refaced`, amount: round(doorCost) },
    { label: `${drawers} drawer fronts`, amount: round(drawerCost) },
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
