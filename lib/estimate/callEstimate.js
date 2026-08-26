// lib/estimate/callEstimate.js
//
// The bridge between a phone call and the instant estimator that already
// exists.
//
// ── There is no second estimator here ──────────────────────────────────────
//
// A homeowner using the public instant quote types a trade, a measurement, a
// material and their details; measureForTrade turns that into a measurement,
// priceOneMaterial prices it from the company's own saved config, and
// createEstimateDraft lands a draft Quote with needsReview = true — the only
// way an auto-estimated quote enters the queue at /app/estimate-reviews.
//
// A phone call carries the same inputs, spoken. So this file translates the
// call into that form and then calls that machinery. It contains no rate, no
// multiplier, no range and no arithmetic, and it must not grow any: a second
// way to price a job is a second way to price it WRONG, and the copy that rots
// is the one nobody looks at.
//
// ── The one thing it adds: refusing to price a form with a hole in it ──────
//
// measureForTrade is strict about the PRIMARY measurement — no square footage,
// no estimate — and deliberately lenient about the rest, because a homeowner
// who leaves the "railing feet" box empty means zero railing. That is the right
// reading of a form somebody filled in.
//
// It is the wrong reading of a phone call. A caller who says "I've got about
// thirty cabinet doors" and never mentions drawers has not said there are no
// drawer fronts; nobody asked. Letting that through would produce a confident
// figure missing an entire component, land it in the review queue looking
// complete, and price the job short.
//
// So this checks EVERY field the trade reads, not just the required one, and
// refuses when any of them went unmentioned. `missing` names them, and the
// contractor is shown the list and prices it by hand instead.

import { db } from "@/lib/db";
import {
  measureForTrade,
  priceOneMaterial,
} from "@/lib/estimate/instantQuoteServer";
import { INSTANT_ESTIMATE_TRADES } from "@/lib/estimate/instantEstimate";
import { sanitiseInstantConfig } from "@/lib/estimate/instantQuoteReadiness";
import { createEstimateDraft } from "@/lib/estimate/createEstimateQuote";

/**
 * ServiceCategory key → estimator trade key.
 *
 * The inverse of TRADE_CATEGORY_KEY in instantQuoteServer.js. Inverted rather
 * than re-typed so the two cannot drift; if a trade is added there it becomes
 * reachable from a call automatically, and if one is removed it stops being
 * reachable — neither needs an edit here.
 */
const CATEGORY_TO_TRADE = {
  roofing_service: "roofing",
  epoxy: "epoxy",
  parging: "parging",
  lawn_mowing: "lawn_mowing",
  cabinet_refacing: "cabinet_refacing",
  countertop: "countertop",
  flooring: "flooring",
  painting: "painting",
  stair: "stair",
  junk_removal: "junk_removal",
};

export function instantTradeFor(categoryKey) {
  return CATEGORY_TO_TRADE[categoryKey] || null;
}

/**
 * The other direction: which ServiceCategory an estimator trade files under.
 *
 * Derived from the same map rather than typed out again — see the note above on
 * why CATEGORY_TO_TRADE is itself an inversion. lib/voice/quoteQuestions.js
 * needs it to name a trade in the company's own language, and a second copy
 * would be the one that stopped matching the day a trade was renamed.
 */
export function categoryKeyForTrade(trade) {
  return Object.keys(CATEGORY_TO_TRADE).find((k) => CATEGORY_TO_TRADE[k] === trade) || null;
}

/** Why a call could not be turned into an instant estimate. */
export const ESTIMATE_BLOCKED = {
  NOT_INSTANT: "not_instant_trade",
  NOT_CONFIGURED: "not_configured",
  NEEDS_MAP: "needs_map",
  NEEDS_ITEM_LIST: "needs_item_list",
  MISSING_INPUT: "missing_input",
  NO_MATERIAL: "no_material",
  NOT_PRICEABLE: "not_priceable",
};

/**
 * What each measurement shape actually reads, and which of it is required.
 *
 * `reads` is the honest list — including the fields measureForTrade would
 * silently coerce to zero. See the header for why a phone call has to treat
 * those as unanswered rather than as answered "none".
 *
 * `from` maps the quote-builder intake key (what the model filled in, because
 * that is the vocabulary the catalogue is written in) onto the key the
 * measurement step reads. Identical for most of them; countertop is the one
 * that genuinely differs.
 *
 * Exported because the PHONE AGENT asks for exactly this list — see
 * lib/voice/quoteQuestions.js. One list read twice, so what the receptionist
 * collects and what the draft needs cannot drift apart; a second hand-written
 * question list would be the copy that rots.
 */
export const MEASURE_SHAPES = {
  manual_units: {
    // Either count alone is a real job — a caller with drawer fronts only is
    // not incomplete — but the OTHER one still has to have been discussed.
    requiredAny: ["doorCount", "drawerCount"],
    reads: ["doorCount", "drawerCount", "boxLinearFt"],
    from: {},
  },
  manual_area: {
    required: ["squareFootage"],
    reads: ["squareFootage"],
    from: { sinkCutouts: "cutouts" },
  },
  stair_count: {
    required: ["treads"],
    reads: ["treads", "railingFt"],
    from: {},
  },
  roof_address: {
    // The address is not intake — it comes from what the caller gave for the
    // job location.
    required: [],
    reads: ["tearOffLayers"],
    from: {},
    needsAddress: true,
  },
  // A polygon is drawn on a map and a stair count is not; neither of these can
  // come out of a conversation, and pretending otherwise would mean inventing
  // the number that decides the price.
  lawn_polygon: { blocked: ESTIMATE_BLOCKED.NEEDS_MAP },
  item_picker: { blocked: ESTIMATE_BLOCKED.NEEDS_ITEM_LIST },
};

