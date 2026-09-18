// lib/estimate/lawnCare.js
//
// Lawn-care PROGRAMS, priced by the size of the lawn. Pure — no I/O — so the
// check script can run it against hostile config and hostile sizes.
//
// ══ What a lawn-care company actually sells ═══════════════════════════════
//
// Not a visit. A PROGRAM: a bundle of treatments across a season ("Fall
// Tune-Up" = weed control + fertilization), plus add-ons the homeowner ticks
// (aeration, grub control, overseeding) and add-on programs sold beside it
// (mosquito control, perimeter pest control). Every one of those is priced
// per property by LAWN SIZE, and the same program at the same size costs the
// same on every street — which is what makes it instant-quotable at all.
//
// This is a different product from `lawn_mowing` (a per-visit price banded
// by lot size, lib/estimate/instantEstimate.js estimateLawnMowing) and is
// kept as its own trade rather than bolted onto it: a mowing company sells
// visits, a treatment company sells programs, and one config that tried to
// be both would be wrong for each.
//
// ══ The 1,500 sq ft floor is a BAND, not a measurement ════════════════════
//
// The competitor whose offer this mirrors (Weed Man, Ottawa and Gatineau,
// observed 2026-09) printed "ESTIMATED LAWN SIZE 1,500 SQ FT" for two
// different houses in two different cities. Two houses do not have the same
// lawn to the square foot; that figure is their MINIMUM PRICING BAND — the
// smallest lawn they price, and the number every smaller (or unmeasured) lawn
// is charged as. So `minSqft` here is a pricing floor and nothing else. The
// public form never presents it as a measurement: when the size shown IS the
// floor rather than a figure from a parcel or a trace, the panel says so and
// offers the trace to correct it (lib/measure/lawnEstimate.js decides which
// it was; `lawnBand` below only reports `belowMinimum`).
//
// ══ Price shape ═══════════════════════════════════════════════════════════
//
// Every priced item carries two numbers in the company's currency:
//
//   base         the price for a lawn up to `minSqft`
//   perThousand  added for each further 1,000 sq ft (or part of one)
//
// A program has no price of its own: it is the SUM of its included services,
// each priced the same way, which is exactly how the competitor prints it
// ("151.76 = Weed Control 75.88 + Fertilization 75.88"). "Best value" goes to
// the program with the lowest price per included service — the cheapest way
// to buy a treatment, which is what a homeowner comparing two cards wants to
// know and cannot work out in their head.
//
// ══ Text is per language ══════════════════════════════════════════════════
//
// Names, descriptions and season windows are stored as { en, fr, es } (a bare
// string is read as every language). The public form and the draft quote
// read the company's / the document's language and fall back to English,
// never to a machine translation — a document keeps the language it was
// created in (AGENTS.md non-negotiable 6), and a program name is part of it.
//
// ══ The browser never sends money ═════════════════════════════════════════
//
// The public form posts a program KEY and add-on KEYS. `lawnCareTotal` is
// the only arithmetic that produces a total, and it reads the company's saved
// config — the same rule as cabinet add-ons and the budget bands (#5).

export const LAWN_MIN_SQFT_DEFAULT = 1500;
export const LAWN_INCREMENT_SQFT = 1000;

/**
 * Above this the property is not a suburban lawn — it is an estate, a farm, a
 * park or the wrong parcel — and a treatment program priced sight-unseen off
 * it would be wrong by a factor. 40,000 sq ft is just under an acre. Refused
 * as needs_site_visit rather than priced; the estimator can still trace and
 * price it by hand.
 */
export const MAX_INSTANT_LAWN_SQFT = 40000;

const LANGS = ["en", "fr", "es"];

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const money = (n) => Math.round(num(n) * 100) / 100;
const safeKey = (k) =>
  typeof k === "string" && /^[A-Za-z][A-Za-z0-9_-]{0,60}$/.test(k) ? k : null;

/**
 * One text field in one language. Accepts a bare string (every language) or
 * an object keyed by language code. Falls back to English, then to the first
 * language that has anything, then to "". Never a machine translation.
 */
