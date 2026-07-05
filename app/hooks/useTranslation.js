// app/hooks/useTranslation.js
"use client";

import { useLanguageContext } from "@/app/providers/LanguageProvider";

// Placeholder dictionary — none of the marketing copy has been broken into keys yet,
// so t() just falls back to whatever string you pass it. This exists so the hook's
// shape (t, language, changeLanguage) is stable now; real translations get filled in
// once page copy is finalized, not before.
const DICTIONARIES = {
  en: {},
  fr: {},
  es: {},
  uk: {},
};

export function useTranslation() {
  const { language, changeLanguage } = useLanguageContext();

  const t = (key, fallback) => {
    return DICTIONARIES[language]?.[key] ?? fallback ?? key;
  };

  return { t, language, changeLanguage };
}
