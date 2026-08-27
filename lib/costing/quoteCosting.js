// lib/costing/quoteCosting.js
//
// A quote's internal cost estimate, as a thing that can be SAVED.
//
// ── The gap this fills ─────────────────────────────────────────────────────
//
// The quote builder worked out labour hours, materials, overhead, the crew and
// the margin live, showed all of it in CostMarginPanel, and threw every number
// away the moment Save was pressed. Reopen the quote and there was no way to
// answer "what margin did we quote this at" or "how many hours did we assume"
// — the two questions the whole costing feature exists to serve.
//
// app/api/jobs/[id]/costing/route.js says so in as many words: it returns
// `estimatedCost: null` because the estimate "is not stored", and notes that
// storing it has to happen server-side, since the browser is not allowed to
// post money amounts. This module is that server side.
//
// ── One function, three callers ────────────────────────────────────────────
//
// `quoteCostSummary` runs at save (POST/PATCH /api/quotes, through
// app/api/quotes/costingWrite.js) and again on read when nothing was saved
// (GET /api/quotes/[id]/costing). Same arithmetic both times, which is the
// point: the recomputed fallback has to be the same shape as the stored one,
// or the UI needs two rendering paths and the second one rots.
//
// What differs is the RATE CARD it runs against. At save it is today's; on the
// fallback it is also today's — but "today" has moved. That is why the
// endpoint flags `saved: false` instead of quietly presenting a fresh
// calculation as the estimate somebody actually quoted.

import { estimateQuoteCost } from "@/lib/costing/estimateJobCost";
import {
  normaliseCostingInputs,
  sane,
  MAX_MONEY,
  MAX_HOURS,
} from "@/lib/costing/actualJobCost";
import {
  tradeLabourHours,
  estimateCabinetDoorCost,
} from "@/lib/pricing/tradeScope";
import { getPriceBook } from "@/app/data/tradePriceBooks";

/// The margin a quote is measured against. Lives here rather than as a local
/// const in the builder so the panel, the saved row and the read endpoint
/// cannot disagree about what "green" means.
export const MARGIN_TARGET_PCT = 30;

/// Overhead as a share of the price, used ONLY when the company has never told
/// us its monthly fixed costs and job capacity. A share of the price is not a
/// cost and this figure knows it — `overheadBasis: "pct_of_price"` travels with
/// every result it produced so nothing presents it as measured. It is the
/// number the builder has always started at; defined once so the panel, the
/// saved row and the recomputed fallback cannot each pick their own.
export const FALLBACK_OVERHEAD_PCT = 10;

/// What an hour of crew COSTS the company when nobody has said who is doing the
/// job. The burdened cost of a worker paid around $25/hr — a charge-out rate
/// here would understate the cost and flatter the margin on every quote.
///
/// Defined once for the same reason as the overhead above, and because the two
/// places that needed it had drifted: the builder started at 35 while the
/// server's recompute used 0, so a quote costed at a healthy margin on the
/// create screen reopened showing hours with no money against them and a margin
/// inflated by the whole missing labour cost. It is an assumption either way,
/// and `labourRateBasis` travels with every result so the panel can say so.
export const FALLBACK_LABOUR_RATE = 35;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v) => {
  const r = Math.round(num(v) * 100) / 100;
  return Number.isFinite(r) ? r : 0;
};

/**
 * The browser → database boundary for a quote's cost panel.
 *
 * Delegates the crew, materials, overhead and note to the shared sanitiser —
 * those rows are identical on both documents — and adds the two fields only a
 * quote has: the estimator's ADDED hours, and the fallback cost-rate used when
 * no crew has been named.
 *
 * `addedLabourHours` is deliberately NOT the total. The hours a takeoff
 * implies are re-derived server-side from the stored takeoff, so a browser
 * cannot inflate the labour side of a margin by posting a bigger number: it
 * can only say "I think this needs six hours more than the book says".
 *
 * @returns null when there is no costing block at all, which the caller must
 *          read as "this request said nothing", not as "clear it".
 */
