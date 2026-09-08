// lib/costing/materialCalibration.js
//
// "The recipe said one roll of tape per 8 doors; this job used one per 6.
// Update the calculation for future quotes?"
//
// Pure. No I/O, no React. Takes a finished job's materials (what the estimate
// said, what was actually used), the estimate groups that predicted them
// (each line's `basis` — the units of work and the rate that divided them),
// and the rates the company uses TODAY, and returns one comparison per line
// with a suggested rate where there is one.
//
// ══ What this never does ═════════════════════════════════════════════════════
//
//   * It never applies anything. A suggested divisor written to Settings
//     without a person confirming it is exactly as invented as a hard-coded
//     default with an extra click pretending otherwise — the same rule
//     lib/costing/assetLifeSuggestions.js keeps. The close-out renders a
//     button per line; the button writes through the existing settings route.
//
//   * It never fills in a missing actual. A line nobody recorded a used
//     quantity for comes back with `reason: "no_actual"` and no suggestion.
//     "We didn't count" and "we used exactly the estimate" are different
//     facts, and only the second says anything about the recipe.
//
//   * It never offers a button for a rate that has nowhere to go. `canApply`
//     is true only when the line's basis names a path a company can save
//     today — a MaterialRecipeSetting key sanitiseRecipeOverrides accepts, or
//     a PRICE_BOOK_FIELDS path sanitiseRates keeps. Roofing's bundles-per-
//     square is a real constant with no override path yet, so its line says
//     "not adjustable from here" rather than drawing a dead button.
//
// ══ One job is one data point ════════════════════════════════════════════════
//
// The suggestion is the rate that would have predicted THIS job exactly. It
// is not an average over the company's history — that would need many
// reviewed jobs to mean anything, and a first slice that quietly averaged
// three would present a guess as a trend. One job, shown as one job, with the
// delta beside it so the person can decide whether the job was typical.
//
// Quantities are whole units bought, and the recipe rounds UP, so a job that
// used 4 gallons where the estimate said 3 may have used anywhere from 3.01
// to 4.00 of them. The suggestion is computed from the whole 4, and the
// close-out says so.

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round = (v, places) => {
  const f = 10 ** places;
  const r = Math.round(num(v) * f) / f;
  return Number.isFinite(r) ? r : 0;
};

/** Why a line has no suggestion, or cannot be applied. Keys, not sentences. */
export const CALIBRATION_REASONS = {
  NO_ACTUAL: "no_actual",
  NO_BASIS: "no_basis",
  NOT_OVERRIDABLE: "not_overridable",
  NO_WORK: "no_work",
  NO_RATE: "no_rate",
  WITHIN_ALLOWANCE: "within_allowance",
  MATCHES: "matches",
  PERMISSION: "permission",
};

/** Read a dotted path — the same shape readField in tradePriceBooks uses. */
export function readPath(obj, path) {
  return String(path || "")
    .split(".")
    .reduce((node, part) => (node == null ? undefined : node[part]), obj);
}

/**
 * A copy of `obj` with one dotted path set. Prototype keys are refused —
 * the object this builds is POSTed straight into a settings row.
 */
export function withPathSet(obj, path, value) {
  const parts = String(path || "").split(".");
  if (parts.some((p) => p === "__proto__" || p === "constructor" || p === "prototype"))
    return obj && typeof obj === "object" ? { ...obj } : {};
  const root = obj && typeof obj === "object" && !Array.isArray(obj) ? { ...obj } : {};
  let node = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    const next = node[part];
    node[part] = next && typeof next === "object" && !Array.isArray(next) ? { ...next } : {};
    node = node[part];
  }
  node[parts[parts.length - 1]] = value;
  return root;
}

/**
 * The whole-number divisor that reproduces `actual` from `units` under the
 * recipe's own arithmetic, qty = offset + ceil(units / p).
 *
 * Nearest whole number to units/actual first; if the ceiling does not land
 * on the actual (it usually does), the nearest neighbour that does. A
 * suggestion the recipe would then turn into a different count than the one
 * the job recorded is a control that appears to work and doesn't.
 */
