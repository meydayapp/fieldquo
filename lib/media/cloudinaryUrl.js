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
