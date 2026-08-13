// lib/estimate/instantQuoteReadiness.js
//
// Two things that must never disagree:
//
//   1. what the public /api/instant-quote/*/measure route can actually price,
//   2. what the settings screen lets an owner switch on.
//
// They disagreed, and it shipped. Cabinet Refacing is declared `hasMaterials`
// (it owns a materialMultiplier map) but prices per DOOR — it has no
// `materials[]` rows, and the settings screen deliberately renders per-door /
// per-drawer fields instead of a materials editor. The public pricer didn't
// know that: it iterated an empty materials array, found nothing, and told the
// homeowner "This service isn't taking instant quotes right now" for a trade
// the owner had correctly enabled and priced. Two implementations of "is this
// priceable?", and the one nobody looked at was the one in front of a stranger.
//
// So the option builder the public route runs lives HERE, pure, and readiness
// dry-runs it against probe measurements. "Ready" therefore means *the shipped
// pricing code produced a number*, not *a second copy of the rules said it
// would*. It also lives here rather than in instantQuoteServer.js so that
// checking readiness never drags the database in.
//
// Nothing in this file is client-facing. The messages are for the CONTRACTOR,
// on their own settings screen — a homeowner is never shown why a company's
// rate card is incomplete (non-negotiable #4).

import {
  computeInstantEstimate,
  INSTANT_ESTIMATE_TRADES,
} from "@/lib/estimate/instantEstimate";
import { JUNK_ITEMS } from "@/lib/junk/pricing";

/**
 * The boundary between "what was saved from a browser" and the price brain.
 *
 * InstantQuoteConfig.config is free-form JSON written straight from the
 * settings form — nothing validates its shape on the way in. The estimator
 * reasonably assumes `materials` is a list of objects and `tiers` is a list,
 * and throws when it isn't: a saved `materials: [null]` turns the PUBLIC
 * measure and request routes into 500s. Normalising here rather than in
 * instantEstimate.js keeps the fix at the edge the untrusted value crosses.
 *
 * Only shape is corrected, never value — a row that survives this prices
 * exactly as it did before.
 */
export function sanitiseInstantConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) return null;
  const out = { ...config };
  if ("materials" in out) {
    out.materials = Array.isArray(out.materials)
      ? out.materials.filter((m) => m && typeof m === "object")
      : [];
  }
  if ("tiers" in out) {
    out.tiers = Array.isArray(out.tiers)
      ? out.tiers.filter((t) => t && typeof t === "object")
      : [];
  }
  return out;
}

/**
 * Every priceable option for one measurement — the exact list the public
 * /measure route returns, minus the visibility gate. Pure.
 *
 * @returns {{ok:true, options:Array}} | {{ok:false, reason:string}}
 */
export function priceOptionsFor({ trade, config: rawConfig, measurement }) {
  const spec = INSTANT_ESTIMATE_TRADES[trade];
  if (!spec) return { ok: false, reason: "unknown_trade" };
  const config = sanitiseInstantConfig(rawConfig);
  if (!config) return { ok: false, reason: "not_configured" };

  const materials = Array.isArray(config.materials) ? config.materials : [];

  // A trade prices per material ROW only when it has rows. `hasMaterials` is
  // not that question: cabinet_refacing sets it for its multiplier map and has
  // no rows at all. "Declares materials, has none" is the single-option case —
  // the homeowner picks nothing and gets one range — not a failure.
  if (!spec.hasMaterials || materials.length === 0) {
    const est = computeInstantEstimate({ trade, measurements: measurement, config });
    if (!est.ok) return { ok: false, reason: est.reason || "no_estimate" };
    return {
      ok: true,
      options: [
        {
          materialKey: null,
          label: null,
          low: est.low,
          high: est.high,
          point: est.point,
          unit: est.unit || null,
        },
      ],
    };
  }

  const options = [];
  const unpriced = [];
  for (const m of materials) {
    const est = computeInstantEstimate({ trade, measurements: measurement, materialKey: m.key, config });
    if (est.ok) {
      options.push({ materialKey: m.key, label: m.label, low: est.low, high: est.high, point: est.point, unit: est.unit || null });
    } else {
      unpriced.push(m);
    }
  }
  if (!options.length) return { ok: false, reason: "no_priceable_materials", unpriced };
  return { ok: true, options, unpriced };
}

/**
 * Which rate field a trade's material rows carry. Roofing sells by the square,
 * stairs by the tread, everything else by the sqft. One source of truth so the
 * "is it priceable?" check and the settings editor can't disagree — it used to
 * live in the settings route, where nothing else could reach it.
 */
export function materialRateKey(trade) {
  if (trade === "roofing") return "ratePerSquare";
  if (trade === "stair") return "ratePerTread";
  return "ratePerSqft";
}

// ── Prices the owner must have STATED ───────────────────────────────────────
//
// Probing alone isn't enough for two trades, because their estimators pad an
// unstated price with something: cabinet refacing floors at `minCharge`, so a
// blank per-door price still yields a range; junk's normaliseJunkRates fills
// missing rates from FieldQuo's reference card, so a blanked load table still
// prices — off numbers the company never chose. Both are the "absence of a
// statement is not a statement" trap in AGENTS.md. Checked explicitly here so
// readiness is strictly stronger than the probes.
function unstatedPriceCode(trade, config) {
  if (trade === "cabinet_refacing" && !(Number(config?.perDoor) > 0)) return "no_per_door";
  if (trade === "junk_removal") {
    const r = config?.rates || {};
    if (!(Number(r?.loadCents?.full) > 0) && !(Number(r?.minimumCents) > 0)) return "no_load_price";
  }
  return null;
}

