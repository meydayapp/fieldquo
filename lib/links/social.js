// lib/links/social.js
//
// The social icon row on the bio-link page: which platforms exist, and how a
// thing the contractor typed becomes a profile URL.
//
// ── Why an allow-list of six, not a free "platform" string ──────────────────
//
// Each platform here has an icon drawn for it and a profile URL shape we know.
// A platform we can't draw would render as a blank circle, and one whose URL
// shape we don't know can't turn "@northline" into a link. Adding a seventh
// means adding both, so the list is closed on purpose and the sanitiser refuses
// anything not on it rather than storing a key the page can't paint.
//
// ── Handle or URL, same field ───────────────────────────────────────────────
//
// A contractor knows their handle ("@northlinepainting") far better than their
// profile URL, and Instagram's "copy profile link" produces a URL with tracking
// junk on it. So the settings field accepts either: a bare handle becomes the
// canonical profile URL for that platform, and a pasted URL goes through the
// same href boundary every other link on the page crosses (./href.js). Either
// way what is STORED is a URL, so the public page never has to guess.
//
// The handle rule is deliberately tighter than any platform's own: letters,
// digits, dot, underscore, hyphen, at most 60 characters. Every real handle on
// these six passes; a 200-character string of anything does not, and neither
// does a slash, which is the character that would let a "handle" become a
// path on somebody else's profile.

import { safeUrl } from "./href";

/** Display order on the page. Fixed: this row is a set of glyphs, not a list a contractor reorders. */
export const SOCIAL_PLATFORMS = ["instagram", "facebook", "tiktok", "youtube", "linkedin", "x"];

const PROFILE_BASE = {
  instagram: "https://www.instagram.com/",
  facebook: "https://www.facebook.com/",
  // TikTok is the one whose canonical profile URL keeps the "@".
  tiktok: "https://www.tiktok.com/@",
  youtube: "https://www.youtube.com/@",
  linkedin: "https://www.linkedin.com/in/",
  x: "https://x.com/",
};

/** What a visitor is told the button is, for the aria-label and the settings screen. */
export const SOCIAL_NAMES = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  x: "X",
};

const HANDLE = /^[A-Za-z0-9._-]{1,60}$/;
const MAX_INPUT = 300;

export function isSocialPlatform(value) {
  return typeof value === "string" && SOCIAL_PLATFORMS.includes(value);
}

/**
 * A profile URL for `platform` from a handle or a pasted URL, or null.
 *
 * Null for an unknown platform, an empty value, a handle that breaks the rule
 * above, and any URL the href boundary refuses — including `tel:` and
 * `mailto:`, which safeUrl allows for other rows but which are not a profile
 * anybody can follow.
 */
export function socialHref(platform, value) {
  if (!isSocialPlatform(platform)) return null;
  const raw = String(value ?? "").trim();
  if (!raw || raw.length > MAX_INPUT) return null;

  // A URL is anything with a scheme, a slash, or a host-shaped ending in it —
  // "@northline" and "northline" have none of those; "instagram.com/northline"
  // and "https://…" do. A handle with a dot ("north.line") is the one
  // ambiguity, resolved in favour of the handle, because a bare dotted word
  // is a handle far more often than it is a hostname.
  //
  // The two paths are exclusive on purpose. The first version of this fell
  // through to the URL path when the handle rule failed, and safeUrl's
  // bare-host courtesy turned a 200-character "handle" into
  // https://aaaa…aaa/ — a link to nowhere, stored. Something that is not
  // URL-shaped is a handle or it is nothing.
  const handle = raw.startsWith("@") ? raw.slice(1) : raw;
  const urlShaped = /[\/:]/.test(handle) || looksLikeHost(handle);
  if (!urlShaped) {
    return HANDLE.test(handle) ? PROFILE_BASE[platform] + encodeURIComponent(handle) : null;
  }

  const url = safeUrl(raw);
  if (!url) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  // http(s) only — safeUrl also passes tel: and mailto:, which are links but
  // not profiles — and a dotted host. "northline/../admin" parses as a host
  // called "northline", which nobody can follow.
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (!parsed.hostname.includes(".")) return null;
  return url;
}

// "instagram.com" typed alone is a host, not a handle called "instagram.com".
// Two or more labels with a known-looking TLD at the end is the whole test;
// "north.line" has a two-letter "TLD" and is treated as a handle, which is
// the right call for the same reason as above.
function looksLikeHost(value) {
  return /\.(com|net|org|ca|co|io|me|tv|app|uk|fr|de|it|es|us)$/i.test(value);
}
