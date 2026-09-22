// app/components/layout/MoreMenu.js
//
// "More": the rows that are not one of the rail's seventeen, drawn as a
// grid of tiles — one tile per group, the group's rows inside it, one line
// of what the group is for. Jobber's Reports page is the pattern (a grid of
// titles with descriptions), not a second rail. Two readers:
//
//   /app/more (MoreGrid)   the desktop page the rail's More row opens
//   the phone (MoreSheet)  the bottom sheet the tab bar's More slot opens —
//                          search first, then the same tiles stacked, then
//                          the account rows, with the tab bar still visible
//                          underneath. It replaces opening the entire rail
//                          as a left drawer over the tab bar.
//
// Same rows, same three filters, same trade gate as the rail (useNavGroups
// in AdminSidebar.js): a row hidden from the rail is hidden here too, and a
// row here is hidden nowhere else.
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, X, FileText, Clock, Wallet, Users, Settings as SettingsIcon } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { HOME_ITEM, NAV_GROUPS, MORE_GROUPS, useNavGroups } from "@/app/components/layout/AdminSidebar";
import { TAB_ITEMS } from "@/app/components/layout/MobileTabBar";
import { useSettingsGroups } from "@/app/components/layout/SettingsSidebar";
import { useNavShell } from "@/app/components/layout/NavShell";
import { useRovingRows } from "@/app/components/layout/rovingRows";
import AccountMenu from "@/app/components/layout/AccountMenu";

// The phone sheet's first tile: the rail's rows that are NOT one of the
// five tabs under it — so the sheet is the phone's whole menu, and every
// destination is two taps from anywhere (More, then the row). Built from
// NAV_GROUPS at module level, filtered at render through the same pipeline.
const TAB_HREFS = new Set(TAB_ITEMS.map((i) => i.href));
const PHONE_MENU_GROUPS = [
  {
    key: "app.nav.mainMenu",
    items: [HOME_ITEM, ...NAV_GROUPS.flatMap((g) => g.items)].filter((i) => !TAB_HREFS.has(i.href)),
  },
];

/** Each More group's icon and its one-line description key. */
export const MORE_GROUP_META = {
  "app.nav.group.moreWork": { icon: FileText, hint: "app.nav.groupHint.moreWork" },
  "app.nav.group.moreCrew": { icon: Clock, hint: "app.nav.groupHint.moreCrew" },
  "app.nav.group.moreMoney": { icon: Wallet, hint: "app.nav.groupHint.moreMoney" },
  "app.nav.group.morePartners": { icon: Users, hint: "app.nav.groupHint.morePartners" },
};

/** Mirrors AdminSidebar's isActive: /app is exact, everything else a prefix. */
function isActive(pathname, href) {
  return href === "/app" ? pathname === "/app" : pathname.startsWith(href);
}

/**
 * The tiles. `columns` is the desktop grid; the phone sheet passes 1.
 * @param onNavigate  closes the sheet on a phone
 */
