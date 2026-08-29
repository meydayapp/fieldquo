// lib/marketing/costCompare.js
//
// "What would each of them charge a business shaped like mine?"
//
// ══ Why this is hard, and why it is the whole module ═══════════════════════
//
// Every company on this page prices a DIFFERENT UNIT. ServiceTitan per
// TECHNICIAN, Jobber by a team-size BAND, Housecall Pro per SEAT with extras
// priced individually, QuoteIQ per USER, Projul a FLAT annual fee. FieldQuo
// prices SEATS and includes CREW free.
//
// A calculator that asks "how many people work here" and puts those numbers in
// one table is comparing different things and looks rigorous while doing it.
// So the input is TWO questions — who originates money, and who is in the field
// — and each competitor's own unit decides which of the two it counts.
//
// The unit vocabulary is NOT defined here. `PRICING_UNITS` in
// ./competitors.js carries it, with a `countsWhom`, a `mapsTo` and a `caveat`
// per unit, and this module reads all three. A second copy of that mapping
// living beside the arithmetic is the copy that rots — AGENTS.md failure class
// 4 — and it would rot into a false statement about somebody's price list. The
// only thing added here is COUNTING_RULES: how THIS PAGE turns the visitor's
// two answers into the headcount a `mapsTo` asks for. That is one small table
// and the page prints it.
//
// ══ The two bases, and why neither may be shown alone ══════════════════════
//
// The first version of this page compared our cheapest tier to their cheapest
// tier. The owner caught it: "quoteIQ starter package doesn't have the
// features. its not just the price." He is right, and it is the exact mistake
// comparableTier() in ./competitors.js exists to prevent — matching Jobber Grow
// to us because both sit third in a table, when Grow has no receptionist.
//
// So there are two bases and the page renders both:
//
//   BASIS_CAPABILITY — the cheapest tier of theirs that ACTUALLY carries what
//   FieldQuo puts in every plan, wherever it sits in their table.
//
//   BASIS_CHEAPEST — the cheapest thing they publish at your headcount,
//   whatever is in it. This is where we LOSE, and it stays for that reason.
//   QuoteIQ Essentials is $29.99 for one user against our $99, and
//   ./competitors.js records that as a capability we lack
//   (`entry_price_below_our_floor`) rather than as prose somebody can drop. A
//   contractor who needs four features and is sold nine at three times the
//   price churns; a calculator that hides the cheaper basic product is the
//   advertisement this module exists to avoid.
//
// The honest sentence is both halves. Either alone is a lie of omission.
//
// ══ Where the numbers come from, and where they do not ═════════════════════
//
// Nothing about a competitor is typed in this file. Every figure, currency,
// date, unit and provenance label is read out of ./competitors.js through its
// own gates — `withholdReason` for a published price, `reportedWithholdReason`
// for a band buyers report. A figure that module refuses is refused here, and
// the row prints the REASON rather than a blank or a number. A page where every
// rival happens to have a number is less credible than one that says what it
// does not know.
//
// This module therefore has exactly THREE numbers of its own, and they are in
// COST_ASSUMPTIONS with their reasoning.
//
// ══ No conversion, ever, and least of all of ours ══════════════════════════
//
// This file does not import lib/marketing/fx.js and must not. SEAT_LADDER
// carries the SAME NUMBER in CAD and USD by design, so a USD competitor lines
// up against our figure with no arithmetic anywhere. Running our own ladder
// through a rate would print a price we do not charge — fx.js says so itself
// and refuses — and this module never gives it the chance.
// scripts/check-cost-compare.mjs asserts the import does not exist.
//
// ══ Ranges never collapse ══════════════════════════════════════════════════
//
// ServiceTitan publishes nothing. What exists is a band contractors report,
// wrapped by ./competitors.js in `Reported`, whose endpoints are private and
// whose valueOf() throws so no midpoint can be computed by accident. Scaling
// that band by a technician count is legitimate — per-technician is the
// reported unit and the count is the visitor's own — but the result has to keep
// the guarantee. `ScaledBand` below is the same device one layer on: private
// ends, a throwing valueOf, and a toString that cannot omit the label.

import {
  BILLING_MODES,
  COMPETITORS,
  COMPARABLE_FEATURES,
  FEATURE_INCLUDED,
  FIELDQUO_CAPABILITIES,
  FIELDQUO_LACKS,
  FIELDQUO_PRICING_UNIT,
  FIELDQUO_REFERENCE,
  PRICE_AMOUNT,
  PRICING_UNITS,
  TEAM_SIZES,
  UNIT_FLAT,
  UNIT_PER_SEAT,
  UNIT_PER_TECHNICIAN,
  UNIT_PER_USER,
  UNIT_TEAM_SIZE_BAND,
  claims,
  provenanceLabel,
  publishableReportedCosts,
  reportedCostText,
  withholdReason,
} from "@/lib/marketing/competitors";
import {
  SEAT_LADDER,
  countSeats,
  tierFor,
  defaultAnnualPrice,
  ANNUAL_FREE_MONTHS,
} from "@/lib/pricing/ladder";
import { PERMISSION_PRESETS } from "@/lib/permissions";

/* ═══════════════════════════════════════════════════════════════════════════
   The three numbers that are ours
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Where a number came from. Same vocabulary as lib/marketing/savings.js, minus
 * the ones nothing here uses, because the discipline is the same: "twelve
 * months in a year" and "a one-time fee lands in year one" are not the same
 * kind of claim and a table that prints them identically hides the only
 * distinction a reader cares about.
 */
export const ASSUMPTION_BASIS = Object.freeze(["arithmetic", "judgement"]);

const ASSUMPTION_ROWS = [
  {
    key: "months_per_year",
    label: "Months in a year",
    value: 12,
    unit: "count",
    display: "12",
    represents: "Turning a monthly price into an annual one, and back again.",
    reasoning: "A definition. There is nothing to disagree with.",
    basis: "arithmetic",
  },
  {
    key: "fieldquo_months_charged",
    label: "Months of FieldQuo in every row",
    value: 12,
    unit: "count",
    display: "12",
    represents:
      "Our own side of every comparison is twelve months at the monthly rate — not the ten months a year's commitment actually costs.",
    reasoning:
      "We publish an annual deal worth two months (lib/pricing/ladder.js — pay for ten, get twelve) and it is deliberately left out of our own figure. Quoting our discounted year against a competitor's list price would be comparing our best case with their conservative one, which is the direction this page must never lean. The committed price is printed beside our figure so a reader can take it into account himself.",
    basis: "judgement",
  },
  {
    key: "implementation_fee_first_year",
    label: "Years a one-time implementation fee is charged to",
    value: 1,
    unit: "count",
    display: "1",
    represents:
      "A reported one-time setup fee lands, in full, in the first year — not spread across a notional lifetime.",
    reasoning:
      "Spreading a $15,000 fee over an assumed five years would be inventing how long a contractor stays and would understate the year the money actually leaves the account. So a reported row carries TWO figures: a first year including the fee, and a following year without it. A monthly figure that ignores a five-figure setup fee is not the cost, and averaging it away is the polite version of ignoring it.",
    basis: "judgement",
  },
];

