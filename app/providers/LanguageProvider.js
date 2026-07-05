// app/providers/LanguageProvider.js
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

const LanguageContext = createContext(null);

const SUPPORTED_LANGUAGES = ["en", "fr", "es", "uk"];
const STORAGE_KEY = "fieldquo-language";

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.includes(stored)) {
      setLanguage(stored);
    }
  }, []);

  const changeLanguage = useCallback((code) => {
    if (!SUPPORTED_LANGUAGES.includes(code)) return;
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
