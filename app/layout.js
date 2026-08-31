// app/layout.js
import { Geist, Geist_Mono } from "next/font/google";
import { LanguageProvider } from "@/app/providers/LanguageProvider";
import { ThemeProvider } from "@/app/providers/ThemeProvider";
import "./globals.css";

// Pre-paint theme script.
//
// Runs before first paint. Applying the class after React hydrates produces a
// white flash on every load for dark-mode users — brief, but on every single
// navigation, which is exactly the kind of thing that makes an app feel cheap.
// Inlined rather than an external file because a round trip before paint
// defeats the purpose.
//
// The path check is the important part, and it's an ALLOW-list rather than a
// block-list on purpose.
//
// Only /app and /platform are themeable — the surfaces staff stare at all day,
// and the only ones whose components were converted to semantic tokens.
// Everything else stays light: the marketing site (brand-fixed, and its
// components still use literal colours), and — more importantly — the pages
// the contractor's CLIENTS see. A homeowner opening a quote link has no
// relationship with FieldQuo and no theme preference here; a quote that
// arrives dark because the contractor's laptop was dark is a document that
// looks wrong.
//
// Written as an allow-list so that a page added tomorrow is light by default
// rather than accidentally themeable and half-converted. That is exactly how
// this broke the first time.
const NO_FLASH = `
(function () {
  try {
    var p = window.location.pathname;
    var themeable =
      p === "/app" || p.indexOf("/app/") === 0 ||
      p === "/platform" || p.indexOf("/platform/") === 0;

    if (!themeable) {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = "light";
      return;
    }

    var stored = localStorage.getItem("fieldquo-theme");
    var dark =
      stored === "dark" ||
      ((stored === "system" || !stored) &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {}
})();
`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "FieldQuo",
  description: "The all-in-one system for contractors and service pros",
  // Apple-specific install behaviour. Next 16 resolves these into real <meta>
  // tags — no raw tags needed — but note what it actually emits differs from
  // older Next versions: `capable` produces only the modern unprefixed
  // `mobile-web-app-capable` tag now, not the legacy `apple-mobile-web-app-
  // capable` one. iOS has honoured the unprefixed tag since 16.4; there is no
  // framework option left to also emit the legacy one.
  //
  // `title` is deliberately NOT set here. It would become `apple-mobile-web-
  // app-title`, which — like the manifest's `name` (see app/manifest.js) —
  // is a single value for the whole origin: Next merges unset metadata
  // fields down from the root layout, so whatever this says would still
  // reach a homeowner's iOS "Add to Home Screen" sheet on a contractor's own
  // subdomain, pre-filled with "FieldQuo". Unlike the manifest, there's no
  // cheap per-host fix available from this file: metadata/viewport is part
  // of the page render tree, so reading the request's Host header here
  // (the same trick app/manifest.js uses) would force the ENTIRE app into
  // dynamic rendering, not just one small route — a real performance cost
  // this task doesn't have standing to spend. The actual fix is a nested
  // metadata export in app/app/layout.js overriding `title` back to
  // "FieldQuo" for the back office specifically, which is out of scope here
  // (app/app/** is another agent's file). Until that lands, the installed
  // icon's suggested name falls back to each page's own <title> — which for
  // /site/*, /quote/*, /book/* etc. is already the contractor's own business
  // name (see the generateMetadata in app/site/[subdomain]/page.js), so the
  // omission is safe, not just silent.
  appleWebApp: {
    capable: true,
    // "default" (opaque, non-overlapping bar) rather than "black-
    // translucent": translucent draws page content under the status bar and
    // requires every top-of-screen surface to pad for
    // env(safe-area-inset-top) itself. Nothing in this codebase does that
    // yet (grepped for "safe-area" — no hits), so translucent would tuck
    // real content under the notch/status bar the first time this is
    // installed. Revisit once a top bar exists that accounts for the inset.
    statusBarStyle: "default",
  },
};

// No `viewport` export existed anywhere in the repo before this one — Next
// was injecting its bare default (`width=device-width, initial-scale=1`).
// `viewportFit: "cover"` is the one load-bearing addition: it's what turns
// on `env(safe-area-inset-*)`, which a parallel agent's bottom tab bar needs
// to clear the iPhone home indicator. Without it those env() values are
// always 0 and the bar sits under the indicator.
//
// Deliberately NOT setting `maximumScale` or `userScalable: false`. The
// owner's zoom/pan complaint traces to 14px form controls forcing an iOS
// auto-zoom, which other agents are fixing at the source (font-size >=16px
// on inputs) — locking zoom would paper over that by taking pinch-zoom away
// from anyone who needs to enlarge text, and current iOS Safari ignores the
// property anyway. Do not add either back without checking whether the
// input-size fix has actually landed.
//
// themeColor uses the real light/dark `--background` tokens from
// globals.css (#f6f8fb / #0a1220), not an invented brand hex, and not
// `--sidebar`/`--primary` navy — the status bar should blend with the
// colour actually at the top edge of the page, which for the overwhelming
// majority of routes (marketing, quotes, invoices, the tenant sites under
// /site) is the plain background, not the app shell's navy chrome that only
// /app and /platform render.
//
// The pair is a considered tradeoff, not a full fix: NO_FLASH (above) forces
// every non-/app, non-/platform route to light regardless of the visitor's
// OS setting, but `theme-color`'s `media` attribute matches the OS setting
// directly and can't see that override. A homeowner on a client-facing page
// with system dark mode gets a dark status bar over a light page — a
// one-line colour seam at the very top of the screen, not the "document
// renders with the wrong content" failure NO_FLASH exists to prevent (its
// comment is about full pages flashing or rendering illegibly, not about
// chrome-vs-content shade matching, which most sites accept as normal).
// Removing the dark branch entirely would trade that minor seam for /app and
// /platform never getting a correct dark status bar at all, which is the
// worse tradeoff given those are the only themeable surfaces. A route-scoped
// fix (reading the request in a nested viewport export) belongs in
// app/app/layout.js, which is out of scope for this change.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1220" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The NO_FLASH script sets the `dark` class and style.colorScheme on
      // <html> BEFORE React hydrates — that's the whole point of it, to avoid a
      // light-then-dark flash. The LanguageProvider also rewrites lang/dir on
      // mount. Both make the hydrated <html> differ from the server's, which
      // React would otherwise warn about on every page. Suppression is scoped to
      // this one element's attributes (not its children), so it silences the
      // intended script mutation without hiding real mismatches anywhere else.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <LanguageProvider>{children}</LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
