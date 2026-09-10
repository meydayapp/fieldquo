// app/i18n/comparePages/index.js
//
// The /compare catalogue, one module per language.
//
// ══ Why its own directory rather than more keys in messages.js ═════════════
//
// Same reason app/i18n/featurePages/ and app/i18n/industries/ have one: 204
// keys times nine languages is 1,836 strings, and dropping them into the middle
// of messages.js would make that file unreadable and every future diff to it
// unreviewable. The merge happens in messages.js, into the MARKETING half —
// which is the part that matters. MESSAGE_KEYS is read off MARKETING.en, and
// check:translations gates a deploy on full coverage of MESSAGE_KEYS in every
// offered language. So a /compare key added without its eight translations
// fails the build rather than shipping an English sentence to a Spanish reader,
// which is exactly the failure this whole directory was created to fix.
//
// ══ On the two languages nobody on the team reads ══════════════════════════
//
// Punjabi and Tagalog were drafted rather than natively authored, as
// industries/index.js already records for its own. They are complete and
// idiomatic enough to ship and they are the two worth putting in front of a
// native speaker before these pages become an acquisition channel for those
// communities. The sentences to check first are the ones that CONCEDE — the
// "What FieldQuo does not do" block and the entry-price panel. A concession
// that has drifted narrower in translation reads as a promise in the reader's
// own language, which is worse than the English it replaced.
//
// Mandarin is here because the catalogue carries it (see the CATALOGUE_ONLY
// note in scripts/check-language-completeness.mjs) even though the picker does
// not offer it yet. It is not gated by check:translations, so it is the one
// file that can fall behind quietly — which is why it is written rather than
// left out.

// Extensions included on purpose, exactly as featurePages/index.js carries
// them. Webpack resolves either way, but scripts/check-translations.mjs and
// scripts/check-marketing-i18n.mjs run under plain node, whose ESM resolver
// does not guess extensions — without them both checks die at import time,
// which is precisely how the coverage gate came to be silently broken before.
import en from "./en.js";
import fr from "./fr.js";
import es from "./es.js";
import uk from "./uk.js";
import pa from "./pa.js";
import tl from "./tl.js";
import de from "./de.js";
import zh from "./zh.js";
import it from "./it.js";

export const COMPARE_PAGE_MESSAGES = { en, fr, es, uk, pa, tl, de, zh, it };

/** Every key the English source defines — what the coverage check measures. */
export const COMPARE_PAGE_KEYS = Object.keys(en);
