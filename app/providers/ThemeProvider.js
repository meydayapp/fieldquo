// app/providers/ThemeProvider.js
//
// Light/dark/system theme, implemented by toggling the `dark` class on <html>.
//
// That's the whole mechanism, because globals.css already declares
// `@custom-variant dark (&:is(.dark *))` and a full set of shadcn variables
// under `.dark`. Components keep using `bg-background` and
// `text-muted-foreground`; nothing needs a theme prop, and dark mode works in
// components nobody has touched.
//
// "system" is a real third option rather than a boolean, because a user who
// has their OS on auto-dark expects the app to follow it — and to keep
// following it when the sun goes down, not to freeze at whatever it was when
// they first loaded the page.
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const ThemeContext = createContext(null);

const STORAGE_KEY = "fieldquo-theme";

// Dark mode is ON.
//
// It was off because the mechanism worked but nothing read it: 3,069
// hardcoded `bg-white` / `text-gray-900` / `border-gray-200` classes across
// 122 files, and a hardcoded colour ignores the theme entirely. The result
// was worse than no dark mode — dark page, dark text, white cards with white
// text, an invisible mobile drawer.
//
// 2,576 of those are now semantic tokens across the authenticated app. What's
// deliberately NOT tokenised, and why it doesn't block this:
//
//   * Client-facing pages (/q, /portal, /refer, /book) are fixed light. A
//     homeowner opening a quote must not get a dark document because the
//     contractor who sent it runs a dark laptop. Those pages carry the
//     CONTRACTOR's branding, not the viewer's theme.
//   * The platform console keeps its near-black chrome in both themes; that's
//     its identity, not a missing token.
//   * Semantic colours (red danger, green success, amber warning) stay put —
//     they read correctly on either background.
const DARK_MODE_ENABLED = true;

function systemPrefersDark() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );
}

// Allow-list, mirroring the pre-paint script in app/layout.js (which has to
// duplicate this because it runs before any module loads).
//
// Only the authenticated surfaces are themeable. Everything else — marketing,
// and the quote/portal/booking pages the contractor's clients see — stays
// light. An allow-list means a page added tomorrow is light by default rather
// than accidentally themeable and half-converted, which is how dark mode
// broke here the first time.
function isThemeablePath(pathname) {
  return ["/app", "/platform"].some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function applyTheme(theme) {
  if (!DARK_MODE_ENABLED || !isThemeablePath(window.location.pathname)) {
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "light";
    return false;
  }

  const isDark = theme === "dark" || (theme === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", isDark);
  // Tells the browser which scrollbar and form-control colours to use, so
  // native UI doesn't stay light against a dark page.
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  return isDark;
}

export function ThemeProvider({ children }) {
  // Always "system" on first render so server and client markup match.
  // Reading localStorage during initial state is a hydration mismatch — the
  // server has no idea what's in the visitor's browser.
  const [theme, setThemeState] = useState("system");
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial =
      stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : "system";
    setThemeState(initial);
    setIsDark(applyTheme(initial));
  }, []);

  // Keep following the OS while on "system" — someone who leaves a tab open
  // through sunset should see it switch.
  useEffect(() => {
    if (theme !== "system" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setIsDark(applyTheme("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next) => {
    if (!["light", "dark", "system"].includes(next)) return;
    setThemeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    setIsDark(applyTheme(next));
  }, []);

  const toggleTheme = useCallback(() => {
    // Toggling from "system" resolves to the opposite of what's currently
    // showing, which is what someone hitting the button actually means.
    setTheme(isDark ? "light" : "dark");
  }, [isDark, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
