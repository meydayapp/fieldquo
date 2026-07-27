// app/layout.js
import { Geist, Geist_Mono } from "next/font/google";
import { LanguageProvider } from "@/app/providers/LanguageProvider";
import { ThemeProvider } from "@/app/providers/ThemeProvider";
import "./globals.css";

// Runs before first paint, so the page never renders light and then snaps to
// dark. Without this there's a visible white flash on every load for dark-mode
// users — the class can only be applied after React hydrates, which is far too
// late. Inlined deliberately: an external script would be another round trip
// before paint, defeating the point.
const NO_FLASH = `
(function () {
  try {
    var stored = localStorage.getItem("fieldquo-theme");
    var isDark =
      stored === "dark" ||
      ((!stored || stored === "system") &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (isDark) {
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
    }
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