export function MoreGrid({ onNavigate, columns = 2 }) {
  const { t } = useTranslation();
  const groups = useNavGroups(MORE_GROUPS);
  const onRowsKeyDown = useRovingRows();
  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground px-1">{t("app.more.empty")}</p>;
  }
  return (
    <div
      className={`grid gap-3 ${columns === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"}`}
      onKeyDown={onRowsKeyDown}
      data-more-grid
    >
      {groups.map((group) => (
        <Tile key={group.key} group={group} meta={MORE_GROUP_META[group.key]} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

/** One titled card of rows — a More group, the phone's menu tile, a settings group. */
function Tile({ group, meta = {}, onNavigate, compact = false }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const Icon = meta.icon || FileText;
  return (
    // The mockup's tile (`.mk-s .tile`): a 34px icon box, a 13px title, the
    // hint under it, and the rows as ONE wrapped line of 12px links rather
    // than a stacked list of icon buttons — eight tiles fit a screen that way.
    <section className="rounded-[10px] border border-border bg-card p-3 flex gap-2.5 items-start min-w-0" aria-labelledby={`more-${group.key}`}>
      {!compact && (
        <span className="w-[34px] h-[34px] rounded-lg bg-muted text-inverted flex items-center justify-center shrink-0">
          <Icon size={16} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h2 id={`more-${group.key}`} className={`font-semibold ${compact ? "text-[10px] uppercase tracking-[0.12em] text-muted-foreground" : "text-[13px] text-foreground"}`}>
          {t(group.key)}
        </h2>
        {meta.hint && <p className="text-xs text-muted-foreground">{t(meta.hint)}</p>}
        <ul className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-1">
          {group.items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  data-nav-row
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center min-h-[28px] rounded-full px-2 text-xs ${
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                      : "text-muted-foreground hover:bg-sidebar-panel-accent hover:text-foreground"
                  }`}
                >
                  {t(item.key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/**
 * The phone sheet's own tiles: the rail rows that are not tabs (first, so
 * Home, Calendar, Clients, the AI rows are two taps from anywhere), and the
 * settings groups (last, compact — the same rows the index draws, so a
 * settings page is two taps on a phone too, not three via the index).
 */
function PhoneMenuTiles({ onNavigate }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const menu = useNavGroups(PHONE_MENU_GROUPS);
  const more = useNavGroups(MORE_GROUPS);
  const settings = useSettingsGroups();
  // The mockup's sheet (s3 `.sheet .srow` / `.sg`): a 10px heading, then
  // ROWS — the rail rows that are not tabs one per row, and each More group
  // as one row whose caption lists its pages. Every page stays a tap away:
  // the caption's words are the links, so two taps reach everything the
  // desktop More page reaches (check-shell walks this).
  const heading = (label) => (
    <p className="px-1.5 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
  );
  const rowCls = "flex items-center gap-2.5 px-1.5 py-2 border-b border-border text-[13px] text-foreground";
  return (
    <div data-phone-menu>
      {menu.map((group) => (
        <section key={group.key} aria-label={t(group.key)}>
          {heading(t(group.key))}
          {group.items.map((item) => {
            const RowIcon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link key={item.href} href={item.href} onClick={onNavigate} data-nav-row aria-current={active ? "page" : undefined} className={`${rowCls} ${active ? "font-semibold" : ""}`}>
                <RowIcon size={16} className="shrink-0 text-muted-foreground" />
                <span className="truncate">{t(item.key)}</span>
              </Link>
            );
          })}
        </section>
      ))}
      {more.length > 0 && heading(t("app.more.everythingElse", "Everything else"))}
      {more.map((group) => {
        const meta = MORE_GROUP_META[group.key] || {};
        const Icon = meta.icon || FileText;
        return (
          <div key={group.key} className={`${rowCls} items-start`} data-more-row>
            <Icon size={16} className="shrink-0 mt-0.5 text-muted-foreground" />
            <span className="shrink-0 font-medium">{t(group.key)}</span>
            <span className="min-w-0 ml-auto text-right text-[11px] leading-5 text-muted-foreground">
              {group.items.map((item, i) => (
                <span key={item.href}>
                  {i > 0 ? " · " : ""}
                  <Link href={item.href} onClick={onNavigate} data-nav-row className="hover:text-foreground hover:underline underline-offset-2 inline-block min-h-[20px]">
                    {t(item.key)}
                  </Link>
                </span>
              ))}
            </span>
          </div>
        );
      })}
      {settings.length > 0 && heading(t("app.settings.title"))}
      {settings.map((group, i) => (
        // One row per settings group, every page of it in the caption — a
        // settings page stays two taps away on a phone (More, then the word).
        <div key={group.key} className={`${rowCls} items-start ${i === settings.length - 1 ? "border-b-0" : ""}`} data-settings-row>
          <SettingsIcon size={16} className="shrink-0 mt-0.5 text-muted-foreground" />
          <span className="shrink-0 font-medium">{t(group.key)}</span>
          <span className="min-w-0 ml-auto text-right text-[11px] leading-5 text-muted-foreground">
            {group.items.map((item, j) => (
              <span key={item.href}>
                {j > 0 ? " · " : ""}
                <Link href={item.href} onClick={onNavigate} data-nav-row className="hover:text-foreground hover:underline underline-offset-2 inline-block min-h-[20px]">
                  {t(item.key)}
                </Link>
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

/** The phone's bottom sheet. Below `lg` only; the tab bar stays visible under it. */
export function MoreSheet() {
  const { t } = useTranslation();
  const shell = useNavShell();
  const open = shell.isOpen("more");

  // Escape closes; the body stops scrolling under the sheet so it does not
  // appear to jump under a finger.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && shell.close();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, shell]);

  if (!open) return null;
  return (
    <div className="lg:hidden fixed inset-0 z-50" data-more-sheet>
      <div className="absolute inset-0 bg-black/40" onClick={shell.close} />
      <div
        role="dialog"
        aria-label={t("app.nav.more")}
        // Leaves the tab bar's row visible under it: the sheet's bottom edge
        // is the tab bar's top edge, so "More" stays lit and tappable.
        className="absolute inset-x-0 top-[72px] bg-card rounded-t-2xl shadow-[0_-8px_40px_rgba(0,0,0,0.18)] flex flex-col"
        style={{ bottom: "var(--fq-tab-bar-height)" }}
      >
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-muted-foreground/25 shrink-0" />
        <div className="flex items-center gap-2 px-3 py-2 shrink-0">
          <button
            type="button"
            onClick={() => shell.open("search")}
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-sm text-muted-foreground"
          >
            <Search size={14} className="shrink-0" />
            <span className="truncate">{t("app.search.placeholderShort")}</span>
          </button>
          <button type="button" onClick={shell.close} aria-label={t("app.sidebar.closeMenu")} className="p-2 text-muted-foreground">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pb-3 space-y-3">
          <PhoneMenuTiles onNavigate={shell.close} />
          <section className="rounded-xl border border-border bg-card p-2" aria-label={t("app.nav.group.account")}>
            <AccountMenu onNavigate={shell.close} tone="sheet" />
          </section>
        </div>
      </div>
    </div>
  );
}
