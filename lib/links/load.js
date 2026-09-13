// lib/links/load.js
//
// The one query behind the bio-link page, shared by the public page and the
// settings screen that configures it.
//
// Shared on purpose. The settings screen has to show EXACTLY what a visitor
// will get — that is the entire point of a screen whose output is a URL you
// paste somewhere you can't take back. Two queries would drift, and the drift
// would only be visible to the contractor's audience.

import { db } from "@/lib/db";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import { INSTANT_ESTIMATE_TRADES } from "@/lib/estimate/instantEstimate";
import { paintingScopesOffered } from "@/lib/estimate/instantSeed";
import { companyEnabledCategoryKeys } from "@/lib/trades/companyCategories";
import { KITCHEN_DESIGN_KEY } from "@/lib/kitchen/key";
import { linkCandidates } from "./candidates";
import { sanitiseLinkConfig } from "./config";

// Deliberately narrow. This runs for a stranger on a phone, and every column
// listed is one this page actually renders or derives a row from.
const SELECT = {
  id: true,
  name: true,
  slug: true,
  bookingSlug: true,
  logoUrl: true,
  brandColor: true,
  phone: true,
  email: true,
  website: true,
  // The line under the name — see lib/links/handle.js for which of these
  // wins and why the FieldQuo site host never does.
  city: true,
  province: true,
  country: true,
  reviewUrl: true,
  defaultLanguage: true,
  linkPage: {
    select: { published: true, headline: true, bio: true, items: true },
  },
  site: { select: { subdomain: true, published: true } },
  // Bookable at all? A calendar with no active event type renders an empty
  // month, so it must not become a row. See ./candidates.js.
  eventTypes: { where: { active: true }, select: { id: true }, take: 1 },
  // Every enabled row, with its trade: which of them the estimator will
  // actually show is decided in priceableEstimators below, not by the count.
  instantQuoteConfigs: { where: { enabled: true }, select: { trade: true } },
  funnels: {
    where: { status: "published" },
    select: { slug: true, name: true, status: true },
    orderBy: { createdAt: "asc" },
    take: 20,
  },
};

/**
 * Everything the page needs, from a slug.
 *
 * @returns null when there is no such company — the caller 404s. A company
 *          that exists but has switched the page off also gets null from
 *          loadPublicLinkPage below; the settings loader still returns it,
 *          because that is the screen where you turn it back on.
 */
export async function loadLinkPageData(slug) {
  const company = await findBookingCompany(slug, SELECT);
  if (!company) return null;
  return shape(company);
}

/** The same thing for a company we already know the id of. */
export async function loadLinkPageDataForCompany(companyId) {
  if (!companyId) return null;
  const company = await db.company.findUnique({ where: { id: companyId }, select: SELECT });
  return company ? shape(company) : null;
}

async function shape(company) {
  const config = sanitiseLinkConfig(company.linkPage || {});
  // Read once and shared: the painting-scope rule below and the kitchen row
  // both need the company's enabled services, and this runs for a stranger
  // on a phone.
  const categoryKeys = await companyEnabledCategoryKeys(company.id);
  const candidates = linkCandidates({
    company,
    site: company.site,
    activeEventTypes: company.eventTypes.length,
    enabledEstimators: await priceableEstimators(company, categoryKeys),
    funnels: company.funnels,
    // The SAME condition /quote/[slug]/kitchen applies before it renders
    // (companyOffersKitchenDesign in lib/kitchen/access.js): the service is
    // switched on. Not a feature flag — see lib/kitchen/key.js.
    offersKitchenDesign: categoryKeys.includes(KITCHEN_DESIGN_KEY),
  });
  return { company, config, candidates };
}

/**
 * How many enabled estimators /instant-quote will actually show.
 *
 * The same two rules lib/estimate/instantQuoteServer.js applies before it
 * renders a trade, and no others: the trade must be one INSTANT_ESTIMATE_TRADES
 * can price, and painting only counts when the company sells at least one
 * painting scope (interior or exterior) — a painting estimator with no scope
 * is dropped from the page there, so it must not become a row here. Counting
 * `enabled` rows alone was the bug this replaces: a company with painting
 * switched on and no painting service got a "Get an instant price" button
 * onto an estimator with nothing on it.
 *
 * The enabled-service keys arrive from shape(), which reads them once for
 * this rule and for the kitchen row together; no second query here.
 */
async function priceableEstimators(company, categoryKeys) {
  const trades = (company.instantQuoteConfigs || [])
    .map((row) => row.trade)
    .filter((trade) => Boolean(INSTANT_ESTIMATE_TRADES[trade]));
  const others = trades.filter((trade) => trade !== "painting").length;
  if (others > 0) return trades.length;
  if (!trades.includes("painting")) return 0;
  const scopes = paintingScopesOffered(categoryKeys);
  return scopes.length > 0 ? 1 : 0;
}
