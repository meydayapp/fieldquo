// lib/quotes/takeoffAddOns.js
//
// The optional scope a takeoff offers, turned into rows the client can tick.
//
// ── Why this exists at all ─────────────────────────────────────────────────
//
// The painting takeoff lets an estimator mark an area or a substrate OPTIONAL:
// the hallway if you're doing the bedrooms, the crown moulding in the den. A
// checkbox that only greyed a row out on the estimator's screen would be the
// exact failure this codebase gets swept for — a control that appears to work.
// "Optional" has to mean the client can remove it and the total they sign
// changes.
//
// QuoteAddOn already does that, and does it correctly: the browser posts ids
// and nothing else, and app/api/public/quotes/[token]/route.js reprices from
// its own rows (non-negotiable #5). So an optional area leaves the priced scope
// and comes back as one of those rows. No new mechanism, no second way for a
// client to change a total.
//
// ── Derived server-side, from the stored takeoff ────────────────────────────
//
// The amount is never read off the request. It is computed here from the
// group's own takeoff and this company's own rate card, exactly as
// resolveCostingGroups does for the cost panel — and for the same reason: a
// browser asserting "the optional hallway is $40" would write a price the
// quote's scope does not support.
//
// ── Why the rows are regenerated rather than merged ─────────────────────────
//
// A takeoff-sourced row is a VIEW of the takeoff. Edit the room, and the offer
// has to follow, or the client is ticking a price for work the scope no longer
// describes. So every save deletes this quote's takeoff rows and rewrites them,
// and leaves manual / AI / history rows completely alone. The add-ons editor
// renders takeoff rows read-only for the same reason, rather than offering an
// edit the next save would silently discard.

import { db } from "@/lib/db";
import { resolveCostingGroups } from "@/app/api/quotes/costingWrite";
import { tradeOptionalExtras } from "@/lib/pricing/tradeScope";

/** The `source` value that marks a row as owned by a takeoff. */
export const TAKEOFF_ADD_ON_SOURCE = "takeoff";

/**
 * Rewrite a quote's takeoff-derived optional extras.
 *
 * Best-effort by contract: the quote and its scope groups have already been
 * written when this runs, and a failure here must not report a saved quote as
 * failed. A quote with no optional scope clears its old rows and stops.
 *
 * @param {object} p
 * @param {string} p.companyId
 * @param {string} p.quoteId
 * @param {Array}  p.scopeGroups  as sent to the save route — categoryId +
 *                                takeoff. Only those two fields are trusted.
 * @returns {Promise<number>} how many rows now exist for this quote
 */
export async function syncTakeoffAddOns({ companyId, quoteId, scopeGroups }) {
  const groups = await resolveCostingGroups(companyId, scopeGroups);

  const rows = [];
  for (const g of groups) {
    if (!g.categoryKey || !g.takeoff) continue;
    const extras = tradeOptionalExtras(
      g.categoryKey,
      g.takeoff,
      g.rateOverrides,
    );
    for (const e of extras) {
      rows.push({
        quoteId,
        description: String(e.description).trim().slice(0, 200),
        detail: e.detail ? String(e.detail).trim().slice(0, 400) : null,
        amount: e.amount,
        // Taxed like the rest of the job. An optional room is the same work as
        // the rooms beside it, so anything else would be a claim nobody made.
        taxable: true,
        source: TAKEOFF_ADD_ON_SOURCE,
        sortOrder: rows.length,
      });
    }
  }

  // Same cap the editor enforces: more than a handful of extras is a second
  // quote, not an upsell. Applied here too so a 30-room takeoff with every
  // room optional cannot produce a 30-item shopping list on a homeowner's page.
  const capped = rows
    .filter((r) => r.description && Number.isFinite(r.amount) && r.amount > 0)
    .slice(0, 8);

  await db.$transaction([
    db.quoteAddOn.deleteMany({
      where: { quoteId, source: TAKEOFF_ADD_ON_SOURCE },
    }),
    ...(capped.length ? [db.quoteAddOn.createMany({ data: capped })] : []),
  ]);

  return capped.length;
}
