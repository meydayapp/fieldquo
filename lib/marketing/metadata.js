// lib/marketing/metadata.js
//
// Per-page <title>, description, canonical and Open Graph tags for the public
// marketing site.
//
// Every page on the site used to render `<title>FieldQuo</title>` — the root
// layout's default, inherited by all of them — with no canonical and no og:*
// anywhere. A link pasted into WhatsApp or a Facebook trades group rendered as
// a bare URL, and twelve industry pages competed in search under one title.
//
// ── Why no title TEMPLATE ───────────────────────────────────────────────────
//
// The obvious implementation is `title: { template: "%s | FieldQuo" }` on the
// root layout. That is exactly wrong here, and it is worth writing down why so
// nobody "simplifies" it back.
//
// The root layout wraps the client-facing surfaces too — /q, /portal, /quote,
// /book, /visit, /design, /site. Those pages are WHITE-LABEL: a homeowner
// opening a quote sees the contractor's brand, and their browser tab says
// "Your quote". A root template would silently turn that into
// "Your quote | FieldQuo" on every one of them, which is the leak AGENTS.md
// forbids — delivered by a mechanism nobody would think to check.
//
// Same reasoning for openGraph: a root-level `siteName: "FieldQuo"` would
// stamp og:site_name onto a contractor's own quote link previews. So the
// og block lives HERE, applied only by the pages that call this helper, and
// `metadataBase` is set here rather than on the root layout for the same
// containment reason.

const SITE_NAME = "FieldQuo";

// Named explicitly rather than left to Next's opengraph-image.js file
// convention, which emitted the tag on the homepage and on none of its
// children — see the header of app/social-card/route.js for what was measured.
const OG_IMAGE = {
  url: "/social-card",
  width: 1200,
  height: 630,
  alt: "FieldQuo — quotes, invoices and scheduling for field service businesses",
};

/**
 * Absolute origin for canonical and og:url.
 *
 * Deliberately NOT lib/appUrl.js's getAppOrigin(): that one throws when it has
 * nothing to go on, and a thrown error while building metadata takes the whole
 * page down. A marketing page with a localhost canonical in local dev is fine;
 * a 500 is not. Both variables are already documented in docs/VERCEL.md.
 */
export function siteOrigin() {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Metadata for one marketing page.
 *
 * @param path        route path, e.g. "/pricing". Becomes the canonical.
 * @param title       full <title>. Written out in full rather than composed,
 *                    so what you read here is what ships.
 * @param description meta description and og:description.
 * @param extra       merged last — for `robots`, `keywords`, an explicit
 *                    `openGraph.images`, and anything else a page needs.
 */
export function marketingMetadata({ path = "/", title, description, ...extra }) {
  const url = path === "/" ? "/" : path;

  return {
    metadataBase: new URL(siteOrigin()),
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      url,
      title,
      description,
      images: [OG_IMAGE],
      // No `locale` here. Language on this site lives in localStorage with no
      // locale-prefixed routes, so every URL serves every language — claiming
      // og:locale would be asserting something the URL cannot deliver. See the
      // locale-routing plan at the end of docs/ROADMAP.md.
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE.url],
    },
    ...extra,
  };
}
