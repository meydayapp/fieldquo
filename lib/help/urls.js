// lib/help/urls.js
//
// Every URL the help centre prints, in one place.
//
// ── Two hosts, one set of pages ────────────────────────────────────────────
//
// The pages live under app/help/ and are statically generated with links of
// the form /help/{lang}/{category}/{article}. They are reachable two ways:
//
//   www.fieldquo.com/help/en/…   — works today, before any DNS change;
//   help.fieldquo.com/en/…       — the canonical address. middleware.js
//                                  rewrites /en/… on that host to /help/en/…
//                                  and REDIRECTS a /help/… path on that host
//                                  to the short form, so a statically
//                                  rendered link still lands on a canonical
//                                  URL there (one hop, never a loop).
//
// So a page link is always the /help-prefixed path (`helpPath` below), and
// only the CANONICAL and the sitemap spell the help.fieldquo.com form. The
// alternative — rendering different hrefs per host — would need the host at
// render time, which makes every page dynamic and un-cacheable for the sake
// of saving one redirect on the host nobody has typed yet.
//
// ── Links OUT of the help centre are absolute ──────────────────────────────
//
// On help.fieldquo.com a relative /pricing would be rewritten into
// /help/pricing and 404. Everything that leaves the help centre — the logo,
// "Sign in", the footer — points at MARKETING_ORIGIN in full.

export const HELP_ORIGIN = "https://help.fieldquo.com";
export const MARKETING_ORIGIN = "https://www.fieldquo.com";

/** The path a page LINKS to (works on both hosts). */
export function helpPath(lang, category = null, article = null) {
  let p = `/help/${lang}`;
  if (category) p += `/${category}`;
  if (article) p += `/${article}`;
  return p;
}

/** The same path in the help-host spelling: /help/en/… → /en/…. */
export function shortHelpPath(lang, category = null, article = null) {
  return helpPath(lang, category, article).slice("/help".length);
}

/** The canonical URL of a page — the help.fieldquo.com spelling. */
export function helpCanonical(lang, category = null, article = null) {
  return `${HELP_ORIGIN}${shortHelpPath(lang, category, article)}`;
}

/** A figure's public path (scripts/build-help-content.mjs copies it there). */
export function figureSrc(lang, name) {
  return `/help/figures/${lang}/${name}.png`;
}

/** The search index the client fetches, one per language. */
export function searchIndexSrc(lang) {
  return `/help/search/${lang}.json`;
}
