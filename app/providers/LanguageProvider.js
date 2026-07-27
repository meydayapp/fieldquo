// app/providers/LanguageProvider.js
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  DEFAULT_LANGUAGE,
  isSupported,
  languageMeta,
  normalizeLanguage,
} from "@/app/i18n/languages";

const LanguageContext = createContext(null);

const STORAGE_KEY = "fieldquo-language";

export function LanguageProvider({ children, initialLanguage }) {
  // Always starts at the default so server and client render identically.
  // Reading localStorage during the initial render would produce a hydration
  // mismatch — the server has no idea what's in the visitor's browser.
  const [language, setLanguage] = useState(
    isSupported(initialLanguage) ? initialLanguage : DEFAULT_LANGUAGE,
  );

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isSupported(stored)) {
      setLanguage(stored);
      return;
    }
    // No stored preference: fall back to the browser's language, so a
    // francophone visitor doesn't have to find the switcher on first visit.
    const fromBrowser = normalizeLanguage(navigator?.language);
    if (fromBrowser !== DEFAULT_LANGUAGE) setLanguage(fromBrowser);
  }, []);

  // Keep <html lang> honest. Screen readers use it to pick a voice, and
  // browsers use it to offer (or suppress) their own translation prompt —
  // leaving it as "en" on a French page makes both behave badly.
  useEffect(() => {
    const meta = languageMeta(language);
    document.documentElement.lang = language;
    document.documentElement.dir = meta.dir;
  }, [language]);

  const changeLanguage = useCallback((code) => {
    if (!isSupported(code)) return;
    setLanguage(code);
    window.localStorage.setItem(STORAGE_KEY, code);
  }, []);

  return (
    <LanguageContext.Provider value={{ language, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguageContext() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error(
      "useLanguageContext must be used inside <LanguageProvider>",
    );
  }
  return ctx;
}
