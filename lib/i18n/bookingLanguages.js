// lib/i18n/bookingLanguages.js
//
// The languages the public booking form (app/book/[companySlug]) offers on
// its three pills — the ones the product owner sells in, the same three
// lib/i18n/instantQuoteCopy.js offers on the instant estimate. The form's
// own strings come from the app catalogue and so exist in nine languages;
// the pills are three because the CONFIRMATION LETTER and the manage page
// the choice is carried onto are hand-written in these (clientDocCopy), and
// a pill for a language the letter would then fall back from is a choice
// that appears to work and half does.
//
// Pure, no imports — the browser, the route and the check all read it.

export const BOOKING_LANGUAGES = Object.freeze(["en", "fr", "es"]);

export const BOOKING_LANGUAGE_NAMES = Object.freeze({ en: "English", fr: "Français", es: "Español" });

/** A posted / queried / stored language, or null when it is not one of the three. */
export function bookingLanguage(value) {
  const code = String(value || "").toLowerCase().slice(0, 2);
  return BOOKING_LANGUAGES.includes(code) ? code : null;
}

/** The localStorage key the form remembers a visitor's pick under, per company. */
export const bookingLangStorageKey = (slug) => `fq.booking.lang.${slug}`;
