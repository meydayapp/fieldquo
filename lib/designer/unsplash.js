// lib/designer/unsplash.js
//
// The stock-photo tab in ImageSidebar, restored per the owner's 2026-08-30
// correction — it's free, same as every editor feature except AI image
// generation. Server-side only: the source clone's `unsplash-js` client used
// `NEXT_PUBLIC_UNSPLASH_ACCESS_KEY`, a key shipped straight into the browser
// bundle. That's wrong for the same reason /api/upload signs Cloudinary
// uploads server-side instead of using an unsigned preset — there is nothing
// to hide from here, this route runs behind session auth, and a public env
// var is a public write... well, read, token: anyone who opens devtools can
// read it out of the bundle and burn the account's rate limit from anywhere.
// So this calls Unsplash's plain REST API directly (no unsplash-js
// dependency needed for one endpoint) from app/api/designer/unsplash/route.js,
// and the key never reaches a browser.
//
// Same curated collection the source clone used (id 317099) rather than a
// search box — restoring exactly what existed, not inventing a bigger
// feature under the same name.
const COLLECTION_ID = "317099";
const DEFAULT_COUNT = 30;

export function unsplashConfigured() {
  return Boolean(process.env.UNSPLASH_ACCESS_KEY);
}

/**
 * @returns {Promise<Array<object>>} raw Unsplash photo objects. Throws on a
 *   non-OK response or a network failure — the caller (the API route)
 *   distinguishes "not configured" from "configured but the provider is
 *   unreachable right now", the same distinction voiceConfigured() callers
 *   make for the voice picker.
 */
export async function fetchRandomStockPhotos({ count = DEFAULT_COUNT } = {}) {
  const url = new URL("https://api.unsplash.com/photos/random");
  url.searchParams.set("collections", COLLECTION_ID);
  url.searchParams.set("count", String(count));

  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
    // Unsplash's own guidance: cache briefly rather than not at all — a
    // designer session opening the Image tab twice in a minute shouldn't
    // spend two calls against the (low, free-tier) rate limit for the same
    // random set.
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`Unsplash responded ${res.status}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [data];
}
