// lib/services/templates.js
//
// The template INSIDE a service: the labour, material and other lines a
// service expands to on an estimate, the discount it opens with, and the
// figures a roofing line takes from the satellite measurement.
//
// ── Why a service holds lines ──────────────────────────────────────────────
//
// A contractor's "Panel upgrade — 200 A" is not one price. It is two labour
// lines (remove the old panel, fit the new one), a materials line (the panel
// itself, taxed differently from the labour) and a new-customer discount, and
// the same three lines every time the service is sold. Product.unitPrice
// stays the company's headline price; `templateLines` is what the estimate
// opens with, and every line is repriceable on the estimate without touching
// the template.
//
// ── Two boundaries, one file ───────────────────────────────────────────────
//
//   sanitiseTemplateLines / sanitiseDefaultDiscount — the boundary between
//     what a browser (or a seed) sent and what a Product row stores. A line
//     with no name is dropped; a negative cost, a NaN qty, a kind the closed
//     list does not know, a measurement key the satellite report does not
//     produce — each is normalised or dropped, never stored as sent.
//   expandTemplate — the boundary between a stored template and the lines an
//     estimate gets: measurements resolved, a seed's USD converted into the
//     company's currency, translations picked for the document's language.
//
// Pure — no database, no React — so scripts/check-service-templates.mjs can
// execute every rule here against hostile input.
//
// ── Money ──────────────────────────────────────────────────────────────────
//
// The browser sends unit prices and unit costs here, because this is the
// CONTRACTOR editing its own price book in Settings — the same as typing a
// rate into Products & Services. Non-negotiable #5 ("the browser never sends
// money amounts") is about CLIENT-facing surfaces; nothing in this file is
// reachable from one, and the check asserts no client route imports it.

import { roundSuggested } from "@/lib/pricing/benchmarkFx";

/** The three kinds a line can be, matching the columns the estimate prints. */
export const LINE_KINDS = ["labour", "material", "other"];

/**
 * The figures lib/measure/roofMeasurement.js#summariseRoof produces, by the
 * names it produces them under (`squares` and `areaSqft` at the top level;
 * the linear feet under `linear`). A template line naming one takes its
 * quantity from the measurement instead of from the typed qty. `wastePct` is
 * not a key but a modifier on a measured line — see expandTemplate.
 */
export const MEASUREMENT_KEYS = [
  "squares",
  "areaSqft",
  "eaveFt",
  "rakeFt",
  "ridgeFt",
  "hipFt",
  "valleyFt",
  "perimeterFt",
];

/** Discount kinds, spelled the way the estimate's own discount is. */
export const DISCOUNT_KINDS = ["fixed", "percent"];

/** Most lines a template may hold — a guard against a runaway client, not a product limit. */
export const MAX_TEMPLATE_LINES = 60;
export const MAX_WASTE_PCT = 50;

const MAX_NAME = 200;
const MAX_DESCRIPTION = 2000;
const MAX_UNIT = 24;

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const money = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = typeof v === "object" && typeof v?.toNumber === "function" ? v.toNumber() : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};
const qtyOf = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) / 1000 : null;
};

/**
 * Per-language { name, description } for a line, in the shape
 * Product.translations documents. Only two-letter language keys with a
 * string name survive; anything else is dropped rather than stored.
 */
