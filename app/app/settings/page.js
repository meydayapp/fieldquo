// app/app/settings/page.js
//
// The settings index. This used to `redirect("/app/settings/company")`, so
// the first thing a new owner saw was one company form beside a 42-row
// list. Now: a search box first, then eight cards — one per group — each
// with a one-line description and its rows as links. Jobber's Reports page
// is the pattern (a grid of titles with descriptions), not its settings
// sidebar. Every setting is two clicks from here and one from search.
//
// Same rows, same three filters, same trade gate as the rail's slide panel
// (useSettingsGroups): a card whose rows are all hidden is not drawn, and a
// trade-gated row (Cabinet rates, Material costs) appears only for the
// company that sells the thing it prices. Five of the rows are also rail or
// More rows (SETTINGS_ROWS_ALSO_IN_NAV) — same page, same URL, drawn here
// as links like any other.
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { NavFilter, NavEmptyState } from "@/app/components/layout/NavFilter";
import { visibleGroups } from "@/app/components/layout/navDisclosure";
import { GROUP_META, useSettingsGroups } from "@/app/components/layout/SettingsSidebar";
import { useNavShell } from "@/app/components/layout/NavShell";
import { useRovingRows } from "@/app/components/layout/rovingRows";
import { SETTINGS_ROW_TRADE_GATE } from "@/lib/settings/tradeGateNav";

export default function SettingsIndexPage() {
  const { t } = useTranslation();
  const shell = useNavShell();
  const groups = useSettingsGroups();
  const [query, setQuery] = useState("");
  const label = (key) => t(key);
  const filtered = useMemo(
    () => visibleGroups({ groups, query, label }),
    // `label` reads only `t`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, query, t],
  );
  const onRowsKeyDown = useRovingRows();

  return (
    <div className="p-4 sm:p-6 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {t("app.settings.title")}
          </p>
          <h1 className="text-2xl font-bold text-foreground">{t("app.settings.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("app.settings.indexHint")}</p>
        </div>
        {/* Records too — the global palette. The box below only filters
            these cards, and says so with its placeholder. */}
        <button
          type="button"
          onClick={() => shell.open("search")}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <Search size={14} />
          {t("app.search.placeholderShort")}
          <kbd className="text-[11px] font-mono border border-border rounded px-1.5">/</kbd>
        </button>
      </div>

      <div className="max-w-xl mb-5">
        <NavFilter value={query} onChange={setQuery} placeholder={t("app.settings.searchExample")} tone="panel" />
      </div>

      {filtered.length === 0 ? (
        <NavEmptyState
          tone="panel"
          message={t("app.nav.noMatches", { query })}
          clearLabel={t("app.action.clear")}
          onClear={() => setQuery("")}
        />
      ) : (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3" onKeyDown={onRowsKeyDown} data-settings-index>
          {filtered.map((group) => {
            const meta = GROUP_META[group.key] || {};
            const Icon = meta.icon;
            // A card whose every row is decided by the trade gate is a trade
            // card; the dashed border says "you see this because of what you
            // sell", the way the mockup marked it.
            const tradeCard = group.items.every((i) => i.key in SETTINGS_ROW_TRADE_GATE);
            return (
              <section
                key={group.key}
                aria-labelledby={`settings-${group.key}`}
                // The mockup's tile (`.mk-s .tile`, s2): a 34px icon box,
                // 13px title, the hint, then the rows as one wrapped line of
                // 12px links. A trade-gated row keeps its dashed outline.
                className={`rounded-[10px] border bg-card p-3 flex gap-2.5 items-start min-w-0 ${tradeCard ? "border-dashed border-sidebar-primary" : "border-border"}`}
              >
                {Icon && (
                  <span className="w-[34px] h-[34px] rounded-lg bg-muted text-inverted flex items-center justify-center shrink-0">
                    <Icon size={16} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <h2 id={`settings-${group.key}`} className="text-[13px] font-semibold text-foreground">
                    {t(group.key)}
                  </h2>
                  {meta.hint && <p className="text-xs text-muted-foreground">{t(meta.hint)}</p>}
                  <ul className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-1">
                    {group.items.map((item) => {
                      const gated = item.key in SETTINGS_ROW_TRADE_GATE;
                      return (
                        <li key={item.href} className="min-w-0">
                          <Link
                            href={item.href}
                            data-nav-row
                            className={`inline-flex items-center min-h-[28px] rounded-full px-2 text-xs text-muted-foreground hover:bg-sidebar-panel-accent hover:text-foreground ${
                              gated ? "border border-dashed border-sidebar-primary/60" : ""
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
          })}
        </div>
      )}
    </div>
  );
}
