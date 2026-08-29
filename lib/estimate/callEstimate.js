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
// Which estimator can price which category — declared once, in the file the
// seeder itself reads, so a call and a public instant quote cannot disagree
// about what a trade is.
import {
  instantTradeForCategory,
  categoryKeysForInstantTrade,
  tradeKeys,
} from "@/lib/trades/catalog";
// The catalogue's own intake questions, which is the vocabulary a model filling
// in a call actually has. See vocabularyGap().
import { INTAKE_FIELDS } from "@/app/data/quoteIntakeFields";
import { sanitiseInstantConfig } from "@/lib/estimate/instantQuoteReadiness";
import { createEstimateDraft } from "@/lib/estimate/createEstimateQuote";

/**
 * ServiceCategory key → estimator trade key, for a PHONE CALL.
 *
 * ── Not a map any more, and that is the fix ─────────────────────────────────
 *
 * There was a hand-typed map here, under a comment claiming it was the inverse
 * of the estimator's own category table "so the two cannot drift". It had
 * drifted three ways at once: `cabinet_refinishing` was simply absent, so a
 * cabinet painter's flagship trade returned not_instant_trade and no call he
 * ever took produced a draft; and `painting` and `stair` named ServiceCategory
 * keys the catalogue has never contained, so both were unreachable with nothing
 * failing anywhere.
 *
 * lib/trades/catalog.js now declares, per category, which estimator can price
 * it — the same declaration prisma/seed.js seeds from. So that half is read,
 * never re-typed.
 *
 * ── But "an estimator exists" is not "a call can fill its form in" ─────────
 *
 * The estimator's vocabulary and the catalogue's intake questions are two
 * different vocabularies, and for two trades they do not meet:
 *
 *   the `painting` estimator prices a stated surface `squareFootage`, while
 *   INTAKE_FIELDS.interior_painting asks for room dimensions and
 *   INTAKE_FIELDS.exterior_painting for wall length × height. Deriving one from
 *   the other is paint-takeoff arithmetic, and lib/pricing/paintTakeoff.js
 *   already owns it against a different rate card;
 *
 *   the `stair` estimator prices per `treads` and per `railingFt`, while
 *   INTAKE_FIELDS.stairs asks `stepCount` and has no railing question at all.
 *
 * A model filling in that catalogue's questions can never produce those keys,
 * so mapping them anyway would give a mapping that looks alive and refuses on
 * every single call — the dead control AGENTS.md is about, wearing a green
 * light. The gate below computes that rather than trusting anyone to remember
 * it, and the refusal is NAMED (`measure_mismatch`) instead of silent, so the
 * receptionist panel can tell the estimator to price it in the builder and say
 * why. Bridging either one is a product decision about which rate card prices a
 * painting call, not a line in a table.
 */
function vocabularyGap(categoryKey, shape) {
  const asked = new Set((INTAKE_FIELDS[categoryKey] || []).map((f) => f?.key));
  return (shape?.reads || []).filter((k) => !asked.has(k));
}

/**
 * The estimator a call about this category can reach, or null.
 *
 * Null covers three different things — no estimator at all, one that cannot
 * come out of a conversation (a polygon on a map), and one whose form this
 * category's questions cannot fill in. formFromGroup distinguishes them for the
 * screen; callers who only want "yes or no" get the one answer.
 */
export function instantTradeFor(categoryKey) {
  const trade = instantTradeForCategory(categoryKey);
  if (!trade) return null;
  const shape = measureShapeFor(trade);
  if (!shape || shape.blocked) return null;
  return vocabularyGap(categoryKey, shape).length ? null : trade;
}

/**
 * The other direction: which ServiceCategory a CALL-QUOTABLE trade files under.
 *
 * lib/voice/quoteQuestions.js uses it to name a trade in the company's own
 * language; null there just means the trade is named from TRADE_LABELS instead.
 * Note what this is NOT: the authority on where a PUBLIC instant quote files
 * its draft. That is primaryCategoryForInstantTrade() in the trade catalogue,
 * which also answers for the trades no call can reach.
 */
export function categoryKeyForTrade(trade) {
  return callQuotableCategoryKeys().find((k) => instantTradeFor(k) === trade) || null;
}

/** Every ServiceCategory key a call can be turned into an instant estimate for. */
export function callQuotableCategoryKeys() {
  return tradeKeys().filter((key) => instantTradeFor(key));
}

/**
 * Categories with an estimator a call cannot feed, and the questions that stop
 * it. Empty when the two vocabularies meet everywhere.
 *
 * Exists so the gap is REPORTABLE rather than merely absent — a check asserts
 * it holds only the two known product decisions, so a third one appearing is a
 * build failure rather than a trade that quietly stopped being quotable.
 */
export function callQuoteVocabularyGaps() {
  const gaps = [];
  for (const key of tradeKeys()) {
    const trade = instantTradeForCategory(key);
    if (!trade) continue;
    const shape = measureShapeFor(trade);
    if (!shape || shape.blocked) continue;
    const missing = vocabularyGap(key, shape);
    if (missing.length) gaps.push({ categoryKey: key, trade, missingQuestions: missing });
  }
  return gaps;
}

