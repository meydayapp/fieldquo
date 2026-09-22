// lib/services/seeds.js
//
// One read over the per-trade service seeds (app/data/serviceSeeds/*): what a
// company in a trade starts with, and the benchmark range beside each service.
//
// ── What a seed is, and is not ─────────────────────────────────────────────
//
// A seed is a NAME, a DESCRIPTION (in en/fr/es), a UNIT and — where the
// benchmark carried one — a RANGE `{ low, median, high }` in USD. The median is
// pre-filled as the company's starting price when the service is first seeded;
// the range is shown as a guideline beside the price box, worded "Typical
// range from industry benchmarks — set your own rate." It is never a fact
// about the company and never reaches a client-facing surface: seeding writes
// Product rows, and a Product's `unitPrice` is the company's number from that
// moment on. Nothing here re-reads a seed to re-price an existing row.
//
// ── The seam ───────────────────────────────────────────────────────────────
//
// `benchmark.source` is "benchmark" today (an industry benchmark, USD). The
// owner's plan is a "fieldquo_median" source — the median across FieldQuo
// companies' own prices, aggregate only and k-anonymous (lib/pricing/
// benchmark.js). `benchmarkIn` (lib/pricing/benchmarkFx.js) already passes a
// non-benchmark source through unconverted, so the day that source exists the
// UI does not change.
//
// ── Consumers ──────────────────────────────────────────────────────────────
//
//   lib/products/seedServices.js     writes Product rows at signup, on trade
//                                    enable, and from "Add missing services"
//   Settings > Services              the range bar and "Use typical"
//   Settings > Products & Services   the same bar in the price editor
//   the New-quote template gallery   serviceSeedsFor(trade), read-only
//
// This file imports only the seed index and stays free of the database, so a
// check script can execute every decision below against fixtures.

import { SERVICE_SEEDS } from "@/app/data/serviceSeeds";

/** Units a seed may carry — what the quote builder writes on a line item. */
export const SEED_UNITS = ["flat", "each", "sqft", "linear_ft", "hour"];

/** Languages every seed carries. */
export const SEED_LANGUAGES = ["en", "fr", "es"];

/** The whole seed for a trade (a ServiceCategory.key), or null. */
export function serviceSeedsFor(trade) {
  if (!trade || !Object.hasOwn(SERVICE_SEEDS, trade)) return null;
  return SERVICE_SEEDS[trade];
}

/** Every trade that ships a seed, in the index's order. */
export function seededTrades() {
  return Object.keys(SERVICE_SEEDS);
}

/**
 * The services a trade seeds INTO A COMPANY'S CATALOGUE — every service whose
 * price is a flat number the company sets. Services marked `pricedBy` are
 * excluded: a takeoff-priced painting or roofing service is priced by the
 * takeoff, and a second, flat-priced copy of it in Products & Services would
 * be a control that contradicts the rate card. They stay in the seed as a
 * reference (the template gallery reads them) and are counted as
 * `referenceOnly` by planServiceSeeds.
 */
export function seedableServices(seed) {
  return (seed?.services || []).filter((s) => !s.pricedBy);
}

let byKey = null;
function index() {
  if (byKey) return byKey;
  byKey = new Map();
  for (const trade of seededTrades()) {
    for (const s of SERVICE_SEEDS[trade].services || []) {
      byKey.set(s.seedKey, { ...s, trade });
    }
  }
  return byKey;
}

/** One seeded service by its stable key, with its trade attached, or null. */
export function seedServiceByKey(seedKey) {
  if (!seedKey) return null;
  return index().get(seedKey) || null;
}

/** The USD benchmark range for a seed key, or null when the source had none. */
export function benchmarkForSeedKey(seedKey) {
  const s = seedServiceByKey(seedKey);
  return s?.benchmark || null;
}

/**
 * Median of the medians a trade's seed carries — "typical for this trade" at
 * the top of the services card. Null when no service has a range; never a
 * number invented from the ones that do not.
 */
export function tradeBenchmarkSummary(trade) {
  const seed = serviceSeedsFor(trade);
  if (!seed) return null;
  const medians = (seed.services || [])
    .map((s) => Number(s.benchmark?.median))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  const total = (seed.services || []).length;
  const seedable = seedableServices(seed).length;
  return {
    trade,
    total,
    seedable,
    withRange: medians.length,
    medianOfMedians: medians.length ? median(medians) : null,
    currency: "USD",
    source: "benchmark",
  };
}

function median(sorted) {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * What seeding a trade would DO to one company, given what it already has.
 *
 * Idempotent by seedKey: a row the company already holds — whatever it has
 * renamed or repriced it to — is skipped, never rewritten. Re-running after
 * the seed gains services adds only the new keys. Pure, so the check executes
 * it against fixtures.
 *
 * @param seed             serviceSeedsFor(trade)
 * @param existingSeedKeys the company's Product.seedKey values (any category)
 * @returns { toCreate, skipped, referenceOnly, total }
 */
export function planServiceSeeds({ seed, existingSeedKeys = [] } = {}) {
  const have = new Set((Array.isArray(existingSeedKeys) ? existingSeedKeys : []).filter(Boolean));
  const all = seed?.services || [];
  const seedable = seedableServices(seed);
  const toCreate = seedable.filter((s) => !have.has(s.seedKey));
  return {
    toCreate,
    skipped: seedable.length - toCreate.length,
    referenceOnly: all.length - seedable.length,
    total: all.length,
  };
}

/**
 * Pick the text a company sees as its own, and the translations beside it.
 *
 * `name`/`description` on a Product are "what the company typed", in its
 * default language; `translations` hold the others, keyed by language, in the
 * shape Product.translations documents. A company whose default language the
 * seed does not carry gets English as the source and all three as
 * translations — an honest fallback, not a machine-guessed fourth language.
 */
export function seedText(service, language) {
  const source = SEED_LANGUAGES.includes(language) ? language : "en";
  const name = service.name?.[source] || service.name?.en || "";
  const description = service.description?.[source] || service.description?.en || "";
  const translations = {};
  for (const lang of SEED_LANGUAGES) {
    if (lang === source) continue;
    const n = service.name?.[lang];
    const d = service.description?.[lang];
    if (n || d) translations[lang] = { name: n || name, description: d || description };
  }
  return { name, description, translations };
}
