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

// Dark mode is OFF until the component layer supports it.
//
// The mechanism here works — toggling `.dark` flips every shadcn variable in
// globals.css. The problem is that almost nothing reads those variables:
// there are ~700 hardcoded `bg-white`, `text-gray-900` and `border-gray-200`
// classes across ~80 files, and a hardcoded colour ignores the theme entirely.
//
// The result was worse than having no dark mode: dark page background with
// dark text, white cards with white text, and an invisible mobile drawer.
//
// Flip this to true once components use semantic tokens (bg-background,
// bg-card, text-foreground, text-muted-foreground, border-border). Until
// then the provider stays mounted and useTheme() keeps working — it just
// never applies the class.
const DARK_MODE_ENABLED = false;

function systemPrefersDark() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );
}

function applyTheme(theme) {
  if (!DARK_MODE_ENABLED) {
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
