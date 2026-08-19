// app/i18n/numberLocale.js
//
// Maps a UI language onto a formatting locale for Intl / toLocaleString.
//
// Digit grouping differs by language — French Canadian uses a thin space where
// English uses a comma (1 250 vs 1,250) — and an English-formatted number
// inside French copy reads as a bug to the people who notice.
//
// Extracted because two pricing surfaces had their own copy of this table.
// The second copy is the one that rots, because it's the one nobody looks at.
//
// Punjabi and Tagalog map to their most common regional formatting rather than
// the bare language tag: `pa` alone gives Indian digit grouping without the
// region, and `tl` isn't a formatting locale at all in most runtimes.

const NUMBER_LOCALES = {
  en: "en-CA",
  fr: "fr-CA",
  es: "es-MX",
  uk: "uk-UA",
  pa: "pa-IN",
  tl: "en-PH",
};

export function numberLocaleFor(language) {
  return NUMBER_LOCALES[language] || "en-CA";
}
