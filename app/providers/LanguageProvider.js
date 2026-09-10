// app/providers/LanguageProvider.js
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { isSupported, languageMeta } from "@/app/i18n/languages";
// The decision itself lives in lib/i18n/statedLanguage.js — a pure function
// plus a page-wide announcement channel. Its header explains why: /app nests
// two of these providers, and the four surfaces the app shell mounts BESIDE
// the inner one (AppTours, ErrorToast, PlanRequiredPrompt, JenniferPanel) read
// the outer one, which was still following a localStorage key this origin
// shares with the marketing site. That is how a Spanish account got Ukrainian
// tours. A stated preference is a fact about the person, not about a subtree.
import {
  resolveShellLanguage,
  statedLanguage,
  announceStatedLanguage,
  retractStatedLanguage,
  subscribeStatedLanguage,
} from "@/lib/i18n/statedLanguage";

const LanguageContext = createContext(null);

const STORAGE_KEY = "fieldquo-language";

// Throws, rather than returning null, in a browser configured to block site
// data — and a language preference is not worth taking a page down for.
function readStored() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * @param initialLanguage  what the server rendered in
 * @param fromAccount      true when `initialLanguage` came from a signed-in
 *                         user's saved preference rather than a guess
 */
export function LanguageProvider({ children, initialLanguage, fromAccount = false }) {
  // Starts at whatever the server rendered, so client and server agree.
  // Reading localStorage or the announcement channel during the initial render
  // would produce a hydration mismatch — the server has no idea what's in the
  // visitor's browser, and the channel is deliberately empty there.
  const [language, setLanguage] = useState(() =>
    resolveShellLanguage({ initialLanguage, fromAccount }),
  );

  // Identity only. See announceStatedLanguage on why a retract has to prove
  // which instance it is retracting.
  const instance = useRef({});

  // ── This provider WAS told the account's choice ──────────────────────────
  // Announce it, so the providers that were not told stop guessing.
  useEffect(() => {
    if (!fromAccount || !isSupported(initialLanguage)) return;
    const key = instance.current;
    announceStatedLanguage(key, initialLanguage);
    return () => retractStatedLanguage(key);
  }, [fromAccount, initialLanguage]);

  // ── This provider was NOT told ───────────────────────────────────────────
  // Subscribed rather than read once: the announcement arrives from an effect
  // in another component, and while React runs child effects first (so the
  // inner /app provider has already announced by the time this runs), relying
  // on that ordering would make the fix depend on where the tag happens to sit
  // — which is the bug.
  const [stated, setStated] = useState(null);
  useEffect(() => {
    if (fromAccount) return;
    setStated(statedLanguage());
    return subscribeStatedLanguage(setStated);
  }, [fromAccount]);

  useEffect(() => {
    // Short-circuited rather than passed through resolveShellLanguage's own
    // `fromAccount` branch, so a provider holding a stated choice never
    // touches storage at all — the read throws outright in a browser set to
    // block site data, and the answer would be discarded anyway.
    if (fromAccount) {
      setLanguage(resolveShellLanguage({ initialLanguage, fromAccount }));
      return;
    }
    setLanguage(
      resolveShellLanguage({
        initialLanguage,
        fromAccount,
        stated,
        stored: readStored(),
        browser: navigator?.language,
      }),
    );
    // `initialLanguage` is in here for the case that reads as the setting not
    // working: saving a new preference revalidates the layout and sends a
    // different value down, and without this the choice only appeared after a
    // hard reload.
  }, [fromAccount, initialLanguage, stated]);

  // Keep <html lang> honest. Screen readers use it to pick a voice, and
  // browsers use it to offer (or suppress) their own translation prompt —
  // leaving it as "en" on a French page makes both behave badly.
  //
  // Both nested providers write this and the outer one runs last, so before
  // the fix above /app served <html lang="uk"> to a Spanish account. They now
  // agree on the answer, which is why one line can safely be written twice.
  useEffect(() => {
    const meta = languageMeta(language);
    document.documentElement.lang = language;
    document.documentElement.dir = meta.dir;
  }, [language]);

  const changeLanguage = useCallback((code) => {
    if (!isSupported(code)) return;
    setLanguage(code);
    try {
      window.localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Same reasoning as readStored: the switch still works for this page.
    }
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
