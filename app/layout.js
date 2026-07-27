// app/layout.js
import { Geist, Geist_Mono } from "next/font/google";
import { LanguageProvider } from "@/app/providers/LanguageProvider";
import { ThemeProvider } from "@/app/providers/ThemeProvider";
import "./globals.css";

// Pre-paint theme script, currently disabled.
//
// When dark mode is enabled (see DARK_MODE_ENABLED in ThemeProvider), this
// has to run before first paint — applying the class after React hydrates
// produces a white flash on every load for dark-mode users. It's inlined
// rather than an external file because a round trip before paint defeats the
// purpose.
//
// It's a no-op today because ~700 hardcoded colour classes across the app
// ignore the theme, so applying `.dark` breaks more than it fixes. Restore
// the body of this function at the same time you flip DARK_MODE_ENABLED.
const NO_FLASH = `
(function () {
  try {
    document.documentElement.classList.remove("dark");
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