// A plausible job for each trade, used to dry-run the real estimator. These are
// PROBES, never published — nothing here reaches a homeowner or a document.
function probesFor(trade, config) {
  switch (trade) {
    case "roofing":
      return [{ label: "a 20-square roof", m: { squares: 20, areaSqft: 2000, steepness: "standard", tearOffLayers: 0 } }];
    case "epoxy":
    case "parging":
    case "flooring":
    case "painting":
      return [{ label: "a 500 sq ft job", m: { areaSqft: 500 } }];
    case "countertop":
      return [{ label: "a 40 sq ft countertop", m: { areaSqft: 40 } }];
    case "cabinet_refacing":
      return [{ label: "10 doors and 4 drawers", m: { doorCount: 10, drawerCount: 4 } }];
    case "stair":
      return [{ label: "a 13-step staircase", m: { treads: 13 } }];
    case "junk_removal": {
      const first = JUNK_ITEMS.find((i) => !i.notAccepted);
      return [{ label: "a single item", m: { items: [{ key: first?.key, quantity: 1 }], jobType: "single_items" } }];
    }
    case "lawn_mowing": {
      // Every band gets probed, not just one. Enable-time used to accept "at
      // least one tier priced", which let a blank first band publish a service
      // that silently refused every small lawn.
      const tiers = Array.isArray(config?.tiers) ? config.tiers : [];
      const probes = [{ label: "a very small lawn", m: { areaSqft: 1 } }];
      for (const t of tiers) {
        const max = Number(t?.maxSqft);
        if (Number.isFinite(max) && max > 0) {
          probes.push({ label: `a lawn up to ${max.toLocaleString()} sq ft`, m: { areaSqft: max } });
        }
      }
      const top = tiers.length ? Number(tiers[tiers.length - 1]?.maxSqft) : 0;
      if (Number.isFinite(top) && top > 0) {
        probes.push({ label: "a lawn over the largest band", m: { areaSqft: top + 43560 } });
      }
      return probes;
    }
    default:
      return [];
  }
}

// What the contractor should DO about it, per trade. Names the field on their
// own screen — "set a sell rate" is useless if you can't see which box.
function fixFor(trade) {
  switch (trade) {
    case "cabinet_refacing":
      return "Set a per-door price.";
    case "junk_removal":
      return "Set a full-truck price or a minimum charge in the load rate card.";
    case "lawn_mowing":
      return "Give every lot-size band a per-visit price, or remove the empty bands.";
    case "roofing":
      return "Set a $ / square on at least one material.";
    case "stair":
      return "Set a $ / tread on at least one build.";
    default:
      return "Set a $ / sqft on at least one material.";
  }
}

/**
 * Can a homeowner get a number out of this trade with these settings?
 *
 * Pure. Runs the shipped estimator over probe jobs, so a green result is a
 * promise the public route can keep.
 *
 * @returns {{ok:boolean, code:string|null, message:string|null, fix:string|null,
 *            warnings:Array<{code:string, message:string}>}}
 */
export function instantQuoteReadiness(trade, rawConfig) {
  const spec = INSTANT_ESTIMATE_TRADES[trade];
  if (!spec) {
    return { ok: false, code: "unknown_trade", message: "This trade isn't wired for instant estimates.", fix: null, warnings: [] };
  }
  const config = sanitiseInstantConfig(rawConfig);
  if (!config) {
    return { ok: false, code: "no_config", message: "There's no pricing saved for this service yet.", fix: fixFor(trade), warnings: [] };
  }

  const unstated = unstatedPriceCode(trade, config);
  if (unstated) {
    return {
      ok: false,
      code: unstated,
      message: "This service has no price of your own saved yet.",
      fix: fixFor(trade),
      warnings: [],
    };
  }

  const probes = probesFor(trade, config);
  if (!probes.length) {
    return { ok: false, code: "no_probe", message: "This trade can't be checked automatically.", fix: null, warnings: [] };
  }

  const warnings = [];
  for (const probe of probes) {
    const priced = priceOptionsFor({ trade, config, measurement: probe.m });
    if (!priced.ok) {
      return {
        ok: false,
        code: priced.reason,
        message: `A homeowner asking about ${probe.label} gets no price.`,
        fix: fixFor(trade),
        warnings,
      };
    }
  }

  // Not fatal, but silent: a material row with no rate is quietly dropped from
  // the list the homeowner sees. The owner typed a name and expects it there.
  const materials = Array.isArray(config.materials) ? config.materials : [];
  if (spec.hasMaterials && materials.length) {
    const key = materialRateKey(trade);
    for (const m of materials) {
      if (!(Number(m?.[key]) > 0)) {
        warnings.push({
          code: "material_unpriced",
          message: `“${m?.label || "Unnamed material"}” has no rate, so homeowners won't be offered it.`,
        });
      }
    }
  }

  return { ok: true, code: null, message: null, fix: null, warnings };
}
