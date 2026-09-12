// app/components/help-centre/HelpChromeControls.js
//
// The three client-side controls in the help centre's header and footer:
//
//   HelpLanguageMenu — a native <select>: picking a language navigates to
//                      the SAME page in that language (the article keeps).
//                      Native on purpose: it works with a thumb, a screen
//                      reader and a keyboard without a line of menu code.
//   HelpThemeToggle  — light / dark / system through the app's ThemeProvider.
//                      /help is on the themeable allow-list (see
//                      app/providers/ThemeProvider.js); this is the switch.
//   HelpContactLink  — "Contact support": the in-app Help page for somebody
//                      who is signed in, the public contact form otherwise.
//                      The session is only visible on the www host (the
//                      cookie is not shared with help.fieldquo.com), so on
//                      the help host this honestly resolves to the public
//                      form.
"use client";

import { usePathname, useRouter } from "next/navigation";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/app/providers/ThemeProvider";
import { useSession } from "@/lib/auth-client";
import { MARKETING_ORIGIN } from "@/lib/help/urls";

/**
 * The same page in another language. Read from the pathname rather than
 * passed down, because the pathname differs by host — /help/en/… on
 * www.fieldquo.com, /en/… on help.fieldquo.com (middleware rewrite) — and
 * the language segment is the one after the optional /help prefix either way.
 */
export function swapLang(pathname, lang) {
  const parts = String(pathname || "/").split("/");
  // ["", "help", "en", ...] or ["", "en", ...]
  const i = parts[1] === "help" ? 2 : 1;
  if (!parts[i]) return `${parts[1] === "help" ? "/help" : ""}/${lang}`;
  parts[i] = lang;
  return parts.join("/") || "/";
}

export function HelpLanguageMenu({ lang, options, label }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <span className="sr-only">{label}</span>
      <select
        value={lang}
        aria-label={label}
        onChange={(e) => router.push(swapLang(pathname, e.target.value))}
        className="min-h-[40px] rounded-full border border-border bg-card px-3 text-sm font-medium text-foreground"
      >
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}

const THEMES = [
  ["light", Sun],
  ["dark", Moon],
  ["system", Monitor],
];

export function HelpThemeToggle({ label }) {
  const { theme, setTheme } = useTheme();
  return (
    <div className="inline-flex rounded-full border border-border bg-card p-0.5" role="group" aria-label={label}>
      {THEMES.map(([value, Icon]) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-pressed={theme === value}
          aria-label={`${label}: ${value}`}
          className={`rounded-full p-2 transition-colors ${
            theme === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}

export function HelpContactLink({ label, className = "" }) {
  const { data: session, isPending } = useSession();
  const signedIn = !isPending && Boolean(session?.user);
  const href = signedIn ? `${MARKETING_ORIGIN}/app/help` : `${MARKETING_ORIGIN}/contact`;
  return (
    <a href={href} className={className}>
      {label}
    </a>
  );
}
