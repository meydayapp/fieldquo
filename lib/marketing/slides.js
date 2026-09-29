// lib/marketing/slides.js
//
// Carousels: one design, 2–10 images posted together.
//
// ══ Where the slides live ═════════════════════════════════════════════════
//
// Slide 1 is the design's MarketingDesignLayout rows, exactly as every design
// before carousels. Slides 2..10 are MarketingDesignSlideLayout rows with
// `position` 1..9 (prisma/schema.prisma explains why that is a second table
// rather than a widened unique key). This module is the one place that turns
// the two into a list of slides and back.
//
// ══ The platforms' own rules ══════════════════════════════════════════════
//
//   Instagram  CAROUSEL container, up to 10 children, one post against the
//              publishing limit; every item is cropped to the FIRST item's
//              aspect ratio, so every slide is sent in the same 4:5.
//              developers.facebook.com/docs/instagram-platform/content-publishing
//   Facebook   each photo uploaded unpublished (temporary=true when
//              scheduled), then one /{page-id}/feed post with attached_media.
//              developers.facebook.com/docs/graph-api/reference/page/photos/
//   TikTok     photo mode, up to 35 photo_images.
//              developers.tiktok.com/doc/content-posting-api-reference-photo-post
//
// FieldQuo caps a carousel at 10 — Instagram's limit, and the tightest.
//
// Pure.

export const MAX_SLIDES = 10;
export const MIN_CAROUSEL_SLIDES = 2;

/**
 * @param {Array<{ratioKey, json, width, height}>} layouts       slide 1's rows
 * @param {Array<{position, ratioKey, json, width, height}>} slideLayouts  slides 2..n
 * @returns {Array<Record<string, {json, width, height}>>} one map per slide, in
 *   order. A gap in positions (a row somebody removed out of order) is closed
 *   up rather than left as an empty slide nobody can see.
 */
export function groupSlides(layouts = [], slideLayouts = []) {
  const first = {};
  for (const l of Array.isArray(layouts) ? layouts : []) {
    if (l && typeof l.ratioKey === "string") first[l.ratioKey] = { json: l.json, width: l.width, height: l.height };
  }
  const byPosition = new Map();
  for (const l of Array.isArray(slideLayouts) ? slideLayouts : []) {
    const p = Number(l?.position);
    if (!Number.isInteger(p) || p < 1 || typeof l.ratioKey !== "string") continue;
    if (!byPosition.has(p)) byPosition.set(p, {});
    byPosition.get(p)[l.ratioKey] = { json: l.json, width: l.width, height: l.height };
  }
  const rest = [...byPosition.keys()].sort((a, b) => a - b).map((p) => byPosition.get(p));
  return [first, ...rest].slice(0, MAX_SLIDES);
}

/** How many images a publish of this design sends. */
export function slideCount(slideLayouts = []) {
  const positions = new Set(
    (Array.isArray(slideLayouts) ? slideLayouts : [])
      .map((l) => Number(l?.position))
      .filter((p) => Number.isInteger(p) && p >= 1),
  );
  return Math.min(MAX_SLIDES, 1 + positions.size);
}

/**
 * The saved layout a slide's missing format is reflowed FROM: the same
 * proportions if the slide has them (a 9:16 Story from a 9:16 TikTok is a
 * copy, not a reflow), else the portrait, else anything it has.
 *
 * @param {Record<string, {width, height}>} slide
 * @param {{width: number, height: number}} target
 * @returns {string|null}
 */
export function reflowSourceKey(slide, target) {
  const keys = Object.keys(slide || {});
  if (!keys.length) return null;
  const tw = Number(target?.width) || 0;
  const th = Number(target?.height) || 0;
  const same = keys.find((k) => {
    const l = slide[k];
    return tw && th && Math.abs(Number(l?.width) / Number(l?.height) - tw / th) < 0.001;
  });
  if (same) return same;
  if (keys.includes("instagram_portrait")) return "instagram_portrait";
  return keys[0];
}

/** Every layout row a design carries, slide 1's and the rest, for a fingerprint or a scan. */
export function allLayoutRows(layouts = [], slideLayouts = []) {
  return [...(Array.isArray(layouts) ? layouts : []), ...(Array.isArray(slideLayouts) ? slideLayouts : [])];
}

/** The rows for ONE format across every slide — what a publish in that format renders. */
export function rowsForRatio(layouts = [], slideLayouts = [], ratioKey) {
  return allLayoutRows(layouts, slideLayouts).filter((l) => l?.ratioKey === ratioKey);
}
