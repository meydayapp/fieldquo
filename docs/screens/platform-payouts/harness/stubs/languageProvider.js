// @/app/providers/LanguageProvider for the harness. RepLanguageChoice reads
// the context directly (to switch the shell's language after a save); the
// harness has no shell provider, so this answers with the ?lang= the
// useTranslation stub is already rendering in.
import React from "react";
const lang = (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("lang")) || "en";
const ctx = { language: lang, changeLanguage: () => {}, stated: null };
export function LanguageProvider({ children }) { return React.createElement(React.Fragment, null, children); }
export function useLanguageContext() { return ctx; }
