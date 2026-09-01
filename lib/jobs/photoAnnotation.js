// lib/jobs/photoAnnotation.js
//
// Everything about a job photo's markup layer that does NOT need Fabric —
// this file imports nothing that touches `window`/`document`, so it runs
// under plain Node (scripts/check-job-photos.mjs does exactly that) and in
// every server route that reads or writes a JobPhoto row.
//
// ══ The one rule every caller of this file exists to protect ══════════════
//
// JobPhoto.url is the original photo. It is never overwritten, never
// resized-in-place, never replaced by an annotated version — see
// docs/PHOTO-ANNOTATION.md. Markup lives in TWO separate, additive columns:
//
//   annotationJson   the vector layer alone ({ objects: [...] } — Fabric's
//                    canvas.getObjects(), never the background photo)
//   flattenedUrl     a SECOND Cloudinary asset: the photo with that layer
//                    baked in, rendered client-side (Fabric can't run
//                    server-side in this repo — no jsdom) and uploaded
//                    through the existing /api/upload the moment someone
//                    taps Done.
//
// displayPhotoUrl() is the one place that decides which of the two a reader
// sees. Every surface that shows a job photo to anyone other than the
// annotator itself — the public gallery, the photo report PDF, the in-app
// timeline — must call it instead of reading `.url` directly, or an edit
// silently fails to show up anywhere but the editor that made it.

/** The working resolution the annotator opens a photo at. Bounded so a
 * 12–48MP phone photo (see lib/cloudinary.js's own note on this) doesn't
 * hand a mobile browser a multi-thousand-pixel-square canvas to draw on —
 * some mobile WebKit builds silently fail or downscale a canvas above
 * roughly 4096px on a side. lib/cloudinary.js#resizedUrl() is reused to get
 * there, the same helper the photo report PDF already resizes through. */
export const ANNOTATOR_MAX_WIDTH = 1600;

// Generous for a hand-drawn markup layer (a few dozen strokes/shapes/text
// boxes) and small next to a single 12MP JPEG — the cap exists to refuse a
// hostile or corrupted payload before it reaches the database, not to limit
// a real editing session.
export const MAX_ANNOTATION_JSON_BYTES = 300_000;
export const MAX_ANNOTATION_OBJECTS = 400;

// Every Fabric object type the annotator's own tools can produce. Anything
// else in a submitted payload is a payload this route didn't build — reject
// it rather than store (and later blindly loadFromJSON()) an unknown shape.
// "image" is deliberately absent: nothing in the annotator adds one, and
// accepting one here would be a path for someone to smuggle an arbitrary
// image URL into a job's annotation layer.
const ALLOWED_OBJECT_TYPES = new Set([
  "path", // freehand pen/marker/pencil/highlighter strokes, and arrows (see lib/photoAnnotator/arrowGeometry.js)
  "group", // the halo+ink pairing every stroke/shape/arrow is wrapped in
  "rect",
  "ellipse",
  "textbox",
  "i-text",
]);

/**
 * Which URL a READER (not the annotator itself) should be shown.
 *
 * @param photo  needs only `url` and `flattenedUrl`
 */
export function displayPhotoUrl(photo) {
  const flattened = photo?.flattenedUrl;
  return typeof flattened === "string" && flattened ? flattened : photo?.url || "";
}

/** Whether a photo currently carries a markup layer at all. */
export function isAnnotated(photo) {
  return typeof photo?.annotationJson === "string" && photo.annotationJson.length > 0;
}

function walkTypes(objects, onType) {
  if (!Array.isArray(objects)) return false;
  for (const obj of objects) {
    if (!obj || typeof obj !== "object" || typeof obj.type !== "string") return false;
    if (!onType(obj.type)) return false;
    // Groups nest their own children under `objects` — the same shape,
    // recursively. A group is the only annotator-produced type that nests.
    if (obj.type === "group" && !walkTypes(obj.objects, onType)) return false;
  }
  return true;
}

function countObjects(objects) {
  if (!Array.isArray(objects)) return 0;
  let n = 0;
  for (const obj of objects) {
    n += 1;
    if (obj?.type === "group") n += countObjects(obj.objects);
  }
  return n;
}

/**
 * The boundary between "what a browser sent" and "what gets stored" — the
 * same role app/data/siteBlocks.js#sanitiseBlocks plays for the website
 * builder. Never trusts the client's claim about its own JSON: re-parses,
 * re-measures, re-validates every object type before anything is written.
 *
 * @param raw  the request body's `annotationJson` field, expected to be a
 *             JSON STRING (matching what Fabric's canvas.toObject() family
 *             produces and what the editor sends)
 * @returns {{ok: true, json: string, objectCount: number} | {ok: false, error: string}}
 */
export function sanitiseAnnotationJson(raw) {
  if (raw === null || raw === "") {
    // Explicit "no markup" — distinct from "malformed markup". Callers use
    // this to clear an annotation without going through the error path.
    return { ok: true, json: null, objectCount: 0 };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: "Annotation data must be a JSON string." };
  }
  if (raw.length > MAX_ANNOTATION_JSON_BYTES) {
    return { ok: false, error: "That annotation is too large to save." };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "That annotation couldn't be read back." };
  }

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.objects)) {
    return { ok: false, error: "That annotation isn't shaped like a markup layer." };
  }

  const objectCount = countObjects(parsed.objects);
  if (objectCount > MAX_ANNOTATION_OBJECTS) {
    return { ok: false, error: "That's a lot of markup for one photo — try clearing some of it." };
  }

  const typesOk = walkTypes(parsed.objects, (type) => ALLOWED_OBJECT_TYPES.has(type));
  if (!typesOk) {
    return { ok: false, error: "That annotation contains a shape this editor doesn't produce." };
  }

  // Re-serialised from the parsed structure, never the caller's raw string —
  // so anything that slipped in OUTSIDE the `{objects: [...]}` shape (extra
  // top-level keys, prototype-pollution-shaped keys) never reaches storage.
  return { ok: true, json: JSON.stringify({ objects: parsed.objects }), objectCount };
}
