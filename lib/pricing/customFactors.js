// lib/pricing/customFactors.js
//
// The estimator's OWN complexity factors — "things that are unforeseen" — on
// any scope group, any trade.
//
// ── What the owner asked for (2026-09-22) ──────────────────────────────────
//
// "custom complexity in the new quote for any type of trade or quote
// preset… things that are unforeseen." The factor model in
// lib/pricing/complexity covers three trades with questions somebody wrote
// in advance. A third-floor walk-up, a dog that has to be crated, a client
// who wants the crew gone by 3 — nobody writes those questions in advance,
// and every trade meets them. So this is the other half: a short label the
// estimator types, and an adjustment as a percentage, a fixed amount, or
// extra hours where the trade sells hours.
//
// ── How it composes with the built-in factors (deterministic, in order) ────
//
//   1. BUILT-IN — the trade's tier / factor model (lib/pricing/complexity)
//      is already inside the group's price: it multiplied the labour hours
//      behind the stair lines, or pressed the cabinet chip the per-door rate
//      came from. That price — every line the group bills, as it will be
//      stored — is the BASE.
//   2. CUSTOM % — each percentage is taken of that same base, rounded to the
//      cent on its own, and the results are added. NOT compounded: 10% then
//      5% is 15% of the base in either order, so the order the estimator
//      typed them in can never change the quote.
//   3. CUSTOM FIXED — added as typed. Extra hours are a fixed amount too:
//      hours × the hourly sell rate captured when the factor was added.
//      Neither is ever multiplied by a percentage.
//
//   total = base + Σ round2(base × pct / 100) + Σ fixed + Σ round2(hours × rate)
//
// ── Where it lives ─────────────────────────────────────────────────────────
//
// On the wire and in the database, each factor is an ordinary LINE on its
// group, appended after every other line: description = the label exactly
// as typed, amount = the adjustment, and `meta.customFactor` = what produced
// it. That is deliberate. A line is what every reader already reads — the
// client's page, the PDF, the email, the invoice built from the quote
// (lib/invoices/createInvoiceFromQuote.js copies lines verbatim), the job's
// work order — so the reason line reaches all of them without any of them
// learning a new shape, and a saved quote keeps its amounts even if the
// estimator's hourly rate moves next week. The builder splits the lines back
// into editable factors when it reopens the quote (splitCustomFactorLines),
// so they are never edited twice, once as a factor and once as a line.
//
// The label is printed in whatever language it was typed in. Nothing here
// translates it: a quote keeps the language it was created in
// (non-negotiable #6), and the estimator is the one who knows what "3rd floor
// walk-up" is in French.
//
// ── What is refused ────────────────────────────────────────────────────────
//
// A factor with no label, a zero, a negative, or a number past the limits
// below is INVALID: it prices nothing and is not written. Negative on
// purpose — a reduction is what the quote's discount field is for, and a
// "complexity" line that takes money off would put two discounts on one
// document with nothing to reconcile them. A percentage of a base of zero (a
// Specialty group that refuses to price) is also written as nothing, because
// a "$0.00" reason line is a price a homeowner can hold the contractor to.
//
// Pure — no database, no React. scripts/check-custom-factors.mjs executes it.

export const CUSTOM_FACTOR_MODES = ["percent", "fixed", "hours"];

/**
 * Past these a number is a typo, not a judgement. 300% on a group is already
 * "this is a different job"; a million on one line is a second quote.
 */
export const CUSTOM_FACTOR_LIMITS = {
  percent: 300,
  fixed: 1_000_000,
  hours: 1_000,
  label: 120,
};

/** Most a group carries — more than this is a scope nobody has written down. */
export const MAX_CUSTOM_FACTORS = 8;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Why a factor does not price, or null when it does. A KEY, not a sentence —
 * the builder says it in the estimator's language.
 */
export function customFactorProblem(factor) {
  if (!factor || typeof factor !== "object") return "invalid";
  const label = String(factor.label ?? "").trim();
  if (!label) return "label";
  if (label.length > CUSTOM_FACTOR_LIMITS.label) return "labelTooLong";
  if (!CUSTOM_FACTOR_MODES.includes(factor.mode)) return "mode";
  const value = num(factor.value);
  if (!Number.isFinite(value) || value <= 0) return "value";
  if (value > CUSTOM_FACTOR_LIMITS[factor.mode]) return "tooLarge";
  if (factor.mode === "hours") {
    const rate = num(factor.rate);
    if (!Number.isFinite(rate) || rate <= 0) return "rate";
  }
  return null;
}

/**
 * A factor as it is kept — trimmed, typed — or null when it cannot be one at
 * all. Used on anything that arrived as JSON (a stored line's meta, a library
 * row, a request body) so a hostile value never becomes a price.
 */
