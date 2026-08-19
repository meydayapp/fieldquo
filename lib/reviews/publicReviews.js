// lib/reviews/publicReviews.js
//
// The reviews a company is willing to show a stranger, read from the database.
//
// The reconciliation of the two places they can live is next door in
// mergeReviews.js, which has no imports so it can be run against hostile input
// without a database. This file is only the queries.
//
// ── What it deliberately does NOT return ───────────────────────────────────
//
// Ids, dates, `approved`, `featured`, `source`, `externalId` — none of it. The
// one caller is a public page rendering inside a stranger's website; it needs a
// sentence and a name, so a sentence and a name is all that leaves the database
// layer. There is nothing here to leak because nothing else is selected.

import { db } from "@/lib/db";
import { TESTIMONIAL_ORDER, PUBLISHED_LIMIT } from "@/lib/reviews/testimonialAccess";
import { mergeReviews } from "@/lib/reviews/mergeReviews";

/**
 * @param companyId  the tenant. Both queries below are filtered by it; there is
 *                   no code path that returns another company's rows.
 * @param limit      hard cap on what a host page can be made to render.
 * @returns [{ quote, author }] — author may be an empty string.
 */
export async function loadPublicReviews(companyId, { limit = PUBLISHED_LIMIT } = {}) {
  if (!companyId) return [];

  const [rows, site] = await Promise.all([
    db.testimonial.findMany({
      where: { companyId, approved: true },
      // Borrowed rather than restated. The reviews management screen prints
      // "N published" from these same constants; a second ordering here would
      // let a contractor reorder the list and get a different six on their own
      // website than the ones that screen said were published.
      orderBy: TESTIMONIAL_ORDER,
      select: { quote: true, authorName: true, authorTitle: true, companyLabel: true },
      take: limit,
    }),
    // Not gated on `published`. The company this embed exists for is the one
    // that already has its own website and will never publish the FieldQuo
    // one — requiring publication would make the snippet dead for exactly its
    // intended user.
    db.companySite.findUnique({
      where: { companyId },
      select: { blocks: true, pages: true },
    }),
  ]);

  return mergeReviews({ rows, site, limit });
}
