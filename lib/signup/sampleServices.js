// lib/signup/sampleServices.js
//
// Two services for the sample quote beside the Trades step of signup — the
// NAMES and DESCRIPTIONS a company in that trade starts with, in the seed's
// own languages, and nothing else.
//
// ══ Why this is server-side and strips the seed ════════════════════════════
//
// app/data/serviceSeeds/* carries an industry benchmark beside every service
// (low / median / high, USD). The seed files' own rule is that nothing in
// them reaches a client-facing surface, and non-negotiable #4 says a public
// endpoint never returns prices. /signup is a public page: importing the
// seeds into its client bundle would ship the whole benchmark library to
// every browser that opens the form, whether or not the panel printed a
// number. So the seeds are read HERE, on the server, and the route hands the
// page two names and two sentences — scripts/check-signup-aside.mjs asserts
// the payload carries no digit-bearing field, and check:public-payload
// treats the route as public like any other.
//
// The panel's amounts are illustrative placeholders drawn by the panel
// itself, labelled as such, never the seed medians.

import { categoryKeysForIndustries } from "@/lib/trades/catalog";
import { serviceSeedsFor, seedText } from "@/lib/services/seeds";
import { INDUSTRIES } from "@/app/data/industries";

/** How many lines the sample quote shows. */
export const SAMPLE_COUNT = 2;

const INDUSTRY_SLUGS = new Set(INDUSTRIES.map((i) => i.slug));

/** A known industry slug, or null. Anything else in the query is ignored. */
export function cleanIndustrySlug(value) {
  return typeof value === "string" && INDUSTRY_SLUGS.has(value) ? value : null;
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
 * Up to SAMPLE_COUNT services for an industry slug, each { name, description }
 * in `language` (falling back to English, as seedText does).
 *
 * Walks the trade's catalogue keys in catalogue order, picks each seed's
 * sample heading (above) and takes its first services that carry a
 * description and are not a catch-all row. An industry with no seed
 * (pressure washing, landscaping today) returns [] and the panel falls back
 * to the quote-type labels the page already holds; it never invents one.
 */
export function sampleServicesForIndustry(slug, language = "en") {
  const industry = cleanIndustrySlug(slug);
  if (!industry) return [];
  const out = [];
  for (const key of categoryKeysForIndustries([industry])) {
    const seed = serviceSeedsFor(key);
    if (!seed) continue;
    const category = sampleCategoryFor(seed);
    if (!category) continue;
    for (const service of seed.services || []) {
      if (out.length >= SAMPLE_COUNT) break;
      if (service.category !== category || isCatchAllRow(service)) continue;
      const { name, description } = seedText(service, language);
      if (!name || !description) continue;
      if (out.some((s) => s.name === name)) continue;
      out.push({ name, description });
    }
    if (out.length >= SAMPLE_COUNT) break;
  }
  return out;
}
