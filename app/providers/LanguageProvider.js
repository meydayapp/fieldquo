// app/providers/LanguageProvider.js
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
} from "react";
import { usePathname } from "next/navigation";
import { isSupported, languageMeta } from "@/app/i18n/languages";
// The decision itself lives in lib/i18n/statedLanguage.js — a pure function
// plus page-wide stores. Its header states the precedence (account > this
// tab's switch > the account learned on a public page > a page-only override
// > the device > English) and records the two bugs that shaped it: Ukrainian
// tours inside a Spanish /app, and a contractor's Spanish booking page making
// fieldquo.com Spanish for days through a permanent localStorage key.
import {
  resolveShellLanguage,
  speaksForCompany,
  statedLanguage,
  announceStatedLanguage,
  retractStatedLanguage,
  subscribeStatedLanguage,
  sessionLanguage,
  subscribeSessionLanguage,
  accountLanguage,
  noteAccountLanguage,
  subscribeAccountLanguage,
} from "@/lib/i18n/statedLanguage";
import {
  forgetLegacyLanguage,
  loadSessionLanguage,
  saveSessionLanguage,
  rememberSignedIn,
  learnAccountLanguage,
} from "@/lib/i18n/languageStorage";

const LanguageContext = createContext(null);

// navigator.languages is the device's whole ordered list; a phone set to
// Punjabi with English second reports ["pa-IN", "en-US"], and navigator.language
// alone would drop the order the person chose.
function deviceLanguages() {
  if (typeof navigator === "undefined") return null;
  return navigator.languages?.length ? navigator.languages : navigator.language;
}

/**
 * @param initialLanguage  what the server rendered in
 * @param fromAccount      true when `initialLanguage` came from a signed-in
 *                         user's saved preference rather than a guess
 * @param accountSession   true only on the /app shell for a real (non-support)
 *                         Better Auth session: this provider may tell the rest
 *                         of the page — and later public pages, through
 *                         lib/i18n/languageStorage.js — that the browser is
 *                         signed in and which language the account reads.
 *                         LinkLanguage and the sales portal are fromAccount
 *                         without being that, which is why it is its own flag.
 */
