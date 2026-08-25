// lib/quotes/builderPayload.js
//
// What one scope group is worth, and what it looks like on the wire.
//
// ── Why this is not inside the component ────────────────────────────────────
//
// It is the money. QuoteBuilder renders the same screen for /app/quotes/new and
// /app/quotes/[id]/edit, and the ONE thing those two routes must never disagree
// about is what a quote comes to — they already did once, when the builder
// taxed the gross subtotal and the editor taxed subtotal − discount.
//
// lib/quotes/totals.js owns the second half of that sum (subtotal → discount →
// tax → total). This owns the first half: line items → group subtotal, and the
// flattening that turns a takeoff and a unit-priced scope into the lines that
// get stored. Pure, so scripts/check-quote-builder.mjs can execute both modes
// against the same input and assert to the cent that they agree, instead of
// somebody reading two screens and hoping.
//
// ── `persisted` is the whole design ─────────────────────────────────────────
//
// A group that came out of the database has already been flattened: its stored
// line items ARE the quote, priced against the rate card of the day it was
// written. Deriving again would do two wrong things at once — reprice a quote
// that may already be in a client's inbox, and prepend the derived lines a
// SECOND time, doubling the group's total. So derivation is off for a stored
// group and on for one added in this session, and every function here agrees
// about that because there is only one of each function.

import {
  isUnitPriced,
  finalUnitPrice,
  groupUnits,
  unitPricingSubtotal,
} from "@/app/data/cabinetPricing";
import { getPriceBook } from "@/app/data/tradePriceBooks";
import {
  buildTradeLineItems,
  cabinetAddOnLines,
} from "@/lib/pricing/tradeScope";
import { hasTakeoff } from "@/lib/pricing/takeoffTrades";
import { round2 } from "@/lib/quotes/totals";

/** A money-ish input from a form field or a Json column → a number, never NaN. */
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Lines a structured takeoff implies. Empty for a stored group — see the header.
 */
export function takeoffLinesFor(group, rateOverrides = null) {
  if (!group || group.persisted) return [];
  if (!group.takeoff || !hasTakeoff(group.categoryKey)) return [];
  const lines = buildTradeLineItems(
    group.categoryKey,
    group.takeoff,
    rateOverrides,
  );
  return Array.isArray(lines) ? lines : [];
}

/**
 * Cabinet upgrades priced from the trade's rate card. Derived rather than
 * stored on the group, for the same reason takeoff lines are: a total that
 * disagrees with the form above it is worse than no total.
 */
export function cabinetAddOnLinesFor(group, rateOverrides = null) {
  if (!group || group.persisted) return [];
  const iv = group.intakeValues || {};
  const lines = cabinetAddOnLines(
    {
      doors: Number(iv.doorCount) || 0,
      drawers: Number(iv.drawerCount) || 0,
      ...group,
    },
    getPriceBook(group.categoryKey, rateOverrides) || {},
  );
  return Array.isArray(lines) ? lines : [];
}

/**
 * A group's client-facing total.
 *
 * Unit-priced trades charge units × final unit price for the base scope PLUS
 * any add-on lines; everything else is the sum of its line items. A stored
 * group is always just the sum of its lines.
 */
export function groupSubtotal(group, rateOverrides = null) {
  if (!group) return 0;
  const lineSum = (Array.isArray(group.lineItems) ? group.lineItems : []).reduce(
    (s, i) => s + num(i?.amount),
    0,
  );
  if (group.persisted) return round2(lineSum);

  const takeoffSum = takeoffLinesFor(group, rateOverrides).reduce(
    (s, i) => s + num(i?.amount),
    0,
  );
  const addOnSum = cabinetAddOnLinesFor(group, rateOverrides).reduce(
    (s, i) => s + num(i?.amount),
    0,
  );

  return round2(
    takeoffSum +
      (isUnitPriced(group.categoryKey)
        ? num(unitPricingSubtotal(group)) + addOnSum + lineSum
        : lineSum),
  );
}