function wholeDivisor(units, actual) {
  const target = units / actual;
  const start = Math.max(1, Math.round(target));
  const reproduces = (p) => Math.ceil(units / p) === actual;
  if (reproduces(start)) return start;
  for (let d = 1; d <= 5; d += 1) {
    if (start - d >= 1 && reproduces(start - d)) return start - d;
    if (reproduces(start + d)) return start + d;
  }
  return start;
}

/**
 * Find the estimate line a job material came from.
 *
 * By materialKey when both sides have one; by name and unit otherwise —
 * which is how rows written before materialKey existed, and estimates frozen
 * before it, still find each other.
 */
function estimateLineFor(material, group) {
  const lines = Array.isArray(group?.materials) ? group.materials : [];
  if (material.materialKey) {
    const hit = lines.find((l) => l && l.materialKey === material.materialKey);
    if (hit) return hit;
  }
  return (
    lines.find(
      (l) => l && l.name === material.name && (l.unit || "each") === (material.unit || "each"),
    ) || null
  );
}

/**
 * @param {object} p
 * @param {Array}  p.materials   JobMaterial rows: { materialKey, categoryKey,
 *                               name, unit, qty, actualQty, addedByHand }
 * @param {Array}  p.groups      estimate groups: [{ categoryKey, label,
 *                               materials: [{ materialKey, name, unit, qty,
 *                               basis }] }] — QuoteCosting.groups when the
 *                               quote was costed, else re-derived by the caller
 * @param {object} p.currentRates { recipes: { [categoryKey]: resolvedRecipe },
 *                               books: { [categoryKey]: resolvedBook } } — what
 *                               the company uses today, with its overrides
 *                               merged. The suggestion is measured against
 *                               these, not against the rate frozen with the
 *                               estimate: the question is whether to change
 *                               the calculation as it stands NOW.
 * @returns {Array} one entry per derived job material (hand-added lines have
 *          no prediction behind them and are left out)
 */
