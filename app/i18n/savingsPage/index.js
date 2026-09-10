// app/i18n/savingsPage/index.js
//
// The /savings catalogue, one dictionary per language, merged into the
// MARKETING half of app/i18n/messages.js.
//
// MARKETING is the load-bearing word. MESSAGE_KEYS is read off MARKETING.en
// and check:translations gates a deploy on every language covering it, so
// landing here is what makes a missing Ukrainian sentence a failed build
// rather than something the owner finds by switching languages and reading his
// own page in English. That is exactly how this page shipped English on a
// nine-language site: the copy sat in a data module (lib/marketing/savings.js)
// that no coverage check could see. comparePages/ and featurePages/ carry the
// same note for the same reason.
//
// Extension included on purpose — scripts/check-translations.mjs runs under
// plain node, whose ESM resolver does not guess extensions.
import { SAVINGS_PAGE_EN } from "./en.js";
import { SAVINGS_PAGE_FR } from "./fr.js";
import { SAVINGS_PAGE_ES } from "./es.js";
import { SAVINGS_PAGE_UK } from "./uk.js";
import { SAVINGS_PAGE_PA } from "./pa.js";
import { SAVINGS_PAGE_TL } from "./tl.js";
import { SAVINGS_PAGE_DE } from "./de.js";
import { SAVINGS_PAGE_ZH } from "./zh.js";
import { SAVINGS_PAGE_IT } from "./it.js";

export const SAVINGS_PAGE_MESSAGES = {
  en: SAVINGS_PAGE_EN,
  fr: SAVINGS_PAGE_FR,
  es: SAVINGS_PAGE_ES,
  uk: SAVINGS_PAGE_UK,
  pa: SAVINGS_PAGE_PA,
  tl: SAVINGS_PAGE_TL,
  de: SAVINGS_PAGE_DE,
  zh: SAVINGS_PAGE_ZH,
  it: SAVINGS_PAGE_IT,
};

export default SAVINGS_PAGE_MESSAGES;
