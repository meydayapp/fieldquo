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
// For THIS PAGE only. It used to also write the language into the browser's
// permanent preference through the root provider's changeLanguage, so that
// /login one click later would not fall back to a guess. That write is what
// made fieldquo.com answer in whatever language the last email link was in,
// days later (2026-09-25). The page after this one now follows the account
// when this browser is signed in, and the device when it is not — the same
// answer the whole site gives.
//
// No language (nothing identified the account) → children as they are: the
// page keeps the shell's own answer rather than an invented English.
"use client";

import { LanguageProvider } from "@/app/providers/LanguageProvider";
import { isSupported } from "@/app/i18n/languages";

export default function LinkLanguage({ language, children }) {
  const supported = isSupported(language) ? String(language).toLowerCase() : null;

  if (!supported) return children;
  return (
    <LanguageProvider initialLanguage={supported} fromAccount>
      {children}
    </LanguageProvider>
  );
}
