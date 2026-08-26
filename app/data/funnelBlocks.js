// app/data/funnelBlocks.js
//
// The funnel step vocabulary and its sanitiser — the boundary between "what a
// browser sent" and "what is served to the public", exactly like siteBlocks.js
// is for websites. A funnel is an ordered array of typed STEPS; each step is a
// full-screen mobile card. The model (in AI generation) and the builder may only
// produce these kinds and these fields, and everything crossing the boundary is
// clamped here so a stored funnel can never become a script, a layout it didn't
// define, or a javascript: image URL.
//
// Kinds:
//   intro           — hook: headline, subhead, CTA, optional image
//   question_single — one tappable answer; can branch and can map to a scorer key
//   question_multi  — several tappable answers
//   instant_estimate— a REAL price on screen, mid-funnel (see below)
//   form            — the contact capture (name / email / phone)
//   photo_upload    — homeowner attaches photos of the job
//   thankyou        — end screen

import {
  INSTANT_ESTIMATE_TRADES,
  INSTANT_ESTIMATE_DEFAULTS,
} from "@/lib/estimate/instantEstimate";

export const FUNNEL_STEP_KINDS = [
  "intro",
  "question_single",
  "question_multi",
  "instant_estimate",
  "form",
  "photo_upload",
  "thankyou",
];

// Which text fields each kind owns, and their max length. Anything not listed is
// dropped. Mirrors siteBlocks' `editable` whitelist.
const TEXT_FIELDS = {
  intro: { headline: 120, subhead: 300, buttonText: 40 },
  question_single: { question: 160, help: 300 },
  question_multi: { question: 160, help: 300, buttonText: 40 },
  instant_estimate: { headline: 120, subhead: 300, sizeQuestion: 160, buttonText: 40 },
  form: { headline: 120, subhead: 300, buttonText: 40, consent: 300 },
  photo_upload: { headline: 120, subhead: 300, buttonText: 40 },
  thankyou: { headline: 120, subhead: 400 },
};

// ── The instant-estimate step ───────────────────────────────────────────────
//
// Shows the visitor a real number partway through the funnel. The price brain is
// lib/estimate/instantEstimate.js — the same one behind /instant-quote — and
// nothing here reimplements a cent of it. What lives here is only the SHAPE of
// the step, and the clamp that keeps a browser from posting anything into it.
//
// ══ Why the visitor taps a band instead of typing a size ═══════════════════
//
// A funnel is reached from an Instagram or TikTok link: cold, mobile,
// impatient. Asking a stranger to type "how many square feet" is where they
// leave, and it's also the one input that would let the browser hand a number
// to the pricer. Bands solve both: the owner writes the sizes ("A single
// room — about 200 sq ft"), the browser posts a band ID, and the server looks
// the measurement up in its own stored row. Nothing numeric crosses the wire,
// so non-negotiable #5's rule ("the browser never sends money") holds a fortiori
// — it never sends the measurement either.
//
// ══ Which trades can appear on a funnel step ═══════════════════════════════
//
// Derived from INSTANT_ESTIMATE_TRADES rather than listed, so a trade added to
// the estimator becomes offerable here automatically. The filter is on how the
// job is MEASURED: a band can carry typed numbers, so manual_area / manual_units
// / stair_count all work. roof_address needs a satellite lookup per visitor,
// lawn_polygon needs a drawable map and item_picker needs the junk taxonomy —
// none of which is a tap on a full-screen card, and faking them here would be
// the dead control this codebase gets swept for. Those three stay on
// /instant-quote, and the builder says so rather than offering a trade that
// can't render.
const BAND_MEASURES = new Set(["manual_area", "manual_units", "stair_count"]);

export const FUNNEL_ESTIMATE_TRADES = Object.entries(INSTANT_ESTIMATE_TRADES)
  .filter(([, spec]) => BAND_MEASURES.has(spec.measure))
  .map(([trade]) => trade);

// What a band may carry, per measurement kind. These are INTAKE keys — the exact
// names measureForTrade() reads out of a request body — so the estimate route
// hands `{ intake: band.values }` straight to the shipped measurement code
// instead of growing a second copy of it.
const BAND_FIELDS = {
  manual_area: [{ key: "squareFootage", label: "Area (sq ft)", primary: true }],
  manual_units: [
    { key: "doorCount", label: "Doors", primary: true },
    { key: "drawerCount", label: "Drawer fronts", primary: true },
    { key: "boxLinearFt", label: "Box veneer (linear ft)" },
  ],
  stair_count: [
    { key: "treads", label: "Steps", primary: true },
    { key: "railingFt", label: "Railing (linear ft)" },
  ],
};

