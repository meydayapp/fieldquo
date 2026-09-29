// lib/i18n/resolveMessage.js
//
// One catalogue lookup: "nav.pricing" against either a flat catalogue
// ({ "nav.pricing": … }) or a nested one ({ nav: { pricing: … } }).
// Supporting both means a catalogue can start flat and grow into nested
// sections without a migration, and a section can be lifted into its own
// file later without touching call sites.
//
// Lifted out of app/hooks/useTranslation.js so it can be EXECUTED by
// scripts/check-translate-missing-key.mjs — the hook imports the language
// provider and cannot run in bare Node, and this function is the line that
// took /app/quotes/new down on 2026-09-19: the quote builder's tour called
// t(undefined), `key.split` threw "undefined is not an object (evaluating
// 'a.split')" in Safari, and the whole builder became an error screen.
//
// A key that is not a non-empty string is a missing translation, never a
// crashed page: the answer is `undefined`, which lets t() fall through to
// English, then the caller's fallback — exactly what a key with no entry
// gets. It deliberately does not coerce (String(123) → "123" would look up
// a key nobody wrote) and does not substitute a placeholder string: an
// absent key has nothing to say, and inventing text would put words on a
// screen that no catalogue contains.

/**
 * @param dict  one language's catalogue (may be absent)
 * @param key   a dot-path; anything but a non-empty string resolves to nothing
 * @returns the entry (string, function, or nested node) or undefined
 */
export function resolveMessage(dict, key) {
  if (!dict || typeof dict !== "object") return undefined;
  if (typeof key !== "string" || !key) return undefined;
  if (dict[key] !== undefined) return dict[key]; // flat hit
  return key
    .split(".")
    .reduce((node, part) => (node == null ? undefined : node[part]), dict);
}

/**
 * t(key, fallbackOrValues?, values?) against a set of catalogues — the body
 * of useTranslation's t(), here so it runs in bare Node.
 *
 * Resolution order: requested language → default language → the explicit
 * fallback → the key itself. An absent key (undefined, null) with no
 * fallback therefore resolves to that same absent value and renders as
 * nothing. It is NOT passed through String(): the values branch below used
 * to turn t(undefined, { n }) into the literal word "undefined" on screen.
 *
 * @param messages         { [language]: catalogue }
 * @param language         the requested language
 * @param defaultLanguage  the language every key is guaranteed in
 */
export function translate(messages, language, defaultLanguage, key, fallbackOrValues, maybeValues) {
  const isValues =
    fallbackOrValues !== null &&
    typeof fallbackOrValues === "object" &&
    !Array.isArray(fallbackOrValues);

  const fallback = isValues ? undefined : fallbackOrValues;
  const values = isValues ? fallbackOrValues : maybeValues;

  const raw =
    resolveMessage(messages?.[language], key) ??
    resolveMessage(messages?.[defaultLanguage], key) ??
    fallback ??
    key;

  // Some entries are functions of their arguments rather than templates —
  // e.g. subject: (n) => `Quote #${n}`. Call them with the values object
  // so a catalog can express plurals or grammatical agreement that a
  // {placeholder} string can't.
  if (typeof raw === "function") return raw(values ?? {});

  if (!values || raw == null) return raw;

  return String(raw).replace(/\{(\w+)\}/g, (match, name) =>
    values[name] !== undefined ? String(values[name]) : match,
  );
}
