// lib/reviews/googlePlace.js
//
// A Google listing → the link where a customer writes a review.
//
// ── Why a place_id and not a pasted link ─────────────────────────────────────
//
// The "Ask for reviews" link Google shows a business owner (g.page/r/…/review)
// is only visible from inside their Business Profile dashboard, and most
// contractors cannot find it — the settings screen has had a paste box for a
// year and the majority of companies left it empty. What they CAN do is type
// their own business name into the same Places box the address fields use;
// that returns a place_id, and Google documents one URL that opens the review
// dialog for any place_id:
//
//     https://search.google.com/local/writereview?placeid=<place_id>
//
// So the settings screen looks the listing up and derives the link. The paste
// box stays — a company that wants to send customers to HomeStars or Yelp
// still can — and a derived link is stored in the same `reviewUrl` column, so
// nothing downstream (the cron, the email, the QR) knows or cares which way
// it arrived.
//
// Pure. scripts/check-reviews-google.mjs executes it against hostile input.

const WRITE_REVIEW = "https://search.google.com/local/writereview?placeid=";

/**
 * Does this look like a Google place_id? They are URL-safe base64-ish strings
 * of 20–300 characters, almost always starting with "ChIJ" for a business,
 * "Eh" for an address, or "GhIJ" for a coordinate. Length and charset only —
 * the prefix is not enforced, because Google documents no format guarantee
 * and a contractor's real listing must never be refused on a heuristic.
 */
export function looksLikePlaceId(value) {
  if (typeof value !== "string") return false;
  const v = value.trim();
  return v.length >= 20 && v.length <= 300 && /^[A-Za-z0-9_-]+$/.test(v);
}

/** The review link for a place_id, or null when the id does not look like one. */
export function reviewUrlForPlaceId(placeId) {
  if (!looksLikePlaceId(placeId)) return null;
  return `${WRITE_REVIEW}${encodeURIComponent(placeId.trim())}`;
}

/** The inverse, for the screen: was this reviewUrl derived from a listing? */
export function placeIdFromReviewUrl(url) {
  if (typeof url !== "string") return null;
  try {
    const u = new URL(url.trim());
    if (u.hostname !== "search.google.com" || u.pathname !== "/local/writereview") return null;
    const id = u.searchParams.get("placeid");
    return looksLikePlaceId(id) ? id : null;
  } catch {
    return null;
  }
}

/**
 * One line naming the listing, from what the Places box returned. Name and
 * address as Google printed them, never reformatted — this is shown back to
 * the contractor as "the listing you picked", and the only useful version of
 * that sentence is Google's own.
 */
export function placeLabel({ name, address } = {}) {
  const n = typeof name === "string" ? name.replace(/\s+/g, " ").trim() : "";
  const a = typeof address === "string" ? address.replace(/\s+/g, " ").trim() : "";
  return [n, a].filter(Boolean).join(" — ").slice(0, 300) || null;
}
