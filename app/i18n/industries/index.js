// app/i18n/industries/index.js
//
// Industry page content per language, with English as the fallback.
//
// es/uk/pa/tl are aliased to English until their files are written. That's a
// deliberate, visible placeholder rather than a silent gap: a Spanish visitor
// reads English industry copy — not a raw key — and the alias below is the
// single place that shows what's outstanding. Replace an alias with a real
// import as each file lands.

import en from "./en";
import fr from "./fr";
import es from "./es";
import uk from "./uk";

export const INDUSTRY_MESSAGES = {
  en,
  fr,
  es,
  uk,
  // TODO: real translations. ~130 strings each — see en.js for the shape.
  pa: en,
  tl: en,
};

/**
 * Resolves industry page content for a language, falling back field by field
 * to English. Field-level (not file-level) fallback means a partially
 * translated trade still shows whatever HAS been translated.
 */
export function industryContentFor(slug, language = "en") {
  const dict = INDUSTRY_MESSAGES[language] || en;
  const trade = dict.trades?.[slug];
  const fallback = en.trades?.[slug];
  if (!trade && !fallback) return null;

  return {
    label: trade?.label || fallback?.label || slug,
    headline: trade?.headline || fallback?.headline || "",
    description: trade?.description || fallback?.description || "",
    pains: trade?.pains?.length ? trade.pains : fallback?.pains || [],
  };
}

export function industryChromeFor(language = "en") {
  const dict = INDUSTRY_MESSAGES[language] || en;
  return { ...en.chrome, ...(dict.chrome || {}) };
}
