// app/app/more/page.js
//
// "More": the destinations that are not one of the rail's seventeen rows,
// as a grid of tiles — one per group, the rows inside, a line of what the
// group is for (MoreMenu.js's MoreGrid, which the phone's sheet also draws).
// A page and not a flyout because a flyout with twenty-three rows is the
// rail again; a page with four titled cards can be scanned by shape.
//
// Nothing here was removed from the product. The rows are exactly the rows
// the rail carried before 2026-09-21, minus the seventeen it kept —
// scripts/check-shell.mjs walks both lists and fails if any old destination
// is missing from the union.
"use client";

import { Search } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { MoreGrid } from "@/app/components/layout/MoreMenu";
import { useNavShell } from "@/app/components/layout/NavShell";

export default function MorePage() {
  const { t } = useTranslation();
  const shell = useNavShell();
  return (
    <div className="p-4 sm:p-6 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {t("app.more.kicker")}
          </p>
          <h1 className="text-2xl font-bold text-foreground">{t("app.nav.more")}</h1>
        </div>
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
      <MoreGrid />
    </div>
  );
}
