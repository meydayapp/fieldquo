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
import { sanitisePaintTakeoffOverrides } from "@/lib/pricing/paintTakeoff";

/**
 * The trades whose `rates.takeoff` carries a STRUCTURE — rate sets, products
 * — and not only the numeric paths PRICE_BOOK_FIELDS declares. Both painting
 * books read one takeoff (see `takeoff:` on each in tradePriceBooks.js), so
 * both rows accept the same subtree; the Services editor writes it to both.
 */
export const PAINT_TAKEOFF_CATEGORIES = ["interior_painting", "exterior_painting"];

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

  // The painting takeoff's own structure — rate sets per estimate type,
  // product costs, the extra-coat share. Sanitised by the engine's own
  // boundary (lib/pricing/paintTakeoff.js) and laid over the numeric paths
  // above: the two touch the same `takeoff.products.<key>` objects (coverage
  // from the declared field, cost from here), so this is a merge, never an
  // overwrite.
  if (PAINT_TAKEOFF_CATEGORIES.includes(categoryKey)) {
    const takeoff = sanitisePaintTakeoffOverrides(rates.takeoff);
    if (takeoff) {
      out.takeoff = mergeObjects(out.takeoff || {}, takeoff);
      count += 1;
    }
  }
  return count > 0 ? out : null;
}

function mergeObjects(base, patch) {
  const out = { ...base };
  for (const key of Object.keys(patch)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    const b = out[key];
    const p = patch[key];
    out[key] =
      b && p && typeof b === "object" && typeof p === "object" && !Array.isArray(b) && !Array.isArray(p)
        ? mergeObjects(b, p)
        : p;
  }
  return out;
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
