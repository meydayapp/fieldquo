// lib/purchasing/stock.js
//
// The stock level, SUMMED from movements. Never stored.
//
// ══ Why there is no `Material.quantityOnHand` ══════════════════════════════
//
// The schema comment on StockMovement says it, and it is worth repeating where
// the arithmetic lives: a stored quantity is a second opinion that drifts from
// the movements, and the one nobody looks at is the one that rots. The same
// call was made for the voice credit ledger and the sales commission ledger.
//
// The consequence people find surprising is the good part: a CORRECTION is a
// movement, not an edit. Somebody counting the van at the end of a week enters
// the difference as an `adjustment` — often negative — and the ledger keeps
// both the count that was wrong and the correction that fixed it. Editing a
// stored level would have destroyed the first, which is the only record that
// anything was ever off.
//
// ══ What this finally gives reorderThreshold ═══════════════════════════════
//
// `Material.reorderThreshold` has existed and been read by NOTHING since it
// was added — AGENTS.md failure class #1, sitting in the schema. A level below
// it is the one thing this feature exists to tell someone, so belowThreshold()
// is what makes that column real.
//
// Pure. No database — the caller loads the rows, this does the arithmetic, and
// scripts/check-purchasing.mjs runs it against hostile input.
import { toMilli, fromMilli, sumMilli, formatMilli } from "./quantity";

/**
 * The five kinds a movement may claim, and which direction each one MUST go.
 *
 * Signed quantities with no rules would let "used: +40" into the ledger, which
 * reads as a delivery and inflates the level of the one thing that has just
 * been consumed. So the sign is derived from the kind rather than trusted from
 * the caller — except for `adjustment`, which is the correction and is the ONE
 * kind allowed to go either way. That exception is the whole reason the column
 * is signed.
 */
export const MOVEMENT_KINDS = {
  received: { direction: 1, label: "Received" },
  returned: { direction: 1, label: "Returned to stock" },
  used: { direction: -1, label: "Used on a job" },
  wastage: { direction: -1, label: "Wastage" },
  adjustment: { direction: 0, label: "Correction after a count" },
};

export const MOVEMENT_KIND_KEYS = Object.keys(MOVEMENT_KINDS);

/**
 * Turn what a form posted into the signed quantity that goes in the ledger.
 *
 * @param {{kind: string, quantity: *}} input
 * @returns {{ok: true, kind, milli, quantity}} or {{ok: false, error}}
 */
export function normaliseMovement({ kind, quantity } = {}) {
  const key = String(kind || "").trim();
  const rule = MOVEMENT_KINDS[key];
  if (!rule) {
    return {
      ok: false,
      error: `"${key || "(none)"}" isn't a kind of stock movement. Use one of: ${MOVEMENT_KIND_KEYS.join(", ")}.`,
    };
  }

  const milli = toMilli(quantity);
  if (milli === null) {
    return { ok: false, error: "That quantity couldn't be read as a number." };
  }
  if (milli === 0) {
    // Zero is not a movement. Recording one would put a row in the ledger that
    // says nothing happened, which is indistinguishable from a bug that lost
    // the amount.
    return { ok: false, error: "A movement of zero isn't a movement — leave it out." };
  }

  if (rule.direction === 0) {
    // The correction. Whatever sign was typed is the statement being made.
    return { ok: true, kind: key, milli, quantity: fromMilli(milli) };
  }

  // Everything else is forced onto its own side. Someone typing "-4" into a
  // "used" box means four were used, not four appeared.
  const signed = Math.abs(milli) * rule.direction;
  return { ok: true, kind: key, milli: signed, quantity: fromMilli(signed) };
}

/**
 * The level for ONE material, from its movements.
 *
 * @param movements  rows with a `quantity` (Decimal, number or string)
 * @returns {{milli: number|null, quantity: number|null, movements: number}}
 *          milli is null when any movement could not be read — see sumMilli.
 */
export function stockLevel(movements) {
  const rows = Array.isArray(movements) ? movements : [];
  const milli = sumMilli(rows.map((m) => toMilli(m?.quantity)));
  return { milli, quantity: fromMilli(milli), movements: rows.length };
}

/**
 * Is this level below the material's reorder threshold?
 *
 * Returns null — not false — when there is no threshold. A material nobody has
 * set a threshold for has made no statement about when it runs low, and
 * answering "no" would be inventing one. Same for a level that could not be
 * summed.
 *
 * Strictly below, not below-or-equal: a threshold of 10 means "tell me when
 * there are fewer than 10 left", which is how everybody reads it aloud.
 */
export function belowThreshold(levelMilli, threshold) {
  if (levelMilli === null || levelMilli === undefined) return null;
  const t = toMilli(threshold);
  if (t === null) return null;
  return levelMilli < t;
}

/**
 * Every material's level, joined to its threshold.
 *
 * @param materials  Material rows: { id, name, unit, reorderThreshold }
 * @param movements  StockMovement rows: { materialId, quantity }
 * @returns one entry per material, in the order given.
 */
export function stockLevels(materials, movements) {
  const byMaterial = new Map();
  for (const m of Array.isArray(movements) ? movements : []) {
    const id = m?.materialId;
    if (!id) continue;
    if (!byMaterial.has(id)) byMaterial.set(id, []);
    byMaterial.get(id).push(m);
  }

  return (Array.isArray(materials) ? materials : []).map((mat) => {
    const rows = byMaterial.get(mat.id) || [];
    const level = stockLevel(rows);
    const low = belowThreshold(level.milli, mat.reorderThreshold);
    return {
      materialId: mat.id,
      name: mat.name,
      unit: mat.unit || null,
      movements: level.movements,
      // `null` travels all the way to the screen on purpose. A level nobody
      // could compute must not render as 0 — see AGENTS.md failure class #5.
      level: level.quantity,
      levelText: formatMilli(level.milli),
      threshold: fromMilli(toMilli(mat.reorderThreshold)),
      // null = no threshold set, so nothing to say. The UI prints nothing;
      // it does not print "in stock".
      belowThreshold: low,
    };
  });
}

/** Just the ones worth acting on — the point of the whole feature. */
export function lowStock(levels) {
  return (Array.isArray(levels) ? levels : []).filter((l) => l.belowThreshold === true);
}
