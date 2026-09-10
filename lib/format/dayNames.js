// lib/format/dayNames.js
//
// Weekday names in a reader's language. The ONE of these in the codebase.
//
// ── Why this is not seven more catalogue keys ──────────────────────────────
//
// "Monday" is not product copy. Every JavaScript runtime already ships CLDR's
// weekday names for every locale FieldQuo supports, and a hand-written table
// would be seven more strings to forget the next time a language is added —
// which is exactly how the opening-hours editor came to print "Sunday /
// Monday / Tuesday" under a heading that said "Horario de apertura".
//
// ── Why it lives here and not beside its first caller ──────────────────────
//
// It was written inside lib/company/businessHours.js, because the tenant
// website needed it first. That made it invisible to every other screen that
// needs the same thing — the scheduler, the weekly availability grid, the
// campaign calendar — and each of those was one `["Mon","Tue",…]` away from
// becoming the second copy. AGENTS.md's fourth recurring failure class is the
// copy, because the copy is the one that rots.
//
// businessHours.js still exports `dayNames`; it re-exports THIS, so there is
// one implementation and the tenant-surface checks that import it keep
// working.
//
// ── Indexing: 0 = Sunday ───────────────────────────────────────────────────
//
// Matches Company.weekStartsOn, Date#getDay(), and the `day` field on every
// stored opening-hours row. Any other base would need a conversion at every
// call site, and one of them would get it wrong.

// The seven English names, used for the fallback ONLY.
//
// Not the display path: these are also the schema.org `dayOfWeek` IRI segments
// (https://schema.org/Monday is that URL in every language on earth), so the
// English table has a real job that has nothing to do with what a person
// reads. Keeping it here as the fallback is deliberate — a locale Intl rejects
// must not blank a public page over a weekday label.
const EN_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const EN_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const ENGLISH_DAY_NAMES = EN_LONG;
export const ENGLISH_DAY_SHORT = EN_SHORT;

/**
 * Weekday names for a locale, indexed 0 = Sunday.
 *
 * 2000-01-02 was a Sunday, so index i is that date plus i days. Formatted in
 * UTC because these are LABELS, not instants — the same reason opening times
 * are stored as "08:00" strings rather than Dates. Format a local-midnight
 * Date instead and a reader west of UTC gets the previous day's name.
 *
 * @param {string} locale  a BCP-47 tag; use numberLocaleFor(language) to get
 *                         one from a UI language code.
 * @param {{short?: boolean}} [opts]  `short` gives "Mon" rather than "Monday".
 */
export function dayNames(locale = "en-CA", { short = false } = {}) {
  try {
    const fmt = new Intl.DateTimeFormat(locale, {
      weekday: short ? "short" : "long",
      timeZone: "UTC",
    });
    return Array.from({ length: 7 }, (_, i) =>
      fmt.format(new Date(Date.UTC(2000, 0, 2 + i))),
    );
  } catch {
    return short ? EN_SHORT : EN_LONG;
  }
}

/**
 * One weekday name, capitalised the way a sentence would start.
 *
 * Spanish, French, Italian and German disagree about this: CLDR gives
 * "lunes", "lundi", "lunedì" lowercase and "Montag" capitalised, because
 * lowercase is correct mid-sentence in the Romance languages. A form ROW label
 * is not mid-sentence — it is a heading — so it takes the capital, and the
 * caller that wants the raw CLDR form (a sentence like "abre el lunes") calls
 * dayNames() and indexes it directly.
 *
 * toLocaleUpperCase, not toUpperCase: Turkish dotted/dotless i. FieldQuo does
 * not ship Turkish today, and a helper that silently breaks the day it does is
 * not worth the two characters saved.
 */
export function dayNameTitle(index, locale = "en-CA", { short = false } = {}) {
  const name = dayNames(locale, { short })[((index % 7) + 7) % 7] ?? "";
  if (!name) return name;
  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
}