export const COST_ASSUMPTIONS = Object.freeze(
  ASSUMPTION_ROWS.map((r) => Object.freeze({ ...r })),
);

const ASSUMPTION_INDEX = new Map(COST_ASSUMPTIONS.map((r) => [r.key, r]));

/**
 * The row, or a throw. Same argument as savings.js: a mistyped key that read as
 * zero would quietly delete a multiplier and the page would still render a
 * confident figure. A build that fails is the better outcome.
 */
export function assumptionRow(key) {
  const row = ASSUMPTION_INDEX.get(key);
  if (!row) throw new Error(`costCompare: no assumption named "${key}"`);
  return row;
}

const A = (key) => assumptionRow(key).value;

/** The table checks itself at load — a display that has drifted from its value
 *  is a lie that survives every review, because the label is what gets read. */
export function validateCostAssumptions() {
  const problems = [];
  const seen = new Set();
  for (const row of COST_ASSUMPTIONS) {
    if (seen.has(row.key)) problems.push(`duplicate assumption "${row.key}"`);
    seen.add(row.key);
    if (!Number.isFinite(row.value)) problems.push(`${row.key}: value is not a number`);
    if (!ASSUMPTION_BASIS.includes(row.basis)) problems.push(`${row.key}: unknown basis`);
    if (!row.represents || !row.reasoning) problems.push(`${row.key}: missing reasoning`);
    if (row.unit !== "count") problems.push(`${row.key}: unknown unit "${row.unit}"`);
    else if (row.display !== String(row.value)) {
      problems.push(`${row.key}: display "${row.display}" is not ${row.value}`);
    }
  }
  return problems;
}

