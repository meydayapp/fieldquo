// lib/pricing/sanitiseRates.js
//
// The one boundary between "an object claiming to be a company's rate
// overrides" and CompanyServiceCategory.rates.
//
// Lived inside PATCH /api/settings/service-categories until the AI review's
// "Update my costing" needed to write a single rate the same way. Two
// sanitisers that are supposed to agree is the copy-that-rots failure —
// and this one guards the pricing model against a "__proto__" key, so the
// copy rotting would not be cosmetic.

import { PRICE_BOOK_FIELDS } from "@/app/data/tradePriceBooks";

/**
 * Keep a company's rate override to the fields its trade actually has.
 *
 * The browser sends this, and it is merged over the price book on every quote,
 * so an arbitrary object here would let a tenant graft junk (or a "__proto__")
 * onto the pricing model. Only paths declared in PRICE_BOOK_FIELDS survive, and
 * each value must be a finite number — a rate is never a string or an object.
 * Nothing left after filtering is stored as null, which correctly means
 * "this company has not customised anything".
 */
export function sanitiseRates(categoryKey, rates) {
  const fields = PRICE_BOOK_FIELDS[categoryKey];
  if (!fields || !rates || typeof rates !== "object" || Array.isArray(rates))
    return null;

  const out = {};
  let count = 0;
  for (const field of fields) {
    const value = readPath(rates, field.path);
    if (value === undefined || value === null || value === "") continue;
    const n = Number(value);
    if (!Number.isFinite(n)) continue;
    writePath(out, field.path, n);
    count += 1;
  }
  return count > 0 ? out : null;
}

export function readPath(obj, path) {
  return String(path)
    .split(".")
    .reduce((node, part) => (node == null ? undefined : node[part]), obj);
}

export function writePath(obj, path, value) {
  const parts = String(path).split(".");
  let node = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part === "__proto__" || part === "constructor" || part === "prototype")
      return;
    if (!node[part] || typeof node[part] !== "object") node[part] = {};
    node = node[part];
  }
  const last = parts[parts.length - 1];
  if (last === "__proto__" || last === "constructor" || last === "prototype")
    return;
  node[last] = value;
}
