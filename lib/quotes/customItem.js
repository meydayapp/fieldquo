// lib/quotes/customItem.js
//
// "Create custom item" — a line the contractor writes on the spot, inside a
// service already on the estimate, in that service's own units.
//
// ── The owner's rule (2026-10-03) ───────────────────────────────────────────
//
// "custom item should be based on the current estimate so they pick one
// service and based on what we have the custom line item makes sense." So a
// custom item is never a free-floating line: it is written INTO one of the
// scope groups the estimate already holds (cabinets, interior rooms, exterior
// surfaces, stairs, drywall…) and offers that group's units — per door on a
// cabinet group, per sq ft of wall on interior, per tread on stairs — plus
// each, hour and lump sum. Where the group's own calculator has already
// measured the unit (32 doors, 412 sq ft of wall), the quantity opens on that
// figure and says where it came from; it stays editable.
//
// ── Reuse, not a fork ───────────────────────────────────────────────────────
//
//   units      lib/services/measurementKeys.js TRADE_MEASUREMENTS — the same
//              per-trade list Settings › Services offers a template line, so a
//              custom item and a template line speak one vocabulary of units
//   figures    lib/quotes/serviceTemplateLines.js groupMeasurements — the
//              figures a template line fills from, read from THIS group only
//              (a custom item belongs to one service; interior walls are not
//              an exterior quantity)
//   overlap    keysPricedByGroup — the units this group's calculator already
//              bills. A template line keyed to one is held back; a custom item
//              is the contractor's own deliberate line ("second coat on the
//              doors, per door"), so it is not refused — the dialog SAYS the
//              calculator already prices that unit and that this line is
//              charged on top of it.
//
// ── The line is an ordinary line ────────────────────────────────────────────
//
// What lands in QuoteScopeGroup.lineItems is the shape every renderer, the
// save, the invoice mirror (lib/invoices/createInvoiceFromQuote.js), the
// Cost & margin panel (lib/costing/lineItemCost.js — `unitCost`) and the
// commission reader (`productId`, when it was saved to the price book)
// already read: description, detail, quantity, unit, rate, amount, unitCost.
// It sits in the group's TYPED lines, beside — never inside — the lines a
// calculator derives at save (builderPayload scopeGroupPayload), so the two
// are summed once each and a takeoff re-deriving its lines cannot drop it or
// count it twice.
//
// `meta.customItem` is office-only (no client renderer reads `meta`) and holds
// no money: { categoryKey, measurementKey?, filled? }. It is what lets a tier
// change keep the line (tierSelectedLines) and the line table say what it is.
//
// ── Tax ─────────────────────────────────────────────────────────────────────
//
// A quote taxes as a whole (lib/quotes/totals.js) and no line carries a tax
// flag — lib/quotes/serviceTemplateLines.js explains why a `taxable` key would
// be a field nothing reads. A custom item is taxed exactly as the section's
// other lines are: with the rest of the quote.
//
// ── Money (non-negotiable #5) ───────────────────────────────────────────────
//
// The unit price is typed by staff in the builder; nothing here is a
// client-facing pricing surface. A member without showPricing writes the
// words and the quantity and the line lands at $0, as a text block does.
//
// Pure — no React, no database — so scripts/check-custom-item.mjs executes
// every rule against hostile input.

import { TRADE_MEASUREMENTS, isMeasurementKey, measurementKeyMeta } from "@/lib/services/measurementKeys";
import { groupMeasurements, keysPricedByGroup, calculatorOfTrade } from "@/lib/quotes/serviceTemplateLines";
import { sanitiseRichText } from "@/lib/quotes/richText";

export const CUSTOM_ITEM_META = "customItem";

/** The units every service can bill in: a count, hours, a lump sum. */
export const PLAIN_UNITS = Object.freeze(["each", "hour", "flat"]);

// The units a unit-priced group's BASE line is written in — see the filter in
// customItemUnits.
const BASE_LINE_UNITS = Object.freeze(["unit", "door", "drawer"]);

export const MAX_DESCRIPTION = 160;
export const MAX_QUANTITY = 1_000_000;
export const MAX_UNIT_PRICE = 10_000_000;
// Decimal(12, 2) holds 9,999,999,999.99 for the whole QUOTE; one line is held
// two orders of magnitude under that so a handful of them cannot overflow the
// total either.
export const MAX_LINE_AMOUNT = 99_999_999.99;

const round2 = (n) => Math.round(n * 100) / 100;
const list = (v) => (Array.isArray(v) ? v : []);

