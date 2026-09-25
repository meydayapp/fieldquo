// lib/signup/sampleServices.js
//
// The sample quote beside the Trades step of signup: two of the trade's own
// services — NAME, DESCRIPTION and the PRICE a company in that trade starts
// with — plus the scope wording and "what happens next" the real client
// quote page prints for that trade. Server-side only; the route hands the
// page the result.
//
// ══ Why the price is here now (2026-09-25) ═════════════════════════════════
//
// Until today this module stripped every figure and the panel drew round
// placeholders ($1,180, $740) beside the trade's service names. The owner
// looked at the HVAC sample — "3.5-ton split system installation … $1,180"
// — and said a figure like that is not believable: the sample prices must
// come from the trade's own seed data, in the visitor's currency. So each
// line now carries `price`: the seed's benchmark MEDIAN converted by
// suggestedIn (lib/pricing/benchmarkFx.js) — exactly the number
// lib/products/seedServices.js writes into Product.unitPrice when this
// visitor's company is created a minute later. It is the visitor's own
// starting price, not a fact about anybody else.
//
// What still never leaves: the benchmark object itself (low / high / source
// / asOf), any service beyond the two sampled, and anything for an industry
// that is not on the list. Two numbers per trade, rate-limited, is the price
// of a believable sample; the library stays on the server. Non-negotiable #4
// is about a CONTRACTOR's rate card on their public pages and is untouched —
// these are FieldQuo's seed defaults, shown to the contractor, on FieldQuo's
// own signup page.
//
// A service whose seed carries no median gets `price: null`, never a
// placeholder: the panel then shows the fixture company's real sample quote
// with a sentence saying so (app/components/auth/samples/QuoteSample.js).

import { categoryKeysForIndustries } from "@/lib/trades/catalog";
import { serviceSeedsFor, seedText } from "@/lib/services/seeds";
import { suggestedIn } from "@/lib/pricing/benchmarkFx";
import { dominantGlossary, dominantProcessSteps, resolveServiceContent } from "@/lib/documents/serviceContent";
import { INDUSTRIES } from "@/app/data/industries";

/** How many lines the sample quote shows. */
export const SAMPLE_COUNT = 2;

const INDUSTRY_SLUGS = new Set(INDUSTRIES.map((i) => i.slug));

/** A known industry slug, or null. Anything else in the query is ignored. */
export function cleanIndustrySlug(value) {
  return typeof value === "string" && INDUSTRY_SLUGS.has(value) ? value : null;
}

/** The two currencies a seed price converts into (benchmarkFx SUPPORTED), or null. */
export function cleanSampleCurrency(value) {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  return code === "USD" || code === "CAD" ? code : null;
}

/**
 * Which heading of a seed to sample from, when it has one of these. In
 * order of preference: the trade's own core work first, then what the owner
 * pointed at in the competitor's panels ("Kitchen remodel", "Bathroom
 * remodel"), then the install/repair headings most trades carry. A seed with
 * none of them samples its LARGEST heading that is not a catch-all — visits,
 * add-ons, "additional", prep — because the biggest heading is the trade's
 * bread and butter, and a booked visit or a hot-tub add-on is not what a
 * homeowner expects to read first on a quote.
 */
const PREFERRED_CATEGORIES = ["core", "kitchen", "bathroom", "install", "repair", "replace", "windows", "carpet", "central", "tree_removal", "removal"];
const CATCH_ALL_CATEGORIES = new Set(["visits", "add_ons", "additional", "commercial", "prep", "specialty", "components", "maintenance", "labour"]);

/** The seed's own catch-all rows ("Other roof cleaning — describe what you need"). */
const isCatchAllRow = (service) => /^other\b|describe what you need/i.test(service?.name?.en || "");

const hasMedian = (service) => Number(service?.benchmark?.median) > 0;

function sampleCategoryFor(seed) {
  const counts = new Map();
  for (const s of seed.services || []) counts.set(s.category, (counts.get(s.category) || 0) + 1);
  for (const key of PREFERRED_CATEGORIES) if (counts.has(key)) return key;
  let best = null;
  for (const [key, n] of counts) {
    if (CATCH_ALL_CATEGORIES.has(key)) continue;
    if (!best || n > best.n) best = { key, n };
  }
  return best?.key || null;
}