export function lawnText(field, language = "en") {
  if (typeof field === "string") return field.trim();
  if (!field || typeof field !== "object") return "";
  const code = String(language || "en").toLowerCase().slice(0, 2);
  for (const k of [code, "en", ...LANGS]) {
    const v = field[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/** A text field with only string values, only the three languages, trimmed. */
function cleanText(field) {
  if (typeof field === "string") return { en: field.trim().slice(0, 600) };
  if (!field || typeof field !== "object") return {};
  const out = {};
  for (const k of LANGS) {
    if (typeof field[k] === "string" && field[k].trim()) out[k] = field[k].trim().slice(0, 600);
  }
  return out;
}

function cleanPrice(item) {
  return {
    base: Math.max(0, money(item?.base)),
    perThousand: Math.max(0, money(item?.perThousand)),
  };
}

/**
 * The boundary between a saved config (browser-authored JSON) and the price
 * maths. Drops anything that is not an object, anything without a usable key,
 * duplicate keys (first wins), and clamps every number to a finite non-
 * negative figure. A program with no services is kept — it prices at zero
 * and readiness refuses to enable it — so the owner sees it rather than
 * losing it.
 *
 * Returns null for a config that is not an object at all.
 */
export function normaliseLawnCareConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) return null;
  const minSqft = Math.max(1, Math.round(num(config.minSqft, LAWN_MIN_SQFT_DEFAULT))) || LAWN_MIN_SQFT_DEFAULT;

  const seen = new Set();
  const programs = [];
  for (const p of Array.isArray(config.programs) ? config.programs : []) {
    const key = safeKey(p?.key);
    if (!p || typeof p !== "object" || !key || seen.has(key)) continue;
    seen.add(key);
    const svcSeen = new Set();
    const services = [];
    for (const s of Array.isArray(p.services) ? p.services : []) {
      const sk = safeKey(s?.key);
      if (!s || typeof s !== "object" || !sk || svcSeen.has(sk)) continue;
      svcSeen.add(sk);
      services.push({
        key: sk,
        name: cleanText(s.name),
        description: cleanText(s.description),
        window: cleanText(s.window),
        ...cleanPrice(s),
      });
    }
    programs.push({
      key,
      name: cleanText(p.name),
      description: cleanText(p.description),
      window: cleanText(p.window),
      services,
    });
  }

  const addOns = [];
  for (const a of Array.isArray(config.addOns) ? config.addOns : []) {
    const key = safeKey(a?.key);
    if (!a || typeof a !== "object" || !key || seen.has(key)) continue;
    seen.add(key);
    addOns.push({
      key,
      // "service" (a one-off treatment) or "program" (its own seasonal
      // bundle, sold beside the main one). Display grouping only — both
      // price the same way.
      kind: a.kind === "program" ? "program" : "service",
      name: cleanText(a.name),
      description: cleanText(a.description),
      window: cleanText(a.window),
      ...cleanPrice(a),
    });
  }

  return { minSqft, programs, addOns };
}

/**
 * Which pricing band a lawn falls in.
 *
 * `bandSqft` is what is priced: the lawn itself, or the floor when the lawn
 * is under it. `increments` is how many per-1,000 steps sit above the floor,
 * rounded UP — 1,850 sq ft on a 1,500 floor is one increment, because the
 * crew treats the whole 1,850, not the first 1,500 of it.
 */
export function lawnBand(areaSqft, minSqft = LAWN_MIN_SQFT_DEFAULT) {
  const floor = Math.max(1, num(minSqft, LAWN_MIN_SQFT_DEFAULT));
  const area = Math.max(0, num(areaSqft));
  const belowMinimum = area < floor;
  const bandSqft = belowMinimum ? floor : Math.round(area);
  const increments = belowMinimum ? 0 : Math.ceil((bandSqft - floor) / LAWN_INCREMENT_SQFT);
  return { areaSqft: Math.round(area), bandSqft, minSqft: floor, increments, belowMinimum };
}

/** One item's price at a band. */
export function lawnItemPrice(item, increments) {
  const inc = Math.max(0, Math.floor(num(increments)));
  return money(num(item?.base) + inc * num(item?.perThousand));
}

function describe(item, language) {
  return {
    key: item.key,
    name: lawnText(item.name, language),
    description: lawnText(item.description, language),
    window: lawnText(item.window, language),
  };
}

/**
 * Every program and add-on, priced for one lawn, in one language — the cards
 * the public form renders. `bestValue` marks the program with the lowest
 * price per included service; ties go to the first listed (the company's own
 * order), and a program with no services or a zero price never wins it.
 */
export function priceLawnCare(rawConfig, areaSqft, language = "en") {
  const config = normaliseLawnCareConfig(rawConfig);
  if (!config) return { ok: false, reason: "not_configured" };
  const band = lawnBand(areaSqft, config.minSqft);

  const programs = config.programs.map((p) => {
    const services = p.services.map((s) => ({
      ...describe(s, language),
      price: lawnItemPrice(s, band.increments),
    }));
    const price = money(services.reduce((t, s) => t + s.price, 0));
    return {
      ...describe(p, language),
      services,
      price,
      perService: services.length && price > 0 ? money(price / services.length) : null,
      bestValue: false,
    };
  });

  let best = null;
  for (const p of programs) {
    if (p.perService == null) continue;
    if (!best || p.perService < best.perService) best = p;
  }
  if (best && programs.filter((p) => p.perService != null).length > 1) best.bestValue = true;

  const addOns = config.addOns.map((a) => ({
    ...describe(a, language),
    kind: a.kind,
    price: lawnItemPrice(a, band.increments),
  }));

  return { ok: true, lawn: band, programs, addOns };
}

/**
 * The total for a selection of KEYS — the only place a lawn-care total is
 * computed. Unknown keys are ignored rather than refused: a stale key from a
 * form that outlived a settings edit prices nothing, which the caller sees as
 * a line that is not there.
 *
 * Returns ok:false with `no_selection` when nothing priced — a program key
 * that matches nothing and no add-ons is not a $0 job, it is no job.
 */
export function lawnCareTotal(rawConfig, areaSqft, { programKey = null, addOnKeys = [] } = {}, language = "en") {
  const priced = priceLawnCare(rawConfig, areaSqft, language);
  if (!priced.ok) return priced;

  const lines = [];
  const program = programKey ? priced.programs.find((p) => p.key === programKey) : null;
  if (program) {
    lines.push({
      kind: "program",
      key: program.key,
      name: program.name,
      description: program.description,
      window: program.window,
      price: program.price,
      services: program.services.map((s) => ({ key: s.key, name: s.name, description: s.description, window: s.window, price: s.price })),
    });
  }
  const wanted = new Set((Array.isArray(addOnKeys) ? addOnKeys : []).filter((k) => typeof k === "string"));
  for (const a of priced.addOns) {
    if (!wanted.has(a.key)) continue;
    lines.push({ kind: "addon", addOnKind: a.kind, key: a.key, name: a.name, description: a.description, window: a.window, price: a.price, services: [] });
  }
  if (!lines.length) return { ok: false, reason: "no_selection", lawn: priced.lawn };

  const total = money(lines.reduce((t, l) => t + l.price, 0));
  return { ok: true, lawn: priced.lawn, lines, total, offer: priced };
}

/**
 * The instant-estimator entry (INSTANT_ESTIMATE_TRADES.lawn_care.fn).
 *
 * Takes the measurement the lawn measurer produced — `areaSqft`, its `source`
 * ("parcel_ottawa" | "parcel_gatineau" | "traced" | "minimum"), and the
 * homeowner's selection carried on it as `programKey` / `addOnKeys` — and the
 * company's config. Returns the same shape every other estimator does so the
 * request route, the draft and the email need no special case: low, point
 * and high are all the one total, because a program has a price, not a
 * range. `offer` carries every card priced, for the form.
 *
 * A measurement the measurer marked untrustworthy (the lawn over the
 * instant ceiling, the address it could not place) is refused as
 * needs_site_visit — the gutter pattern — rather than priced off the floor.
 */
export function estimateLawnCare(measurements, config, { language = "en" } = {}) {
  const area = num(measurements?.areaSqft);
  if (!(area > 0)) return { ok: false, reason: "no_measurement" };
  if (measurements?.trustworthy === false) return { ok: false, reason: "needs_site_visit" };
  if (area > MAX_INSTANT_LAWN_SQFT) return { ok: false, reason: "needs_site_visit" };

  const normalised = normaliseLawnCareConfig(config);
  if (!normalised || !normalised.programs.length) return { ok: false, reason: "material_not_configured" };

  const offer = priceLawnCare(normalised, area, language);
  if (!offer.ok) return { ok: false, reason: offer.reason };

  // No selection yet (the /measure preview) prices the cheapest program so
  // the panel has a figure to show under the cards — the figure a homeowner
  // who ticks nothing would pay. Marked as such so the route can say it.
  const selection = {
    programKey: typeof measurements?.programKey === "string" ? measurements.programKey : null,
    addOnKeys: Array.isArray(measurements?.addOnKeys) ? measurements.addOnKeys.filter((k) => typeof k === "string") : [],
  };
  let defaulted = false;
  if (!selection.programKey && !selection.addOnKeys.length) {
    const cheapest = offer.programs.filter((p) => p.price > 0).sort((a, b) => a.price - b.price)[0];
    if (cheapest) {
      selection.programKey = cheapest.key;
      defaulted = true;
    }
  }

  const priced = lawnCareTotal(normalised, area, selection, language);
  if (!priced.ok) return { ok: false, reason: priced.reason };

  const breakdown = [];
  for (const l of priced.lines) {
    breakdown.push({ label: l.name, amount: l.price, kind: l.kind, key: l.key });
    for (const s of l.services) breakdown.push({ label: `  ${s.name}`, amount: s.price, kind: "service", key: s.key, parentKey: l.key });
  }

  return {
    ok: true,
    low: priced.total,
    point: priced.total,
    high: priced.total,
    minimumApplied: priced.lawn.belowMinimum,
    breakdown,
    assumptions: [],
    lawn: priced.lawn,
    offer: { programs: offer.programs, addOns: offer.addOns },
    selection: { ...selection, defaulted },
    lines: priced.lines,
  };
}
