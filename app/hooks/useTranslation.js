// app/hooks/useTranslation.js
"use client";

import { useCallback } from "react";
import { useLanguageContext } from "@/app/providers/LanguageProvider";
import { MESSAGES } from "@/app/i18n/messages";
import { DEFAULT_LANGUAGE } from "@/app/i18n/languages";
import { translate } from "@/lib/i18n/resolveMessage";

/**
 * t(key, fallbackOrValues?, values?)
 *
 * Resolution order: requested language → English → the explicit fallback →
 * the key itself. Falling back to English rather than the raw key matters:
 * one English sentence on a French page is a much smaller failure than
 * "features.quotes.body" rendered to a customer.
 *
 * Interpolation uses {name} placeholders:
 *   t("greeting", { name: "Jane" })   // "Hi {name}" -> "Hi Jane"
 *
 * The second argument accepts either a string fallback or a values object,
 * so existing t("key", "Some default") calls keep working unchanged.
 */
// The lookup itself (flat-or-nested catalogues, the English fallback, the
// {placeholder} fill) lives in lib/i18n/resolveMessage.js as plain functions,
// because this hook imports the language provider and cannot run in bare
// Node — and the lookup is what took /app/quotes/new down on 2026-09-19
// when t(undefined) threw on `.split`. scripts/check-translate-missing-key.mjs
// executes it with hostile keys.
export function useTranslation() {
  // changeLanguage is an explicit, this-tab-only switch; setPageLanguage is
  // this page's render only; applyAccountLanguage is Settings saving the
  // account's preference. Which one a caller may use is the whole fix in
  // app/providers/LanguageProvider.js — read its note before picking.
  const { language, changeLanguage, setPageLanguage, applyAccountLanguage } = useLanguageContext();

  const t = useCallback(
    (key, fallbackOrValues, maybeValues) =>
      translate(MESSAGES, language, DEFAULT_LANGUAGE, key, fallbackOrValues, maybeValues),
    [language],
  );

  return { t, language, changeLanguage, setPageLanguage, applyAccountLanguage };
}