/**
 * The candidates of one seed, best first: its sample heading, then its other
 * headings that are not catch-alls, each in seed order. Catch-all rows and
 * rows with no description never qualify.
 */
function candidatesOf(seed) {
  const category = sampleCategoryFor(seed);
  if (!category) return [];
  const ok = (s) => !isCatchAllRow(s) && s?.description?.en;
  const own = (seed.services || []).filter((s) => s.category === category && ok(s));
  const others = (seed.services || []).filter((s) => s.category !== category && !CATCH_ALL_CATEGORIES.has(s.category) && ok(s));
  return [...own, ...others];
}

/**
 * Up to SAMPLE_COUNT seed services for an industry, with the catalogue key
 * of the seed they came from. A PRICED service (one whose benchmark has a
 * median) beats an unpriced one wherever it sits in the order, so a trade
 * that has figures shows figures; within each kind, the order above.
 */
function pickServices(industry) {
  const priced = [];
  const unpriced = [];
  for (const key of categoryKeysForIndustries([industry])) {
    const seed = serviceSeedsFor(key);
    if (!seed) continue;
    for (const service of candidatesOf(seed)) (hasMedian(service) ? priced : unpriced).push({ key, service });
  }
  const seen = new Set();
  const out = [];
  for (const row of [...priced, ...unpriced]) {
    if (out.length >= SAMPLE_COUNT) break;
    const en = row.service.name?.en;
    if (!en || seen.has(en)) continue;
    seen.add(en);
    out.push(row);
  }
  return out;
}

/**
 * Up to SAMPLE_COUNT services for an industry slug, each
 * { name, description, price } in `language` (falling back to English, as
 * seedText does). `price` is the company's starting price in `currency`
 * (USD or CAD), or null — no median, or a currency the seed does not
 * convert into. An industry with no seed (pressure washing today) returns
 * [] and the panel falls back to the quote-type labels the page holds; it
 * never invents one.
 */
export function sampleServicesForIndustry(slug, language = "en", currency = null) {
  const industry = cleanIndustrySlug(slug);
  if (!industry) return [];
  const code = cleanSampleCurrency(currency);
  return pickServices(industry).map(({ service }) => {
    const { name, description } = seedText(service, language);
    return { name, description, price: code ? suggestedIn(service.benchmark?.median, code) : null };
  });
}

/**
 * Everything the sample quote page needs for a trade, as the public quote
 * route (app/api/public/quotes/[token]) would project it for a quote whose
 * one scope group is this trade: the group's description / included /
 * may-change wording and accent from resolveServiceContent, and the "what
 * happens next" steps and glossary from the same dominant-group readers —
 * so the sample prints the words a real quote in this trade prints.
 *
 * @returns {{ categoryKey, currency, services, group, processSteps, glossary }}
 *          or null for an unknown industry.
 */
export function sampleQuoteForIndustry(slug, language = "en", currency = null) {
  const industry = cleanIndustrySlug(slug);
  if (!industry) return null;
  const picked = pickServices(industry);
  const code = cleanSampleCurrency(currency);
  const services = picked.map(({ service }) => {
    const { name, description } = seedText(service, language);
    return { name, description, price: code ? suggestedIn(service.benchmark?.median, code) : null };
  });
  // The seed the first line came from names the group's trade. An industry
  // with no seed at all has no category to word the group with: the generic
  // wording, as a quote whose group has no category gets.
  const categoryKey = picked[0]?.key || null;
  const content = resolveServiceContent(categoryKey, null, null, language);
  const subtotal = services.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
  const groups = [{ categoryKey, override: null, subtotal }];
  return {
    categoryKey,
    currency: code,
    services,
    group: {
      accent: content.accent || null,
      description: content.description || "",
      included: Array.isArray(content.included) ? content.included : [],
      mayChange: Array.isArray(content.mayChange) ? content.mayChange : [],
    },
    processSteps: dominantProcessSteps(groups, language),
    glossary: dominantGlossary(groups),
  };
}