/**
 * The instant-quote form, filled from one drafted scope group.
 *
 * Pure — no database, no network — so scripts/check-call-quote-draft.mjs can
 * execute it against calls where the caller said everything, something, and
 * nothing.
 *
 * @param group    a validated draft group { categoryKey, intakeValues, material }
 * @param address  the job address heard on the call, or null
 * @returns {{ ok:true, trade, intake, materialKey }}
 *        | {{ ok:false, reason, missing?:string[] }}
 */
export function formFromGroup(group, { address = null } = {}) {
  const trade = instantTradeFor(group?.categoryKey);
  if (!trade) return { ok: false, reason: ESTIMATE_BLOCKED.NOT_INSTANT };

  const spec = INSTANT_ESTIMATE_TRADES[trade];
  const shape = MEASURE_SHAPES[spec?.measure];
  if (!shape) return { ok: false, reason: ESTIMATE_BLOCKED.NOT_INSTANT };
  if (shape.blocked) return { ok: false, reason: shape.blocked, trade };

  const values = group?.intakeValues || {};
  const missing = [];

  if (shape.needsAddress && !address) missing.push("address");

  // Every field the trade reads has to have been MENTIONED. Not defaulted —
  // see the header. This is the whole reason this function exists rather than
  // handing the intake straight to measureForTrade.
  for (const key of shape.reads) {
    if (!(key in values)) missing.push(key);
  }

  // requiredAny is a genuinely different question: at least one of these has to
  // be a real number, or there is no job at all.
  if (shape.requiredAny && !shape.requiredAny.some((k) => Number(values[k]) > 0)) {
    for (const k of shape.requiredAny) if (!missing.includes(k)) missing.push(k);
  }
  for (const key of shape.required || []) {
    if (!(Number(values[key]) > 0) && !missing.includes(key)) missing.push(key);
  }

  if (missing.length) {
    return { ok: false, reason: ESTIMATE_BLOCKED.MISSING_INPUT, missing, trade };
  }

  // Which material is a pricing decision. A caller who never named one leaves it
  // open, and the contractor picks — the same way the homeowner picks on the
  // public form. Defaulting to the first configured option would be FieldQuo
  // choosing what a job is worth.
  if (spec.hasMaterials && !group?.material?.key) {
    return { ok: false, reason: ESTIMATE_BLOCKED.NO_MATERIAL, trade };
  }

  const intake = {};
  for (const key of shape.reads) {
    intake[shape.from[key] || key] = values[key];
  }

  return {
    ok: true,
    trade,
    intake,
    materialKey: group?.material?.key || null,
    ...(address ? { address } : {}),
  };
}

/**
 * The company's enabled instant trades, as material labels the model may pick
 * from — keyed by ServiceCategory key so it lines up with the catalogue.
 *
 * Labels only. The rates behind them never leave the server.
 */
export async function instantMaterialsByCategory(companyId) {
  const rows = await db.instantQuoteConfig.findMany({
    where: { companyId, enabled: true },
    select: { trade: true, config: true },
  });

  const out = {};
  for (const row of rows) {
    const spec = INSTANT_ESTIMATE_TRADES[row.trade];
    if (!spec?.hasMaterials) continue;
    const categoryKey = Object.keys(CATEGORY_TO_TRADE).find(
      (k) => CATEGORY_TO_TRADE[k] === row.trade,
    );
    if (!categoryKey) continue;
    const materials = sanitiseInstantConfig(row.config)?.materials || [];
    out[categoryKey] = materials
      .filter((m) => m && m.key)
      .map((m) => ({ key: m.key, label: m.label || m.key }));
  }
  return out;
}

/**
 * Run one filled form through the existing instant-quote path and land a draft.
 *
 * Everything from `measureForTrade` onward is untouched product code. The draft
 * arrives in `draft` status with needsReview = true, exactly as a web instant
 * quote does, and shows up in the same review queue — with estimateSource
 * saying it came off a phone call, so nobody has to wonder later.
 *
 * @returns {{ ok:true, quote }} | {{ ok:false, reason, detail? }}
 */
export async function draftEstimateFromForm({ company, form, contact, language }) {
  const measured = await measureForTrade(form.trade, {
    address: form.address,
    intake: form.intake,
  });
  if (!measured.ok) {
    return { ok: false, reason: ESTIMATE_BLOCKED.NOT_PRICEABLE, detail: measured.reason };
  }

  const priced = await priceOneMaterial({
    companyId: company.id,
    trade: form.trade,
    materialKey: form.materialKey,
    measurement: measured.measurement,
  });
  if (!priced.ok) {
    return {
      ok: false,
      reason:
        priced.reason === "not_configured"
          ? ESTIMATE_BLOCKED.NOT_CONFIGURED
          : ESTIMATE_BLOCKED.NOT_PRICEABLE,
      detail: priced.reason,
    };
  }

  const quote = await createEstimateDraft({
    company,
    trade: form.trade,
    categoryId: priced.categoryId,
    contact,
    measurement: measured.measurement,
    materialKey: form.materialKey,
    estimate: priced.estimate,
    // Not priced.source. The reviewer's first question about an unexpected
    // draft is where it came from, and "measured from satellite" answers a
    // different one — the satellite measured the roof, but a person on the
    // phone is what produced this row. The measurement's own provenance is
    // still in estimateData.
    source: "phone_call",
    address: form.address || null,
    language,
  });

  return { ok: true, quote };
}
