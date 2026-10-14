// lib/i18n/timesOrdinal.js
//
// "2nd time", "2e fois", "zum 2. Mal" — the one phrase the client-opened
// alert needs (the owner, 2026-10-14: "Maureen Faulkner opened quote
// Q-2026-0022 (2nd time)"). One function for the bell sentence
// (app/i18n/appMessages.js, under plain node as well as the bundler — hence
// import-free) and the text message (lib/i18n/clientAlertCopy.js), so the two
// can never count differently.
//
// Ordinals are not a plural rule (lib/i18n/plurals.js answers "how many", not
// "which one") and Intl has no ordinal WORDS — Intl.PluralRules({ type:
// "ordinal" }) only knows English-style suffix categories. So each language's
// own form is written here, by hand, for the nine app languages.

const EN_SUFFIX = { one: "st", two: "nd", few: "rd", other: "th" };
let enRules = null;

function english(n) {
  if (!enRules) enRules = new Intl.PluralRules("en", { type: "ordinal" });
  return `${n}${EN_SUFFIX[enRules.select(n)] || "th"} time`;
}

const FORMS = {
  en: english,
  fr: (n) => (n === 1 ? "1re fois" : `${n}e fois`),
  es: (n) => `${n}.ª vez`,
  it: (n) => `${n}ª volta`,
  de: (n) => `zum ${n}. Mal`,
  uk: (n) => `${n}-й раз`,
  pa: (n) => `${n}ਵੀਂ ਵਾਰ`,
  tl: (n) => `ika-${n} beses`,
  zh: (n) => `第${n}次`,
};

/** The languages this file writes — held to the app catalogue by the check. */
export const TIMES_ORDINAL_LANGUAGES = Object.freeze(Object.keys(FORMS));

/**
 * "{n}th time" in `language`. A count that is not a positive whole number is
 * read as 1 rather than printing "NaNth" at somebody.
 */
export function timesOrdinal(language, count) {
  const n = Math.max(1, Math.trunc(Number(count) || 1));
  const code = String(language || "en").toLowerCase().split(/[-_]/)[0];
  return (FORMS[code] || FORMS.en)(n);
}
