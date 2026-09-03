// lib/purchasing/quantity.js
//
// Quantities, in integers.
//
// ══ Why not just use Number ════════════════════════════════════════════════
//
// PurchaseOrderLine.quantity and StockMovement.quantity are Decimal(12,3), so
// a quantity carries exactly three decimal places — 0.5 of a sheet, 12.75 m,
// 1.125 kg. Summing those as floats is the same mistake AGENTS.md names for
// money, wearing a different hat: 0.1 + 0.2 is 0.30000000000000004 whether the
// unit is dollars or litres, and a stock level that reads 3.0000000000000004
// bags is a number nobody trusts and nobody can explain.
//
// So every quantity becomes an integer number of THOUSANDTHS at the boundary,
// all arithmetic happens on integers, and it converts back once for display.
// The same shape lib/receipts/money.js uses for cents, for the same reason.
//
// ══ Why parsing returns null rather than 0 ═════════════════════════════════
//
// AGENTS.md failure class #5: absence of a statement is not a statement. A
// quantity nobody could read is NOT zero — zero is a claim that there are none
// of something, which is exactly the claim a reorder alert acts on. Callers
// have to decide what to do about null; they cannot be handed a silent zero.
//
// Pure. No imports, no database — so scripts/check-purchasing.mjs executes
// every line of it against hostile input rather than reasoning about it.

/** Decimal places the schema stores. Changing this needs a schema change too. */
export const QUANTITY_SCALE = 3;

const SCALE_FACTOR = 10 ** QUANTITY_SCALE;

/**
 * A quantity as an integer number of thousandths.
 *
 * Accepts a number, a string, or anything with a toString that produces a
 * decimal — which is what Prisma's Decimal is. Parsed from the STRING form
 * rather than via Number() so a value that arrived as text never takes a
 * detour through a float: "12.345" becomes 12345 by moving the point, not by
 * multiplying.
 *
 * @returns {number|null} integer thousandths, or null when it cannot be read.
 */
export function toMilli(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    // A number literal has already been through a float, so the best that can
    // be done is round at the scale the column stores. Rounding here rather
    // than truncating: 0.1+0.2 must land on 300, not 299.
    return Math.round(value * SCALE_FACTOR);
  }

  const text = String(typeof value === "object" ? value.toString() : value).trim();
  if (!text) return null;

  const m = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(text);
  if (!m) return null;
  const [, sign, whole, frac = ""] = m;
  if (!whole && !frac) return null; // "." and "" are not quantities

  // Pad or cut the fraction to the stored scale. A caller sending more
  // precision than the column holds is TRUNCATED rather than rounded, because
  // the database would truncate it too and two different answers to "what did
  // we store" is worse than one slightly blunt one.
  const scaled = frac.padEnd(QUANTITY_SCALE, "0").slice(0, QUANTITY_SCALE);
  const milli = Number(`${whole || "0"}${scaled}`);
  if (!Number.isFinite(milli)) return null;
  return sign === "-" ? -milli : milli;
}

/** Integer thousandths back to a plain number, for display and for Prisma. */
export function fromMilli(milli) {
  if (milli === null || milli === undefined || !Number.isFinite(milli)) return null;
  return milli / SCALE_FACTOR;
}

/**
 * A quantity as text, with trailing zeros trimmed.
 *
 * "12" not "12.000", "0.5" not "0.500" — a bag count that reads like a
 * measurement invites someone to wonder what the extra digits mean.
 */
export function formatMilli(milli) {
  if (milli === null || milli === undefined || !Number.isFinite(milli)) return "";
  const negative = milli < 0;
  const abs = Math.abs(Math.trunc(milli));
  const whole = Math.floor(abs / SCALE_FACTOR);
  const frac = String(abs % SCALE_FACTOR)
    .padStart(QUANTITY_SCALE, "0")
    .replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}

/**
 * Sum a list of already-parsed thousandths.
 *
 * Any null in the list makes the whole sum null. A stock level computed from
 * movements where one movement could not be read is not a stock level — it is
 * a stock level minus an unknown amount, and printing it as a fact is how a
 * reorder alert fires on a number that was never true.
 */
export function sumMilli(values) {
  let total = 0;
  for (const v of values) {
    if (v === null || v === undefined || !Number.isFinite(v)) return null;
    total += Math.trunc(v);
  }
  return total;
}
