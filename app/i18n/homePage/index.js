// app/i18n/homePage/index.js
//
// The homepage catalogue, one dictionary per language, merged into the
// MARKETING half of app/i18n/messages.js — the half check:translations gates
// a deploy on, so a missing Punjabi sentence on the homepage is a failed build
// rather than an English line the owner finds by switching languages. Its own
// directory for the reason savingsPage/ and comparePages/ give: two hundred
// keys times nine languages would double the size of messages.js.
//
// Extension included on purpose — scripts/check-translations.mjs runs under
// plain node, whose ESM resolver does not guess extensions.
import { HOME_PAGE_EN } from "./en.js";
import { HOME_PAGE_FR } from "./fr.js";
import { HOME_PAGE_ES } from "./es.js";
import { HOME_PAGE_UK } from "./uk.js";
import { HOME_PAGE_PA } from "./pa.js";
import { HOME_PAGE_TL } from "./tl.js";
import { HOME_PAGE_DE } from "./de.js";
import { HOME_PAGE_ZH } from "./zh.js";
import { HOME_PAGE_IT } from "./it.js";

export const HOME_PAGE_MESSAGES = {
  en: HOME_PAGE_EN,
  fr: HOME_PAGE_FR,
  es: HOME_PAGE_ES,
  uk: HOME_PAGE_UK,
  pa: HOME_PAGE_PA,
  tl: HOME_PAGE_TL,
  de: HOME_PAGE_DE,
  zh: HOME_PAGE_ZH,
  it: HOME_PAGE_IT,
};

export default HOME_PAGE_MESSAGES;
