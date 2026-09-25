// app/app/analytics/kpis/KpiTiles.js
//
// The KPI dashboard's two tiles, in their own file so they can be drawn outside
// the dashboard — the /signup side panel renders these exact components
// against fixture figures rather than hand-drawn lookalikes. Presentational:
// no fetch, no router, no permission hook.
//
// `KpiTile` is the ONLY place the dashboard turns `{ value, reason,
// reasonText }` into pixels, and `MoneyTile` keeps the same "—" discipline for
// money-flow figures; see the header of page.js for why that matters.
"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

// Reason codes lib/analytics/kpis.js's REASONS gives a real translation for
// (five of them name a count off the KPI's own `sampleSize`/`floor`/
// `remaining`; no_throughput_reference names an action instead — see that
// file's REASONS header). Only these six need a translation key: every OTHER
// reason code's English sentence has no placeholder to fill, so it renders
// correctly straight from `reasonText` with no lookup at all, exactly as it
// did before this map existed.
//
// There is deliberately no second copy of the English text here. `t()`'s
// fallback argument is `data.reasonText` itself (kpis.js's own REASONS[code],
// unsubstituted) — so the ENGLISH wording lives in exactly one place, and
// this map only says which reason codes have a translation, not what they say.
const REASON_I18N_KEYS = {
  no_quotes_sent: "app.kpis.reason.noQuotesSent",
  no_won_quotes: "app.kpis.reason.noWonQuotes",
  no_leads_in_period: "app.kpis.reason.noLeadsInPeriod",
  none_decided_yet: "app.kpis.reason.noneDecidedYet",
  below_floor: "app.kpis.reason.belowFloor",
  no_throughput_reference: "app.kpis.reason.noThroughputReference",
  no_survey_responses: "app.kpis.reason.noSurveyResponses",
};

/**
 * The sentence a card with no value shows, translated when the reason names a
 * count (see REASON_I18N_KEYS above) and printed as-is otherwise. `data.floor`
 * / `data.sampleSize` / `data.remaining` are lib/analytics/kpis.js's own
 * numbers — never recomputed here — so a translated sentence can never show a
 * different count than an English one would.
 */
export function reasonMessage(t, data) {
  if (!data?.reasonText) return null;
  const key = REASON_I18N_KEYS[data.reason];
  if (!key) return data.reasonText;
  return t(key, data.reasonText, {
    sampleSize: data.sampleSize,
    floor: data.floor,
    remaining: data.remaining,
  });
}

/**
 * One KPI, rendered honestly.
 *
 * `format` turns a non-null value into text; it is never called on a null
 * value, so a formatter cannot accidentally coerce null into "$0" or "0%".
 */
export function KpiTile({ label, data, format, hint }) {
  const { t } = useTranslation();
  const hasValue = data && data.value !== null && data.value !== undefined;
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        {data?.incomplete && (
          <TriangleAlert
            size={14}
            className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"
            aria-label="Incomplete data"
          />
        )}
      </div>
      <div className="mt-1 text-2xl font-semibold text-foreground">
        {hasValue ? format(data.value) : "—"}
      </div>
      {hasValue ? (
        <div className="mt-1 text-xs text-muted-foreground">
          {data.sampleSize} {data.sampleSize === 1 ? "job/quote" : "jobs/quotes"}
          {data.incomplete ? " · some data missing, see below" : ""}
        </div>
      ) : (
        <div className="mt-1 text-xs text-muted-foreground">
          {reasonMessage(t, data) ||
            t("app.kpis.finance.backlogUnknown", "No data yet.")}
        </div>
      )}
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * The signed percentage a trend.js `compare()` result carries, or null.
 *
 * `deltaPct` is already null on compare()'s own zero-denominator branch — see
 * lib/analytics/moneyFlow.js's header for why that branch is reused rather
 * than re-decided. This only turns the signed fraction into a rounded, always
 * positive whole number for display; the sign is read off `direction`
 * instead, so "down -12%" can never appear.
 */
function pctFromTrend(trend) {
  if (!trend || trend.deltaPct === null || trend.deltaPct === undefined) return null;
  return Math.round(Math.abs(trend.deltaPct) * 100);
}

/**
 * One money-flow tile: income, expenses or what's left, with a period-over-
 * period trend line. Same "—" discipline as KpiTile above — `hasValue` gates
 * everything, so a null figure can never be formatted as money.
 */
export function MoneyTile({ label, figure, trend, money, t, hint }) {
  const hasValue = figure && figure.value !== null && figure.value !== undefined;
  const pct = pctFromTrend(trend);
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        {figure?.incomplete && (
          <TriangleAlert
            size={14}
            className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"
            aria-label="Incomplete data"
          />
        )}
      </div>
      {/* "≈" when the figure includes a row converted from another currency at
          the pinned rate (lib/analytics/spendCurrency.js). The hint below the
          tile names what was converted and how old the rate is; the mark is
          what stops the figure reading as exact when the hint is skimmed. */}
      <div className="mt-1 text-2xl font-semibold text-foreground">
        {hasValue ? `${figure.approximate ? "≈ " : ""}${money(figure.value)}` : "—"}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {hasValue
          ? trend
            ? trend.direction === "flat"
              ? t("app.kpis.moneyFlow.trend.flat", "About the same as last period")
              : pct !== null
                ? t(
                    trend.direction === "up" ? "app.kpis.moneyFlow.trend.up" : "app.kpis.moneyFlow.trend.down",
                    trend.direction === "up" ? "Up {pct}% on last period" : "Down {pct}% on last period",
                    { pct },
                  )
                : t("app.kpis.moneyFlow.trend.fromZero", "Up from nothing last period")
            : null
          : figure?.reasonText ||
            t("app.kpis.finance.backlogUnknown", "No data yet.")}
      </div>
      {hint}
    </div>
  );
}
