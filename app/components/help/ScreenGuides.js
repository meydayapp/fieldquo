// app/components/help/ScreenGuides.js
//
// "The guide for every screen" — the block at the top of /app/help that
// links each sidebar row to its article on the public help centre
// (help.fieldquo.com, served at /help/* on this host too, so the link works
// before the DNS record exists).
//
// ── One list, not two ──────────────────────────────────────────────────────
//
// The rows are read from the SAME arrays the two sidebars render
// (AdminSidebar's NAV_GROUPS / BOTTOM_ITEMS, SettingsSidebar's GROUPS); each
// row carries `helpArticle`, the screen slug lib/help/tree.js maps to an
// article. Nothing here is a second list of screens — a row added to the
// sidebar without a helpArticle simply does not appear, and
// scripts/check-help-centre.mjs fails the build for it.
//
// The rows are NOT filtered by the reader's permissions, on purpose: a Crew
// member who wonders what "Payroll" is may read about it here, exactly as
// they could on the public site. Only the sidebar hides rows; a help index
// is not access control and must not pretend to be.
//
// Links open in a new tab: the reader is usually mid-task in the app.
"use client";

import { ExternalLink } from "lucide-react";
import { NAV_GROUPS, BOTTOM_ITEMS, HOME_ITEM, AI_ITEM } from "@/app/components/layout/AdminSidebar";
import { GROUPS as SETTINGS_GROUPS } from "@/app/components/layout/SettingsSidebar";
import { useTranslation } from "@/app/hooks/useTranslation";
import { articleForScreen } from "@/lib/help/tree";
import { helpPath } from "@/lib/help/urls";
import { isHelpChromeLang } from "@/lib/help/chrome";

function rowsOf(groups) {
  return groups.map((g) => ({ key: g.key, items: (g.items || []).filter((i) => i.helpArticle) }));
}

export default function ScreenGuides() {
  const { t, language } = useTranslation();
  const lang = isHelpChromeLang(language) ? language : "en";
  const groups = [
    { key: "app.nav.group.more", items: [HOME_ITEM, AI_ITEM] },
    ...rowsOf(NAV_GROUPS),
    { key: "app.nav.settings", items: BOTTOM_ITEMS.filter((i) => i.helpArticle) },
    ...rowsOf(SETTINGS_GROUPS),
  ];

  return (
    <section className="mb-8 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{t("app.help.screenGuides.title", "The guide for every screen")}</h2>
        <a
          href={helpPath(lang)}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {t("app.help.screenGuides.open", "Open the help centre")} <ExternalLink size={12} aria-hidden="true" />
        </a>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("app.help.screenGuides.intro", "Every row of the sidebar and of Settings has a step-by-step article on the help centre, with the real screen and what each control does.")}
      </p>
      <div className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {groups.map((g) => {
          const links = g.items
            .map((item) => ({ item, article: articleForScreen(item.helpArticle) }))
            .filter((x) => x.article);
          if (!links.length) return null;
          return (
            <div key={g.key}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t(g.key)}</p>
              <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {links.map(({ item, article }) => (
                  <li key={item.key + item.href}>
                    <a
                      href={helpPath(lang, article.category, article.slug)}
                      target="_blank"
                      rel="noopener"
                      className="text-sm text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground"
                    >
                      {t(item.key)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
