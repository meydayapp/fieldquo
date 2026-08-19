// lib/i18n/plurals.js
//
// Picking the right word for a count, per language.
//
// ── Why not just "n === 1 ? singular : plural" ────────────────────────────
//
// Because four of the six languages this product ships in disagree with that
// rule, and two of them disagree in ways that are not obvious:
//
//   fr, pa   ZERO is singular. "0 jour", not "0 jours".
//   uk       Three forms by the last digits: 1/21/31 → день, 2–4/22–24 → дні,
//            0 and 5–20 → днів. A two-form catalogue cannot express this.
//   fil      Its two CLDR categories are NOT singular/plural at all — they
//            split on whether the number ends in 4, 6 or 9, which is a
//            phonological rule about the linker, not a count. See the Tagalog
//            block in appMessages.js.
//
// So the categories come from Intl.PluralRules — the CLDR data, which is
// already in every browser and in Node — and the catalogue supplies one word
// per category. Nothing here re-implements a plural rule; duplicating CLDR by
// hand is how a catalogue ends up quietly wrong for the language nobody on the
// team reads.

// Intl.PluralRules construction is not free and this runs inside a render, so
// one instance per locale is kept. The set of locales is fixed (six) and tiny.
const cache = new Map();

function rulesFor(locale) {
  let pr = cache.get(locale);
  if (!pr) {
    pr = new Intl.PluralRules(locale);
    cache.set(locale, pr);
  }
  return pr;
}

/**
 * The CLDR plural category for `value` in `locale` — "one", "few", "many",
 * "other", …
 *
 * Non-finite input resolves as 0 rather than throwing. This is fed from a
 * numeric form field and from database rows, and a half-typed "1e" must not
 * take down the settings page; 0 mirrors delayMs() in lib/followUps/flow.js,
 * which makes the same call for the same reason.
 */
export function pluralCategory(locale, value) {
  const n = Number(value);
  return rulesFor(locale).select(Number.isFinite(n) ? n : 0);
}

/**
 * The word for `value` out of a per-category map.
 *
 * `forms.other` is the fallback because every language has that category;
 * a locale whose ICU data is missing collapses to English rules, and English
 * only ever asks for "one" or "other".
 */
export function pluralForm(locale, value, forms) {
  return forms[pluralCategory(locale, value)] ?? forms.other;
}

/**
 * A catalogue entry that renders "<n> <word>", declined for its own language.
 *
 * The locale is baked in at definition time rather than read from the active
 * language, and that is deliberate: t() falls back to the ENGLISH entry when a
 * language is missing a key, and an English word has to be declined by English
 * rules. Binding the locale to the words keeps the pair honest under fallback.
 *
 * Returns a function, which useTranslation()'s t() calls with its values
 * object — see the function-valued entry note in app/hooks/useTranslation.js.
 */
export function countedNoun(locale, forms) {
  return ({ value }) => {
    const n = Number(value);
    // Same 0 fallback as pluralCategory, applied to the printed number too —
    // otherwise a broken row renders the category for 0 next to the literal
    // text "NaN".
    const count = Number.isFinite(n) ? n : 0;
    return `${count} ${pluralForm(locale, count, forms)}`;
  };
}