/** Why a call could not be turned into an instant estimate. */
export const ESTIMATE_BLOCKED = {
  NOT_INSTANT: "not_instant_trade",
  NOT_CONFIGURED: "not_configured",
  NEEDS_MAP: "needs_map",
  NEEDS_ITEM_LIST: "needs_item_list",
  MISSING_INPUT: "missing_input",
  // An estimator exists for this trade, and it asks for a measurement this
  // quote type's own questions never collect. Named rather than folded into
  // NOT_INSTANT, because "we don't price this automatically" and "we do, but
  // not from a phone call about THIS trade" send the estimator to two
  // different places.
  MEASURE_MISMATCH: "measure_mismatch",
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
 * Where one TRADE reads something different from its measurement shape.
 *
 * Two trades share `manual_units` and do not read the same fields. Refacing
 * veneers the exposed cabinet-box sides and prices that by the linear foot;
 * refinishing sprays those box exteriors as part of the base scope and has no
 * per-foot rate for them at all. Left on the shared shape, `boxLinearFt` would
 * be a field the caller has to have been asked about before a refinishing job
 * could be priced — and the receptionist would ask "how much cabinet box needs
 * covering" on a call about repainting a kitchen.
 *
 * Keyed by trade and consulted FIRST, so the shapes above stay the answer for
 * everything that has no reason to differ.
 *
 * `carries` is the third kind of field, and it is not `reads`: something the
 * draft should record when the caller volunteered it and must never be required
 * because nothing prices off it. The door material is the case — see
 * estimateCabinetRefinishing on why it changes the wording and the cost model
 * but not this company's sell rate.
 *
 * `addOns: true` means this trade's estimator PRICES the upgrades the caller
 * asked for. It is false everywhere else, and that difference is load-bearing:
 * reviewNotesFromDraft tells the estimator "the automatic price does not
 * include upgrades" for the trades where that is true, and must not say it for
 * the trade where the hinges are already in the total.
 */
export const TRADE_SHAPES = {
  cabinet_refinishing: {
    requiredAny: ["doorCount", "drawerCount"],
    reads: ["doorCount", "drawerCount"],
    carries: ["woodSpecies"],
    addOns: true,
    from: {},
  },
};

/**
 * The shape one trade's form has to satisfy, or null.
 *
 * The single resolver, because two callers ask this question — this file, to
 * decide whether a call can be priced, and lib/voice/quoteQuestions.js, to
 * decide what the receptionist asks for. They have to agree or the agent
 * collects one set of answers and the draft needs another.
 */
export function measureShapeFor(trade) {
  if (Object.prototype.hasOwnProperty.call(TRADE_SHAPES, trade)) {
    return TRADE_SHAPES[trade];
  }
  const spec = INSTANT_ESTIMATE_TRADES[trade];
  const shape = spec && MEASURE_SHAPES[spec.measure];
  return shape || null;
}

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
  // Read from the trade catalogue, then narrowed by the three separate reasons
  // a call cannot reach an estimator that exists. Each returns its own name,
  // because they send the estimator to three different places: nothing is
  // wired, this one needs a map or an item list, or this quote type's questions
  // cannot fill this estimator's form in.
  const trade = instantTradeForCategory(group?.categoryKey);
  if (!trade) return { ok: false, reason: ESTIMATE_BLOCKED.NOT_INSTANT };

  const spec = INSTANT_ESTIMATE_TRADES[trade];
  const shape = measureShapeFor(trade);
  if (!spec || !shape) return { ok: false, reason: ESTIMATE_BLOCKED.NOT_INSTANT };
  if (shape.blocked) return { ok: false, reason: shape.blocked, trade };

  const missingQuestions = vocabularyGap(group?.categoryKey, shape);
  if (missingQuestions.length) {
    return {
      ok: false,
      reason: ESTIMATE_BLOCKED.MEASURE_MISMATCH,
      trade,
      missingQuestions,
    };
  }

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
  // Volunteered, not required — omitted entirely when the caller never said it,
  // so nothing downstream can read an absent species as a stated one.
  for (const key of shape.carries || []) {
    if (key in values) intake[shape.from[key] || key] = values[key];
  }

  // The upgrades the caller asked for, as KEYS. Only for the trades whose
  // estimator prices them; everywhere else they stay off the form and the
  // review note says the automatic total does not carry them.
  //
  // Keys only, and no quantity — validateCallDraft already refuses to take one.
  // How many hinges is the door count times the company's rate, and the door
  // count is an answer that survives only if the caller gave it.
  if (shape.addOns) {
    intake.addOns = (Array.isArray(group?.addOns) ? group.addOns : [])
      .map((a) => a?.key)
      .filter(Boolean);
  }

  return {
    ok: true,
    trade,
    intake,
    materialKey: group?.material?.key || null,
    ...(address ? { address } : {}),
  };
}

/** Does this trade's instant estimate already carry the caller's upgrades? */
export function estimateCarriesAddOns(trade) {
  return Boolean(measureShapeFor(trade)?.addOns);
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
    // Plural: one `painting` estimator serves interior AND exterior painting,
    // and its materials belong under both. The old lookup asked for the single
    // category a hand-typed map named, which for painting was a key the
    // catalogue has never contained — so a painting company's own paint grades
    // were never shown to the model at all.
    const categoryKeys = categoryKeysForInstantTrade(row.trade);
    if (!categoryKeys.length) continue;
    const materials = sanitiseInstantConfig(row.config)?.materials || [];
    const labels = materials
      .filter((m) => m && m.key)
      .map((m) => ({ key: m.key, label: m.label || m.key }));
    for (const categoryKey of categoryKeys) out[categoryKey] = labels;
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
export async function draftEstimateFromForm({
  company,
  form,
  contact,
  language,
  // Passed straight through to Quote.reviewNotes. Nothing here composes it —
  // lib/ai/callQuoteDraft.js knows what the caller asked for and this file
  // deliberately knows nothing about the call.
  reviewNotes = null,
  // The caller, already resolved to a client row by lib/ai/callQuoteDraft.js.
  // Passed through so the estimate does not create a SECOND client for a caller
  // that file has just matched or created — see createEstimateDraft.
  clientId = null,
  // The VoiceCall this came off. An id, never the recording URL.
  sourceCallId = null,
}) {
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
    reviewNotes,
    clientId,
    sourceCallId,
  });

  return { ok: true, quote };
}
