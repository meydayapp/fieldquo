// app/hooks/useTranslation.js
"use client";

import { useCallback } from "react";
import { useLanguageContext } from "@/app/providers/LanguageProvider";
import { MESSAGES } from "@/app/i18n/messages";
import { DEFAULT_LANGUAGE } from "@/app/i18n/languages";

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
export function useTranslation() {
  const { language, changeLanguage } = useLanguageContext();

  const t = useCallback(
    (key, fallbackOrValues, maybeValues) => {
      const isValues =
        fallbackOrValues !== null &&
        typeof fallbackOrValues === "object" &&
        !Array.isArray(fallbackOrValues);

      const fallback = isValues ? undefined : fallbackOrValues;
      const values = isValues ? fallbackOrValues : maybeValues;

      const raw =
        MESSAGES[language]?.[key] ??
        MESSAGES[DEFAULT_LANGUAGE]?.[key] ??
        fallback ??
        key;

      if (!values) return raw;

      return String(raw).replace(/\{(\w+)\}/g, (match, name) =>
        values[name] !== undefined ? String(values[name]) : match,
      );
    },
    [language],
  );

  return { t, language, changeLanguage };
}
