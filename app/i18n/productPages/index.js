// app/i18n/productPages/index.js
//
// Nine languages of /product/<slug> — the four pages the header dropdown, the
// footer and the homepage feature band all link to.
//
// ══ The hole this closes ═══════════════════════════════════════════════════
//
// Every other marketing surface is translated into nine languages. These four
// were not: app/data/productFeatures.js is English only, and the page had
// "Start Free Trial" and "See Pricing" typed into the JSX with no t() call at
// all. A francophone visitor left a fully translated homepage, clicked "En
// savoir plus" on a feature card, and landed in English — from the site's own
// navigation, three separate ways in.
//
// ══ Why a resolver here rather than a merge into messages.js ═══════════════
//
// app/i18n/featurePages/ is merged into the MARKETING blocks of messages.js,
// so its keys reach t() and are gated by scripts/check-translations.mjs.
// app/i18n/industries/ is NOT: it exports its own resolver and the page calls
// it directly. Both patterns are in the tree and both work.
//
// This directory follows industries, for one reason: messages.js is not this
// change's to edit. A surface whose copy lives outside MESSAGES needs its own
// gate or it is ungated copy, which is the failure this whole file exists to
// fix — so scripts/check-product-pages.mjs holds all nine modules key-for-key
// against English, pins English to the data module, and proves the rendered
// page prints the reader's language. That is the same bar check:translations
// sets, applied by a check that can see these keys.
//
// If these keys are ever moved into messages.js, delete productSay() and pass
// t() straight to productPageCopy() — it takes a (key, english) function and
// t() already is one. Nothing else changes.
//
// ══ What is NOT in here ════════════════════════════════════════════════════
//
//   product.<slug>.label   the eyebrow over the headline. Already in
//                          messages.js in all nine — the nav renders it — so
//                          the page resolves it through t() and this
//                          catalogue does not carry a second copy.
//   hero.cta               "Start free trial". Already in messages.js in all
//   featurePage.chrome.    nine and already shared (Hero and ClosingCTA both
//     seePricing           render hero.cta). See the comment on the buttons in
//                          ProductPageContent.js for why the second one is
//                          borrowed from the /features namespace rather than
//                          duplicated here.
//
// ══ What a native speaker should still read ════════════════════════════════
//
// This is a draft in all eight non-English languages. Each module's own header
// carries the specific doubts for that language — the words where a trade
// register was chosen over a dictionary one, and the ones a speaker should
// arbitrate. The register bar is the one app/i18n/featurePages/index.js sets:
// Québec French says "soumission" and "chantier", Spanish "presupuesto",
// Ukrainian "кошторис", Punjabi ਕੋਟ, Tagalog keeps "quote", German "Angebot",
// Mandarin 报价, Italian "preventivo" — matching what already ships beside
// them, because a page in one vocabulary over a nav in another reads as two
// different products.

// Extensions included on purpose, and relative rather than "@/": this module is
// reached by scripts/check-product-pages.mjs under plain node, whose ESM
// resolver has neither the bundler's alias map nor its extension guessing. The
// same reasoning is spelled out on the imports in featurePages/index.js and
// appMessages.js, where leaving it off silently broke the coverage gate.
import en from "./en.js";
import fr from "./fr.js";
import es from "./es.js";
import uk from "./uk.js";
import pa from "./pa.js";
import tl from "./tl.js";
import de from "./de.js";
import zh from "./zh.js";
import it from "./it.js";

export const PRODUCT_PAGE_MESSAGES = { en, fr, es, uk, pa, tl, de, zh, it };

/** Every key English carries — the list the coverage check holds the rest to. */
export const PRODUCT_PAGE_MESSAGE_KEYS = Object.keys(en);

/**
 * A (key, english) → string function for one language, shaped like t().
 *
 * The resolution chain is t()'s, deliberately, one surface over: requested
 * language → English catalogue → the English the caller passed in. It never
 * returns the key. A language with a hole prints the proved English sentence
 * rather than `productPage.quoting.headline`, which is the whole argument in
 * the header of app/hooks/useTranslation.js.
 *
 * The English catalogue step looks redundant — check-product-pages.mjs pins it
 * character-identical to the data module the fallback comes from — and it is
 * kept because that pin is what makes it redundant. If the two ever drift, the
 * check fails and names the key rather than the page quietly rendering
 * whichever copy the caller happened to hold.
 */
export function productSay(language = "en") {
  const dict = PRODUCT_PAGE_MESSAGES[language];
  return (key, english) => dict?.[key] ?? en[key] ?? english;
}
