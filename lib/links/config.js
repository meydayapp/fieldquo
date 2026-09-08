// lib/links/config.js
//
// The boundary between "what a browser sent" and "what is served on the bio
// link page" — the same job app/data/siteBlocks.js does for the website
// builder, and written the same way.
//
// ── Why the stored shape is an ordered array of overrides ───────────────────
//
// Two things have to be true at once, and a map keyed by link would only give
// the first:
//
//   1. A contractor decides what shows and in what order.
//   2. Publishing a new funnel next month makes it APPEAR, without them
//      having to come back here and notice.
//
// So the array is an override list, not the list. Anything it names keeps the
// position and the on/off state it was given; anything it doesn't name — a
// funnel published since, a booking calendar that now has an event type — is
// appended in the natural order ./candidates.js produced, with that
// candidate's own default. A stored entry for something that no longer exists
// (a deleted funnel, a review link cleared in Settings) is dropped, because
// the candidate list is the only source of truth about what is reachable.
//
// ── Three kinds of stored entry ─────────────────────────────────────────────
//
//   { key: "quote", enabled, label? }              an override of a candidate
//   { key: "custom:N", enabled, label, url, icon? } a row the contractor typed
//   { key: "social:instagram", enabled, url }      one circle in the icon row
//
// Social entries are keyed by platform rather than position because there is
// exactly one Instagram: a second entry for the same platform is a duplicate,
// not a second button, and the first one wins the way it does for "quote".

import { safeUrl } from "./href";
import { isSocialPlatform, socialHref, SOCIAL_NAMES } from "./social";
import { isCustomIconName } from "./icons";

const MAX_ITEMS = 30;
const MAX_CUSTOM = 10;
const MAX_LABEL = 60;
const MAX_HEADLINE = 80;
const MAX_BIO = 200;

// Keys that are dangerous as object properties. JSON.parse happily creates an
// own "__proto__" property, and every one of these ends up as a lookup key
// below.
const FORBIDDEN_KEY = /^(__proto__|constructor|prototype)$/;

/**
 * Clean a stored or posted config into the exact shape the renderer reads.
 *
 * Never throws and never returns undefined fields: the public page must render
 * for a row somebody hand-edited in the database as readily as for one this
 * function wrote.
 */
export function sanitiseLinkConfig(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};

  const items = [];
  let customCount = 0;

  for (const entry of Array.isArray(src.items) ? src.items : []) {
    if (items.length >= MAX_ITEMS) break;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;

    const key = String(entry.key ?? "").trim();
    if (!key || key.length > 120 || FORBIDDEN_KEY.test(key)) continue;

    if (key.startsWith("custom")) {
      // A custom row is only worth storing if it goes somewhere. Its key is
      // re-assigned from its position rather than trusted: the whole array is
      // written on every save, so positional keys are stable, and it means a
      // client can't collide two rows onto one key or smuggle "custom:__proto__"
      // through.
      if (customCount >= MAX_CUSTOM) continue;
      const url = safeUrl(entry.url);
      const label = text(entry.label, MAX_LABEL);
      if (!url || !label) continue;
      // An icon name off the allow-list is dropped, not the row: the row
      // still goes somewhere, and the generic glyph is what it showed before
      // the field existed. See lib/links/icons.js for why names, not URLs.
      const icon = isCustomIconName(entry.icon) ? entry.icon : null;
      items.push({
        key: `custom:${customCount++}`,
        enabled: entry.enabled !== false,
        label,
        url,
        ...(icon ? { icon } : {}),
      });
      continue;
    }

    if (key.startsWith("social:")) {
      // The platform is re-derived from the key and checked against the
      // closed list, so "social:__proto__" and "social:myspace" both fall out
      // here rather than reaching the icon map. The URL crosses the same
      // boundary as everything else — socialHref refuses javascript:, a
      // 200-character "handle", and anything that isn't http(s).
      const platform = key.slice("social:".length);
      if (!isSocialPlatform(platform)) continue;
      if (items.some((i) => i.key === key)) continue;
      const url = socialHref(platform, entry.url);
      if (!url) continue;
      items.push({ key, enabled: entry.enabled !== false, url });
      continue;
    }

    if (items.some((i) => i.key === key)) continue;
    const label = text(entry.label, MAX_LABEL);
    items.push({
      key,
      enabled: entry.enabled !== false,
      // Only stored when the contractor actually changed it. An empty string
      // must not become a button with no words on it.
      ...(label ? { label } : {}),
    });
  }

  return {
    published: src.published !== false,
    headline: text(src.headline, MAX_HEADLINE),
    bio: text(src.bio, MAX_BIO),
    items,
  };
}