export function materialCalibration({ materials = [], groups = [], currentRates = {} } = {}) {
  const out = [];
  const groupsByKey = new Map();
  for (const g of Array.isArray(groups) ? groups : []) {
    if (!g || !g.categoryKey) continue;
    if (!groupsByKey.has(g.categoryKey)) groupsByKey.set(g.categoryKey, []);
    groupsByKey.get(g.categoryKey).push(g);
  }

  for (const m of Array.isArray(materials) ? materials : []) {
    if (!m || m.addedByHand) continue;
    const base = {
      materialId: m.id ?? null,
      materialKey: m.materialKey ?? null,
      categoryKey: m.categoryKey ?? null,
      name: String(m.name ?? ""),
      unit: m.unit || "each",
      estimatedQty: m.qty == null ? null : num(m.qty),
      actualQty: m.actualQty == null ? null : num(m.actualQty),
      unitsOfWork: null,
      unitLabel: null,
      estimatedPerUnit: null,
      actualPerUnit: null,
      currentRate: null,
      suggestedRate: null,
      deltaPct: null,
      canApply: false,
      reason: null,
    };

    // Which estimate line predicted this row. Two groups of the same trade on
    // one quote is rare; the first that has the line wins.
    let line = null;
    for (const g of groupsByKey.get(m.categoryKey) || []) {
      line = estimateLineFor(m, g);
      if (line) break;
    }
    if (!line) {
      out.push({ ...base, reason: CALIBRATION_REASONS.NO_BASIS });
      continue;
    }

    const basis = line.basis && typeof line.basis === "object" ? line.basis : null;
    if (!basis || !basis.path || !basis.store) {
      // A real line from a constant with no settings path (roofing packaging,
      // sandpaper priced per piece). The comparison of quantities is still
      // shown; there is just no rate to move.
      out.push({
        ...base,
        unitsOfWork: basis ? num(basis.units) : null,
        unitLabel: basis?.unitLabel ?? null,
        reason: CALIBRATION_REASONS.NOT_OVERRIDABLE,
      });
      continue;
    }

    const units = num(basis.units);
    const store = basis.store === "book" ? "book" : "recipe";
    const source =
      store === "book"
        ? currentRates?.books?.[m.categoryKey]
        : currentRates?.recipes?.[m.categoryKey];
    const currentValue = num(readPath(source, basis.path));
    const currentRate = {
      store,
      path: basis.path,
      value: currentValue > 0 ? currentValue : null,
      label: basis.rateLabel ?? null,
      // What the estimate itself was computed with, kept so the close-out can
      // say "the estimate used 350; you have since changed it to 320".
      atEstimate: num(basis.rate) > 0 ? num(basis.rate) : null,
    };
    const withBasis = {
      ...base,
      unitsOfWork: units,
      unitLabel: basis.unitLabel ?? null,
      currentRate,
    };

    if (base.actualQty == null) {
      out.push({ ...withBasis, reason: CALIBRATION_REASONS.NO_ACTUAL });
      continue;
    }
    if (units <= 0) {
      out.push({ ...withBasis, reason: CALIBRATION_REASONS.NO_WORK });
      continue;
    }

    const estimatedPerUnit = base.estimatedQty == null ? null : round(base.estimatedQty / units, 4);
    const actualPerUnit = round(base.actualQty / units, 4);
    const perUnit = { estimatedPerUnit, actualPerUnit };

    if (currentRate.value == null) {
      out.push({ ...withBasis, ...perUnit, reason: CALIBRATION_REASONS.NO_RATE });
      continue;
    }
    if (base.estimatedQty != null && base.actualQty === base.estimatedQty) {
      out.push({ ...withBasis, ...perUnit, reason: CALIBRATION_REASONS.MATCHES });
      continue;
    }

    let suggested = null;
    if (basis.kind === "multiplier") {
      // qty = ceil(units × rate) → rate = qty / units.
      suggested = basis.whole ? Math.max(1, Math.round(base.actualQty / units)) : round(base.actualQty / units, 3);
    } else {
      // qty = offset + ceil(units / rate) → rate = units / (qty − offset).
      const effective = base.actualQty - num(basis.offset);
      if (effective <= 0) {
        // Used no more than the per-job allowance: the per-piece rate did not
        // enter into it, and this job cannot say what it should be.
        out.push({ ...withBasis, ...perUnit, reason: CALIBRATION_REASONS.WITHIN_ALLOWANCE });
        continue;
      }
      suggested = basis.whole
        ? wholeDivisor(units, Number.isInteger(effective) ? effective : Math.ceil(effective))
        : round(units / effective, 3);
    }

    if (!Number.isFinite(suggested) || suggested <= 0) {
      out.push({ ...withBasis, ...perUnit, reason: CALIBRATION_REASONS.NO_RATE });
      continue;
    }
    if (suggested === currentRate.value) {
      // The rounding landed back on the rate the company already has — the
      // job disagreed with the estimate by less than one whole unit's worth.
      out.push({ ...withBasis, ...perUnit, suggestedRate: suggested, deltaPct: 0, reason: CALIBRATION_REASONS.MATCHES });
      continue;
    }

    out.push({
      ...withBasis,
      ...perUnit,
      suggestedRate: suggested,
      deltaPct: round(((suggested - currentRate.value) / currentRate.value) * 100, 1),
      canApply: true,
      reason: null,
    });
  }
  return out;
}

/**
 * The estimate groups a job's calibration should be measured against.
 *
 * Frozen (QuoteCosting.groups) when the quote was costed AND the freeze
 * carries a basis on at least one line — a row written before `basis`
 * existed has quantities and no ratios, and re-deriving is the only way to
 * get the denominator back. Otherwise the caller's fresh derivation. The
 * caller passes both; this decides, so the route and the check agree.
 */
export function pickEstimateGroups({ frozen, derived }) {
  const f = Array.isArray(frozen) ? frozen : [];
  const hasBasis = f.some((g) =>
    (Array.isArray(g?.materials) ? g.materials : []).some((m) => m && m.basis && m.basis.path),
  );
  if (hasBasis) return { groups: f, source: "frozen" };
  return { groups: Array.isArray(derived) ? derived : [], source: "derived" };
}