export function LanguageProvider({
  children,
  initialLanguage,
  fromAccount = false,
  accountSession = false,
}) {
  // Starts at whatever the server rendered, so client and server agree.
  // Reading storage or the page-wide stores during the initial render would
  // produce a hydration mismatch — the server has no idea what's in the
  // visitor's browser, and the stores are deliberately empty there.
  const [language, setLanguage] = useState(() =>
    resolveShellLanguage({ initialLanguage, fromAccount }),
  );

  // Identity only. See announceStatedLanguage on why a retract has to prove
  // which instance it is retracting.
  const instance = useRef({});

  const pathname = usePathname();
  const companyVoice = speaksForCompany(pathname);

  // The permanent key is gone for everyone, on the first page they load.
  useEffect(() => {
    forgetLegacyLanguage();
  }, []);

  // ── This provider WAS told the account's choice ──────────────────────────
  // Announce it, so the providers that were not told stop guessing.
  useEffect(() => {
    if (!fromAccount || !isSupported(initialLanguage)) return;
    const key = instance.current;
    announceStatedLanguage(key, initialLanguage);
    return () => retractStatedLanguage(key);
  }, [fromAccount, initialLanguage]);

  // …and, on the /app shell only, remember it past /app: a signed-in person
  // who clicks through to the marketing site or the help centre keeps their
  // language without a request. Not retracted on unmount — it is a fact about
  // the session, and signOut() is what ends it.
  useEffect(() => {
    if (!accountSession || !fromAccount || !isSupported(initialLanguage)) return;
    rememberSignedIn();
    noteAccountLanguage(initialLanguage);
  }, [accountSession, fromAccount, initialLanguage]);

  // ── This provider was NOT told ───────────────────────────────────────────
  // Subscribed rather than read once: announcements arrive from effects in
  // other components, and relying on effect ordering would make the answer
  // depend on where a tag happens to sit — which was the tours bug.
  const [stated, setStated] = useState(null);
  const [session, setSession] = useState(null);
  const [account, setAccount] = useState(null);
  useEffect(() => {
    if (fromAccount) return;
    setStated(statedLanguage());
    return subscribeStatedLanguage(setStated);
  }, [fromAccount]);
  useEffect(() => {
    if (fromAccount) return;
    loadSessionLanguage();
    setSession(sessionLanguage());
    return subscribeSessionLanguage(setSession);
  }, [fromAccount]);
  useEffect(() => {
    if (fromAccount) return;
    setAccount(accountLanguage());
    const unsubscribe = subscribeAccountLanguage(setAccount);
    // Never on a contractor's page: the account would be ignored there anyway
    // (statedLanguage.js), and a homeowner-facing page has no business asking
    // FieldQuo who is looking at it.
    if (!companyVoice) learnAccountLanguage();
    return unsubscribe;
  }, [fromAccount, companyVoice]);

  // ── Page-only override ───────────────────────────────────────────────────
  // Keyed to the path it was set on, because this provider outlives client
  // navigations: a booking page's Spanish must not follow the visitor to the
  // next page. The path is tracked in a LAYOUT effect so it is current before
  // any child's passive effect can call setPageLanguage — a child's effects
  // run before this provider's, so clearing on navigation in a passive effect
  // would wipe the override the new page had just set.
  const pathRef = useRef(pathname);
  useLayoutEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);
  const [page, setPage] = useState(null);
  const pageLanguage = page && page.path === pathname ? page.code : null;

  useEffect(() => {
    // Short-circuited rather than passed through resolveShellLanguage's own
    // `fromAccount` branch only for clarity: a provider holding a stated
    // choice consults nothing else.
    if (fromAccount) {
      setLanguage(resolveShellLanguage({ initialLanguage, fromAccount }));
      return;
    }
    setLanguage(
      resolveShellLanguage({
        initialLanguage,
        fromAccount,
        stated,
        session,
        account,
        page: pageLanguage,
        browser: deviceLanguages(),
        companyVoice,
      }),
    );
    // `initialLanguage` is in here for the case that reads as the setting not
    // working: saving a new preference revalidates the layout and sends a
    // different value down, and without this the choice only appeared after a
    // hard reload.
  }, [fromAccount, initialLanguage, stated, session, account, pageLanguage, companyVoice]);

  // Keep <html lang> honest. Screen readers use it to pick a voice, and
  // browsers use it to offer (or suppress) their own translation prompt —
  // leaving it as "en" on a French page makes both behave badly.
  //
  // Nested providers all write this and the outer one runs last; they agree
  // on the answer (the announcement channel), which is why one line can
  // safely be written twice.
  useEffect(() => {
    const meta = languageMeta(language);
    document.documentElement.lang = language;
    document.documentElement.dir = meta.dir;
  }, [language]);

  // ── The three ways to change it ──────────────────────────────────────────
  //
  // THE RULE: an explicit switch (the marketing header's switcher, the sales
  // invite picker, the rep's picker) lasts for THIS TAB'S browsing session
  // only — sessionStorage, never localStorage, never a cookie. A signed-in
  // person using it on a public page gets that language for the tab and keeps
  // their account preference untouched; Settings › Language is the only thing
  // that changes the account. Nothing a page does on its own — a booking page,
  // a prefilled form, an email-link landing — may call this: those call
  // setPageLanguage, which stores nothing. scripts/check-language-precedence.mjs
  // lists every caller allowed to.
  const changeLanguage = useCallback((code) => {
    if (!isSupported(code)) return;
    // Set here as well as through the store, so the click shows on a provider
    // that ignores the store — the nested account provider on an email-link
    // landing, whose own header carries the switcher.
    setLanguage(code);
    saveSessionLanguage(code);
  }, []);

  // This render of this page only: stored nowhere, dropped on navigation.
  const setPageLanguage = useCallback((code) => {
    setPage(isSupported(code) ? { code: String(code).toLowerCase(), path: pathRef.current } : null);
  }, []);

  // Settings › Language just saved the account's preference. Applied at once,
  // the page learns it as the account's, and this tab's earlier switch is
  // dropped — otherwise a pick made on the marketing site last hour would keep
  // overriding the setting the person has just saved, in this tab only, which
  // is the kind of "the setting doesn't work" nobody can reproduce.
  //
  // Re-announced from here as well, because nothing else would: the settings
  // route does not revalidate the layout, so until the page's router.refresh()
  // lands this provider's `initialLanguage` is still the OLD choice, and the
  // tours beside the shell would keep reading it.
  const applyAccountLanguage = useCallback(
    (code) => {
      if (!isSupported(code)) return;
      setLanguage(code);
      if (fromAccount) announceStatedLanguage(instance.current, code);
      noteAccountLanguage(code);
      saveSessionLanguage(null);
    },
    [fromAccount],
  );

  return (
    <LanguageContext.Provider
      value={{ language, changeLanguage, setPageLanguage, applyAccountLanguage }}
    >
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