export function normaliseCustomFactor(raw) {
  if (!raw || typeof raw !== "object") return null;
  const mode = CUSTOM_FACTOR_MODES.includes(raw.mode) ? raw.mode : null;
  if (!mode) return null;
  const out = {
    id: String(raw.id || "").slice(0, 64) || null,
    label: String(raw.label ?? "").slice(0, CUSTOM_FACTOR_LIMITS.label),
    mode,
    value: Number.isFinite(num(raw.value)) ? num(raw.value) : 0,
  };
  if (mode === "hours") out.rate = Number.isFinite(num(raw.rate)) ? num(raw.rate) : 0;
  return out;
}

/**
 * Every factor priced against a base, in the order the header documents.
 *
 * @param {object} p
 * @param {number} p.base     the group's price before any custom factor —
 *                            built-in complexity already inside it
 * @param {Array}  p.factors  the group's factors, valid or not
 * @returns {{ rows: Array<{factor, amount, hours, problem}>, percentTotal,
 *             fixedTotal, hoursTotal, hours, total }}
 *   `rows` keeps the estimator's order (for the screen); the TOTALS are
 *   order-independent by construction.
 */
export function priceCustomFactors({ base, factors }) {
  const b = Number.isFinite(num(base)) && num(base) > 0 ? num(base) : 0;
  const list = Array.isArray(factors) ? factors.slice(0, MAX_CUSTOM_FACTORS) : [];

  let percentTotal = 0;
  let fixedTotal = 0;
  let hoursTotal = 0;
  let hours = 0;

  const rows = list.map((factor) => {
    const problem = customFactorProblem(factor);
    if (problem) return { factor, amount: 0, hours: 0, problem };
    const value = num(factor.value);
    if (factor.mode === "percent") {
      const amount = round2((b * value) / 100);
      // Nothing to take a percentage OF — see the header.
      if (!(amount > 0)) return { factor, amount: 0, hours: 0, problem: "noBase" };
      percentTotal = round2(percentTotal + amount);
      return { factor, amount, hours: 0, problem: null };
    }
    if (factor.mode === "fixed") {
      const amount = round2(value);
      fixedTotal = round2(fixedTotal + amount);
      return { factor, amount, hours: 0, problem: null };
    }
    const amount = round2(value * num(factor.rate));
    hoursTotal = round2(hoursTotal + amount);
    hours = round2(hours + value);
    return { factor, amount, hours: value, problem: null };
  });

  return {
    rows,
    percentTotal,
    fixedTotal,
    hoursTotal,
    hours,
    total: round2(percentTotal + fixedTotal + hoursTotal),
  };
}

/** True when a group carries at least one factor, valid or not. */
export function hasCustomFactors(group) {
  return Array.isArray(group?.customFactors) && group.customFactors.length > 0;
}

/** Does this stored line come from a custom factor? */
export function isCustomFactorLine(line) {
  return Boolean(
    line &&
      typeof line === "object" &&
      line.meta &&
      typeof line.meta === "object" &&
      line.meta.customFactor &&
      typeof line.meta.customFactor === "object",
  );
}

/**
 * The lines a group's factors write, appended after its other lines.
 *
 * Only factors that price produce a line — see the header on what is
 * refused. `quantity: 1` and `rate = amount` for every mode, the hours
 * included: the client reads the reason and what it adds, and "× 3" beside a
 * sentence would read as three of whatever the sentence names. The hours and
 * the rate they were sold at travel in `meta`, which no client-facing
 * renderer reads.
 */
export function customFactorLines({ base, factors }) {
  const priced = priceCustomFactors({ base, factors });
  return priced.rows
    .filter((r) => !r.problem && r.amount > 0)
    .map(({ factor, amount }) => ({
      description: String(factor.label).trim(),
      quantity: 1,
      unit: "flat",
      rate: amount,
      amount,
      meta: {
        customFactor: {
          id: factor.id || null,
          mode: factor.mode,
          value: num(factor.value),
          ...(factor.mode === "hours" ? { rate: num(factor.rate) } : {}),
        },
      },
    }));
}

/**
 * A stored group's lines, split back into the lines the table edits and the
 * factors the factor editor edits. The inverse of customFactorLines: a
 * factor written and read back is the same factor, so re-saving an untouched
 * quote writes the same lines to the cent (scripts/check-custom-factors.mjs
 * proves the fixed point).
 */
