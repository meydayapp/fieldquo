// app/i18n/industries/index.js
//
// Industry page content per language, with English as the fallback.
//
// All six languages are now written. Punjabi and Tagalog were drafted rather
// than natively authored — see the header notes in pa.js and tl.js. They're
// complete and idiomatic enough to ship, but they're the two worth putting in
// front of a native speaker before these pages become a primary acquisition
// channel for those communities.

import en from "./en";
import fr from "./fr";
import es from "./es";
import uk from "./uk";
import pa from "./pa";
import tl from "./tl";
import de from "./de";
import zh from "./zh";
import it from "./it";

export const INDUSTRY_MESSAGES = { en, fr, es, uk, pa, tl, de, zh, it };

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