/** A typed number box → a finite number, or null for blank / junk. */
function typedNumber(raw) {
  if (raw === null || raw === undefined || typeof raw === "boolean") return null;
  if (typeof raw === "string") {
    const s = raw.replace(/[,\s]/g, "");
    if (!s) return null;
    raw = s;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * The sections a custom item can be written into: the estimate's own scope
 * groups. Not an imported subcontractor cost (read-only — it is another
 * company's quote), and not a group with no quote type, which has no units.
 *
 * @param groups      the builder's scope groups
 * @param categories  the company's categories, for the label and the unit
 *                    each service is sold in
 */
export function customItemTargets(groups, categories = []) {
  return list(groups)
    .filter((g) => g && typeof g === "object" && g.tempId && g.categoryId && g.imported !== true)
    .map((g) => {
      const cat = list(categories).find((c) => c && c.id === g.categoryId) || null;
      return {
        tempId: g.tempId,
        label: String(g.label || cat?.label || ""),
        categoryLabel: String(cat?.label || ""),
        categoryId: g.categoryId,
        categoryKey: g.categoryKey || cat?.key || null,
        categoryUnit: typeof cat?.unit === "string" && cat.unit.trim() ? cat.unit.trim() : null,
      };
    });
}

/** Which trade's measurement list a group draws on — painting by its estimate type. */
function tradeKeysOf(group) {
  const key = group?.categoryKey;
  const type = group?.takeoff && typeof group.takeoff === "object" ? group.takeoff.estimateType : null;
  if ((key === "interior_painting" || key === "exterior_painting") && type === "exterior") {
    return TRADE_MEASUREMENTS.exterior_painting;
  }
  return typeof key === "string" && Object.hasOwn(TRADE_MEASUREMENTS, key) ? TRADE_MEASUREMENTS[key] : [];
}

/**
 * The units a custom item in `group` may be billed in, in the order the
 * dialog offers them: the service's own measured units first (with the
 * figure this group already holds, if any), then the unit the company sells
 * the service in, then each / hour / lump sum.
 *
 * Each option: { id, unit, measurementKey, figure, calc, pricedByCalculator }
 *   id                  "m:<key>" for a measured unit, "u:<unit>" otherwise —
 *                       what the dialog sends back; anything not in this
 *                       list is refused by buildCustomLine
 *   figure / calc       the group's own figure and the calculator it came
 *                       from, or null when nothing measured it yet
 *   pricedByCalculator  the group's calculator already bills this unit —
 *                       the dialog says so; the line is charged on top
 *   pricedBy            which calculator that is (app.templateLines.calc_<id>)
 *                       — the drywall price book for a drywall group, the
 *                       same naming templateSkipNote uses
 */
export function customItemUnits(group, { categoryUnit = null } = {}) {
  if (!group || typeof group !== "object") return [];
  const figures = groupMeasurements(group);
  const priced = new Set(keysPricedByGroup(group));
  const pricedBy = priced.size
    ? group.categoryKey === "drywall_install"
      ? "drywallBook"
      : calculatorOfTrade(group.categoryKey) || "intake"
    : null;
  const out = [];
  const seen = new Set();
  for (const key of tradeKeysOf(group)) {
    if (!isMeasurementKey(key)) continue;
    const id = `m:${key}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const meta = measurementKeyMeta(key);
    const fig = Object.hasOwn(figures, key) ? figures[key] : null;
    out.push({
      id,
      unit: meta.unit,
      measurementKey: key,
      figure: fig ? fig.value : null,
      calc: fig ? fig.calc : null,
      pricedByCalculator: priced.has(key),
      pricedBy: priced.has(key) ? pricedBy : null,
    });
  }
  // The cabinet base line's own units ("unit", "door", "drawer") are not
  // offered as plain units: on a cabinet group they ARE the door and drawer
  // counts above, and a line in one of them would be read by billedUnitsOf
  // (lib/quotes/builderPayload.js) as more faces the client is billed for.
  const plain = [categoryUnit, ...PLAIN_UNITS].filter(
    (u) => typeof u === "string" && /^[a-z_]{1,24}$/.test(u) && !BASE_LINE_UNITS.includes(u),
  );
  for (const unit of plain) {
    const id = `u:${unit}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, unit, measurementKey: null, figure: null, calc: null, pricedByCalculator: false, pricedBy: null });
  }
  return out;
}

/** The quantity a unit opens on: the group's own figure, or blank. */
export function openingQuantity(option) {
  return option && typeof option.figure === "number" && option.figure > 0 ? option.figure : "";
}

/**
 * The boundary between the dialog's boxes and a line on the quote.
 *
 * @param input  { description, detail, unitId, quantity, rate, unitCost, productId? }
 * @param units  customItemUnits(group) — the only units accepted
 * @param categoryKey  the group's quote type, stamped on meta
 * @param showPricing  false → rate and cost are ignored and the line is $0
 * @returns { ok: true, line } | { ok: false, field, error }
 *   `error` is an English sentence; `field` + a reason key let the screen
 *   say it in the member's language (app.customItem.error_<reason>).
 */
export function buildCustomLine(input = {}, { units = [], categoryKey = null, showPricing = true } = {}) {
  const fail = (field, reason, error) => ({ ok: false, field, reason, error });
  const src = input && typeof input === "object" ? input : {};

  const description = String(src.description ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, MAX_DESCRIPTION);
  if (!description) return fail("description", "description", "Describe the item — it is the line the client reads.");

  const option = list(units).find((u) => u && u.id === src.unitId) || null;
  if (!option) return fail("unit", "unit", "Pick one of this service's units.");

  const qty = typedNumber(src.quantity);
  if (qty === null) return fail("quantity", "quantity", "Enter a quantity.");
  if (qty <= 0) return fail("quantity", "quantityPositive", "The quantity must be more than zero.");
  if (qty > MAX_QUANTITY) return fail("quantity", "quantityLarge", "That quantity is larger than a line can hold — check for a stray digit.");
  const quantity = Math.round(qty * 100) / 100;
  if (quantity <= 0) return fail("quantity", "quantityPositive", "The quantity must be more than zero.");

  let rate = 0;
  let unitCost = null;
  if (showPricing) {
    const r = typedNumber(src.rate);
    if (r === null) return fail("rate", "rate", "Enter a unit price (0 is allowed).");
    if (r < 0) return fail("rate", "rateNegative", "A unit price can't be negative — use the quote's discount instead.");
    if (r > MAX_UNIT_PRICE) return fail("rate", "rateLarge", "That unit price is larger than a line can hold — check for a stray digit.");
    rate = round2(r);
    const c = typedNumber(src.unitCost);
    if (c !== null) {
      if (c < 0) return fail("unitCost", "costNegative", "A cost can't be negative.");
      if (c > MAX_UNIT_PRICE) return fail("unitCost", "costLarge", "That cost is larger than a line can hold — check for a stray digit.");
      if (c > 0) unitCost = round2(c);
    }
  }

  const amount = round2(quantity * rate);
  if (amount > MAX_LINE_AMOUNT) return fail("rate", "amountLarge", "This line comes to more than one line can hold — check the quantity and the price.");

  const detail = sanitiseRichText(src.detail ?? "");
  const filled =
    option.measurementKey && typeof option.figure === "number" && option.figure > 0 && option.figure === quantity
      ? { value: option.figure, calc: option.calc }
      : null;
  const productId = typeof src.productId === "string" && src.productId.trim() ? src.productId.trim() : null;

  return {
    ok: true,
    line: {
      description,
      ...(detail ? { detail } : {}),
      quantity,
      unit: option.unit,
      rate,
      amount,
      ...(unitCost !== null ? { unitCost } : {}),
      ...(productId ? { productId } : {}),
      meta: {
        [CUSTOM_ITEM_META]: {
          ...(categoryKey ? { categoryKey: String(categoryKey) } : {}),
          ...(option.measurementKey ? { measurementKey: option.measurementKey } : {}),
          ...(filled ? { filled } : {}),
        },
      },
    },
  };
}

/** Is this line a custom item? */
export function isCustomItemLine(line) {
  return Boolean(line && typeof line === "object" && line.meta && typeof line.meta === "object" && line.meta[CUSTOM_ITEM_META]);
}

/** The custom items in a list of lines, in order. */
export function customItemLines(lines) {
  return list(lines).filter(isCustomItemLine);
}

/**
 * A tiered-package group's lines after a tier is picked: the tier's line, then
 * every custom item the contractor already wrote into the group. Picking a
 * tier used to replace the whole list — harmless while nothing else lived
 * there, a silent delete once a custom item could. A group with no custom
 * item gets exactly the one line it always got.
 */
export function tierSelectedLines(group, tierLabel) {
  return [
    {
      description: `${group?.label} — ${tierLabel}`,
      quantity: 1,
      unit: "flat",
      rate: 0,
      amount: 0,
    },
    ...customItemLines(group?.lineItems),
  ];
}

/**
 * "Save to price book": the POST /api/products body for a custom line — the
 * service's own price book, linked to the quote type it was written in, at
 * the unit price and cost the contractor typed. Null for a line with no price
 * (a $0 line is not a price-book entry; it would be offered on the next quote
 * as a free item).
 */
export function priceBookBody(line, { categoryId = null } = {}) {
  if (!line || typeof line !== "object") return null;
  const name = String(line.description || "").trim();
  const rate = Number(line.rate);
  if (!name || !Number.isFinite(rate) || rate <= 0) return null;
  const cost = Number(line.unitCost);
  return {
    name,
    description: line.detail ? String(line.detail) : null,
    type: "service",
    unitPrice: round2(rate),
    costPrice: Number.isFinite(cost) && cost > 0 ? round2(cost) : null,
    unit: line.unit || null,
    categoryIds: categoryId ? [categoryId] : [],
  };
}