export function normaliseQuoteCosting(input) {
  if (!input || typeof input !== "object") return null;
  // The shared sanitiser calls it `materialCost` because on an invoice that IS
  // the material cost. On a quote it is only the part the estimator ADDED on
  // top of what the recipes and takeoffs predicted, so the wire field says so
  // and the old name is still accepted rather than silently ignored.
  const base = normaliseCostingInputs({
    ...input,
    materialCost: input.addedMaterialCost ?? input.materialCost,
  });
  return {
    crew: base.crew,
    addedMaterialCost: base.materialCost,
    overheadPct: base.overheadPct,
    note: base.note,
    addedLabourHours: sane(input.addedLabourHours, MAX_HOURS),
    labourRate: sane(input.labourRate, MAX_MONEY),
  };
}

/**
 * Hours a group's takeoff implies, and the goods bought for it.
 *
 * Both are derived from the price book, so both are computed here rather than
 * accepted from the request. `tradeLabourHours` answers "how long", which is
 * separate from the price — a trade billed per square foot still takes a
 * predictable number of hours — and `estimateCabinetDoorCost` is a real
 * supplier cost no coverage rate can predict.
 *
 * A malformed takeoff yields 0 rather than throwing: this runs inside a save,
 * and a quote that cannot be saved because one stored blob is odd is a worse
 * failure than a cost panel that reads low and visibly so.
 */

/**
 * A cabinet group's intake answers, in the shape cabinetRunLabour reads.
 *
 * Returns null for a group with no counts — "nobody has answered yet" has to
 * stay distinguishable from "a kitchen with no doors", because the first is an
 * incomplete estimate and the second is not a job.
 */
function cabinetConfigFrom(group) {
  const iv = group?.intakeValues;
  if (!iv || typeof iv !== "object") return null;
  const doors = num(iv.doorCount);
  const drawers = num(iv.drawerCount);
  if (doors + drawers <= 0) return null;
  return {
    ...iv,
    doors,
    drawers,
    // Also read by estimateCabinetDoorCost, which wants the same two names.
  };
}

function takeoffDerived(group) {
  const { categoryKey, takeoff, rateOverrides } = group;

  // ── A cabinet group has no takeoff, and it still has hours ──────────────
  //
  // This required `takeoff` to be an object, which is true of every trade that
  // draws one and false of the door-and-drawer trades, whose inputs are intake
  // ANSWERS. So cabinets fell straight through to { hours: 0 } and the margin
  // panel scored the highest-volume trade in the product as if the spraying,
  // the sanding and the reinstall were free.
  //
  // The intake is the takeoff for these trades. Field names differ — the intake
  // stores doorCount/drawerCount because that is what the form asks — so the
  // shape is translated here rather than teaching cabinetLabour two vocabularies.
  // Cabinets are deliberately NOT handled here. Their labour comes from the
  // recipe path (estimateJobCost's cabinet_unit model, which calls
  // cabinetRunLabour directly), and quoteCostSummary ADDS takeoff hours to
  // recipe hours — so deriving them in both places double-counted every cabinet
  // job. `source` still falls back to the intake for the MATERIAL estimate
  // below, which reads doors and drawers and has no other way to get them.
  const source = takeoff || cabinetConfigFrom(group);
  if (!categoryKey || !source || typeof source !== "object") {
    return { hours: 0, purchased: 0 };
  }
  let hours = 0;
  let purchased = 0;
  try {
    hours = takeoff
      ? num(tradeLabourHours(categoryKey, takeoff, rateOverrides || null))
      : 0;
  } catch {
    hours = 0;
  }
  try {
    const book = getPriceBook(categoryKey, rateOverrides || null) || {};
    purchased = num(estimateCabinetDoorCost(source, book)?.total);
  } catch {
    purchased = 0;
  }
  return { hours: round2(hours), purchased: round2(purchased) };
}

