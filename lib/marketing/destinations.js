// lib/marketing/destinations.js
//
// Which format each place a post goes gets — decided here, once, so nobody
// has to pick a "shape" at publish time and nobody can pick the wrong one.
//
// ══ The rule (owner, 2026-09-29) ═══════════════════════════════════════════
//
//   Instagram feed   4:5  instagram_portrait (1080x1350)
//   Facebook feed    4:5  instagram_portrait — or 1.91:1 facebook_feed ONLY
//                         when the person chose a link-style post
//   TikTok           9:16 tiktok (1080x1920)
//   Reels / Stories  9:16 instagram_story (1080x1920)
//
// The Publish dialog used to offer a Portrait / Square / Landscape picker.
// That was a control whose only effect could be sending a platform a shape it
// crops or refuses; it is gone, and each destination now shows its own
// preview in the one format it gets.
//
// ══ Existing square designs ════════════════════════════════════════════════
//
// No new design, template or publish choice is 1:1. But a design laid out as
// a square before 2026-09-28 — it has an instagram_post layout and no
// portrait — keeps publishing as that square to Instagram and Facebook, which
// both accept it. Reflowing it to 4:5 behind the contractor's back would post
// a layout nobody has looked at. So for exactly those designs the feed format
// stays the square, and the request body is byte-for-byte what it was
// (scripts/check-design-templates.mjs proves the md5).
//
// Pure — no fabric, no DOM, no database.
import { AD_RATIOS, ratio as ratioByKey } from "./ratios";

export const PORTRAIT = "instagram_portrait";
export const SQUARE = "instagram_post";
export const VERTICAL = "tiktok";
export const STORY = "instagram_story";
export const LANDSCAPE = "facebook_feed";

/** The three formats every new template ships a layout for. Never the square. */
export const TEMPLATE_FORMATS = Object.freeze([PORTRAIT, VERTICAL, LANDSCAPE]);

/** Facebook post styles. "link" is the 1.91:1 link-preview look. */
export const FACEBOOK_STYLES = Object.freeze(["feed", "link"]);

const keysOf = (savedKeys) => (Array.isArray(savedKeys) ? savedKeys.filter((k) => typeof k === "string") : []);

/**
 * A square design from before 4:5 existed: it has the square and never got a
 * portrait. The one case the feed format stays 1:1.
 */
export function isLegacySquareDesign(savedKeys) {
  const keys = keysOf(savedKeys);
  return keys.includes(SQUARE) && !keys.includes(PORTRAIT);
}

/**
 * The format a destination gets.
 *
 * @param {"instagram"|"facebook"|"tiktok"|"reels"|"stories"} destination
 * @param {{savedKeys?: string[], facebookStyle?: "feed"|"link"}} [opts]
 * @returns {string|null} an AD_RATIOS key, or null for an unknown destination
 */
export function destinationRatio(destination, { savedKeys = [], facebookStyle = "feed" } = {}) {
  const feed = isLegacySquareDesign(savedKeys) ? SQUARE : PORTRAIT;
  switch (destination) {
    case "instagram":
      return feed;
    case "facebook":
      return facebookStyle === "link" ? LANDSCAPE : feed;
    case "tiktok":
      return VERTICAL;
    case "reels":
    case "stories":
      return STORY;
    default:
      return null;
  }
}

/**
 * The Facebook/Instagram publish requests to make: one per DISTINCT format,
 * each carrying the platforms that share it, in the order given. Facebook and
 * Instagram in the same feed format are one request — exactly the request
 * this dialog always made — and only a link-style Facebook post splits off a
 * second one with its own image.
 *
 * @param {{platforms: string[], savedKeys?: string[], facebookStyle?: string}} args
 * @returns {Array<{ratioKey: string, platforms: string[]}>}
 */
export function planMetaRequests({ platforms = [], savedKeys = [], facebookStyle = "feed" } = {}) {
  const out = [];
  for (const p of Array.isArray(platforms) ? platforms : []) {
    if (p !== "facebook" && p !== "instagram") continue;
    const ratioKey = destinationRatio(p, { savedKeys, facebookStyle });
    const existing = out.find((r) => r.ratioKey === ratioKey);
    if (existing) {
      if (!existing.platforms.includes(p)) existing.platforms.push(p);
    } else {
      out.push({ ratioKey, platforms: [p] });
    }
  }
  return out;
}

/**
 * The server's check: may `ratioKey` be posted to `platform` for a design with
 * these saved layouts? Only the destination's own format — Facebook also
 * takes the 1.91:1 link style. Anything else is the wrong size, refused.
 */
export function isAllowedPublishRatio(platform, ratioKey, savedKeys) {
  if (platform === "facebook") {
    return (
      ratioKey === destinationRatio("facebook", { savedKeys, facebookStyle: "feed" }) ||
      ratioKey === destinationRatio("facebook", { savedKeys, facebookStyle: "link" })
    );
  }
  if (platform === "instagram" || platform === "tiktok") {
    return ratioKey === destinationRatio(platform, { savedKeys });
  }
  return false;
}

/**
 * Do these rendered pixels have the format's proportions? A hand-adjusted
 * layout keeps its frame, so this is a tight tolerance — half a percent —
 * that only rounding passes.
 */
export function matchesRatio(ratioKey, width, height) {
  const r = ratioByKey(ratioKey);
  const w = Number(width);
  const h = Number(height);
  if (!r || !(w > 0) || !(h > 0)) return false;
  return Math.abs(w / h - r.width / r.height) <= (r.width / r.height) * 0.005;
}

/**
 * The editor's format tabs. Every preset except the square, which appears
 * only for a design that already has a square layout — a 1:1 design still
 * opens on its own tab, and a new one is never offered it.
 */
export function visibleRatios(savedKeys) {
  const keys = keysOf(savedKeys);
  return AD_RATIOS.filter((r) => r.key !== SQUARE || keys.includes(SQUARE));
}
