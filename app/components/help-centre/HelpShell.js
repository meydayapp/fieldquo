// app/components/help-centre/HelpShell.js
//
// The frame around every help-centre page: header, footer, and the
// mobile-first column in between. Server component; the interactive bits are
// the three small client controls in HelpChromeControls.js.
//
// ── Why not MarketingHeader / MarketingFooter ──────────────────────────────
//
// Two reasons, both about the host. The marketing components link with
// relative hrefs (/pricing, /product/quoting) that on help.fieldquo.com would
// be rewritten into /help/pricing and 404; and they read the visitor's
// language from the LanguageProvider (localStorage), whereas here the
// language is the URL — a French article must keep a French frame whatever
// the browser last chose on fieldquo.com. So this frame borrows the
// marketing site's LOOK — the same tokens, the same header height and
// border, the same navy footer — and none of its routing.
import Link from "next/link";
import Logo from "@/app/components/Logo";
import { HELP_CATEGORIES } from "@/lib/help/tree";
import { helpPath, MARKETING_ORIGIN } from "@/lib/help/urls";
import { HELP_CHROME_LANGS } from "@/lib/help/chrome";
import { LANGUAGES } from "@/app/i18n/languages";
import HelpSearch from "./HelpSearch";
import { HelpContactLink, HelpLanguageMenu, HelpThemeToggle } from "./HelpChromeControls";
import HelpHostLinks from "./HelpHostLinks";

// Languages the picker offers: those with chrome, in the app's own order,
// with the native name the app's own switcher uses.
const OPTIONS = HELP_CHROME_LANGS.map((code) => {
  const l = LANGUAGES.find((x) => x.code === code);
  return { code, nativeName: l?.nativeName || (code === "zh" ? "中文" : code) };
});

export function categoryLabels(t) {
  return Object.fromEntries(HELP_CATEGORIES.map((c) => [c.key, t(`category.${c.key}`)]));
}

export default function HelpShell({ lang, t, children, showSearch = true }) {
  const labels = categoryLabels(t);
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <HelpHostLinks />
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          {/* The navy wordmark vanishes on the dark header; the composed
              icon + live-text mark takes over there (Logo's onDark). Two
              marks, one visible at a time — the server does not know the
              theme, CSS does. */}
          <span className="dark:hidden inline-flex shrink-0"><Logo variant="horizontal" href={MARKETING_ORIGIN} height={28} /></span>
          <span className="hidden dark:inline-flex shrink-0"><Logo variant="horizontal" href={MARKETING_ORIGIN} height={28} onDark /></span>
          <Link
            href={helpPath(lang)}
            className="hidden sm:inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            {t("nav.home")}
          </Link>
          {showSearch && (
            <div className="ml-auto hidden md:block w-72 lg:w-96">
              <HelpSearch
                lang={lang}
                compact
                placeholder={t("search.placeholder")}
                label={t("search.label")}
                noneLabel={t("search.none")}
                countLabel={t("search.count")}
                categoryLabels={labels}
              />
            </div>
          )}
          <div className={`flex items-center gap-2 ${showSearch ? "md:ml-0 ml-auto" : "ml-auto"}`}>
            <HelpLanguageMenu lang={lang} options={OPTIONS} label={t("nav.language")} />
            <span className="hidden sm:inline-flex">
              <HelpThemeToggle label={t("nav.theme")} />
            </span>
            <a
              href={`${MARKETING_ORIGIN}/login`}
              className="hidden sm:inline-flex min-h-[40px] items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              {t("nav.openApp")}
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-16 bg-primary text-primary-foreground/80">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <span className="text-xl font-bold text-white tracking-tight">FieldQuo</span>
              <p className="mt-2 text-sm leading-relaxed">{t("tagline")}</p>
            </div>
            <div>
              <h4 className="mb-3 text-sm font-semibold text-white">{t("home.browse")}</h4>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {HELP_CATEGORIES.map((c) => (
                  <li key={c.key}>
                    <Link href={helpPath(lang, c.key)} className="text-sm hover:text-white">
                      {labels[c.key]}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-3 text-sm font-semibold text-white">{t("nav.contact")}</h4>
              <ul className="space-y-1.5">
                <li>
                  <HelpContactLink label={t("nav.contact")} className="text-sm hover:text-white" />
                </li>
                <li>
                  <a href={MARKETING_ORIGIN} className="text-sm hover:text-white">{t("footer.website")}</a>
                </li>
                <li>
                  <a href={`${MARKETING_ORIGIN}/pricing`} className="text-sm hover:text-white">{t("footer.pricing")}</a>
                </li>
                <li>
                  <a href={`${MARKETING_ORIGIN}/login`} className="text-sm hover:text-white">{t("nav.signIn")}</a>
                </li>
              </ul>
              <div className="mt-4 sm:hidden">
                <HelpThemeToggle label={t("nav.theme")} />
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-col gap-3 border-t border-white/15 pt-6 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} FieldQuo. {t("footer.rights")}</p>
            <div className="flex gap-5">
              <a href={`${MARKETING_ORIGIN}/privacy`} className="hover:text-white">{t("footer.privacy")}</a>
              <a href={`${MARKETING_ORIGIN}/terms`} className="hover:text-white">{t("footer.terms")}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