// Countertops price three ADDITIVE extras on top of the area (edge profile,
// cutouts, backsplash). measureForTrade already forwards them for every
// manual_area trade and the other estimators ignore them, so they're a
// per-trade addition rather than a fourth measurement kind.
const TRADE_EXTRA_FIELDS = {
  countertop: [
    { key: "edgeFt", label: "Upgraded edge (linear ft)" },
    { key: "cutouts", label: "Sink / cooktop cutouts" },
    { key: "backsplashSqft", label: "Backsplash (sq ft)" },
  ],
};

// Where one trade reads FEWER fields than its measurement kind. Cabinet
// refinishing shares manual_units with refacing but has no box-veneer rate —
// its estimator ignores boxLinearFt entirely, so offering the owner a band
// field for it would be a number they can type that changes no price.
const TRADE_BAND_FIELDS = {
  cabinet_refinishing: [
    { key: "doorCount", label: "Doors", primary: true },
    { key: "drawerCount", label: "Drawer fronts", primary: true },
  ],
};

/** The numeric fields a band carries for this trade. Empty for an unknown trade. */
export function bandFieldsFor(trade) {
  const spec = INSTANT_ESTIMATE_TRADES[trade];
  if (!spec || !BAND_MEASURES.has(spec.measure)) return [];
  const base = Object.prototype.hasOwnProperty.call(TRADE_BAND_FIELDS, trade)
    ? TRADE_BAND_FIELDS[trade]
    : BAND_FIELDS[spec.measure] || [];
  return [...base, ...(TRADE_EXTRA_FIELDS[trade] || [])];
}

// ── Assumptions the owner states once, for the whole step ───────────────────
//
// Every area trade carries percentage surcharges the homeowner would normally
// pick on the instant-quote form (interior vs exterior, surface condition,
// access). A funnel can't ask all of them without becoming the form it exists to
// replace — but leaving them unset is not neutral: estimatePainting() defaults
// `scope` to "interior", so an EXTERIOR painting ad would quietly price 30%
// light. Absence of a statement is not a statement, so the owner states it once
// on the step and the visitor never sees the question.
//
// The table mirrors the surcharge wiring inside each estimate* function. It
// can't be read out of them — that wiring is closure code, not data — so a trade
// added there needs a line here. Getting it wrong is not dangerous: an intake
// key the estimator doesn't read, or a value its surcharge map doesn't have,
// resolves to a 0% surcharge, which is exactly today's behaviour.
const TRADE_CHOICES = {
  epoxy: { surfaceCondition: "prepSurcharge" },
  flooring: { surfaceCondition: "prepSurcharge" },
  painting: { scope: "scopeSurcharge", surfaceCondition: "conditionSurcharge" },
  parging: { access: "accessSurcharge", condition: "conditionSurcharge" },
};

const CHOICE_LABELS = {
  scope: "Interior or exterior",
  surfaceCondition: "Surface condition",
  access: "Access",
  condition: "Condition",
};

/**
 * The fixed assumptions this trade can state, and the vocabulary each one
 * accepts. The values come from INSTANT_ESTIMATE_DEFAULTS — the same seed the
 * settings form writes — so the builder can only ever offer a word the
 * company's own surcharge map is keyed by.
 */
export function choiceFieldsFor(trade) {
  const map = TRADE_CHOICES[trade];
  if (!map) return [];
  return Object.entries(map)
    .map(([key, sourceKey]) => ({
      key,
      label: CHOICE_LABELS[key] || key,
      options: Object.keys(INSTANT_ESTIMATE_DEFAULTS[trade]?.[sourceKey] || {}),
    }))
    .filter((f) => f.options.length > 0);
}

// Ordering. Price-first is the DEFAULT because it is the reason this step
// exists: a cold visitor from an ad gives you one screen to prove you're worth
// a phone number, and a number on screen is that proof. It is also the lower-
// capture half of a real business trade-off — price-first means fewer contacts,
// each much warmer; details-first captures more people and converts worse
// because plenty of them only wanted the number. FieldQuo can't make that call
// for a business, so it's a per-step setting; what FieldQuo can do is default to
// the one the feature was built for.
const ESTIMATE_ORDERS = new Set(["price_first", "details_first"]);
export const DEFAULT_ESTIMATE_ORDER = "price_first";

const MAX_BANDS = 8;
// A residential job that measures over a million of anything is a typo or an
// attack, not a kitchen. Clamped rather than rejected so one bad digit costs a
// band, never the page.
const MAX_MEASUREMENT = 1_000_000;