function sanitiseTranslations(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const out = {};
  for (const [lang, entry] of Object.entries(input)) {
    if (!/^[a-z]{2}$/.test(lang) || !entry || typeof entry !== "object") continue;
    const name = str(entry.name, MAX_NAME);
    if (!name) continue;
    const description = str(entry.description, MAX_DESCRIPTION);
    out[lang] = description ? { name, description } : { name };
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * One line, or null when it cannot be a line (no name, or not an object).
 * Exported for the check; callers use sanitiseTemplateLines.
 */
export function sanitiseTemplateLine(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const name = str(input.name, MAX_NAME);
  if (!name) return null;
  const kind = LINE_KINDS.includes(input.kind) ? input.kind : "other";
  const line = {
    kind,
    name,
    description: str(input.description, MAX_DESCRIPTION),
    // A line with no qty is one unit — the estimate's own default. Zero is
    // kept as zero: a contractor who typed 0 meant "priced elsewhere".
    qty: qtyOf(input.qty) ?? 1,
    unit: str(input.unit, MAX_UNIT) || (kind === "labour" ? "flat" : "each"),
    unitPrice: money(input.unitPrice),
    unitCost: money(input.unitCost),
    // Labour is taxable in every province and state the product bills in;
    // the capture the shape was copied from marks materials per line. An
    // absent flag is "taxable", never "tax-free".
    taxable: typeof input.taxable === "boolean" ? input.taxable : true,
  };
  if (MEASUREMENT_KEYS.includes(input.measurementKey)) {
    line.measurementKey = input.measurementKey;
    const waste = Number(input.wastePct);
    if (Number.isFinite(waste) && waste > 0) line.wastePct = Math.min(MAX_WASTE_PCT, Math.round(waste * 10) / 10);
  }
  const translations = sanitiseTranslations(input.translations);
  if (translations) line.translations = translations;
  return line;
}

/**
 * What a Product row stores for `templateLines`: an array of clean lines, or
 * null when nothing usable was sent (so an emptied template clears the
 * column rather than storing `[]` beside `null` as two spellings of "none").
 */
export function sanitiseTemplateLines(input) {
  if (!Array.isArray(input)) return null;
  const lines = input.slice(0, MAX_TEMPLATE_LINES).map(sanitiseTemplateLine).filter(Boolean);
  return lines.length ? lines : null;
}

/**
 * What a Product row stores for `defaultDiscount`: { name, kind, amount } or
 * null. A percent over 100 is clamped — a 300 % discount is a typo, not a
 * refund — and a non-positive amount is no discount at all.
 */
export function sanitiseDefaultDiscount(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const kind = DISCOUNT_KINDS.includes(input.kind) ? input.kind : "fixed";
  let amount = money(input.amount);
  if (amount == null || amount <= 0) return null;
  if (kind === "percent") amount = Math.min(100, amount);
  const name = str(input.name, 120) || "Discount";
  return { name, kind, amount };
}

/** A photo URL the catalogue card may show: https only, or null. */
export function sanitiseImageUrl(input) {
  const s = str(input, 2048);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * The text a line shows in `language`, in the shape resolveProductText
 * (lib/i18n/translateContent.js) returns for a product — re-stated here so
 * this file stays free of the AI provider that module imports.
 */
export function lineText(line, language, defaultLanguage = "en") {
  const source = { name: line?.name || "", description: line?.description || "" };
  if (!language || language === defaultLanguage) return { ...source, missing: false };
  const entry = line?.translations?.[language];
  if (!entry?.name) return { ...source, missing: true };
  return {
    name: entry.name,
    description: entry.description || source.description,
    missing: !entry.description && Boolean(source.description),
  };
}

/**
 * Read one measurement off the shape summariseRoof returns — top-level
 * `squares`/`areaSqft`, the linear feet under `linear` — or off a flat
 * object a caller built by hand. Null when absent or not a finite ≥ 0 number.
 */
export function measurementValue(measurements, key) {
  if (!measurements || typeof measurements !== "object" || !MEASUREMENT_KEYS.includes(key)) return null;
  const direct = measurements[key];
  const nested = measurements.linear && typeof measurements.linear === "object" ? measurements.linear[key] : undefined;
  const v = Number(direct ?? nested);
  return Number.isFinite(v) && v >= 0 ? v : null;
}

/**
 * The lines an estimate opens with for a service.
 *
 * @param product       a Product row (or a seed service) carrying templateLines
 * @param measurements  summariseRoof() output, or null — a line naming a
 *                      measurementKey takes its qty from here (× 1 + waste)
 *                      and falls back to its typed qty, flagged, when the
 *                      figure is missing
 * @param currency      the currency the lines should come out in
 * @param fromCurrency  the currency the template's prices are in (a seed's
 *                      are USD; a company's own row has none → `currency`)
 * @param fx            multiplier fromCurrency → currency when they differ;
 *                      a converted rate is rounded by roundSuggested so it
 *                      cannot read as exact. Missing or invalid when needed →
 *                      the rate is null and the line says so, never the
 *                      foreign number wearing the wrong sign
 * @param language      the DOCUMENT's language for the line text
 * @returns lines[] — [{ kind, description, detail, quantity, unit, rate,
 *          amount, cost, taxable, measurementKey, measured, wastePct,
 *          missing, warnings[] }], one per template line, in template order.
 *          `[]` for a product with no template.
 */
export function expandTemplate(product, { measurements = null, currency = null, fromCurrency = null, fx = null, language = null, defaultLanguage = "en" } = {}) {
  const lines = sanitiseTemplateLines(product?.templateLines);
  if (!lines) return [];

  const to = String(currency || "").toUpperCase();
  const from = String(fromCurrency || to).toUpperCase();
  const needsFx = Boolean(to) && from !== to;
  const rate = Number(fx);
  const fxOk = Number.isFinite(rate) && rate > 0;
  const convert = (v) => {
    if (v == null) return null;
    if (!needsFx) return v;
    if (!fxOk) return null;
    return roundSuggested(v * rate);
  };

  return lines.map((line) => {
    const warnings = [];
    let quantity = line.qty;
    let measured = false;
    if (line.measurementKey) {
      const m = measurementValue(measurements, line.measurementKey);
      if (m == null) {
        warnings.push(`measurement:${line.measurementKey}`);
      } else {
        measured = true;
        quantity = Math.round(m * (1 + (line.wastePct || 0) / 100) * 100) / 100;
      }
    }
    const unitRate = convert(line.unitPrice);
    const unitCost = convert(line.unitCost);
    if (needsFx && !fxOk && (line.unitPrice != null || line.unitCost != null)) warnings.push("fx");
    const text = lineText(line, language, defaultLanguage);
    if (text.missing) warnings.push(`translation:${language}`);
    const amount = unitRate == null ? null : Math.round(unitRate * quantity * 100) / 100;
    return {
      kind: line.kind,
      description: text.name,
      detail: text.description || "",
      quantity,
      unit: line.unit,
      rate: unitRate,
      amount,
      cost: unitCost == null ? null : Math.round(unitCost * quantity * 100) / 100,
      taxable: line.taxable,
      measurementKey: line.measurementKey || null,
      measured,
      wastePct: line.wastePct || 0,
      currency: to || from || null,
      missing: text.missing,
      warnings,
    };
  });
}

/**
 * Subtotal, cost, the discount the template applies to that subtotal, and
 * the total — the numbers Settings > Services prints under a template. A
 * line with a null rate contributes nothing and is counted in `unpriced`, so
 * the total is never quietly short by a line the reader cannot see.
 */
export function templateTotals(lines, discount = null) {
  const list = Array.isArray(lines) ? lines : [];
  let subtotal = 0;
  let cost = 0;
  let unpriced = 0;
  for (const l of list) {
    if (l?.amount == null) unpriced += 1;
    else subtotal += l.amount;
    if (l?.cost != null) cost += l.cost;
  }
  subtotal = Math.round(subtotal * 100) / 100;
  cost = Math.round(cost * 100) / 100;
  const d = sanitiseDefaultDiscount(discount);
  let discountAmount = 0;
  if (d) {
    discountAmount = d.kind === "percent" ? (subtotal * d.amount) / 100 : Math.min(d.amount, subtotal);
    discountAmount = Math.round(discountAmount * 100) / 100;
  }
  return {
    subtotal,
    cost,
    discount: d,
    discountAmount,
    total: Math.round((subtotal - discountAmount) * 100) / 100,
    margin: subtotal > 0 ? Math.round(((subtotal - discountAmount - cost) / subtotal) * 1000) / 10 : null,
    unpriced,
  };
}

/** Group expanded (or stored) lines by kind, in the order the estimate prints them. */
export function groupLinesByKind(lines) {
  const groups = { labour: [], material: [], other: [] };
  for (const l of Array.isArray(lines) ? lines : []) {
    const k = LINE_KINDS.includes(l?.kind) ? l.kind : "other";
    groups[k].push(l);
  }
  return groups;
}
