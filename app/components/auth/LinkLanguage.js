// app/components/auth/LinkLanguage.js
//
// Renders a page reached from an account email in the language that email was
// written in — decided on the server from the account (lib/authLinkLanguage.js)
// and handed in here, so the FIRST render is already right.
//
// A nested LanguageProvider with `fromAccount`, the same shape /app uses for a
// signed-in user's saved choice: it ignores the browser's guesses outright and
// announces the choice page-wide (lib/i18n/statedLanguage.js), so the header
// above it follows too.
//
// It also writes the choice into the browser's own preference, through the
// ROOT provider's changeLanguage. The page's own buttons lead to /login and
// /forgot-password, which have no account to ask, and the person who has just
// been shown their language should not be switched back to a guess one click
// later. This is a language the person demonstrably reads, on their own
// device — the same write the header's language switcher makes.
//
// No language (nothing identified the account) → children as they are: the
// page keeps today's browser guess rather than an invented English.
"use client";

import { useEffect } from "react";
import { LanguageProvider, useLanguageContext } from "@/app/providers/LanguageProvider";
import { isSupported } from "@/app/i18n/languages";

export default function LinkLanguage({ language, children }) {
  // Outside the nested provider below, so this is the ROOT one.
  const { changeLanguage } = useLanguageContext();
  const supported = isSupported(language) ? String(language).toLowerCase() : null;

  useEffect(() => {
    if (supported) changeLanguage(supported);
  }, [supported, changeLanguage]);

  if (!supported) return children;
  return (
    <LanguageProvider initialLanguage={supported} fromAccount>
      {children}
    </LanguageProvider>
  );
}