export function splitCustomFactorLines(lineItems) {
  const lines = [];
  const factors = [];
  for (const line of Array.isArray(lineItems) ? lineItems : []) {
    if (!isCustomFactorLine(line)) {
      lines.push(line);
      continue;
    }
    const meta = line.meta.customFactor;
    const factor = normaliseCustomFactor({
      id: meta.id || `cf-${factors.length + 1}`,
      label: line.description,
      mode: meta.mode,
      value: meta.value,
      rate: meta.rate,
    });
    // A line that says it is a factor but cannot be one (a mode nobody knows)
    // stays a LINE — dropping it would take money off a saved quote.
    if (factor) factors.push(factor);
    else lines.push(line);
  }
  return { lines, factors };
}

/**
 * The extra crew hours a quote's custom factors sell, read off the lines as
 * stored (or as a request is about to store them). The costing side adds
 * these to the labour pool — hours sold are hours worked, and a margin that
 * counted the revenue and not the time would flatter every such quote.
 */
export function customFactorHoursOf(groups) {
  let hours = 0;
  for (const g of Array.isArray(groups) ? groups : []) {
    for (const line of Array.isArray(g?.lineItems) ? g.lineItems : []) {
      if (!isCustomFactorLine(line)) continue;
      const m = line.meta.customFactor;
      if (m.mode !== "hours") continue;
      const v = num(m.value);
      if (Number.isFinite(v) && v > 0 && v <= CUSTOM_FACTOR_LIMITS.hours) hours += v;
    }
  }
  return round2(hours);
}

/**
 * The hourly SELL rate an "extra hours" factor is priced at, or null when
 * this trade does not sell hours — and then the hours option is not offered
 * at all, rather than offered at a rate that means something else (a
 * flooring group's per-sq-ft default is not an hourly rate).
 *
 * The trade's own book first (painting's hourlySellRate), then the service's
 * rate when the service is sold by the hour (plumbing, electrical, cleaning).
 */
export function hourlyRateForFactors({ book = null, category = null, fallbackUnitRate = null } = {}) {
  const fromBook = num(book?.hourlySellRate);
  if (Number.isFinite(fromBook) && fromBook > 0) return round2(fromBook);
  const unit = String(category?.unit ?? fallbackUnitRate?.unit ?? "").toLowerCase();
  if (!/^(hour|hours|hr|hrs|h)$/.test(unit)) return null;
  const rate = num(category?.defaultRate ?? fallbackUnitRate?.rate);
  return Number.isFinite(rate) && rate > 0 ? round2(rate) : null;
}

/**
 * A company library row → a factor on a group. The label is copied exactly;
 * an hours preset takes THIS group's hourly rate, and on a group that does
 * not sell hours it cannot be applied (null).
 */
export function factorFromPreset(preset, { id, hourlyRate = null } = {}) {
  if (!preset || typeof preset !== "object") return null;
  const mode = CUSTOM_FACTOR_MODES.includes(preset.mode) ? preset.mode : null;
  if (!mode) return null;
  if (mode === "hours" && !(num(hourlyRate) > 0)) return null;
  return {
    id: id || null,
    label: String(preset.label ?? "").trim().slice(0, CUSTOM_FACTOR_LIMITS.label),
    mode,
    value: num(preset.value),
    ...(mode === "hours" ? { rate: num(hourlyRate) } : {}),
    presetId: preset.id || null,
  };
}

/**
 * A stored library row as the builder and the settings card read it. The
 * value is the company's pricing, so it is withheld from a member who may
 * not see prices — the boundary /api/quote-text-blocks keeps.
 */
export function presentPreset(row, { showPricing = false } = {}) {
  return {
    id: row.id,
    label: row.label,
    mode: row.mode,
    ...(showPricing ? { value: Number(row.value) } : {}),
    language: row.language,
    createdAt: row.createdAt,
  };
}

/**
 * A library row as the settings card and the builder send it → the row to
 * store, or `{ error }`. The server's own gate; the forms say the same thing
 * in the reader's language first.
 */
export function normalisePresetInput(body, { languages = [] } = {}) {
  const label = String(body?.label ?? "").trim();
  if (!label) return { error: "Give the factor a label." };
  if (label.length > CUSTOM_FACTOR_LIMITS.label) {
    return { error: `Keep the label under ${CUSTOM_FACTOR_LIMITS.label} characters.` };
  }
  const mode = CUSTOM_FACTOR_MODES.includes(body?.mode) ? body.mode : null;
  if (!mode) return { error: "Choose a percentage, a fixed amount or extra hours." };
  const value = num(body?.value);
  if (!Number.isFinite(value) || value <= 0) return { error: "Enter an amount above zero." };
  if (value > CUSTOM_FACTOR_LIMITS[mode]) {
    return { error: `That is past the limit for this kind of factor (${CUSTOM_FACTOR_LIMITS[mode]}).` };
  }
  const lang = String(body?.language || "").toLowerCase();
  return {
    data: {
      label,
      mode,
      value: round2(value),
      ...(languages.includes(lang) ? { language: lang } : {}),
    },
  };
}
