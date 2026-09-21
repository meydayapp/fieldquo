// lib/materials/facts.js
//
// What the material-list model is ALLOWED to see about a job — and, more to
// the point, what it is not.
//
// ══ No money in, no money out ══════════════════════════════════════════════
//
// The schema in lib/materials/list.js has no price field, which stops a price
// coming OUT. This file stops one going IN: the quote's line items carry
// `rate` and `amount`, the paint takeoff's areas carry `labour`, `material`
// and `total`, the recipe carries `costPerGal`. None of that helps count tape,
// and any of it in the prompt is a number the model can echo into a "reason"
// that the panel then prints. So every object handed to the model is built
// here field by field, from an allow-list, and scripts/check-material-list.mjs
// walks the result asserting that no key that means money survives.
//
// Pure. The caller loads the rows; this decides what the prompt says.
import { paintTakeoff } from "@/lib/pricing/paintTakeoff";
import { getPriceBook } from "@/app/data/tradePriceBooks";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const text = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/**
 * The keys that mean money, anywhere in a facts object. Exported so the check
 * script asserts the same list this file promises to keep out.
 */
export const MONEY_KEYS = Object.freeze([
  "rate",
  "amount",
  "labour",
  "labor",
  "material",
  "total",
  "subtotal",
  "price",
  "cost",
  "costPerGal",
  "unitCost",
  "estUnitCost",
  "hourlySellRate",
  "margin",
  "markup",
  "deposit",
  "supplierCost",
]);

/**
 * One paint area, as facts: what is measured and what goes on it. No hours
 * either — hours are a labour figure and the list is about materials.
 */
function paintAreaFacts(area) {
  return {
    label: text(area.label, 80),
    surface: area.surface,
    wallSqft: num(area.geometry?.wallSqft),
    ceilingSqft: num(area.geometry?.ceilingSqft),
    floorSqft: num(area.geometry?.floorSqft),
    linearFt: num(area.geometry?.linearFt),
    prepHours: num(area.lines?.find?.((l) => l.kind === "prep")?.hours),
    substrates: (area.lines || [])
      .filter((l) => l.kind === "substrate")
      .map((l) => ({
        label: text(l.label, 80),
        quantity: num(l.quantity),
        unit: l.unit,
        coats: num(l.coats),
        product: l.productKey || null,
        gallons: l.gallons == null ? null : num(l.gallons),
      })),
    // The estimator's own "crew note (work order only)" is a fact about the
    // job ("shelves stay unpainted — tape them"), and it is the kind of fact
    // that adds a roll of tape. Its client-facing sibling is not sent: it is
    // written FOR the homeowner and says nothing about materials.
    crewNote: text(area.crewNote, 300) || null,
  };
}

/**
 * Facts for one scope group. Takes the group with its category and takeoff,
 * plus the company's rate overrides, and returns only measurements, counts,
 * descriptions and product NAMES.
 */
export function scopeGroupFacts(group, rateOverrides) {
  const key = group?.category?.key || null;
  const out = {
    trade: key,
    label: text(group?.label, 120) || null,
    lines: (Array.isArray(group?.lineItems) ? group.lineItems : [])
      .filter((l) => l && typeof l === "object")
      .slice(0, 60)
      .map((l) => ({
        description: text(l.description, 240),
        quantity: num(l.quantity) || 1,
        unit: text(l.unit, 24) || null,
        detail: text(l.detail, 400) || null,
      })),
    takeoff: null,
    products: null,
  };

  const takeoff = group?.takeoff;
  if (takeoff && typeof takeoff === "object" && takeoff.model === "area_substrate") {
    const book = getPriceBook(key, rateOverrides);
    const result = paintTakeoff(takeoff, book?.takeoff);
    out.takeoff = {
      kind: "paint_areas",
      areas: result.areas.map(paintAreaFacts),
      optionalAreas: result.optionalAreas.map(paintAreaFacts),
    };
    // Product NAMES and coverage — the two things a foreman reads off a rate
    // card to count gallons. Not the cost per gallon.
    const products = book?.takeoff?.products || {};
    out.products = Object.keys(products)
      .slice(0, 40)
      .map((pk) => ({
        key: pk,
        label: text(products[pk]?.label, 80) || pk,
        coverageSqftPerGal: num(products[pk]?.coverageSqftPerGal) || null,
      }));
  } else if (takeoff && typeof takeoff === "object") {
    // Other trades' takeoffs are free-form forms. Copy only the scalar
    // measurements — numbers and short strings — never nested money.
    const flat = {};
    for (const [k, v] of Object.entries(takeoff)) {
      if (MONEY_KEYS.includes(k) || /cost|price|rate|amount|total|margin|markup/i.test(k)) continue;
      if (typeof v === "number" && Number.isFinite(v)) flat[k] = v;
      else if (typeof v === "string" && v.length <= 80) flat[k] = v;
      else if (typeof v === "boolean") flat[k] = v;
    }
    out.takeoff = { kind: "form", fields: flat };
  }
  return out;
}

/**
 * The whole prompt payload for one job. Every field an allow-list, every
 * string clipped.
 *
 * @param job        { title, quote: { scopeGroups, notes, scopeDetails } }
 * @param derived    deriveSourcingLines() rows — name, qty, unit, materialKey
 * @param stock      stockListForPrompt() rows
 * @param ratesById  Map(categoryId → rates) as regenerateSourcingList attaches
 */
export function jobFactsForPrompt({ job, derived, stock, ratesById }) {
  const groups = Array.isArray(job?.quote?.scopeGroups) ? job.quote.scopeGroups : [];
  return {
    job: {
      title: text(job?.title, 160),
      // Notes are facts about the job. The prompt says so, and says they are
      // never instructions.
      notes: text(job?.quote?.notes, 1500) || null,
    },
    trades: groups.map((g) => scopeGroupFacts(g, ratesById?.get?.(g.categoryId) || null)),
    takeoffLines: (Array.isArray(derived) ? derived : []).map((d) => ({
      name: text(d.name, 160),
      quantity: num(d.qty),
      unit: text(d.unit, 24) || "ea",
      materialKey: d.materialKey || null,
      trade: d.categoryKey || null,
    })),
    stock: Array.isArray(stock) ? stock : [],
  };
}

/**
 * Walk any value and return the first money key found, or null. Used by the
 * check script AND by the build itself as a last guard before the prompt is
 * sent — a facts builder that grows a `rate` field fails loudly here rather
 * than quietly teaching the model the company's prices.
 */
export function findMoneyKey(value, path = "") {
  if (Array.isArray(value)) {
    for (const [i, v] of value.entries()) {
      const hit = findMoneyKey(v, `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (MONEY_KEYS.includes(k)) return `${path}.${k}`;
      const hit = findMoneyKey(v, `${path}.${k}`);
      if (hit) return hit;
    }
  }
  return null;
}
