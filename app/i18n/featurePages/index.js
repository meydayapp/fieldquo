// app/i18n/featurePages/index.js
//
// Six languages of /features and /features/<slug>.
//
// ══ Why a directory rather than 5,886 more lines in messages.js ════════════
//
// The same argument app/i18n/appMessages.js makes, and it is made for the same
// reason: messages.js is the marketing catalogue, already ~2,900 lines of
// landing-page copy edited by hand. 981 keys × six languages is twice the size
// of everything else on the site put together, changes for a different reason
// (a feature page is rewritten when the FEATURE changes), and would bury every
// other string in the file. Merged at the bottom of messages.js, so t(), the
// coverage script and every call site stay unchanged: there is still exactly
// one MESSAGES object and one flat lookup. app/i18n/industries/ is the same
// shape one surface over.
//
// ══ What is in here, and where each part's truth lives ═════════════════════
//
//   featurePage.<slug>.*   the prose. English is a pinned copy of
//                          app/data/featurePages.js — see en.js — because that
//                          module is what scripts/check-feature-pages.mjs reads
//                          when it proves these pages cannot claim a phone
//                          application, an accounting integration or change
//                          orders. The English also arrives at t() as the
//                          FALLBACK, so a hole prints the proved sentence
//                          rather than `featurePage.quotes.headline`.
//   featurePage.chrome.*   the page's furniture. No other home; the catalogue
//   featuresIndex.*        is the source, which is why the components pass no
//                          fallback for these.
//   featureGroup.*         the four matrix group headings, pinned to
//                          lib/marketing/featureMatrix.js.
//   feature.*.limits       where a partly-built thing stops. Pinned to the
//                          matrix, and the eight sentences on this site where a
//                          loose paraphrase does the most damage.
//
// ══ What a native speaker should still read ════════════════════════════════
//
// This is a draft in all five non-English languages, and it is a large one. The
// bar it clears is the bar app/i18n/industries/index.js sets: complete,
// idiomatic, in the trade register — Québec French says "soumission" and
// "chantier", not "devis" and "projet", matching the feature names already
// shipping in messages.js. The bar it does NOT clear is a native speaker's
// signature. What follows is the list to put in front of one, written down
// because the alternative is presenting 4,905 strings as finished.
//
// ── The caveats, first, in every language ─────────────────────────────────
//
// A caveat that has drifted WIDER than the English is a promise we did not
// make, in the reader's own language, on the page where it costs the most.
// Three of the eight came back with a flag from more than one translator:
//
//   feature.payroll.limits — "file your payroll taxes". French narrowed it to
//     source deductions ("déclarations de retenues à la source"), which a
//     Québec bookkeeper could read as leaving the employer side unspoken;
//     Ukrainian's "подає ваші зарплатні податки" can be heard as "does not
//     remit" rather than "does not file"; Punjabi's ਭਰਦਾ covers both filing and
//     paying, which is wider than the English and therefore safer. Arbitrate.
//   feature.contractor_payouts.limits — "a fixed bid". Every language rendered
//     the PRICE rather than the BID DOCUMENT (fr "prix forfaitaire", es "oferta
//     cerrada", uk "фіксовану пропозицію", pa "ਤੈਅ ਬੋਲੀ"). Spanish's reads as a
//     sealed tender, which would be narrower than the English.
//   feature.financing.limits — the one that matters most, and the one every
//     language got right: two verbs, two negations, never "is not a lender".
//     Punjabi's ਮਨਜ਼ੂਰੀ is the same word the catalogue uses for approving a
//     QUOTE, so a speaker should confirm it reads as credit approval.
//
// ── Punjabi, which nobody in-house can check at all ───────────────────────
//
// Written as Surrey/Lower Mainland job-site Punjabi, in Gurmukhi, keeping the
// English loanwords a contractor says out loud (ਕੋਟ, ਇਨਵੌਇਸ, ਜੌਬ ਕੌਸਟਿੰਗ) —
// the same standing note pa.js carries in app/i18n/industries/. The specific
// doubts: ਅੰਦਾਜ਼ਾ ਲਾਉਣ ਵਾਲਾ for "estimator" (a Surrey estimator may just say
// ਐਸਟੀਮੇਟਰ); ਮੁਨਾਫ਼ਾ for "markup", which is strictly "profit"; ਕੋਸੀ for a warm
// lead, which may read as lukewarm water; and
// featurePage.quotes.detail.1.label, where "builder" means the quote-builder
// SCREEN and ਬਿਲਡਰ will be read as a construction builder.
//
// ── Spanish: an inherited split, deliberately not fixed here ──────────────
//
// The shipped catalogue is a Peninsular/LatAm mixture — "control de costes por
// trabajo" (Peninsular) beside "costos" everywhere else, "triplay" (Mexican)
// for a sheet of ply. These files reproduce that split exactly rather than
// harmonising it, because a feature page written in one Spanish over a pricing
// page written in another is the same half-and-half failure this whole pass
// exists to remove. The fix is one decision across the whole catalogue, not 981
// keys of it. Also worth an eye: "presupuesto" is the catalogue's word for a
// QUOTE, so the six places where the English means the homeowner's BUDGET use
// "monto" instead.
//
// ── French and Ukrainian ──────────────────────────────────────────────────
//
// French is Québec throughout (texto, courriel, grille de prix, RPC et AE,
// verge cube, carrés for roofing squares). Two strings use "TVA" on purpose —
// featurePage.sales-tax.description and .how.2.body, where the English is
// literally about VAT countries; everywhere else it is the GST/QST vocabulary.
// The roofing and cabinet vocabulary is where the translator was least
// confident. Ukrainian is standard literary Ukrainian with the polite plural;
// its four plural-agreement strings (partialMany, featureCountMany, closing,
// directoryTitle) use the catalogue's existing postposed-numeral escape hatch
// ("Сторінок: {count}"), which is grammatical for every value but reads as a
// label rather than a sentence — the four to revisit if t() ever gains plural
// forms.
//
// One string was edited after the fact rather than by its translator:
// featurePage.sales-tax.description and .how.2.body came back with "VAT" left
// in Latin in the Punjabi, which is the only script the check does not allow it
// in. Written as ਵੈਟ, matching how the other four languages localise it.

import en from "./en.js";
import fr from "./fr.js";
import es from "./es.js";
import uk from "./uk.js";
import pa from "./pa.js";
import tl from "./tl.js";
import de from "./de.js";
import zh from "./zh.js";
import it from "./it.js";

// Extensions included on purpose, and relative rather than "@/": this module is
// reached by scripts/check-translations.mjs under plain node, whose ESM
// resolver has neither the bundler's alias map nor its extension guessing. The
// same reasoning is spelled out on the import in appMessages.js, where leaving
// it off silently broke the coverage gate.
export const FEATURE_PAGE_MESSAGES = { en, fr, es, uk, pa, tl, de, zh, it };

/** Every key English carries — the list the coverage check holds the rest to. */
export const FEATURE_PAGE_MESSAGE_KEYS = Object.keys(en);
