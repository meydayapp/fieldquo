// app/components/settings/AutoTranslateBanner.js
//
// "Translated automatically into 7 languages — Review", after a save that
// queued drafts (lib/i18n/autoTranslate.js). Mounted by every settings
// screen whose save route answers an `autoTranslate` summary: Company
// (terms, what happens next), Presentation (story), Client messages (SMS),
// Products & Services.
//
// ── It says what is there, not what was queued ──────────────────────────────
//
// The save answers before the drafts exist. Showing "translated" off the
// summary alone would be the control that appears to work and doesn't when
// a draft fails. So the banner renders the queued sentence, then asks the
// status route a few seconds later and rewrites itself from the truth:
// "7 of 7 ready", or "5 of 7 ready · 2 still pending" — and links to the
// review page either way. No key on the deployment: one honest sentence,
// no link that opens an empty page.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Languages, Loader2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

/** How long after the save before the first status read. */
const FIRST_POLL_MS = 4000;
const POLL_MS = 5000;
const MAX_POLLS = 6;

function statusUrl(result) {
  const params = new URLSearchParams({ summary: "1" });
  if (result.model === "company") {
    params.set("keys", (result.keys || []).join(","));
  } else {
    params.set("model", result.model);
    params.set("id", result.id || "");
  }
  return `/api/settings/translations/company?${params}`;
}

/**
 * @param result  the `autoTranslate` object a save route answered, or null
 * @param id      for the JSON models (a product, a text block) — the row id
 */
export default function AutoTranslateBanner({ result, id = null, className = "" }) {
  const { t } = useTranslation();
  const [state, setState] = useState(null);

  useEffect(() => {
    setState(null);
    if (!result?.queued) return undefined;
    let polls = 0;
    let timer;
    let cancelled = false;
    const tick = async () => {
      polls++;
      try {
        const res = await fetch(statusUrl({ ...result, id: id || result.id }));
        const d = res.ok ? await res.json().catch(() => null) : null;
        if (cancelled) return;
        if (d?.keys) {
          const cells = Object.values(d.keys).flatMap((byLang) => Object.values(byLang));
          const total = cells.length;
          const ready = cells.filter((s) => s === "drafted" || s === "reviewed").length;
          const pending = cells.filter((s) => s === "pending").length;
          setState({ total, ready, pending, settled: ready + pending >= total });
          if (ready + pending >= total || polls >= MAX_POLLS) return;
        } else if (polls >= MAX_POLLS) {
          return;
        }
      } catch {
        if (polls >= MAX_POLLS) return;
      }
      timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, FIRST_POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [result, id]);

  if (!result) return null;

  if (!result.queued) {
    return (
      <div className={`flex items-start gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground ${className}`}>
        <Languages size={16} className="shrink-0 mt-0.5" />
        <span>{t("app.autoTranslate.unavailable", "Automatic translation isn't switched on for this deployment. Clients in other languages will see this text as you wrote it.")}</span>
      </div>
    );
  }

  const count = result.languages?.length || 0;
  const perKey = result.model === "company" ? (result.keys?.length || 1) : 1;
  const ready = state ? Math.floor(state.ready / perKey) : null;
  const pending = state ? Math.ceil(state.pending / perKey) : 0;

  return (
    <div
      role="status"
      data-auto-translate-banner
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200 ${className}`}
    >
      <Languages size={16} className="shrink-0" />
      <span className="font-medium">
        {t("app.autoTranslate.banner", "Translated automatically into {count} languages.", { count })}
      </span>
      {state ? (
        <span className="text-emerald-800 dark:text-emerald-300">
          {t("app.autoTranslate.progress", "{done} of {count} ready", { done: ready, count })}
          {pending > 0 && ` · ${t("app.autoTranslate.pending", "{count} still pending", { count: pending })}`}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-emerald-800 dark:text-emerald-300">
          <Loader2 size={12} className="animate-spin" /> {t("app.autoTranslate.drafting", "Drafting…")}
        </span>
      )}
      <Link href="/app/settings/translations" className="font-semibold underline underline-offset-2">
        {t("app.autoTranslate.review", "Review")}
      </Link>
    </div>
  );
}