/**
 * What a quote is estimated to cost, and what margin that leaves.
 *
 * @param {object}   p
 * @param {Array}    p.scopeGroups  [{ categoryKey, label, takeoff, intakeValues?,
 *                                     rateOverrides? }] — as stored, or as the
 *                                   request is about to store them
 * @param {Array}    p.crew         [{ id, name, rate, hours }]
 * @param {number}   p.addedLabourHours  the estimator's own hours, on top of
 *                                       whatever the takeoffs imply
 * @param {number}   p.addedMaterialCost
 * @param {number}   p.labourRate   fallback cost-rate; superseded by the crew
 * @param {number}   p.overheadPct  fallback overhead as a % of the price
 * @param {number?}  p.overheadPerJob the company's REAL overhead per job
 * @param {number}   p.price        the pre-tax subtotal being costed against
 * @returns the estimateQuoteCost result, with each group's takeoff hours
 *          folded into that group's row so the itemised half adds up to the
 *          headline.
 */
export function quoteCostSummary({
  scopeGroups = [],
  crew = [],
  addedLabourHours = 0,
  addedMaterialCost = 0,
  labourRate = 0,
  overheadPct = 0,
  overheadPerJob = null,
  price = 0,
  marginTargetPct = MARGIN_TARGET_PCT,
  recipeOverridesByCategory = {},
} = {}) {
  const groups = (Array.isArray(scopeGroups) ? scopeGroups : []).filter(
    (g) => g && typeof g === "object",
  );

  // Derived per group, then summed — the same numbers have to appear on the
  // group rows AND in the pool the crew shares, and deriving them twice is how
  // the two end up disagreeing by a rounding step.
  const derived = groups.map((g) => takeoffDerived(g));
  const takeoffHours = round2(derived.reduce((s, d) => s + d.hours, 0));
  const purchasedMaterialCost = round2(
    derived.reduce((s, d) => s + d.purchased, 0),
  );

  const estimate = estimateQuoteCost({
    scopeGroups: groups.map((g, i) => ({
      // `tempId` is what estimateQuoteCost keys overrides by and echoes back on
      // each group. Stored groups have a real id; a group being created has
      // neither, so the index stands in — it is only ever used to match a row
      // to its own result inside this call.
      tempId: g.tempId || g.id || `g${i}`,
      categoryKey: g.categoryKey,
      label: g.label,
      intakeValues: g.intakeValues || {},
      takeoff: g.takeoff || null,
      rateOverrides: g.rateOverrides || null,
    })),
    labourRatePerHour: num(labourRate),
    crew: Array.isArray(crew) ? crew : [],
    // Both, not either. A price book's productivity rate is a prediction, and
    // the estimator standing on the site is allowed to know better — so the
    // typed hours are additive rather than a replacement, exactly as the
    // builder has always shown them.
    manualLabourHours: takeoffHours + num(addedLabourHours),
    manualMaterialCost: num(addedMaterialCost),
    price: num(price),
    overheadPerJob,
    overheadPctOfPrice: num(overheadPct),
    purchasedMaterialCost,
    marginTargetPct: num(marginTargetPct) || MARGIN_TARGET_PCT,
    recipeOverridesByCategory: recipeOverridesByCategory || {},
  });

  // A takeoff trade has no recipe, so estimateQuoteCost gives its group zero
  // labour hours and adds the takeoff's hours to the pool instead. Left like
  // that, a roofing group would render "0 hrs" underneath a headline of
  // forty-one. Folding the hours back onto the group they came from is the
  // difference between a breakdown and a list of zeroes.
  const byTempId = new Map(
    groups.map((g, i) => [g.tempId || g.id || `g${i}`, derived[i]]),
  );
  const merged = estimate.groups.map((g) => {
    const d = byTempId.get(g.tempId);
    return d ? { ...g, labourHours: round2(num(g.labourHours) + d.hours) } : g;
  });

  // Groups whose entire contribution is takeoff hours (no recipe, no bill of
  // materials) never reach estimateQuoteCost's result at all — it drops a
  // group that estimated to nothing. They still took time, so they appear
  // here rather than vanishing from a breakdown of their own job.
  for (let i = 0; i < groups.length; i += 1) {
    const key = groups[i].tempId || groups[i].id || `g${i}`;
    if (derived[i].hours <= 0) continue;
    if (merged.some((g) => g.tempId === key)) continue;
    merged.push({
      tempId: key,
      categoryKey: groups[i].categoryKey || null,
      label: groups[i].label || null,
      materials: [],
      materialTotal: 0,
      unpricedCount: 0,
      labourHours: derived[i].hours,
      labourCost: 0,
      total: 0,
    });
  }

  return {
    ...estimate,
    groups: merged,
    takeoffHours,
    purchasedMaterialCost,
    // estimateQuoteCost is handed the price and doesn't hand it back. It rides
    // along here because the saved row freezes it: the quote's own subtotal
    // moves when it is edited, and a margin has to keep pointing at the price
    // it was measured against.
    price: num(price),
    // estimateQuoteCost's own `costIncomplete` only fires when NOBODY has a
    // rate. A crew of three with one unrated slips past it — the blended rate
    // is positive, so the total looks finished while ten hours cost nothing.
    // The panel already refuses to call that green; the flag should agree with
    // the badge rather than contradict it.
    costIncomplete:
      Boolean(estimate.costIncomplete) || (estimate.crewUnrated || 0) > 0,
  };
}

