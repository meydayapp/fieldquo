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
import { suggestedIn } from "@/lib/pricing/benchmarkFx";
import { sanitiseTemplateLines, sanitiseDefaultDiscount, sanitiseImageUrl, sanitiseEstimateTypes } from "@/lib/services/templates";

/** Units a seed may carry — what the quote builder writes on a line item. */
export const SEED_UNITS = ["flat", "each", "sqft", "linear_ft", "hour"];

/** Languages every seed carries. */
export const SEED_LANGUAGES = ["en", "fr", "es"];

/**
 * Languages a TEMPLATED service may carry on top of the three every seed has —
 * the owner's list for the estimate templates ("english, french, spanish,
 * italian, german, tagalog, ukrainian"). seedText reads whatever a service
 * actually carries; a language is never invented for a service that has none.
 */
export const TEMPLATE_LANGUAGES = ["en", "fr", "es", "it", "de", "uk", "tl"];

/** The four headings the estimate-template library is organised under. */
export const TEMPLATE_CATEGORIES = ["installation", "repair", "inspection", "maintenance"];

// ── The estimate template on a seed row — the exact shape this loader reads ──
//
// A seed service may carry, beside the fields index.js documents, the
// ESTIMATE TEMPLATE the service opens with. The seeds are authored by a
// separate pass; this file is the loader, so the contract is written here
// once and the seeds match it:
//
//   {
//     seedKey, category, unit, benchmark, …           // as ./index.js documents
//     name:        { en, fr, es },                     // as today
//     description: { en, fr, es },                     // as today
//
//     templateLines: [{                               // ENGLISH text, USD money
//       kind: "labour" | "material" | "other",
//       name, description,
//       qty, unit,                                     // unit: flat | each | sqft | linear_ft | hour | square
//       unitPrice, unitCost,                           // USD, converted like the benchmark median
//       taxable,                                       // boolean; absent = taxable
//       measurementKey?,                               // a key of lib/services/measurementKeys.js — the
//                                                      //   closed registry of what the takeoffs produce
//                                                      //   (a painter's wallSqft, a stair's treads, a
//                                                      //   roof's squares …); qty then comes from the
//                                                      //   takeoff, or the line is flagged needsMeasurement.
//                                                      //   An unknown key fails validateTemplateLines.
//       wastePct?,                                     // material lines only: qty × (1 + wastePct/100)
//     }],
//     defaultDiscount: { name, kind: "fixed" | "percent", amount },   // English; USD when fixed
//     imageUrl: "https://…",
//     categories: ["cabinet_refinishing", …],          // the QUOTE TYPES (ServiceCategory keys)
//                                                      //   the template is offered on, beside the
//                                                      //   trade being seeded (always linked)
//     estimateTypes: ["interior", …],                  // painting sub-types (PAINT_ESTIMATE_TYPES
//                                                      //   keys) the template is limited to;
//                                                      //   absent/empty = every estimate type
//     translations: {                                  // keyed by language code
//       fr: { name, description,
//             templateLines: [{ name, description }],  // SAME ORDER as templateLines
//             defaultDiscountName? },
//       es, it, de, uk, tl: same shape
//     },
//     templateCategory?: "installation" | "repair" | "inspection" | "maintenance",
//   }
//
// What lands on the Product row (productDataForSeed → seedTemplateFor):
//   templateLines[i]  = { kind, name, description, qty, unit, unitPrice, unitCost,
//                         taxable, measurementKey?, wastePct?, translations }
//                       with name/description in the COMPANY's language when the
//                       seed carries it (else English) and every other language
//                       the seed carries under `translations` — the shape
//                       lib/services/templates.js#lineText reads;
//   defaultDiscount   = { name, kind, amount } in the company's language and
//                       currency (a percent is a percent anywhere);
//   imageUrl          = the seed's, when it is an https URL;
//   categories        = the seeding trade's category PLUS every `categories`
//                       key that names a system quote type (resolved to ids
//                       by the seeder — seedCategoryKeys lists the keys);
//   estimateTypes     = the seed's, known keys only (sanitiseEstimateTypes);
//   templateEnabled   = true (the schema default) — the company's switch.
// A service with no template gets NO template keys at all — Prisma refuses a
// bare null on a Json column, and absent keeps the column null.

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
  const names = service?.name && typeof service.name === "object" ? service.name : {};
  const descs = service?.description && typeof service.description === "object" ? service.description : {};
  const tr = service?.translations && typeof service.translations === "object" ? service.translations : {};
  const nameIn = (l) => names[l] || tr[l]?.name || "";
  const descIn = (l) => descs[l] || tr[l]?.description || "";
  const source = nameIn(language) ? language : "en";
  const name = nameIn(source) || names.en || "";
  const description = descIn(source) || descs.en || "";
  const translations = {};
  const langs = new Set([...SEED_LANGUAGES, ...Object.keys(names), ...Object.keys(descs), ...Object.keys(tr)]);
  for (const lang of langs) {
    if (lang === source) continue;
    const n = nameIn(lang);
    const d = descIn(lang);
    if (n || d) translations[lang] = { name: n || name, description: d || description };
  }
  return { name, description, translations };
}

