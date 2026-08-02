// lib/site/pages.js
//
// The multi-page model, layered on top of the original single-page `blocks`.
//
// A site is an ordered list of PAGES — Home, Services, About, Work, FAQ,
// Contact, plus the two functional ones (Book, Get a quote) — each with its own
// block list and a flag for whether it shows in the header menu. This is what
// turns the one long scrolling page into a real website with a nav.
//
// Backward compatibility is the whole reason this is a helper and not a hard
// schema change: every existing site stored its content in `CompanySite.blocks`
// with no `pages`. `resolvePages` treats that as a single Home page, so nothing
// migrates and nothing breaks — a site becomes multi-page only once `pages` is
// written.

export const HOME_SLUG = "home";

// The catalogue of pages a site MAY have, in menu order. `slug` is the URL
// segment (home renders at "/"); `blockTypes` is the default content a freshly
// generated version of this page carries. Kept small and honest — a page a
// contractor can't fill is worse than no page.
export const PAGE_CATALOGUE = [
  { slug: "home", title: "Home", nav: true, blockTypes: ["hero", "services", "beforeafter", "cta", "contact"] },
  { slug: "services", title: "Services", nav: true, blockTypes: ["hero", "services", "process", "faq", "cta"] },
  { slug: "work", title: "Our Work", nav: true, blockTypes: ["hero", "gallery", "beforeafter", "testimonials", "cta"] },
  { slug: "about", title: "About", nav: true, blockTypes: ["hero", "about", "credentials", "areas", "cta"] },
  { slug: "book", title: "Book", nav: true, blockTypes: ["hero", "booking", "hours"] },
  { slug: "quote", title: "Get a quote", nav: true, blockTypes: ["hero", "quoteform"] },
  { slug: "contact", title: "Contact", nav: true, blockTypes: ["hero", "contact", "hours", "areas"] },
];

const CATALOGUE_BY_SLUG = Object.fromEntries(PAGE_CATALOGUE.map((p) => [p.slug, p]));

// A slug safe for a URL segment. Reserved-word collisions (a page called
// "fr" clashing with the French language route) are avoided by prefixing pages
// under their own segment in the router — see the routing layer — so this only
// has to produce something URL-clean.
export function pageSlug(raw) {
  return String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function isPage(p) {
  return p && typeof p === "object" && typeof p.slug === "string" && Array.isArray(p.blocks);
}

/**
 * The site's pages, always as a non-empty array with a Home first.
 *
 * @param site  a CompanySite row (or the shape the editor holds): { blocks, pages }.
 *
 * If `pages` is a valid non-empty array it's used as-is (slugs normalised, a
 * Home guaranteed). Otherwise the legacy single-page `blocks` becomes the one
 * Home page — the backward-compatible path every existing site takes.
 */
export function resolvePages(site) {
  const raw = Array.isArray(site?.pages) ? site.pages.filter(isPage) : [];

  if (raw.length) {
    const pages = raw.map((p, i) => ({
      id: p.id || `${p.slug}_${i}`,
      slug: i === 0 ? HOME_SLUG : pageSlug(p.slug) || `page-${i}`,
      title: p.title || CATALOGUE_BY_SLUG[p.slug]?.title || "Page",
      nav: p.nav !== false,
      blocks: p.blocks,
    }));
    // Guarantee exactly one Home, first.
    if (!pages.some((p) => p.slug === HOME_SLUG)) pages[0].slug = HOME_SLUG;
    return pages;
  }

  // Legacy / single-page: the flat blocks array is the Home page.
  return [
    {
      id: "home",
      slug: HOME_SLUG,
      title: CATALOGUE_BY_SLUG.home.title,
      nav: true,
      blocks: Array.isArray(site?.blocks) ? site.blocks : [],
    },
  ];
}

/** The page matching `slug` (Home for empty/"home"), or null if there's none. */
export function findPage(pages, slug) {
  const want = !slug || slug === HOME_SLUG ? HOME_SLUG : pageSlug(slug);
  return pages.find((p) => p.slug === want) || null;
}

/** The header-menu entries: nav-visible pages, Home first, in order. */
export function navPages(pages) {
  return pages.filter((p) => p.nav);
}

/** True once a site has adopted the multi-page model (more than just Home). */
export function isMultiPage(site) {
  return Array.isArray(site?.pages) && site.pages.filter(isPage).length > 1;
}
