// lib/services/addedForYou.js
//
// "Added for you" — saying out loud which price-book rows FieldQuo put there.
//
// The owner, 2026-09-25: "they might not do it — every contractor is
// different. It is loaded by default, so if it is loaded by default it should
// say so." Signup seeds a trade's services (lib/products/seedServices.js) and
// many owners never open "Confirm what you quote", so the rows have to
// announce themselves wherever they are listed.
//
// ══ The rule, and why it is inferred ═══════════════════════════════════════
//
// Product has no updatedAt (the same gap lib/setupSteps.js#
// isUntouchedStandardAddOn works around for the add-ons), and adding one
// would not help: auto-translate, the template backfill and the archive flag
// all write the row without the company editing anything. So "untouched" is
// read off the row disagreeing with the seed it came from, on the two fields
// the badge makes a promise about:
//
//   a row is "Added for you" when
//     - it carries a seedKey that names a service the seed files still hold,
//     - its NAME is the seed's name in one of the languages the seed carries
//       (a company that later changed its default language is still looking
//       at the words FieldQuo wrote), and
//     - its PRICE is exactly what the seeder writes today in the company's
//       currency (lib/pricing/benchmarkFx.js#suggestedIn), or both are unset.
//
// Anything else — renamed, repriced, a row the company typed, a seed row
// whose wording FieldQuo has since revised — reads "In your list". That errs
// towards NOT claiming authorship: a badge that says "we added this" on a row
// the owner priced himself would be the false statement; the reverse is only
// a missing label. Descriptions are deliberately not compared: the
// description backfill (scripts/backfill-product-descriptions.mjs) writes
// seeded rows' descriptions without the company, so it says nothing about
// whether the owner looked.
//
// ══ "When you signed up" ═══════════════════════════════════════════════════
//
// Signup seeds inside POST /api/companies, seconds after the Company row is
// created. A seeded row created within SIGNUP_SEED_WINDOW_MS of the company
// is one signup added; one created later came from a trade switched on,
// "Add missing services" or this screen, and the "We added N services when
// you signed up" line does not count it. An hour is two orders of magnitude
// wider than the slowest signup seed (~110 rows in batches of ten) and far
// narrower than any owner opening Settings to switch a second trade on.

import { seedServiceByKey } from "@/lib/services/seeds";
import { suggestedIn } from "@/lib/pricing/benchmarkFx";

export const SIGNUP_SEED_WINDOW_MS = 60 * 60 * 1000;

const norm = (s) => (typeof s === "string" ? s.trim().replace(/\s+/g, " ").toLowerCase() : "");

/** Every name the seed gives the service, in every language it carries. */
function seedNames(service) {
  const out = new Set();
  const names = service?.name && typeof service.name === "object" ? service.name : {};
  for (const v of Object.values(names)) if (norm(v)) out.add(norm(v));
  const tr = service?.translations && typeof service.translations === "object" ? service.translations : {};
  for (const v of Object.values(tr)) if (v && norm(v.name)) out.add(norm(v.name));
  return out;
}

/**
 * True when the row is a seeded service the company has not renamed or
 * repriced. `currency` is the company's; `product.unitPrice` may be a Prisma
 * Decimal, a number, a numeric string or null.
 */
export function isAddedForYou(product, { currency } = {}) {
  if (!product || typeof product !== "object") return false;
  if (typeof product.seedKey !== "string" || !product.seedKey) return false;
  const service = seedServiceByKey(product.seedKey);
  if (!service) return false;
  if (!seedNames(service).has(norm(product.name))) return false;
  const expected = suggestedIn(service.benchmark?.median, currency);
  const raw = product.unitPrice;
  if (raw == null || raw === "") return expected == null;
  const have = Number(raw);
  if (!Number.isFinite(have) || expected == null) return false;
  return Math.abs(have - expected) < 0.005;
}

const timeOf = (v) => {
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string" || typeof v === "number") {
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : NaN;
  }
  return NaN;
};

/**
 * The seeded rows signup created: seedKey set and created within the window
 * after the company. Removed rows count — the sentence is about what was
 * added, and the Selected tab says what is still there. An unreadable
 * company date counts nothing (never "all of them").
 */
export function signupSeededRows(products, companyCreatedAt) {
  const start = timeOf(companyCreatedAt);
  if (!Number.isFinite(start) || !Array.isArray(products)) return [];
  return products.filter((p) => {
    if (!p || typeof p !== "object" || typeof p.seedKey !== "string" || !p.seedKey) return false;
    const at = timeOf(p.createdAt);
    return Number.isFinite(at) && at >= start - 60_000 && at - start <= SIGNUP_SEED_WINDOW_MS;
  });
}
