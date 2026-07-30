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

/**
 * @param initialLanguage  what the server rendered in
 * @param fromAccount      true when `initialLanguage` came from a signed-in
 *                         user's saved preference rather than a guess
 */
export function LanguageProvider({ children, initialLanguage, fromAccount = false }) {
  // Starts at whatever the server rendered, so client and server agree.
  // Reading localStorage during the initial render would produce a hydration
  // mismatch — the server has no idea what's in the visitor's browser.
  const [language, setLanguage] = useState(
    isSupported(initialLanguage) ? initialLanguage : DEFAULT_LANGUAGE,
  );

  useEffect(() => {
    // A saved account preference is a DECISION and outranks both of the guesses
    // below. Skipping this effect entirely is the point: localStorage is
    // per-browser, so without the guard a user who chose French in Settings got
    // English back on any browser that had ever visited the marketing site in
    // English — the stored guess overwriting the stated choice.
    if (fromAccount) return;

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isSupported(stored)) {
      setLanguage(stored);
      return;
    }
    // No stored preference: fall back to the browser's language, so a
    // francophone visitor doesn't have to find the switcher on first visit.
    const fromBrowser = normalizeLanguage(navigator?.language);
    if (fromBrowser !== DEFAULT_LANGUAGE) setLanguage(fromBrowser);
  }, [fromAccount]);

  // Keep in step when the server sends a different language than we're showing —
  // the case that matters is saving a new preference in Settings, which
  // revalidates the layout. Without this the choice only appeared after a hard
  // reload, which reads as the setting not working.
  useEffect(() => {
    if (fromAccount && isSupported(initialLanguage)) setLanguage(initialLanguage);
  }, [fromAccount, initialLanguage]);

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