/**
 * The template a seeded service opens with, ready to store on the Product
 * row — see the contract above. Every line's text in the company's language
 * with the other languages beside it, every USD figure converted and rounded
 * into the company's currency by the same rule the headline price follows
 * (benchmarkFx). `null` lines/discount/image for a service that has none —
 * never an empty array standing in for one.
 *
 * A line whose USD figure does not convert (an unsupported currency) keeps a
 * null price so the company sees the line and sets the rate, exactly as an
 * unpriced service reads "set your rate".
 */
export function seedTemplateFor(service, { language, currency } = {}) {
  const raw = Array.isArray(service?.templateLines) ? service.templateLines : [];
  const tr = service?.translations && typeof service.translations === "object" ? service.translations : {};
  const langs = Object.keys(tr).filter((l) => Array.isArray(tr[l]?.templateLines));
  const source = language && language !== "en" && langs.includes(language) ? language : "en";
  const lines = raw.map((line, i) => {
    const own = source === "en" ? null : tr[source].templateLines[i];
    const name = own?.name || line?.name || "";
    const description = (own?.name ? own.description : null) || line?.description || "";
    const translations = {};
    if (source !== "en" && line?.name) translations.en = { name: line.name, description: line.description || "" };
    for (const l of langs) {
      if (l === source) continue;
      const e = tr[l].templateLines[i];
      if (e?.name) translations[l] = { name: e.name, description: e.description || "" };
    }
    return {
      kind: line?.kind,
      name,
      description,
      qty: line?.qty,
      unit: line?.unit,
      unitPrice: suggestedIn(line?.unitPrice, currency),
      unitCost: suggestedIn(line?.unitCost, currency),
      taxable: line?.taxable,
      measurementKey: line?.measurementKey,
      wastePct: line?.wastePct,
      ...(Object.keys(translations).length ? { translations } : {}),
    };
  });
  const d = service?.defaultDiscount;
  const discount = d
    ? sanitiseDefaultDiscount({
        name: tr[source]?.defaultDiscountName || d.name,
        kind: d.kind,
        amount: d.kind === "percent" ? d.amount : suggestedIn(d.amount, currency),
      })
    : null;
  return {
    templateLines: sanitiseTemplateLines(lines),
    defaultDiscount: discount,
    imageUrl: sanitiseImageUrl(service?.imageUrl),
    estimateTypes: sanitiseEstimateTypes(service?.estimateTypes),
  };
}

/**
 * The quote-type keys a seed row asks to be linked to beside the trade being
 * seeded — strings only, deduplicated, the seeding trade itself excluded
 * (it is always linked). The seeder resolves them to ServiceCategory ids.
 */
export function seedCategoryKeys(service, seedingTrade = null) {
  const raw = Array.isArray(service?.categories) ? service.categories : [];
  const keys = [...new Set(raw.filter((k) => typeof k === "string" && /^[a-z0-9_]+$/.test(k)))];
  return keys.filter((k) => k !== seedingTrade);
}

/**
 * Every templated service of a trade, grouped under the four headings, for
 * the estimate-template library. A service whose `templateCategory` is not
 * one of the four is listed under "other" rather than dropped.
 */
export function templatedServices(trade) {
  const seed = serviceSeedsFor(trade);
  const groups = Object.fromEntries([...TEMPLATE_CATEGORIES, "other"].map((k) => [k, []]));
  for (const s of seed?.services || []) {
    if (!Array.isArray(s.templateLines) || !s.templateLines.length) continue;
    const key = TEMPLATE_CATEGORIES.includes(s.templateCategory) ? s.templateCategory : "other";
    groups[key].push(s);
  }
  return groups;
}
