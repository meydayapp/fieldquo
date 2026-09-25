// lib/aiEmployee/names.js
//
// The name each AI employee is hired with.
//
// ══ Why every role has its own ═════════════════════════════════════════════
//
// Every row used to be born "Assistant" — the schema default — so a company
// with a receptionist and a closer had two employees called Assistant on the
// team list, in the flow view, in the handling timeline, and in the hand-off
// line a homeowner reads ("Assistant here — I'll take it from here", from an
// "Assistant"). The owner, 2026-09-22: "each assistant should have its own
// default name that the company can change."
//
// So a hire gets a first name that is distinct per role WITHIN a language,
// in the company's own language (a Québec painter's receptionist is not
// "Emma"), and the company renames it on the settings screen like any other
// field. The receptionist and the closer carry names that suit their default
// portraits (lib/aiEmployee/faces.js: receptionist-f, closer-m); the two
// roles without a portrait get names that read either way.
//
// These are ordinary first names, not product names — white-label: nothing
// here says FieldQuo, and nothing says "bot".

/** role → name, per app language. Every language names every role, and no
 *  two roles share a name inside one language — check:ai-employee executes
 *  both. */
const NAMES = Object.freeze({
  en: { receptionist: "Emma", closer: "Jack", troubleshooter: "Sam", custom: "Alex" },
  fr: { receptionist: "Chloé", closer: "Julien", troubleshooter: "Hugo", custom: "Camille" },
  es: { receptionist: "Lucía", closer: "Mateo", troubleshooter: "Diego", custom: "Sofía" },
  uk: { receptionist: "Олена", closer: "Андрій", troubleshooter: "Тарас", custom: "Саша" },
  pa: { receptionist: "ਸਿਮਰਨ", closer: "ਅਰਜਨ", troubleshooter: "ਗੁਰਪ੍ਰੀਤ", custom: "ਜਸਲੀਨ" },
  tl: { receptionist: "Maria", closer: "Paolo", troubleshooter: "Jun", custom: "Liza" },
  de: { receptionist: "Anna", closer: "Lukas", troubleshooter: "Felix", custom: "Kim" },
  zh: { receptionist: "小雅", closer: "志强", troubleshooter: "明远", custom: "佳怡" },
  it: { receptionist: "Giulia", closer: "Marco", troubleshooter: "Luca", custom: "Andrea" },
});

export const DEFAULT_NAME_LANGUAGES = Object.freeze(Object.keys(NAMES));

/** The schema's default — what a row carries when nobody ever named it. */
export const UNNAMED = "Assistant";

/**
 * The name a new hire in this role gets, in this language.
 *
 * An unknown language falls back to English and an unknown role to the
 * custom role's name — the same fail-closed direction roles.js's roleFor
 * takes, so this never returns an empty string.
 */
export function defaultNameFor(role, language = "en") {
  const table = NAMES[String(language || "").toLowerCase().slice(0, 2)] || NAMES.en;
  return table[role] || table.custom;
}

/** Every role's name in one language — for the check. */
export function defaultNamesIn(language) {
  return { ...(NAMES[language] || NAMES.en) };
}
