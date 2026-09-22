// app/components/pricing/BenchmarkRange.js
//
// The guideline beside a seeded service's price: "Typical: $250 · $325 · $450
// (low · typical · high)", the company's own price marked on that bar, and a
// "Use typical" button that copies the median into the price box.
//
// ── One component, two screens ─────────────────────────────────────────────
//
// Settings > Services (the trade card) and Settings > Products & Services (the
// price editor) both show it, so it is written once here. The wording is the
// owner's: the range is a GUIDELINE the company is asked to set its own rate
// against — never a fact about the company, never the source's number, and
// never rendered anywhere a client reads (the check asserts no client-facing
// route imports this file or the seeds).
//
// The company's price is compared in the company's currency: a CAD company
// sees the USD quartiles converted and rounded by lib/pricing/benchmarkFx.js,
// so the bar and the box agree on what a dollar is.
"use client";

import { useMemo } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { benchmarkIn } from "@/lib/pricing/benchmarkFx";
import { formatMoney } from "@/lib/currency";

function whole(n, currency, language) {
  if (n == null) return null;
  // The quartiles are coarse; cents on them would read as precision they
  // do not have. formatMoney prints cents, so trim them here.
  return formatMoney(n, currency, language).replace(/[.,]00(?=\D*$)/, "");
}

/**
 * @param benchmark  the seed's raw range ({ low, median, high, currency: "USD" }) or null
 * @param currency   the company's billing currency (what the price box is in)
 * @param price      the company's current price for the service, or null
 * @param onUse      called with the median in the company's currency; omit to
 *                   hide the button (a reader who may not edit)
 * @param compact    one line, for a list row
 */
export default function BenchmarkRange({ benchmark, currency, price, onUse, compact = false }) {
  const { t, language } = useTranslation();
  const range = useMemo(() => benchmarkIn(benchmark, currency), [benchmark, currency]);

  if (!range) {
    return (
      <p className={`text-[11px] leading-snug text-amber-700 dark:text-amber-500 ${compact ? "" : "mt-1"}`}>
        {t("app.serviceSeeds.setYourRate")}
      </p>
    );
  }

  const own = Number(price);
  const hasOwn = Number.isFinite(own) && own > 0;
  // Where the company's price sits on the bar, low → high. Clamped: a price
  // outside the band sits on the edge, which is the honest picture of it.
  const lo = range.low ?? range.median;
  const hi = range.high ?? range.median;
  const span = hi - lo;
  const pct = (v) => (span > 0 ? Math.max(0, Math.min(100, ((v - lo) / span) * 100)) : 50);

  const isPoint = range.low == null && range.high == null;
  const triple = isPoint
    ? whole(range.median, range.currency, language)
    : [whole(range.low, range.currency, language), whole(range.median, range.currency, language), whole(range.high, range.currency, language)]
        .filter(Boolean)
        .join(" · ");

  return (
    <div className={compact ? "min-w-0" : "mt-1.5"}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-snug text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">{t("app.serviceSeeds.typical")}</span> {triple}
          {!isPoint && <span className="opacity-70"> ({t("app.serviceSeeds.lowTypicalHigh")})</span>}
        </span>
        {onUse && (
          <button
            type="button"
            onClick={() => onUse(range.median)}
            className="rounded border border-border px-1.5 py-0.5 text-[11px] font-medium text-foreground hover:bg-accent"
          >
            {t("app.serviceSeeds.useTypical")}
          </button>
        )}
      </div>
      {!isPoint && (
        <div
          className="relative mt-1 h-1.5 w-full max-w-[220px] rounded-full bg-muted"
          role="img"
          aria-label={`${t("app.serviceSeeds.typical")} ${triple}`}
        >
          {/* The typical mark. */}
          <span
            aria-hidden="true"
            className="absolute top-1/2 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded bg-muted-foreground/70"
            style={{ left: `${pct(range.median)}%` }}
          />
          {/* The company's own price, when it has one. Drawn last so it sits
              on top of the typical mark when the two coincide. */}
          {hasOwn && (
            <span
              aria-hidden="true"
              title={whole(own, currency, language)}
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground"
              style={{ left: `${pct(own)}%` }}
            />
          )}
        </div>
      )}
      {!compact && (
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          {t("app.serviceSeeds.rangeNote")}
        </p>
      )}
    </div>
  );
}