/**
 * One scope group, as POST /api/quotes and PATCH /api/quotes/[id] store it.
 *
 * The derived lines are flattened in HERE, once, and saved — a sent quote must
 * keep its prices even if the rate card moves next week. `catalogKey` is
 * dropped: it is an editor-only handle for looking up FieldQuo's own benchmark
 * while a rate is still blank, and the quote a client reads must not carry a
 * pointer into our pricing research.
 */
export function scopeGroupPayload(group, rateOverrides = null) {
  let lineItems = Array.isArray(group?.lineItems) ? group.lineItems : [];

  if (!group?.persisted) {
    if (isUnitPriced(group?.categoryKey)) {
      const units = num(groupUnits(group));
      const rate = num(finalUnitPrice(group));
      const base = {
        description: group.label,
        quantity: units,
        unit: "unit",
        rate,
        amount: round2(units * rate),
        // Carried so the review page can explain the price: what the base rate
        // was, what made it complex, and the finish that was agreed.
        meta: {
          baseUnitPrice: num(group.baseUnitPrice),
          complexityLevel: group.complexityLevel,
          complexityUpcharge:
            group.complexityLevel === "custom"
              ? num(group.complexityUpcharge)
              : undefined,
          complexityReasons: group.complexityReasons || [],
          color: group.color || "",
          sheen: group.sheen || "",
          doorStyle: group.doorStyle || "",
        },
      };
      lineItems = [
        base,
        ...cabinetAddOnLinesFor(group, rateOverrides),
        ...lineItems,
      ];
    }

    // Takeoff lines read FIRST, above any extras typed by hand: the stair
    // elements are the job and the disposal fee is the footnote.
    if (hasTakeoff(group?.categoryKey) && group?.takeoff) {
      lineItems = [...takeoffLinesFor(group, rateOverrides), ...lineItems];
    }
  }

  return {
    // Sent so the API reconciles by identity instead of regenerating groups —
    // that is what keeps an imported subcontractor cost's linkage intact across
    // an edit. A new group has no id and is created.
    ...(group?.id ? { id: group.id } : {}),
    categoryId: group?.categoryId,
    label: group?.label,
    // The form behind those lines, so reopening the quote restores it instead
    // of a flat list nobody can recount.
    ...(group?.takeoff ? { takeoff: group.takeoff } : {}),
    // A null in a Json column is not hypothetical — `lineItems` is Json, and a
    // row written by an older version or a half-finished import can hold one.
    // Destructuring it threw and took the save down with it.
    lineItems: lineItems
      .filter((i) => i && typeof i === "object")
      .map(({ catalogKey, ...item }) => ({
        ...item,
        quantity: num(item.quantity) || 1,
        amount: round2(num(item.amount)),
      })),
    subtotal: groupSubtotal(group, rateOverrides),
  };
}

/**
 * Turn a saved group back into one this editor can work on.
 *
 * The old line editor on the edit route typed an AMOUNT directly; this one
 * types quantity × rate, which is what the builder has always done. Plenty of
 * stored lines therefore carry no rate at all, and `value={item.rate}` on an
 * undefined would render an uncontrolled input whose first keystroke writes NaN
 * into the amount. Deriving a rate keeps the amount identical on the qty=1
 * lines that are nearly all of them, and gives the rest a rate that multiplies
 * back to the figure on the document.
 */
export function lineItemsFromStored(stored) {
  return (Array.isArray(stored) ? stored : [])
    .filter((li) => li && typeof li === "object")
    .map((li) => {
      const quantity = num(li.quantity);
      const amount = num(li.amount);
      const rate = li.rate;
      return {
        ...li,
        quantity: quantity || 1,
        rate:
          rate === null || rate === undefined || rate === ""
            ? round2(amount / Math.max(quantity || 1, 1))
            : num(rate),
        amount,
      };
    });
}

/**
 * One line item edited. Shared so the amount can never be recomputed one way in
 * the table and another on save.
 */
export function applyLineItemEdit(item, field, value) {
  const updated = { ...item, [field]: value };
  if (field === "quantity" || field === "rate") {
    updated.amount = round2(
      num(field === "quantity" ? value : item?.quantity) *
        num(field === "rate" ? value : item?.rate),
    );
  }
  return updated;
}
