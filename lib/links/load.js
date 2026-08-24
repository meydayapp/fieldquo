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
  instantQuoteConfigs: { where: { enabled: true }, select: { id: true }, take: 1 },
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

function shape(company) {
  const config = sanitiseLinkConfig(company.linkPage || {});
  const candidates = linkCandidates({
    company,
    site: company.site,
    activeEventTypes: company.eventTypes.length,
    enabledEstimators: company.instantQuoteConfigs.length,
    funnels: company.funnels,
  });
  return { company, config, candidates };
}
