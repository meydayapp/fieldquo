// lib/links/icons.js
//
// The icons a contractor may put on a custom bio-link row, by name.
//
// Names only, no components: this file is imported by the sanitiser
// (./config.js), which runs under plain node in scripts/check-bio-link.mjs and
// must stay free of React and lucide. The name-to-component map that actually
// draws them lives in app/components/links/linkIcons.js, and the check script
// proves every name here is one that map knows.
//
// ── Why a closed list rather than an icon URL ───────────────────────────────
//
// An uploaded or hotlinked icon is a third-party image on a page a stranger
// opens with no session — a tracking pixel by another name, and a mixed-
// content warning waiting to happen. Lucide names are a finite set of
// vector paths that ship with the page, so a name is the only thing worth
// storing. Anything not in this list is dropped by the sanitiser and the row
// falls back to the generic link glyph, which is what it showed before the
// field existed.
//
// The set is what a field-service business actually links to from a bio:
// a gallery, a map, a review site, a supplier, a promotion, a video — not a
// general-purpose icon library.

export const CUSTOM_ICON_NAMES = [
  "link",
  "image",
  "images",
  "camera",
  "video",
  "map-pin",
  "map",
  "house",
  "truck",
  "wrench",
  "hammer",
  "paintbrush",
  "brush",
  "ruler",
  "droplet",
  "leaf",
  "gift",
  "percent",
  "tag",
  "dollar-sign",
  "credit-card",
  "clock",
  "award",
  "shield",
  "heart",
  "thumbs-up",
  "star",
  "users",
  "briefcase",
  "clipboard-list",
  "sparkles",
  "music",
  "file-text",
  "globe",
  "phone",
  "mail",
  "message-circle",
  "calendar-days",
];

export function isCustomIconName(value) {
  return typeof value === "string" && CUSTOM_ICON_NAMES.includes(value);
}
