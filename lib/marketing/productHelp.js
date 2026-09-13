// lib/marketing/productHelp.js
//
// The "Read how it works →" link under each section of /product/<slug>.
//
// Pure, and executed by scripts/check-product-pages.mjs against every section
// of every page: a section names a help article by SLUG only, and this is
// where the slug becomes a URL. The category is looked up in lib/help/tree.js
// rather than typed beside the slug, because a slug is the article's address
// forever (tree.js's own rule) and a category typed next to it is the copy
// that rots the day an article moves.
//
// ── Language ───────────────────────────────────────────────────────────────
//
// The help centre is WRITTEN in HELP_LANGS (en, fr, es). Every other language
// the marketing site speaks gets the English article — the help centre itself
// would serve the English body with a notice, and a link that lands there is
// honest about it up front: `fallback` is true and the page prints "(in
// English)" beside the link. bodyLang() in lib/help/urls.js is the one
// decision, shared with the help centre itself rather than re-derived here.
//
// ── Absolute, on the help host ─────────────────────────────────────────────
//
// helpCanonical() spells the help.fieldquo.com form. A relative /help/... would
// work on www.fieldquo.com and be rewritten into /help/help/... on the help
// host; the canonical address works from anywhere.

import { articleMeta, categoryOf } from "@/lib/help/tree";
import { bodyLang, helpCanonical } from "@/lib/help/urls";

/**
 * @returns {{ href: string, lang: string, fallback: boolean } | null}
 *   null when the slug is not in the tree — the check fails it by name, and
 *   the renderer must not print a link to a page that does not exist.
 */
export function productHelpUrl(slug, language = "en") {
  if (!articleMeta(slug)) return null;
  const lang = bodyLang(language);
  return {
    href: helpCanonical(lang, categoryOf(slug), slug),
    lang,
    fallback: lang !== language,
  };
}
