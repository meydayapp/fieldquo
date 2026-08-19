// app/social-card/route.js
//
// The 1200×630 image behind og:image and twitter:image on the marketing site.
//
// ── Why a route handler and not opengraph-image.js ─────────────────────────
//
// The file convention was the first attempt: app/(marketing)/opengraph-image.js.
// It emitted the tag on / and on nothing else — /pricing, /resources, /about
// and all twelve industry pages came out with no og:image at all. Verified in a
// production `next start`, not just dev, so it isn't a dev-server artifact:
// the convention did not cascade from the route group down to its children
// here. A tag that appears on one page out of twenty is worse than no tag,
// because it looks done.
//
// A plain route handler has a URL this code chooses, so lib/marketing/metadata.js
// can point every page at it explicitly and the result is the same everywhere.
// Static, so it's generated once at build and served from the CDN.
//
// Deliberately NOT wired into the root layout's metadata: the root also wraps
// /q, /portal, /quote, /book and /site, and a FieldQuo-branded card on a
// contractor's own white-label quote link is the leak AGENTS.md forbids. Only
// pages that call marketingMetadata get it.
import { renderOgCard } from "@/lib/marketing/ogCard";

export const dynamic = "force-static";

export function GET() {
  return renderOgCard({
    headline: "Quote it. Do it. Get paid.",
    sub: "Quotes, invoices and scheduling for field service businesses.",
  });
}