/**
 * The wire shape of a quote's costing — the ONE definition of it.
 *
 * Both halves of GET /api/quotes/[id]/costing come through here: the stored
 * row and the recomputed fallback. A second hand-built object for the fallback
 * is the copy that would drift, and the whole point of `saved` is that the UI
 * renders one shape and only changes what it SAYS about it.
 *
 * `marginPct` is null when there was no price to have a margin against. A
 * quote priced at nothing has not broken even, and 0 would claim it did;
 * `signal: "none"` carries the same fact for anything reading the badge.
 */
export function quoteCostingShape(source, { saved }) {
  const groups = Array.isArray(source.groups) ? source.groups : [];
  return {
    saved: Boolean(saved),
    labourHours: round2(source.labourHours),
    labourCost: round2(source.labourCost),
    materialTotal: round2(source.materialTotal),
    unpricedMaterials: Math.max(0, Math.trunc(num(source.unpricedMaterials))),
    overhead: round2(source.overhead),
    overheadBasis: source.overheadBasis || "pct_of_price",
    estimatedCost: round2(source.estimatedCost),
    price: round2(source.price),
    profit: round2(source.profit),
    marginPct: source.marginPct == null ? null : round2(source.marginPct),
    marginTargetPct: round2(source.marginTargetPct ?? MARGIN_TARGET_PCT),
    signal: source.signal || "none",
    costIncomplete: Boolean(source.costIncomplete),
    crew: (Array.isArray(source.crew) ? source.crew : []).map((m) => ({
      name: String(m?.name ?? ""),
      // The saved row keeps `rate`, the live estimate calls the same number
      // `rate` too — but the contract asks for `hourlyRate`, so the rename
      // happens once, here, instead of in whichever caller remembers.
      hourlyRate: round2(m?.hourlyRate ?? m?.rate),
      hours: round2(m?.hours),
      cost: round2(m?.cost),
    })),
    blendedRate: source.blendedRate == null ? null : round2(source.blendedRate),
    groups: groups.map((g) => ({
      label: g?.label ?? null,
      categoryKey: g?.categoryKey ?? null,
      labourHours: round2(g?.labourHours),
      materialTotal: round2(g?.materialTotal),
      materials: (Array.isArray(g?.materials) ? g.materials : []).map((m) => ({
        name: String(m?.name ?? ""),
        qty: round2(m?.qty),
        unit: String(m?.unit ?? ""),
        // Null, not 0. "Nobody has priced this" and "this is free" are
        // different statements, and `unpriced` exists because the difference
        // changes what the margin below is worth.
        unitCost: m?.unitCost == null ? null : round2(m.unitCost),
        cost: round2(m?.cost),
        unpriced: Boolean(m?.unpriced),
      })),
    })),
  };
}

/**
 * Map a saved QuoteCosting row onto the wire shape.
 *
 * Every figure comes off the row verbatim — nothing is recomputed. That is the
 * entire reason the row exists: it is what the quote was costed at, not what
 * it would be costed at now.
 */