function measureNum(v) {
  const n = Number(v);
  // 1e400 parses to Infinity, which is not finite — so it lands on 0 here and
  // never reaches a multiplication that would produce NaN downstream.
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.min(MAX_MEASUREMENT, Math.max(0, n)) * 100) / 100;
}

// Every band key any supported trade uses. The fallback whitelist for a step
// whose trade doesn't resolve — because the sanitiser's job is to CLAMP what a
// browser sent, not to delete it. Keying off the step's own trade alone meant a
// step with no trade picked yet (or one whose trade was later withdrawn) came
// back from a routine save with every measurement silently zeroed, which is a
// destructive operation wearing a cosmetic label. Another trade's key is inert
// anyway: each estimator reads only the fields it defined.
const ALL_BAND_KEYS = [
  ...new Set(
    [...Object.values(BAND_FIELDS).flat(), ...Object.values(TRADE_EXTRA_FIELDS).flat()].map(
      (f) => f.key,
    ),
  ),
];

function cleanBands(list, trade) {
  if (!Array.isArray(list)) return [];
  const fields = bandFieldsFor(trade);
  const keys = fields.length ? fields.map((f) => f.key) : ALL_BAND_KEYS;
  return list.slice(0, MAX_BANDS).map((b, i) => {
    const values = {};
    // Whitelisted keys only, written onto a fresh object — a posted `price`,
    // `low`, `__proto__` or anything else simply has nowhere to land.
    for (const key of keys) values[key] = measureNum(b?.values?.[key]);
    return {
      id: typeof b?.id === "string" && b.id ? b.id.slice(0, 40) : `b${i}`,
      label: str(b?.label, 120),
      values,
    };
  });
}

// Steps that carry an answer list, and whether the visitor may pick more than one.
const ANSWER_KINDS = new Set(["question_single", "question_multi"]);

// A question answer can map its chosen value onto a lead-scoring input, so a
// funnel budget/timeline question feeds the same triage as the self-quote form.
const ANSWER_MAPS = new Set(["budget", "timeline", ""]);

// The only contact fields a form step may request.
const FORM_FIELDS = ["name", "email", "phone"];

const MAX_STEPS = 24;
const MAX_ANSWERS = 12;

function str(v, max) {
  return typeof v === "string" ? v.slice(0, max) : "";
}

// http(s) only — blocks javascript:/data: exactly as the website sanitiser does.
function safeUrl(value) {
  if (typeof value !== "string") return "";
  const v = value.trim();
  return /^https?:\/\//i.test(v) ? v.slice(0, 2000) : "";
}

// Stable-ish id when one is missing. No Math.random (banned in some run
// contexts and irrelevant here) — index + kind is unique within a funnel.
function stepId(step, i) {
  return typeof step?.id === "string" && step.id ? step.id.slice(0, 40) : `s${i}`;
}

function cleanAnswers(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, MAX_ANSWERS).map((a, i) => {
    const maps = ANSWER_MAPS.has(a?.maps) ? a.maps : "";
    return {
      id: typeof a?.id === "string" && a.id ? a.id.slice(0, 40) : `a${i}`,
      label: str(a?.label, 120),
      // `value` is what gets stored/scored; defaults to the label when unset.
      value: str(a?.value ?? a?.label, 120),
      // Optional per-answer weight for a lightweight quiz score (0–50).
      weight: Number.isFinite(a?.weight) ? Math.max(0, Math.min(50, Math.round(a.weight))) : 0,
      // Branch target step id, or null for "next".
      next: typeof a?.next === "string" && a.next ? a.next.slice(0, 40) : null,
      ...(maps ? { maps } : {}),
    };
  });
}

/**
 * The boundary. Returns a clean, render-safe steps array. Unknown kinds are
 * dropped; a funnel with no steps left falls back to a single thank-you so the
 * public page never renders blank.
 */
