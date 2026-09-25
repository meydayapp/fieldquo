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
// Resolves "nav.pricing" against either a flat catalog ({ "nav.pricing": … })
// or a nested one ({ nav: { pricing: … } }). Supporting both means the
// catalog can start flat and grow into nested sections without a migration,
// and a section can be lifted into its own file later without touching call
// sites.
function resolve(dict, key) {
  if (!dict) return undefined;
  // A missing key is a missing translation, never a crashed page: t(undefined)
  // used to throw on `.split` and take the whole screen down with it.
  if (typeof key !== "string" || !key) return undefined;
  if (dict[key] !== undefined) return dict[key]; // flat hit
  return key
    .split(".")
    .reduce((node, part) => (node == null ? undefined : node[part]), dict);
}

export function useTranslation() {
  // changeLanguage is an explicit, this-tab-only switch; setPageLanguage is
  // this page's render only; applyAccountLanguage is Settings saving the
  // account's preference. Which one a caller may use is the whole fix in
  // app/providers/LanguageProvider.js — read its note before picking.
  const { language, changeLanguage, setPageLanguage, applyAccountLanguage } = useLanguageContext();

  const t = useCallback(
    (key, fallbackOrValues, maybeValues) => {
      const isValues =
        fallbackOrValues !== null &&
        typeof fallbackOrValues === "object" &&
        !Array.isArray(fallbackOrValues);

      const fallback = isValues ? undefined : fallbackOrValues;
      const values = isValues ? fallbackOrValues : maybeValues;

      const raw =
        resolve(MESSAGES[language], key) ??
        resolve(MESSAGES[DEFAULT_LANGUAGE], key) ??
        fallback ??
        key;

      // Some entries are functions of their arguments rather than templates —
      // e.g. subject: (n) => `Quote #${n}`. Call them with the values object
      // so a catalog can express plurals or grammatical agreement that a
      // {placeholder} string can't.
      if (typeof raw === "function") return raw(values ?? {});

      if (!values) return raw;

      return String(raw).replace(/\{(\w+)\}/g, (match, name) =>
        values[name] !== undefined ? String(values[name]) : match,
      );
    },
    [language],
  );

  return { t, language, changeLanguage, setPageLanguage, applyAccountLanguage };
}