export function shapeSavedQuoteCosting(row) {
  const shaped = quoteCostingShape(
    {
      labourHours: row.labourHours,
      labourCost: row.labourCost,
      materialTotal: row.materialTotal,
      unpricedMaterials: row.unpricedMaterials,
      overhead: row.overhead,
      overheadBasis: row.overheadBasis,
      estimatedCost: row.totalCost,
      price: row.price,
      profit: row.profit,
      marginPct: row.marginPct,
      marginTargetPct: row.marginTargetPct,
      signal: row.signal,
      costIncomplete: row.costIncomplete,
      crew: Array.isArray(row.crew) ? row.crew : [],
      blendedRate: row.blendedRate,
      groups: Array.isArray(row.groups) ? row.groups : [],
    },
    { saved: true },
  );

  // ── The INPUTS come back too ─────────────────────────────────────────────
  //
  // quoteCostingShape describes the ANSWER: hours, costs, margin. It is shared
  // with the recompute path, which has no inputs to report, so it never carried
  // the four numbers the estimator actually typed.
  //
  // Which meant every editor that reopens a costed quote — QuoteCostEditor on
  // the quote page, and the builder's cost panel on the edit route — seeded
  // itself from fields that were never in the response. They read as blank, and
  // the next save wrote the blanks back: the extra hours, the extra materials,
  // the fallback rate and any PINNED crew hours were silently zeroed by
  // reopening the panel and pressing Save. Written and never read, in the one
  // direction that loses data.
  //
  // Only on the SAVED shape. A recompute has no inputs, and inventing zeroes
  // for it would claim an estimator had said something they never said.
  const crewRows = Array.isArray(row.crew) ? row.crew : [];
  return {
    ...shaped,
    addedLabourHours: round2(row.addedLabourHours),
    addedMaterialCost: round2(row.addedMaterialCost),
    labourRate: round2(row.labourRate),
    overheadPct: round2(row.overheadPct),
    note: row.note ?? null,
    crew: shaped.crew.map((m, i) => ({
      ...m,
      id: crewRows[i]?.id ?? null,
      // Which of the two a number was. Without it, reopening the panel pins a
      // share that should still move when the scope does — the exact thing
      // buildQuoteCostingRow froze this flag to prevent.
      hoursExplicit: Boolean(crewRows[i]?.hoursExplicit),
    })),
  };
}

/**
 * Map a live estimate onto the wire shape.
 *
 * `saved` is a parameter because the SAME estimate object is the answer in two
 * situations that mean opposite things: the figures a save just computed and
 * stored, and the figures a read had to invent because nothing was stored.
 */
export function shapeEstimate(estimate, { saved = false } = {}) {
  return quoteCostingShape(
    {
      ...estimate,
      // The crew rows carry `rate`; the contract carries `hourlyRate`.
      crew: (estimate.crew || []).map((m) => ({ ...m, hourlyRate: m.rate })),
    },
    { saved },
  );
}

/**
 * Can this recompute support a margin at all?
 *
 * Q-2026-0006 rendered "54.52% margin" against LABOUR $0.00 / 0 hrs and
 * MATERIALS $0.00 on a $6,650 cabinet quote. The arithmetic was right —
 * $6,650 minus $3,024 of overhead really is 54.52% — and it was still a lie,
 * because it presented a subtraction missing its two biggest terms as an
 * answer, in green.
 *
 * Cabinet refinishing and exterior painting are priced from INTAKE ANSWERS
 * through app/data/materialRecipes.js, and QuoteScopeGroup has never had a
 * column to keep them in: a trade takeoff is stored, intake answers are not.
 * So for those trades a recompute has nothing to work from and cannot be made
 * to by trying harder.
 *
 * Absence of a cost is not a cost of zero. Pure and exported so the rule is
 * testable rather than buried in a route handler.
 */
export function costBasisMissing({ labourHours, materialTotal, price }) {
  const hours = Number(labourHours);
  const materials = Number(materialTotal);
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount <= 0) return false;
  return (
    (!Number.isFinite(hours) || hours <= 0) &&
    (!Number.isFinite(materials) || materials <= 0)
  );
}
