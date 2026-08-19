// lib/reviews/mergeReviews.js
//
// The two places a company's reviews can live, reconciled into one list.
//
// ── Why two sources rather than one ─────────────────────────────────────────
//
// `Testimonial` is the approval-gated table: a row is invisible until someone
// sets `approved`, which is the property that makes it safe to serve publicly.
//
// The other place is the site's own block JSON. What a contractor typed under
// Settings → Website → Sections → "What clients say" is stored there
// (app/data/siteBlocks.js), already through `sanitiseBlocks`, and for most of
// this product's life that was the only way to record a review at all.
//
// The table is now the right answer — Settings → Reviews writes it, and a
// regeneration rebuilds the blocks FROM it. But the blocks of every company
// that predates that screen still hold the only copy of their reviews, and an
// embed that showed them nothing would be a control that appears to work and
// doesn't. So: both, table first, de-duplicated by the text of the quote. The
// block half is a bridge, not a second home; it can go once those rows have
// been migrated.
//
// ── Why this file has no imports ────────────────────────────────────────────
//
// The interesting failures here are all shape failures — a `pages` that is a
// string, a block whose content is null, the same review recorded in both
// places — and every one can be provoked in a throwaway script in a
// millisecond. A database call, or an import that reaches `next/server`, would
// mean none of it can be exercised without a running app. The DB half lives
// next door in publicReviews.js.

/** Same key for "the same review recorded twice" — punctuation and case folded. */
const dedupeKey = (quote) => String(quote).trim().replace(/\s+/g, " ").toLowerCase();

/**
 * @param rows   Testimonial rows: { quote, authorName, authorTitle, companyLabel },
 *               already filtered to approved and already in publication order.
 * @param site   { blocks, pages } as stored, or null.
 * @param limit  hard cap on what a host page can be made to render.
 * @returns [{ quote, author }] — author may be an empty string.
 */
export function mergeReviews({ rows = [], site = null, limit = 6 } = {}) {
  const out = [];
  const seen = new Set();

  const push = (quote, author) => {
    const text = typeof quote === "string" ? quote.trim() : "";
    if (!text) return;
    const key = dedupeKey(text);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ quote: text, author: author || "" });
  };

  for (const r of Array.isArray(rows) ? rows : []) {
    // The public byline as captured at approval time — name, then whatever
    // context was given with it. Joined here rather than in the renderer so
    // both sources arrive in one shape.
    push(
      r?.quote,
      [r?.authorName, r?.authorTitle, r?.companyLabel]
        .filter((s) => typeof s === "string" && s.trim())
        .join(", "),
    );
  }

  // A block can appear on the single-page `blocks` list and again on a page of
  // a multi-page site (buildPages clones it), which is why the dedupe above is
  // not optional.
  const lists = [
    Array.isArray(site?.blocks) ? site.blocks : [],
    ...(Array.isArray(site?.pages) ? site.pages : []).map((p) =>
      Array.isArray(p?.blocks) ? p.blocks : [],
    ),
  ];

  for (const list of lists) {
    for (const block of list) {
      if (block?.type !== "testimonials") continue;
      // `visible: false` is the contractor saying "not on my page". Honouring
      // it here keeps one decision in one place instead of two public surfaces
      // that disagree about which reviews are published.
      if (block.visible === false) continue;
      for (const item of Array.isArray(block.content?.items) ? block.content.items : []) {
        push(item?.quote, typeof item?.author === "string" ? item.author : "");
      }
    }
  }

  return out.slice(0, limit);
}