export function sanitiseFunnelSteps(steps) {
  const arr = Array.isArray(steps) ? steps.slice(0, MAX_STEPS) : [];
  const clean = [];

  for (let i = 0; i < arr.length; i++) {
    const step = arr[i];
    const kind = FUNNEL_STEP_KINDS.includes(step?.kind) ? step.kind : null;
    if (!kind) continue;

    const out = { id: stepId(step, i), kind };

    const fields = TEXT_FIELDS[kind] || {};
    for (const [field, max] of Object.entries(fields)) {
      if (step[field] != null) out[field] = str(step[field], max);
    }

    if (kind === "intro" || kind === "thankyou" || kind === "photo_upload") {
      const img = safeUrl(step.image);
      if (img) out.image = img;
    }

    if (ANSWER_KINDS.has(kind)) {
      out.answers = cleanAnswers(step.answers);
      // What this question feeds, if anything (budget/timeline). Single-choice
      // only — a multi-select budget makes no sense.
      if (kind === "question_single" && ANSWER_MAPS.has(step.maps) && step.maps) {
        out.maps = step.maps;
      }
    }

    if (kind === "instant_estimate") {
      // The trade must be one this step can actually render. An unknown or
      // unsupported trade becomes "", which estimateStepIssues() reports and the
      // public route treats as unservable — rather than a step that quietly
      // prices something else.
      out.trade = FUNNEL_ESTIMATE_TRADES.includes(step.trade) ? step.trade : "";
      out.order = ESTIMATE_ORDERS.has(step.order) ? step.order : DEFAULT_ESTIMATE_ORDER;
      out.bands = cleanBands(step.bands, out.trade);

      // Fixed assumptions, each checked against its own trade's vocabulary.
      const allowed = choiceFieldsFor(out.trade);
      const assumptions = {};
      for (const f of allowed) {
        const v = step.assumptions?.[f.key];
        if (typeof v === "string" && f.options.includes(v)) assumptions[f.key] = v;
      }
      if (Object.keys(assumptions).length) out.assumptions = assumptions;
      // Note what is NOT copied: no low, no high, no rate, no currency. A price
      // on this step is always computed from the company's saved config at
      // request time; a price that arrived in a save body is discarded here.
    }

    if (kind === "form") {
      const requested = Array.isArray(step.fields) ? step.fields : FORM_FIELDS;
      out.fields = FORM_FIELDS.filter((f) => requested.includes(f));
      // Name is always collected; a form with no way to reply is useless.
      if (!out.fields.includes("name")) out.fields.unshift("name");
      if (!out.fields.includes("email") && !out.fields.includes("phone")) {
        out.fields.push("email");
      }
    }

    clean.push(out);
  }

  if (clean.length === 0) {
    return [{ id: "s0", kind: "thankyou", headline: "Thanks — we'll be in touch." }];
  }
  return clean;
}

// Does this funnel have a way to capture a lead? A funnel with no form step
// collects nothing — the builder warns, and publish is blocked on it.
export function funnelHasForm(steps) {
  return Array.isArray(steps) && steps.some((s) => s?.kind === "form");
}

/** Every instant-estimate step in a funnel, in order. */
export function funnelEstimateSteps(steps) {
  return (Array.isArray(steps) ? steps : []).filter((s) => s?.kind === "instant_estimate");
}

/**
 * What is wrong with an estimate step, judged on the step ALONE — no company,
 * no database. Empty array means "nothing here stops it working"; whether the
 * company's rate card can actually price the bands is a separate question the
 * public route answers by running the real pricer.
 *
 * Returned as codes plus contractor-facing sentences: this is builder copy, and
 * a homeowner never reads why a company's funnel isn't configured (#4).
 */
export function estimateStepIssues(step) {
  const issues = [];
  if (!step || step.kind !== "instant_estimate") return issues;

  if (!step.trade) {
    issues.push({
      code: "no_trade",
      message: "Pick which service this step prices.",
    });
  }

  const bands = Array.isArray(step.bands) ? step.bands : [];
  // A band with nothing positive in it can never produce a number — it is a tap
  // that leads to an apology. Counted rather than deleted on save, so a
  // half-typed band survives until the owner finishes it.
  const usable = bands.filter((b) => Object.values(b?.values || {}).some((v) => Number(v) > 0));
  if (!usable.length) {
    issues.push({
      code: "no_bands",
      message: "Add at least one size option with a measurement in it.",
    });
  } else if (usable.length < bands.length) {
    issues.push({
      code: "empty_band",
      message: "One of the size options has no measurement, so it can't be priced.",
    });
  }
  if (usable.some((b) => !b.label)) {
    issues.push({
      code: "unlabelled_band",
      message: "Every size option needs a label the homeowner can tap.",
    });
  }
  return issues;
}

/**
 * The band the visitor tapped, resolved from the STORED step. The browser posts
 * an id; the measurement comes from here, so a forged body can pick a different
 * band but can never invent one.
 */
export function resolveEstimateBand(step, bandId) {
  if (!step || step.kind !== "instant_estimate") return null;
  const bands = Array.isArray(step.bands) ? step.bands : [];
  const band = bands.find((b) => b.id === bandId);
  if (!band) return null;
  if (!Object.values(band.values || {}).some((v) => Number(v) > 0)) return null;
  return band;
}

/**
 * The intake object measureForTrade() expects, built from a band plus the step's
 * fixed assumptions. Pure: it names keys, never rates.
 */
export function bandIntake(step, band) {
  return { ...(band?.values || {}), ...(step?.assumptions || {}) };
}
