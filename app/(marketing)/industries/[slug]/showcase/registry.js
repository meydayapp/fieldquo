// app/(marketing)/industries/[slug]/showcase/registry.js
//
// Which trades have a live walk-through on their industry page, and how its
// data is built. Server-only: the builders read harness fixtures and the tax
// tables, and only their plain-data result crosses to the client.
//
// The template never asks "is this roofing?". A trade listed here gets the
// hero's "See it in action" link and the section it points at; a trade not
// listed gets neither — so adding a second showcase is a row here and a
// `kind` the page knows how to draw, not a branch in the page.

import { buildRoofingShowcase } from "./buildRoofingShowcase";

export const INDUSTRY_SHOWCASES = {
  roofing: {
    kind: "instant_quote",
    // The anchor the hero link and ads point at: /industries/roofing#instant-quote-example
    anchor: "instant-quote-example",
    build: buildRoofingShowcase,
  },
};

/** { kind, anchor, data } for a slug, or null when the trade has no showcase. */
export function industryShowcase(slug) {
  const entry = Object.prototype.hasOwnProperty.call(INDUSTRY_SHOWCASES, slug) ? INDUSTRY_SHOWCASES[slug] : null;
  if (!entry) return null;
  return { kind: entry.kind, anchor: entry.anchor, data: entry.build() };
}
