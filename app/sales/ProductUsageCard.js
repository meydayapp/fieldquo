// app/sales/ProductUsageCard.js
//
// "What contractors use most" — the ten /app features contractors open most,
// over the last 30 days, in the rep's own language.
//
// ══ Why a rep gets this at all ════════════════════════════════════════════
//
// A rep on the phone is asked "what do people actually use it for?", and the
// honest answer is a count, not a pitch. This card is that count: the
// sidebar labels the contractor sees (app.nav.* / app.settings.*, so the rep
// says the same word the screen shows), the one-line summary the pricing page
// makes for the same feature (feature.<key>.summary), and how many companies
// opened it.
//
// ══ The gate is the route's; the card only reports it ═════════════════════
//
// /api/sales/product-usage returns `eligible: false` with the running count
// below the owner's 150-view threshold. The card then says so — "Not enough
// usage yet — appears at 150 views (62 so far)" — rather than rendering
// nothing, because a card that is sometimes blank reads as broken. Nothing
// about marketing, help or client pages ever reaches this component; the
// route filters to /app before ranking.
//
// Every string through t(), nine languages (app.salesUsage.*).
"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";

const CARD = "rounded-xl border border-border bg-card p-4 space-y-3";
const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";

export default function ProductUsageCard({ compact = false }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchJson("/api/sales/product-usage"));
    } catch (err) {
      setData(null);
      setError(err?.message || t("app.salesUsage.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const max = data?.items?.length ? Math.max(...data.items.map((i) => i.views)) : 0;

  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">{t("app.salesUsage.title")}</h2>
        {data ? <span className="text-xs text-muted-foreground">{t("app.salesUsage.lastDays", { days: data.days })}</span> : null}
      </div>
      {!compact ? <p className="text-sm text-muted-foreground">{t("app.salesUsage.intro")}</p> : null}

      {error ? (
        <div className="flex items-start gap-2 text-sm">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
          <div className="min-w-0 space-y-2">
            <p className="text-foreground break-words">{error}</p>
            <button type="button" onClick={load} className={`${BTN} border border-border text-foreground`}>
              <RefreshCw size={15} /> {t("app.salesUsage.tryAgain")}
            </button>
          </div>
        </div>
      ) : loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> {t("app.salesUsage.loading")}
        </p>
      ) : !data.eligible ? (
        <p className="text-sm text-muted-foreground">
          {t("app.salesUsage.notEnough", { threshold: data.threshold, count: data.totalViews })}
        </p>
      ) : (
        <ol className="space-y-2">
          {data.items.map((it) => (
            <li key={it.navKey} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-foreground font-medium min-w-0 truncate">
                  <span className="text-muted-foreground tabular-nums mr-2">{it.rank}.</span>
                  {t(it.navKey)}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                  {t("app.salesUsage.companies", { count: it.companies })}
                </span>
              </div>
              <div className="h-1.5 rounded bg-muted overflow-hidden" aria-hidden="true">
                <div className="h-full bg-primary/70" style={{ width: `${max ? Math.max(3, Math.round((it.views / max) * 100)) : 0}%` }} />
              </div>
              {(it.summaryKey || it.registryBlurb) ? (
                <p className="text-xs text-muted-foreground">
                  {it.summaryKey ? t(it.summaryKey, it.registryBlurb || undefined) : it.registryBlurb}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