{
  const problems = validateCostAssumptions();
  if (problems.length) throw new Error(`costCompare assumptions: ${problems.join("; ")}`);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Seats, crew, and the sentence that has to travel with them
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The grid a free crew member actually holds.
 *
 * Its `description` is the sentence the in-app access editor shows, and it is
 * read from there rather than paraphrased for marketing. The day the preset
 * gains or loses a power, this page's promise moves with it; a paraphrase would
 * rot into a false claim about what a stranger is buying.
 */
export const CREW_PRESET = PERMISSION_PRESETS.worker;

/**
 * The caveat that may never be separated from a headcount comparison.
 *
 * ══ Why this is enforced and not documented ════════════════════════════════
 *
 * "Twenty technicians costs $6,000 a month there and $369 here" is a true
 * sentence and an incomplete one. A ServiceTitan technician is reported to get
 * mobile estimates from the middle tier up; a FieldQuo crew member cannot write
 * a quote at all. Counting heads without saying so is the dishonest version of
 * a true argument, and it is what a prospect tests in the first ten minutes of
 * a demo — at which point the number is worth less than nothing, because it has
 * been caught.
 *
 * Both halves are read out of the capability ledger rather than written here.
 * ./competitors.js records `free_crew_seats` and `field_worker_quotes` as a
 * deliberate PAIR, with the note that "a renderer that reaches for the first
 * without the second is making the argument a prospect will take apart in one
 * question". This is that renderer, refusing to.
 *
 * The rows are not reachable without it — see GatedComparison.
 */
export const CREW_CAPABILITY = Object.freeze({
  headline: "Crew are free here because they can do less.",
  advantage: FIELDQUO_CAPABILITIES.free_crew_seats.label,
  advantageEvidence: FIELDQUO_CAPABILITIES.free_crew_seats.evidence,
  // The concession, in the ledger's own words. `has: false`, so it is one of
  // FIELDQUO_LACKS and appears in the concession block too — deliberately
  // twice, because this is the one a headcount argument stands or falls on.
  limit: FIELDQUO_CAPABILITIES.field_worker_quotes.label,
  limitEvidence: FIELDQUO_CAPABILITIES.field_worker_quotes.evidence,
  can: CREW_PRESET.description,
  cannot:
    "If the people you have in the field need to price work while they are standing in a driveway, they are SEATS on this page and not crew. Move them across and every figure below changes.",
  scope:
    "This page compares PRICE at a given shape of business. It does not claim that a seat here and a licence there can do the same things.",
  proof: ["lib/pricing/ladder.js", "lib/permissions.js"],
});

/**
 * The paragraph the owner asked for: why our headcount does not compare
 * like-for-like with a per-user price.
 *
 * It is the most valuable thing on the page. Everything else is arithmetic.
 */
export const SEAT_VS_CREW = Object.freeze({
  headline: "A seat and a head are not the same thing.",
  body:
    "A SEAT is somebody who can originate money — create or change a quote, a job or an invoice. That is not a job title and it is not a row in a table: it is read off the permissions the person actually holds, so an estimator labelled Crew who has been handed quoting powers is a seat, and a lead hand who has not is not. CREW is everybody else — the people in the van who see their schedule, open the job they are driving to, mark it done and log their hours. Crew cost nothing, on every plan, at every size. That is why our headcount does not line up with a per-user price: a twenty-person business is twenty billable logins to a company that charges per login, and two or three seats to us. The saving is real and the reason is boring — we are not selling the people in the van a licence they were never going to open. The cost of it is on the other side of the same sentence: those crew cannot price a job, and if yours need to, they are seats.",
  proof: ["lib/pricing/ladder.js", "lib/permissions.js"],
});

/* ═══════════════════════════════════════════════════════════════════════════
   How this page turns two answers into their unit
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * `PRICING_UNITS[unit].mapsTo` says WHOSE headcount a vendor bills. This says
 * what that means for the two numbers the visitor typed.
 *
 * It is the only mapping in this file, it is four rows long, and the page
 * prints it. Everything else about a unit — its label, who it counts, and the
 * caveat that has to travel with it — comes from ./competitors.js, because a
 * second copy of that is the copy that rots.
 *
 * A `mapsTo` with no row here produces an UNMAPPED row carrying its reason. It
 * does not fall back to a headcount, because guessing which people a vendor
 * bills is the one guess this whole module exists to refuse.
 */
export const COUNTING_RULES = Object.freeze({
  crew: Object.freeze({
    mapsTo: "crew",
    label: "the people in the field",
    count: (p) => p.fieldCrew,
    reasoning:
      "The vendor bills per technician, and a technician is a field worker. Office staff are not counted, because whether this vendor bills them on top was never established — so the figure is a FLOOR and the row says so rather than inventing the rest.",
  }),
  seats_and_crew_together: Object.freeze({
    mapsTo: "seats_and_crew_together",
    label: "everybody with a login",
    count: (p) => p.total,
    reasoning:
      "The vendor bills per login and makes no distinction between somebody writing estimates and somebody reading a schedule. So both of your answers are added together, which is exactly the difference this page exists to show.",
  }),
  none: Object.freeze({
    mapsTo: "none",
    label: "nobody",
    count: () => 0,
    reasoning:
      "A flat fee does not move with headcount, so neither of your answers changes it. That cuts both ways and the row says so: a flat fee gets cheaper per head as a business grows.",
  }),
  self: Object.freeze({
    mapsTo: "self",
    label: "the people who originate money",
    count: (p) => p.officeSeats,
    reasoning:
      "FieldQuo's own unit. The count is not taken on trust: this page builds a roster of the shape you described and runs it through isBillableSeat in lib/pricing/ladder.js — the same function that decides a real customer's bill — rather than a second copy of the rule written here.",
  }),
});

export function countingRuleFor(unitKey) {
  const unit = PRICING_UNITS[unitKey];
  if (!unit) return null;
  return COUNTING_RULES[unit.mapsTo] || null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   The questions
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Two questions, because one number cannot be mapped onto six pricing units.
 *
 * Bounds are refused rather than clamped, for the reason savings.js gives:
 * clamping 900 to 500 answers a question the visitor did not ask and then
 * prints a total built on it.
 */
export const INPUT_FIELDS = Object.freeze([
  Object.freeze({
    key: "officeSeats",
    kind: "number",
    required: true,
    min: 0,
    max: 500,
    label: "People who quote, schedule or invoice",
    help: "Anyone who creates or changes the paperwork — in the office or out of a van. Every company below charges you for these people, and they are what a FieldQuo plan is priced on.",
  }),
  Object.freeze({
    key: "fieldCrew",
    kind: "number",
    required: true,
    min: 0,
    max: 2000,
    label: "People in the field who just need their schedule",
    help: "Technicians, installers, labourers. They see their work, clock in and upload photos. This is the number that moves the answer most, because the companies below disagree completely about whether it costs anything.",
  }),
]);

/** One typed answer, read strictly. Blank, a word, a boolean, an object and a
 *  non-finite number are all ABSENT — never zero. Zero people is an answer; no
 *  answer is not. */
function readNumber(raw, field) {
  if (raw === null || raw === undefined) return { state: "absent", value: null };
  if (typeof raw === "boolean") return { state: "absent", value: null };
  if (typeof raw === "object") return { state: "absent", value: null };
  const text = String(raw).trim();
  if (text === "") return { state: "absent", value: null };
  const n = Number(text);
  if (!Number.isFinite(n)) return { state: "absent", value: null };
  if (n < field.min || n > field.max) return { state: "out_of_range", value: n };
  // Floored AFTER the range test, so "2.7 people" reads as 2 and "-1" is
  // already refused above and never reaches here. A fractional headcount is
  // not a headcount, and rounding up would invent a person.
  return { state: "ok", value: Math.max(0, Math.floor(n)) };
}

export function readInputs(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const values = {};
  const missing = [];
  const outOfRange = [];
  for (const field of INPUT_FIELDS) {
    const read = readNumber(source[field.key], field);
    if (read.state === "ok") values[field.key] = read.value;
    else if (read.state === "out_of_range") outOfRange.push(field.key);
    else if (field.required) missing.push(field.key);
  }
  return { values, missing, outOfRange };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Money, and a band that stays a band
   ═══════════════════════════════════════════════════════════════════════════ */

// A fixed locale, not the visitor's: these strings are rendered on the server
// and again in the browser, and a locale that differs between the two is a
// hydration mismatch that shows up as flickering numbers.
const WHOLE = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 });
const CENTS = new Intl.NumberFormat("en-CA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * A figure, with its cents only where it has any.
 *
 * QuoteIQ publishes $29.99 and $582.50. Rounding those to $30 and $583 on a
 * page that argues about price differences would be quietly restating somebody
 * else's price list, and $29.99 against $99 is the single most quotable number
 * in this comparison — it had better be the number they print.
 */
export function formatAmount(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  return Number.isInteger(v) ? WHOLE.format(v) : CENTS.format(v);
}

/** An amount with the currency it was published in. Never a bare "$": a page
 *  read in Canada showing "$59" is a number pretending to be local. */
export function money(amount, currency) {
  return currency ? `$${formatAmount(amount)} ${currency}` : `$${formatAmount(amount)}`;
}

/**
 * The endpoints of a `Reported`, or null.
 *
 * ══ Why this parses a string ═══════════════════════════════════════════════
 *
 * `Reported` in ./competitors.js keeps its ends in private fields on purpose:
 * there is no `.low`, no `.high`, and `valueOf()` throws so no midpoint can be
 * computed. That guarantee is worth keeping, and this module is not allowed to
 * edit that file to add an accessor.
 *
 * So the ends come back out of the class's own rendering — its one public form
 * — and are immediately re-wrapped in `ScaledBand`, which carries the identical
 * guarantee. Nothing in between ever holds a bare number a template could
 * reach.
 *
 * Returns NULL on anything it cannot read, and the row then says the cost was
 * not established. It never returns one end, never a midpoint, never a guess:
 * if `Reported`'s rendering changes shape this page goes quiet rather than
 * wrong, which is the correct direction for that failure.
 */
const BAND_TEXT = /\$\s?([\d,]+(?:\.\d+)?)\s*[–—-]\s*\$\s?([\d,]+(?:\.\d+)?)/;

export function bandEndpoints(reported) {
  if (!reported || reported.isReported !== true) return null;
  const m = BAND_TEXT.exec(String(reported));
  if (!m) return null;
  const low = Number(m[1].replace(/,/g, ""));
  const high = Number(m[2].replace(/,/g, ""));
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
  if (!(low > 0) || !(low < high)) return null;
  return { low, high };
}

/**
 * A band that has been multiplied by something, and is still a band.
 *
 * Same shape and the same reasoning as `Reported`: private ends, no `.low`, no
 * `.amount`, `valueOf()` throws so `(band + 0) / 2` cannot be written by
 * accident, and `toString()` always carries a label. The one thing it adds is
 * arithmetic — scaling by a headcount, scaling by an uncertain minimum, adding
 * a one-time fee — and it adds it INSIDE the wrapper, so the result never
 * exists as a loose pair of numbers.
 */
export class ScaledBand {
  #low;
  #high;
  #unit;
  #label;

  constructor({ low, high, unit, label }) {
    if (!Number.isFinite(low) || !Number.isFinite(high)) {
      throw new Error("ScaledBand: both ends are required");
    }
    if (!(low < high)) {
      throw new Error("ScaledBand: low must be below high — a band with one end is a number");
    }
    this.#low = low;
    this.#high = high;
    this.#unit = unit || "";
    this.#label = label || "reported";
    Object.freeze(this);
  }

  /** Always true, so a renderer branches on this rather than on a type check. */
  get isBand() {
    return true;
  }

  /** Multiply both ends by a fixed count. Zero or less returns null — a count
   *  of zero would collapse the band to a point, which is the midpoint mistake
   *  wearing a different hat. */
  times(n, { unit, label } = {}) {
    if (!Number.isFinite(n) || n <= 0) return null;
    return new ScaledBand({
      low: this.#low * n,
      high: this.#high * n,
      unit: unit ?? this.#unit,
      label: label ?? this.#label,
    });
  }

  /**
   * Multiply by another BAND — used when the count itself is uncertain.
   *
   * ServiceTitan's Starter tier carries a reported minimum of three to five
   * technicians. A two-van shop is billed at the minimum, and nobody
   * established whether the minimum is three or five, so the count is a band
   * and the product of two bands is low×low to high×high. Taking the midpoint
   * of the minimum to get a single count would be the same mistake as taking
   * the midpoint of the price.
   */
  timesBand({ low, high }, { unit, label } = {}) {
    if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
    if (!(low > 0) || !(low <= high)) return null;
    const lo = this.#low * low;
    const hi = this.#high * high;
    if (!(lo < hi)) return null;
    return new ScaledBand({ low: lo, high: hi, unit: unit ?? this.#unit, label: label ?? this.#label });
  }

  /** Add another band, end to end — "a year of subscription PLUS a one-time
   *  implementation fee", which is two bands and one cost. */
  plus(other, { unit, label } = {}) {
    if (!(other instanceof ScaledBand)) return this;
    return new ScaledBand({
      low: this.#low + other.#low,
      high: this.#high + other.#high,
      unit: unit ?? this.#unit,
      label: label ?? this.#label,
    });
  }

  /** What a fixed FieldQuo figure saves against this band — itself a band, and
   *  never wider than the band it came from. Clamped at zero at both ends: a
   *  competitor being cheaper is reported by the caller as exactly that, and is
   *  never smuggled through here as a small positive saving. */
  savingAgainst(fixed, { unit, label } = {}) {
    const f = Number(fixed);
    if (!Number.isFinite(f)) return null;
    const low = Math.max(0, this.#low - f);
    const high = Math.max(0, this.#high - f);
    if (!(low < high)) return null;
    return new ScaledBand({ low, high, unit: unit ?? this.#unit, label: label ?? "somewhere between" });
  }

  /** Is a fixed figure below, above, or inside this band? Three answers, never
   *  two: a band that straddles the other number has no winner, and saying it
   *  does is how a range quietly becomes a midpoint. */
  compareToFixed(fixed) {
    const f = Number(fixed);
    if (!Number.isFinite(f)) return "unclear";
    if (f < this.#low) return "below";
    if (f > this.#high) return "above";
    return "overlapping";
  }

  toString() {
    const unit = this.#unit ? ` ${this.#unit}` : "";
    return `${this.#label} $${formatAmount(this.#low)}–$${formatAmount(this.#high)}${unit}`;
  }

  toJSON() {
    return { reported: this.toString() };
  }

  /** Refuses to be a number. This is what stops the midpoint. */
  valueOf() {
    throw new Error(
      "ScaledBand: refuses to be used as a number. A band of what buyers say they paid has no midpoint — render it with toString(), which carries its label.",
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   The capability set we are matched on
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * What "the same thing" means when we match tiers.
 *
 * Drawn from COMPARABLE_FEATURES in ./competitors.js — the cross-vendor
 * vocabulary — rather than from a list typed here, because a feature named on
 * a public page has to be one somebody proved against the product AND against
 * theirs. A capability added there widens this comparison automatically.
 *
 * ══ Why this is not built from their feature PROSE ═════════════════════════
 *
 * Several competitors carry `includedFeatures` and `addsOverPreviousTier` lists
 * in their own words — "job costing", "MapMeasure Pro", "InstaQuote". Matching
 * those strings against our matrix would let this page decide that their
 * "estimating" is or is not our "quotes", which is precisely the straw man
 * ./competitors.js refuses when it says their lists are "kept in their words,
 * not translated into our feature vocabulary". So the match is made ONLY on the
 * structured `features` map, whose values are the module's own closed
 * vocabulary. Where a tier carries no such map the row says nobody established
 * it — which is the correct amount to say about a thing nobody checked, and is
 * a gap in the DATA rather than in this arithmetic.
 */
export const CAPABILITY_SET = Object.freeze(
  Object.values(COMPARABLE_FEATURES).map((f) =>
    Object.freeze({ key: f.key, label: f.label, fieldquo: f.fieldquo }),
  ),
);

export const BASIS_CAPABILITY = "capability_matched";
export const BASIS_CHEAPEST = "cheapest_published";

export const BASES = Object.freeze({
  [BASIS_CAPABILITY]: Object.freeze({
    key: BASIS_CAPABILITY,
    title: "Priced on what you actually get",
    intro:
      "The cheapest tier of theirs that carries what FieldQuo puts in every plan, wherever it sits in their table. Matching on position instead — their third tier against our third — credits a plan with features it does not have and understates ours.",
  }),
  [BASIS_CHEAPEST]: Object.freeze({
    key: BASIS_CHEAPEST,
    title: "The cheapest thing they publish at your size",
    intro:
      "Whatever is in it. This is the other half and it is where we can lose: if you genuinely need only estimates, invoicing and scheduling, somebody may sell you that for less than we do. A contractor sold nine features when he needed four churns, which helps nobody.",
  }),
});

/* ═══════════════════════════════════════════════════════════════════════════
   The gate the caveats sit behind
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * A set of comparison rows that cannot be read until the disclosures have been.
 *
 * ══ Why the rows are not simply an array ═══════════════════════════════════
 *
 * Two things must appear beside any headcount comparison this module produces:
 * what crew can and cannot do (CREW_CAPABILITY), and the capabilities FieldQuo
 * does not have at all (FIELDQUO_LACKS, resolved per competitor — including the
 * cheaper entry price and the two things QuoteIQ Elite has that we do not).
 * Both are inconvenient, both are one deletion away from being "tidied" out of
 * a template, and neither leaves a mark when it goes.
 *
 * A comment asking a renderer to include them is a convention, and conventions
 * are what a template in a hurry drops. So `rows` THROWS until both disclosures
 * have been reached. A page that renders the table without them does not render
 * a slightly worse page — it does not render at all, and
 * scripts/check-cost-compare.mjs proves that by deleting each disclosure from
 * the component and watching the page fail.
 *
 * `count` is deliberately outside the gate so a renderer can ask "is there
 * anything here at all" before drawing the section. Without that, the gate
 * would force the caveats onto a page with an empty table.
 */
export class GatedComparison {
  #rows;
  #crewCapability;
  #concessions;
  #seen = new Set();

  constructor({ rows, crewCapability, concessions }) {
    this.#rows = Object.freeze(rows.map((r) => Object.freeze(r)));
    this.#crewCapability = crewCapability;
    this.#concessions = Object.freeze(concessions.map((c) => Object.freeze(c)));
  }

  /** How many rows there are. Ungated on purpose — see the note above. */
  get count() {
    return this.#rows.length;
  }

  /** What crew can and cannot do. Reading this unlocks half the gate. */
  get crewCapability() {
    this.#seen.add("crew");
    return this.#crewCapability;
  }

  /** What FieldQuo does not do, resolved per competitor. Unlocks the rest. */
  get concessions() {
    this.#seen.add("concessions");
    return this.#concessions;
  }

  get rows() {
    const missing = [];
    if (!this.#seen.has("crew")) missing.push("crewCapability");
    if (!this.#seen.has("concessions")) missing.push("concessions");
    if (missing.length) {
      throw new Error(
        `costCompare: the comparison rows were read before ${missing.join(
          " and ",
        )}. A headcount comparison may not be rendered without them — read those first and render what they contain.`,
      );
    }
    return this.#rows;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   Pricing one competitor, one basis
   ═══════════════════════════════════════════════════════════════════════════ */

export const ROW_PRICED = "priced";
export const ROW_REPORTED = "reported";
export const ROW_NOT_ESTABLISHED = "not_established";
export const ROW_UNMAPPED = "unmapped";

/**
 * A withholding reason with the money taken out of it.
 *
 * Several reasons from ./competitors.js QUOTE the figure they are refusing —
 * "the relationship between the $49/mo regular rate and the $29/mo…" — so
 * printing one verbatim publishes the number it withholds. A disclaimer under a
 * number does not stop a reader taking the number.
 *
 * Deliberately the same rule as `redactAmounts` in
 * app/(marketing)/compare/[slug]/ComparisonPage.js. The two are asserted to
 * agree on every real reason in the data by scripts/check-cost-compare.mjs —
 * importing a React page module into a pure library to share one regex would be
 * the worse trade, and an unasserted copy would be the worst of the three.
 */
export function withoutAmounts(reason) {
  return String(reason ?? "").replace(/\$\s?\d[\d,]*(?:\.\d+)?/g, "[amount withheld]");
}

/** A published figure as a comparable annual number, in its own currency. */
function annualFrom(figure) {
  const p = figure?.price;
  if (p?.kind !== PRICE_AMOUNT) return null;
  if (!Number.isFinite(p.amount) || p.amount <= 0) return null;
  if (p.per === "year") return p.amount;
  if (p.per === "month") return p.amount * A("months_per_year");
  return null;
}

/** Their own selectors, in their own words, for a figure's coordinates. */
export function coordinateLabel(axis) {
  if (!axis) return "";
  const parts = [];
  if (axis.teamSize && TEAM_SIZES[axis.teamSize]) parts.push(TEAM_SIZES[axis.teamSize].label);
  if (axis.billing && BILLING_MODES[axis.billing]) parts.push(BILLING_MODES[axis.billing].label);
  return parts.join(" · ");
}

/** Is this figure sold on a term we are not asking the visitor to make? Our own
 *  side of every row is twelve uncommitted months, so a competitor shown at a
 *  prepaid annual rate is being shown at their BEST price against our list one.
 *  That leans against us, which is the right direction — and it is said out
 *  loud rather than left for somebody to notice. */
function commitmentCaveat(figure, competitorName) {
  const billing = figure?.axis?.billing;
  if (!billing || billing === "monthly_none") return null;
  const mode = BILLING_MODES[billing];
  return `This is ${competitorName}'s "${mode ? mode.label : billing}" rate — their discount for committing — set against twelve uncommitted months of ours. The comparison is being made in their favour: our own year, committed, is cheaper than the figure shown for us.`;
}

/** Does this figure carry every capability in the set, established as INCLUDED?
 *  FEATURE_UNKNOWN is neither present nor absent, so an uninspected tier can
 *  never win this by default — comparableTier's own rule. */
function carriesCapabilities(figure) {
  if (CAPABILITY_SET.length === 0) return false;
  return CAPABILITY_SET.every((c) => figure.features?.[c.key] === FEATURE_INCLUDED);
}

/** Every publishable figure of theirs, with its annual equivalent attached. */
function publishableOf(comp, asOf) {
  return (comp.figures || [])
    .map((f) => ({ figure: f, annual: annualFrom(f) }))
    .filter((x) => x.annual !== null && withholdReason(x.figure, asOf) === null);
}

/** The first reason we are withholding anything at all, redacted, so a row that
 *  cannot be priced says WHY rather than going blank. */
function firstWithheldReason(comp, asOf, filter = () => true) {
  for (const f of comp.figures || []) {
    if (!filter(f)) continue;
    const reason = withholdReason(f, asOf);
    if (reason) return withoutAmounts(reason);
  }
  return null;
}

/** Jobber's own band for a headcount — their selector, not our bucketing. */
function teamBandFor(total) {
  const bands = Object.values(TEAM_SIZES);
  const closed = bands.find((b) => b.usersIncluded !== null && total <= b.usersIncluded);
  // `usersIncluded: null` is their open-ended top band. It is the right answer
  // for anybody past the largest closed band, and is reached only after every
  // closed band has been tested — it is not a fallback for a missing one.
  return closed || bands.find((b) => b.usersIncluded === null) || null;
}

/** How many of their user slots this business needs. `unlimitedSeats` covers
 *  any headcount; a null count with no unlimited flag covers nothing, because
 *  "not stated" is not "unlimited". */
function coversUsers(figure, users) {
  if (figure.unlimitedSeats === true) return true;
  return Number.isFinite(figure.seatsIncluded) && figure.seatsIncluded >= users;
}

/**
 * One competitor priced on one basis.
 *
 * Always returns a row. There is no path that drops a competitor silently:
 * every refusal carries the sentence explaining it, because an absent row on a
 * comparison page reads as an admission we could not beat them, and a blank
 * cell reads as carelessness. ./competitors.js makes the same argument about
 * withheld figures and it applies with more force here, where the visitor asked
 * a direct question.
 */
function priceCompetitor(comp, { basis, people, asOf }) {
  const unit = PRICING_UNITS[comp.pricingUnit] || null;
  const counting = countingRuleFor(comp.pricingUnit);

  const base = {
    key: comp.id,
    name: comp.name,
    homepage: comp.homepage,
    unit,
    unitSourcing: comp.pricingUnitSourcing || null,
    counting,
    countedHere: counting ? counting.count(people) : null,
    // The unit's own caveat, carried on every row whatever its status. It is
    // the sentence that keeps a headcount comparison honest and it is written
    // in ./competitors.js beside the unit it belongs to, not here.
    unitCaveat: unit ? unit.caveat : null,
    geoCaveat: comp.geoCaveat || null,
    caveats: [],
    tier: null,
    coordinate: "",
    currency: null,
    annualFirstYear: null,
    annualOngoing: null,
    band: null,
    ongoingBand: null,
    monthlyBand: null,
    seatsIncluded: null,
    source: null,
    provenance: null,
    reason: null,
  };

  if (!unit || !counting) {
    return {
      ...base,
      status: ROW_UNMAPPED,
      reason: `We have not established what unit ${comp.name} prices, so there is nothing to map your answers onto. A number here would be a guess about somebody else's price list.`,
    };
  }

  if (comp.pricingUnit === UNIT_PER_TECHNICIAN) {
    return priceReported(comp, { people, asOf, base });
  }

  let candidates = publishableOf(comp, asOf);
  let emptyReason = null;

  if (comp.pricingUnit === UNIT_PER_USER || comp.pricingUnit === UNIT_PER_SEAT) {
    const users = counting.count(people);
    const covered = candidates.filter((c) => coversUsers(c.figure, users));
    if (covered.length === 0) {
      const ceiling = candidates.reduce(
        (max, c) => Math.max(max, Number(c.figure.seatsIncluded) || 0),
        0,
      );
      emptyReason =
        ceiling > 0
          ? `The largest plan ${comp.name} publishes a price for includes ${ceiling} ${
              ceiling === 1 ? "user" : "users"
            }, and a business of your shape is ${users}. What an additional user costs appears on their page as a footnote rather than as a figure recorded with a source and a date, so there is no honest number to put here.`
          : `Nothing ${comp.name} publishes states how many users it includes, so we cannot tell which of their plans fits ${users} ${
              users === 1 ? "person" : "people"
            }. "Not stated" is not "unlimited".`;
    }
    candidates = covered;
  }

  if (comp.pricingUnit === UNIT_TEAM_SIZE_BAND) {
    const band = teamBandFor(counting.count(people));
    const inBand = candidates.filter((c) => c.figure.axis?.teamSize === band?.key);
    if (inBand.length === 0) {
      const why = firstWithheldReason(comp, asOf, (f) => f.axis?.teamSize === band?.key);
      emptyReason = why
        ? `${comp.name}'s own selector has a “${band?.label}” setting, and we are not publishing what it shows: ${why}.`
        : `${comp.name}'s own selector has a “${band?.label}” setting and nobody recorded what it shows. It has deliberately not been extrapolated from the bands below it.`;
    }
    candidates = inBand;
    base.coordinateBand = band?.label || null;
  }

  if (comp.pricingUnit === UNIT_FLAT) {
    base.caveats.push(
      `${comp.name}'s fee does not move with headcount, so this figure is the same whatever you answered. That cuts both ways: past some size a flat fee beats a per-seat one, and this row is where you would see it.`,
    );
  }

  if (basis === BASIS_CAPABILITY) {
    const carrying = candidates.filter((c) => carriesCapabilities(c.figure));
    if (carrying.length === 0 && candidates.length > 0) {
      const what =
        CAPABILITY_SET.length === 1
          ? `“${CAPABILITY_SET[0].label}”`
          : "everything FieldQuo puts in every plan";
      emptyReason = `Nobody has established which ${comp.name} tier carries ${what}. An uninspected tier is not a cheaper tier — it is one nobody looked at — so this comparison stays empty rather than crediting them with a feature or denying them one. Their published prices are in the other table, and the full side-by-side is on /compare.`;
    }
    candidates = carrying;
  }

  if (candidates.length === 0) {
    return {
      ...base,
      status: ROW_NOT_ESTABLISHED,
      reason:
        emptyReason ||
        `There is nothing on ${comp.name}'s pricing page that we can publish as a price at this size. Every figure we hold for them is withheld, with its own reason, on /compare.`,
    };
  }

  const best = candidates.reduce((a, b) => (b.annual < a.annual ? b : a));
  const figure = best.figure;
  const commitment = commitmentCaveat(figure, comp.name);

  return {
    ...base,
    status: ROW_PRICED,
    tier: { id: figure.id, label: figure.label },
    coordinate: coordinateLabel(figure.axis),
    currency: figure.price.currency,
    annualFirstYear: best.annual,
    annualOngoing: best.annual,
    seatsIncluded: figure.unlimitedSeats === true ? "unlimited" : figure.seatsIncluded ?? null,
    source: figure.source,
    provenance: `Read from a ${figure.observedFrom} connection on ${figure.checked}`,
    caveats: commitment ? [...base.caveats, commitment] : base.caveats,
  };
}

/**
 * ServiceTitan, whose price is a rumour with a shape.
 *
 * Everything here is third-hand and every string it produces says so.
 * ./competitors.js gates it through `reportedWithholdReason` rather than
 * `withholdReason` precisely because "may we state this as their price" and
 * "may we state that buyers said this" are different questions with different
 * answers, and only the second one is ours to ask.
 *
 * The band is scaled by the technician count — raised to their reported
 * MINIMUM where the count falls under it, because a minimum is part of what a
 * small shop actually pays — and the reported implementation fee is added to
 * the first year. Nothing ever becomes a single number.
 */
function priceReported(comp, { people, asOf, base }) {
  const technicians = base.countedHere;
  const entries = publishableReportedCosts(asOf).filter((r) => r.competitorId === comp.id);
  const terms = (comp.reportedTerms || []).map((t) => `${t.statement} — ${t.whyItMatters}`);

  if (entries.length === 0) {
    return {
      ...base,
      status: ROW_NOT_ESTABLISHED,
      caveats: terms,
      reason: `${comp.name} publishes no price at all, and the second-hand figures we hold for them are not in a state we will print.`,
    };
  }

  const withEnds = entries
    .map((e) => ({ entry: e, ends: bandEndpoints(e.price.band) }))
    .filter((e) => e.ends !== null);
  if (withEnds.length === 0) {
    return {
      ...base,
      status: ROW_NOT_ESTABLISHED,
      caveats: terms,
      reason: `The reported bands for ${comp.name} did not come back in a shape this page can scale, so no figure is shown. Their reported terms are below, and they are the part of this worth reading anyway.`,
    };
  }

  // The cheapest reported tier, which is the conservative choice: it understates
  // what a shop this size would be quoted, and the dearer tiers are named in the
  // caveat rather than silently dropped.
  const cheapest = withEnds.reduce((a, b) => (b.ends.low < a.ends.low ? b : a));
  const entry = cheapest.entry;

  if (technicians <= 0) {
    return {
      ...base,
      status: ROW_NOT_ESTABLISHED,
      caveats: terms,
      reason: `${comp.name} is reported to price per technician, and you told us you have nobody in the field. A per-technician price has nothing to multiply, and what they charge an office-only business was never established — so there is no figure here rather than a zero.`,
    };
  }

  const perTech = new ScaledBand({
    low: cheapest.ends.low,
    high: cheapest.ends.high,
    unit: "per technician per month",
    label: "Contractors report paying",
  });

  // ── The reported minimum, which is part of what a small shop pays ────────
  //
  // Their entry tier is reported to have a minimum of three to five
  // technicians. A two-van shop does not pay for two. Nobody established
  // whether the minimum is three or five, so the billed COUNT is itself a band
  // and the product of two bands runs low×low to high×high — taking the
  // midpoint of the minimum to get one count would be the same mistake as
  // taking the midpoint of the price.
  const minimum = bandEndpoints(entry.minimumTechnicians);
  const billedLow = minimum ? Math.max(technicians, minimum.low) : technicians;
  const billedHigh = minimum ? Math.max(technicians, minimum.high) : technicians;
  const minimumBites = minimum !== null && technicians < minimum.high;

  const monthly = minimumBites
    ? perTech.timesBand(
        { low: billedLow, high: billedHigh },
        {
          unit: `a month — billed at their reported minimum, not at your ${technicians} ${
            technicians === 1 ? "technician" : "technicians"
          }`,
        },
      )
    : perTech.times(technicians, {
        unit: `a month for ${technicians} ${technicians === 1 ? "technician" : "technicians"}`,
      });

  if (!monthly) {
    return {
      ...base,
      status: ROW_NOT_ESTABLISHED,
      caveats: terms,
      reason: `The reported band for ${comp.name} could not be scaled to a business of this shape without collapsing to a single number, which is the one thing a reported band may never become.`,
    };
  }

  const ongoing = monthly.times(A("months_per_year"), { unit: "a year, subscription only" });
  const implementation = bandEndpoints(entry.alsoReported);
  const firstYear = implementation
    ? ongoing.plus(
        new ScaledBand({
          low: implementation.low * A("implementation_fee_first_year"),
          high: implementation.high * A("implementation_fee_first_year"),
          unit: "one-time",
          label: "an implementation fee of",
        }),
        { unit: "in the first year, including the reported one-time implementation fee" },
      )
    : ongoing;

  const caveats = [reportedCostText(entry, { subject: comp.name })];
  if (withEnds.length > 1) {
    caveats.push(
      `This is their ${entry.label} tier, the cheapest of the ${withEnds.length} bands buyers report. The others are reported higher, so the figure above is a floor and not a total.`,
    );
  }
  if (minimumBites) {
    caveats.push(
      `You told us about ${technicians} in the field and their ${entry.label} tier carries ${entry.minimumTechnicians}, so the figure above is billed at that minimum rather than at your headcount. Below the minimum, the minimum IS the entry price.`,
    );
  }
  if (!implementation) {
    caveats.push(
      "No implementation fee is included above, because none was recorded in a shape this page could add. Where one is reported it runs to five figures and belongs in the first year.",
    );
  }
  caveats.push(...terms);

  return {
    ...base,
    status: ROW_REPORTED,
    tier: { id: entry.id, label: entry.label },
    currency: entry.price.currency,
    band: firstYear,
    ongoingBand: ongoing,
    monthlyBand: monthly,
    caveats,
    provenance: provenanceLabel(entry, { subject: comp.name }),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   FieldQuo's own side
   ═══════════════════════════════════════════════════════════════════════════ */

/** The largest business the published ladder has a price for. */
export const LADDER_CEILING = Object.freeze({
  seats: Math.max(...SEAT_LADDER.map((t) => t.seats)),
  crew: Math.max(...SEAT_LADDER.map((t) => t.crewSeats)),
  people: Math.max(...SEAT_LADDER.map((t) => t.seats + t.crewSeats)),
});

/**
 * What a business of this shape costs on FieldQuo — through the product's own
 * rules, never restated.
 *
 * The roster is BUILT and COUNTED rather than the visitor's numbers being taken
 * at face value. `isBillableSeat` is what decides a real customer's bill, and a
 * marketing page using a second, simpler definition would be quoting a price
 * the product does not charge — the same failure as retyping 99 into a
 * template, one level of indirection up.
 *
 * A roster that fits no rung returns `fits: false` rather than the top tier.
 * The ladder's own comment makes the argument: seating twelve people on a plan
 * for ten bills them for ten and locks two out.
 */
export function fieldquoCost({ officeSeats, fieldCrew }) {
  const crewGrid = CREW_PRESET.values;
  const roster = [];
  for (let i = 0; i < officeSeats; i += 1) {
    // An admin is unconditionally a seat under isBillableSeat, which is exactly
    // what "somebody who quotes, schedules or invoices" means here.
    roster.push({ role: "admin", permissions: null, active: true });
  }
  for (let i = 0; i < fieldCrew; i += 1) {
    roster.push({ role: "employee", permissions: crewGrid, active: true });
  }
  const counted = countSeats(roster);
  const tier = tierFor({ seats: counted.seats, crew: counted.crew });

  const shared = {
    unit: PRICING_UNITS[FIELDQUO_PRICING_UNIT],
    counting: COUNTING_RULES.self,
    countedSeats: counted.seats,
    countedCrew: counted.crew,
    monthsPerYear: A("months_per_year"),
    payForMonths: A("months_per_year") - ANNUAL_FREE_MONTHS,
    ceiling: LADDER_CEILING,
  };

  if (!tier) {
    return Object.freeze({
      ...shared,
      fits: false,
      tierKey: null,
      label: null,
      monthly: 0,
      annualAtMonthly: 0,
      annualCommitted: 0,
      includedSeats: null,
      includedCrew: null,
    });
  }

  return Object.freeze({
    ...shared,
    fits: true,
    tierKey: tier.tierKey,
    label: tier.label,
    monthly: tier.price,
    annualAtMonthly: tier.price * A("fieldquo_months_charged"),
    annualCommitted: defaultAnnualPrice(tier.price),
    includedSeats: tier.seats,
    includedCrew: tier.crewSeats,
  });
}

/**
 * What we save against one row — or what they save against us, said plainly.
 *
 * ══ The four shapes ════════════════════════════════════════════════════════
 *
 * A fixed competitor figure gives a fixed saving, in either direction. A
 * reported band gives a band, and it stays a band. A band that STRADDLES our
 * price gives neither: it says so, because "somewhere between saving money and
 * spending more" is the honest answer and picking the flattering end of it is
 * the midpoint mistake again. A row with no figure gives nothing.
 *
 * Guarantees, asserted rather than observed: never NaN, never negative where a
 * saving is claimed, and never larger than the larger of the two figures.
 */
export function savingAgainst(row, fieldquoAnnual) {
  const ours = Number(fieldquoAnnual);
  // Zero is not a FieldQuo price — it is what fieldquoCost returns when the
  // roster fits no rung on the published ladder. Treating it as "free" would
  // print the competitor's entire bill as a saving against a plan we do not
  // sell, which is the largest single overstatement this page could make.
  if (!Number.isFinite(ours) || ours <= 0) return null;

  if (row.status === ROW_REPORTED && row.band) {
    const side = row.band.compareToFixed(ours);
    if (side === "below") {
      const perMonth = ours / A("months_per_year");
      return Object.freeze({
        direction: "fieldquo",
        band: row.band.savingAgainst(ours, { unit: "a year" }),
        monthlyBand:
          row.monthlyBand && row.monthlyBand.compareToFixed(perMonth) === "below"
            ? row.monthlyBand.savingAgainst(perMonth, { unit: "a month" })
            : null,
        fixed: null,
        fixedMonthly: null,
      });
    }
    if (side === "above") {
      return Object.freeze({
        direction: "competitor",
        band: null,
        monthlyBand: null,
        fixed: null,
        fixedMonthly: null,
      });
    }
    return Object.freeze({
      direction: "unclear",
      band: null,
      monthlyBand: null,
      fixed: null,
      fixedMonthly: null,
    });
  }

  if (row.status !== ROW_PRICED || !Number.isFinite(row.annualFirstYear)) return null;

  const theirs = row.annualFirstYear;
  const gap = theirs - ours;
  if (gap === 0) {
    return Object.freeze({
      direction: "level",
      band: null,
      monthlyBand: null,
      fixed: 0,
      fixedMonthly: 0,
    });
  }
  // Never wider than the larger figure. Both sides are non-negative so this is
  // arithmetically true anyway; the clamp is what makes it a GUARANTEE rather
  // than an observation about the data that happens to be in the file today.
  const magnitude = Math.min(Math.abs(gap), Math.max(theirs, ours));
  return Object.freeze({
    direction: gap > 0 ? "fieldquo" : "competitor",
    band: null,
    monthlyBand: null,
    fixed: magnitude,
    fixedMonthly: magnitude / A("months_per_year"),
  });
}

/**
 * Which row is cheapest, including ours — or null when nothing can be ranked.
 *
 * A reported BAND is never ranked against a fixed figure. It has no single
 * value, and deciding it is cheapest or dearest by one of its ends is the
 * midpoint mistake with an extra step. So a band can only ever be described,
 * never coloured green.
 */
export function cheapestOf(rows, fieldquo) {
  const competitors = rows
    .filter((r) => r.status === ROW_PRICED && Number.isFinite(r.annualFirstYear))
    .map((r) => ({ key: r.key, name: r.name, annual: r.annualFirstYear }));
  const ranked = [...competitors];
  if (fieldquo.fits) {
    ranked.push({ key: "fieldquo", name: "FieldQuo", annual: fieldquo.annualAtMonthly });
  }
  if (ranked.length === 0) return null;
  const winner = ranked.reduce((a, b) => (b.annual < a.annual ? b : a));
  return {
    ...winner,
    // How many rivals were actually in the race. Without this a page can
    // announce that FieldQuo is cheapest on a basis where every competitor row
    // said "not established" — a walkover against an empty table, which is the
    // most flattering and least honest thing this module could produce.
    competitorsRanked: competitors.length,
    totalRows: rows.length,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   The comparison
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Every competitor, priced on one basis, behind the caveat gate.
 *
 * `concessions` is not decoration and not a footnote. FIELDQUO_LACKS is derived
 * from the capability ledger, so the day we ship a phone app one of these
 * disappears on its own — and until then a capability-matched comparison cannot
 * be rendered without the capabilities we would fail. It would be a strange
 * kind of honesty to match on what a plan contains and then go quiet about
 * route optimisation, inventory, and a competitor whose entry price is a third
 * of ours.
 */
function comparisonFor(basis, { people, asOf }) {
  const rows = COMPETITORS.map((comp) => priceCompetitor(comp, { basis, people, asOf }));

  const concessions = FIELDQUO_LACKS.map((capability) => {
    const cap = FIELDQUO_CAPABILITIES[capability];
    const theirs = [];
    for (const comp of COMPETITORS) {
      const both = claims(comp.id);
      const hit = both?.theyHaveWeDont.find((c) => c.capability === capability && c.publishable);
      if (hit) {
        theirs.push({
          competitor: comp.name,
          claim: hit.claim,
          source: hit.source,
          checked: hit.checked,
          provenance: hit.provenance,
        });
      }
    }
    return { capability, label: cap.label, evidence: cap.evidence, theirs };
  });

  return new GatedComparison({ rows, crewCapability: CREW_CAPABILITY, concessions });
}

/**
 * The whole comparison, from raw form state.
 *
 * Never throws on bad input, never returns NaN, never returns a negative
 * saving, never returns a saving larger than the larger of the two figures, and
 * never returns a row without either a figure or the reason there is none.
 * Those are guarantees, asserted against hostile input by
 * scripts/check-cost-compare.mjs, which is the only reason to believe them.
 *
 * `asOf` is required and has no default, for the reason ./competitors.js gives:
 * a caller that does not know what day it is has no business deciding whether a
 * competitor's price is still fresh.
 */
export function compareCosts(raw, { asOf } = {}) {
  if (!asOf) {
    throw new Error(
      "compareCosts: asOf is required — every figure on this page has a staleness window, and a caller that does not know the date cannot apply it",
    );
  }
  const { values, missing, outOfRange } = readInputs(raw);

  if (missing.length || outOfRange.length) {
    return Object.freeze({
      ready: false,
      asOf,
      missing: Object.freeze([...missing]),
      outOfRange: Object.freeze([...outOfRange]),
      people: null,
      fieldquo: null,
      bases: null,
    });
  }

  const people = Object.freeze({
    officeSeats: values.officeSeats,
    fieldCrew: values.fieldCrew,
    total: values.officeSeats + values.fieldCrew,
  });

  return Object.freeze({
    ready: true,
    asOf,
    missing: Object.freeze([]),
    outOfRange: Object.freeze([]),
    people,
    fieldquo: fieldquoCost(people),
    capabilitySet: CAPABILITY_SET,
    bases: Object.freeze({
      [BASIS_CAPABILITY]: comparisonFor(BASIS_CAPABILITY, { people, asOf }),
      [BASIS_CHEAPEST]: comparisonFor(BASIS_CHEAPEST, { people, asOf }),
    }),
    // Said once. Both supported currencies carry the same NUMBER rather than a
    // conversion, so a USD competitor lines up against our figure with no
    // arithmetic anywhere on this page.
    currencyNote: FIELDQUO_REFERENCE.sameNumberBothCurrencies
      ? `Every competitor figure here is in the currency they published it in. FieldQuo's is the same number in ${FIELDQUO_REFERENCE.currencies.join(
          " and ",
        )} — $${FIELDQUO_REFERENCE.entryTier.price} in each is a real price we charge, not a conversion of the other — so nothing on this page has been run through an exchange rate.`
      : `Sold in ${FIELDQUO_REFERENCE.currencies.join(" and ")}.`,
  });
}
