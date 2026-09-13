// app/sales/MyFunnelCard.js
//
// The rep's own funnel this month, on the portal's front door.
//
// ══ The rep sees their own card and only their own ════════════════════════
//
// /api/sales/funnel answers about the session's rep and nobody else — the
// route scopes on the session, not on a query field — and this card renders
// what comes back. The references beside each conversion are a published
// benchmark (said so, in the rep's language) or FieldQuo's floor-wide
// figure; never another rep's numbers.
//
// ══ Every word through t() ════════════════════════════════════════════════
//
// The stage names, the units, the band words and the two sentences come from
// the catalogue; app/components/sales/FunnelView.js holds no literal and
// takes this card's resolved copy. The one string it prints verbatim is
// `conversion.reference.label`, which is the module's own decision about
// whether a figure is a benchmark — translated here by KIND rather than by
// re-composing the sentence, so a benchmark can never be printed under the
// "FieldQuo's own" words.
"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import FunnelView from "@/app/components/sales/FunnelView";

const CARD = "rounded-xl border border-border bg-card p-4 space-y-3";
const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const FIELD =
  "border border-border rounded-lg px-3 py-2 min-h-[40px] text-sm bg-card text-foreground disabled:opacity-60";

export default function MyFunnelCard() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState("");

  const load = useCallback(async (m) => {
    setLoading(true);
    setError("");
    try {
      const d = await fetchJson(`/api/sales/funnel${m ? `?month=${encodeURIComponent(m)}` : ""}`);
      setData(d);
      if (!m) setMonth(d.monthKey);
    } catch (err) {
      setData(null);
      setError(err?.message || t("app.salesToday.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load(month);
  }, [load, month]);

  const funnel = data?.funnel ? relabel(data.funnel, t) : null;

  const copy = {
    stage: t("app.salesFunnel.col.stage"),
    count: t("app.salesFunnel.col.count"),
    conversionFrom: t("app.salesFunnel.col.conversion"),
    reference: t("app.salesFunnel.col.reference"),
    noRate: t("app.salesFunnel.noRate"),
    stageLabel: (s) => t(s.labelKey),
    unit: (u) => t(`app.salesFunnel.unit.${u}`),
    benchmarkUntil: (n, dials) => t("app.salesFunnel.benchmarkUntil", { n, dials }),
    abandoned: (n) => t("app.salesFunnel.abandoned", { n }),
    bands: {
      minimum: t("app.salesFunnel.band.minimum"),
      target: t("app.salesFunnel.band.target"),
      strong: t("app.salesFunnel.band.strong"),
    },
    rampNote: (f) => t("app.salesFunnel.rampNote", { pct: Math.round(f * 100) }),
    quotaSignups: t("app.salesFunnel.quotaSignups"),
    quotaAgreed: t("app.salesFunnel.quotaAgreed"),
  };

  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">{t("app.salesFunnel.title")}</h2>
        <select
          aria-label={t("app.salesFunnel.month")}
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className={FIELD}
          disabled={!data}
        >
          {(data?.months || (month ? [month] : [])).map((m) => (
            <option key={m} value={m}>
              {m}
              {m === data?.currentMonth ? ` — ${t("app.salesFunnel.soFar")}` : ""}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-muted-foreground break-words">{t("app.salesFunnel.intro")}</p>

      {error ? (
        <div className="flex items-start gap-2 text-sm">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
          <div className="min-w-0 space-y-2">
            <p className="text-foreground break-words">{error}</p>
            <button type="button" onClick={() => load(month)} className={`${BTN} border border-border text-foreground`}>
              <RefreshCw size={15} /> {t("app.salesToday.tryAgain")}
            </button>
          </div>
        </div>
      ) : loading ? (
        <Loader2 size={18} className="animate-spin text-muted-foreground" />
      ) : funnel ? (
        <>
          {funnel.ramp?.factor < 1 ? (
            <p className="text-xs text-muted-foreground break-words">
              {t("app.salesFunnel.ramp", { month: funnel.ramp.tenureMonth, pct: Math.round(funnel.ramp.factor * 100) })}
            </p>
          ) : null}
          <FunnelView funnel={funnel} copy={copy} compact />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t("app.salesToday.notLoaded")}</p>
      )}
    </section>
  );
}

/**
 * The reference labels, by KIND. `label` is what FunnelView prints, so it is
 * replaced with the translated sentence for the kind the module decided —
 * the kind itself is never changed here.
 */
function relabel(funnel, t) {
  return {
    ...funnel,
    stages: funnel.stages.map((s) => {
      const ref = s.conversion?.reference;
      if (!ref) return s;
      const label =
        ref.kind === "benchmark"
          ? t("app.salesFunnel.reference.benchmark")
          : t("app.salesFunnel.reference.fieldquo", { n: ref.sampleDials ?? 0 });
      return { ...s, conversion: { ...s.conversion, reference: { ...ref, label } } };
    }),
  };
}
