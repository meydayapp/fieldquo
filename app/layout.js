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
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