/**
 * The rows the public page renders, in order.
 *
 * @param candidates  from linkCandidates()
 * @param config      from sanitiseLinkConfig()
 * @returns [{ key, kind, url, label, group, enabled, icon?, platform? }] —
 *          enabled rows AND disabled ones, because the settings screen
 *          renders the same list with switches. The public page filters on
 *          `enabled`. Social entries come back with kind "social", a
 *          `platform`, and group "follow"; the page paints them as the icon
 *          row rather than as labelled rows (see splitSocial below).
 */
export function resolveLinks(candidates, config) {
  const list = Array.isArray(candidates) ? candidates : [];
  const cfg = config && typeof config === "object" ? config : { items: [] };
  const stored = Array.isArray(cfg.items) ? cfg.items : [];

  const byKey = new Map(list.map((c) => [c.key, c]));
  const seen = new Set();
  const out = [];

  for (const entry of stored) {
    if (entry.key.startsWith("custom:")) {
      out.push({
        key: entry.key,
        kind: "custom",
        url: entry.url,
        label: entry.label,
        group: "more",
        enabled: entry.enabled !== false,
        ...(entry.icon ? { icon: entry.icon } : {}),
      });
      continue;
    }
    if (entry.key.startsWith("social:")) {
      const platform = entry.key.slice("social:".length);
      out.push({
        key: entry.key,
        kind: "social",
        platform,
        url: entry.url,
        // The platform name doubles as the label so the settings screen and
        // the aria-label have a word for it without a lookup.
        label: SOCIAL_NAMES[platform] || platform,
        group: "follow",
        enabled: entry.enabled !== false,
      });
      continue;
    }
    const candidate = byKey.get(entry.key);
    // Dropped, not kept as a broken row: the candidate list is what is
    // reachable, and a stored override for something unreachable is stale.
    if (!candidate || seen.has(entry.key)) continue;
    seen.add(entry.key);
    out.push({
      key: candidate.key,
      kind: candidate.kind,
      url: candidate.url,
      label: entry.label || candidate.label,
      group: candidate.group,
      enabled: entry.enabled !== false,
    });
  }

  for (const candidate of list) {
    if (seen.has(candidate.key)) continue;
    out.push({
      key: candidate.key,
      kind: candidate.kind,
      url: candidate.url,
      label: candidate.label,
      group: candidate.group,
      enabled: candidate.defaultOn === true,
    });
  }

  return out;
}

/** Just the rows a visitor sees. */
export function visibleLinks(candidates, config) {
  return resolveLinks(candidates, config).filter((l) => l.enabled && l.url && l.label);
}

/**
 * The icon row and the labelled rows, apart.
 *
 * Social entries are never labelled rows: six circles read as "we are on
 * these", and six "Follow us on X" buttons read as six more decisions.
 */
export function splitSocial(links) {
  const list = Array.isArray(links) ? links : [];
  return {
    social: list.filter((l) => l.kind === "social"),
    rows: list.filter((l) => l.kind !== "social"),
  };
}

/**
 * Labelled rows gathered into headed sections.
 *
 * Sections appear in the order their FIRST row appears in `rows`, so the
 * contractor's reorder decides which section leads and the first row of the
 * page is still the first row they chose — the one the page paints filled.
 * Rows inside a section keep their relative order. A group with no row in it
 * is simply absent: nothing here invents an empty "Book" heading for a
 * company with nothing bookable.
 *
 * @returns [{ group, rows }]
 */
export function groupLinks(rows) {
  const sections = [];
  const byGroup = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const group = typeof row.group === "string" && row.group ? row.group : "more";
    let section = byGroup.get(group);
    if (!section) {
      section = { group, rows: [] };
      byGroup.set(group, section);
      sections.push(section);
    }
    section.rows.push(row);
  }
  return sections;
}

function text(value, max) {
  if (typeof value !== "string") return "";
  // Collapse newlines: this is button and header text, and a pasted paragraph
  // with hard breaks in it wrecks a 375px layout.
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}
