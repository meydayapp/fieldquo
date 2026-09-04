// lib/media/cloudinaryUrl.js
//
// resizedUrl() lived in lib/cloudinary.js until the photo annotator needed
// it from a "use client" component (app/components/photoAnnotator/
// PhotoAnnotatorEditor.js — it opens the editor against a resized variant so
// a 12–48MP phone photo doesn't hand a mobile browser a multi-thousand-pixel
// canvas to draw on; see lib/jobs/photoAnnotation.js#ANNOTATOR_MAX_WIDTH).
//
// lib/cloudinary.js's own top-level `cloudinary.config(...)` call means
// importing ANYTHING from that file pulls in the `cloudinary` npm package —
// a Node SDK that touches `fs`/`https`, which does not belong in a client
// bundle and would fail (or silently bloat) the real Next build the moment a
// "use client" file imported it. resizedUrl() itself never touched that SDK
// — it's pure string surgery on a URL — so it moves here, to a module with
// no server-only dependency, and lib/cloudinary.js re-exports it so every
// existing server-side caller (lib/jobs/photoReport.js, lib/ai/images.js)
// keeps working unchanged.
export function resizedUrl(url, { width = 1536 } = {}) {
  if (typeof url !== "string") return url;
  const marker = "/upload/";
  const i = url.indexOf(marker);
  if (i === -1) return url;

  const head = url.slice(0, i + marker.length);
  const tail = url.slice(i + marker.length);
  const w = Math.max(1, Math.round(Number(width) || 1536));
  // Valid immediately after `/upload/` whatever already follows it — a
  // version segment (`v169.../`) or an existing transformation both still
  // parse correctly with ours inserted in front.
  return `${head}w_${w},c_limit,q_auto,f_auto/${tail}`;
}

/**
 * A variant cropped to EXACTLY `width`x`height` — `c_fill`, not `c_limit`.
 *
 * ── Why a second function instead of a `crop` option on resizedUrl ─────────
 *
 * The two answer different questions and only one of them is safe for the
 * caller that needs this. `c_limit` says "no bigger than", so the delivered
 * size depends on the source photo — fine for a vision read, useless for
 * lib/marketing/jobPost.js, which lays a photo into a fixed panel on a canvas
 * it composes SERVER-SIDE and therefore never gets to measure. A fabric
 * `image` object carries its own `width`/`height` in the saved document and
 * fabric treats them as a crop box on load: guess them and the browser
 * renders a corner of the photo at the wrong scale, silently, in a post that
 * goes out under the contractor's name. Asking Cloudinary for a known size is
 * what makes those two numbers knowable without ever fetching the file.
 *
 * `c_fill` with the default (centre) gravity rather than `g_auto`: auto
 * gravity is a better crop when it is enabled, and a delivery error when it
 * is not. A composition that has to be right on every deployment takes the
 * transformation that exists on all of them.
 *
 * A URL with no `/upload/` marker is returned unchanged, same as resizedUrl —
 * and callers that depend on the delivered size must therefore refuse a URL
 * that isn't one of this deployment's own uploads BEFORE calling this. See
 * isUploadedUrl() in lib/jobs/documents.js, which is the check
 * lib/marketing/jobPostSource.js applies for exactly this reason.
 */
export function filledUrl(url, { width, height } = {}) {
  if (typeof url !== "string") return url;
  const marker = "/upload/";
  const i = url.indexOf(marker);
  if (i === -1) return url;

  const w = Math.max(1, Math.round(Number(width) || 1));
  const h = Math.max(1, Math.round(Number(height) || 1));
  const head = url.slice(0, i + marker.length);
  const tail = url.slice(i + marker.length);
  return `${head}w_${w},h_${h},c_fill,q_auto,f_auto/${tail}`;
}
