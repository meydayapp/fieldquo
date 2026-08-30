// app/app/analytics/kpis/page.js
//
// One dashboard for the numbers that decide whether the business is healthy:
// sales, profit, execution, cash — most of which had no screen at all before
// this one. See lib/analytics/kpis.js for what each figure means and why it
// can refuse to print a number; this file only renders what the API sends.
//
// ══ The one rule this screen exists to keep ════════════════════════════════
//
// A KPI with no data renders as "—" and a stated reason. NEVER as 0. `KpiTile`
// below is the ONLY place that turns `{ value, reason, reasonText }` into
// pixels, so a new card cannot accidentally print "0%" for "we don't know" —
// the same discipline app/app/analytics/estimate-accuracy/page.js's `Rate`
// keeps for the same reason.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TriangleAlert, Info } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { formatAppMoney } from "@/lib/format/money";
import { presetRange, PERIOD_PRESETS } from "@/lib/analytics/periodPresets";
import { useTranslation } from "@/app/hooks/useTranslation";
import Sparkline from "@/app/components/charts/Sparkline";
import BarComparison from "@/app/components/charts/BarComparison";
import GanttStrip from "@/app/components/charts/GanttStrip";

// Aging bucket labels — the SAME i18n keys the main dashboard already uses for
// this exact ladder (app/app/page.js), so "1–30 days" doesn't get a second,
// possibly drifting, translation.
const AGING_LABELS = {
  not_due: ["app.dash.aging.notDue", "Not yet due"],
  days_1_30: ["app.dash.aging.d1to30", "1–30 days"],
  days_31_60: ["app.dash.aging.d31to60", "31–60 days"],
  days_61_90: ["app.dash.aging.d61to90", "61–90 days"],
  days_90_plus: ["app.dash.aging.d90plus", "90+ days"],
};

/**
 * One KPI, rendered honestly.
 *
 * `format` turns a non-null value into text; it is never called on a null
 * value, so a formatter cannot accidentally coerce null into "$0" or "0%".
 */
function KpiTile({ label, data, format, hint }) {
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
          {data?.reasonText || "No data yet."}
        </div>
      )}
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SectionHeading({ title, subtitle }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

export default function KpiDashboardPage() {
  const { t, language } = useTranslation();

  const [preset, setPreset] = useState("thisQuarter");
  const [range, setRange] = useState(() => presetRange("thisQuarter"));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchJson(`/api/analytics/kpis?from=${range.from}&to=${range.to}`);
      setData(res);
    } catch (err) {
      // fetchJson always carries a readable message; no silent `if (res.ok)`
      // branch (AGENTS.md failure class 2).
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    load();
  }, [load]);

  const money = useMemo(() => {
    const currency = data?.currency || null;
    return (amount) => formatAppMoney(amount, currency, language);
  }, [data?.currency, language]);

  const choosePreset = (key) => {
    setPreset(key);
    setRange(presetRange(key));
  };

  const pct = (v) => `${v}%`;
  const weeks = (v) => (v === 1 ? "1 week" : `${v} weeks`);

  const agingRows = useMemo(() => {
    const aging = data?.cash?.arAging?.aging;
    if (!Array.isArray(aging)) return [];
    return aging.map((b) => {
      const [key, fallback] = AGING_LABELS[b.id] || [null, b.id];
      return { key: b.id, label: key ? t(key, fallback) : fallback, value: b.amount, negative: b.overdue };
    });
  }, [data, t]);

  const estimateDims = data?.execution?.estimateAccuracy?.dimensions;
  const estimateRows = useMemo(() => {
    if (!estimateDims) return [];
    return Object.values(estimateDims)
      .filter((d) => d.reportable)
      .map((d) => ({ key: d.key, label: d.label, value: d.medianPct, negative: d.medianPct > 0 }));
  }, [estimateDims]);

  const ganttRows = data?.execution?.onTimeCompletion?.jobs || [];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg md:text-xl font-semibold">
          {t("app.kpis.title", "KPI dashboard")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "app.kpis.subtitle",
            "Sales, profit, execution and cash, in one place — most of these numbers have never had a screen before. A card with no data says why, rather than showing a zero.",
          )}
        </p>
        <Link
          href="/app/analytics/benchmark"
          className="inline-flex items-center gap-1.5 text-sm text-foreground underline mt-2"
        >
          {t("app.kpis.backToInsights", "How you compare")}
        </Link>
      </div>

      <div className="glass-effect rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {PERIOD_PRESETS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => choosePreset(key)}
              className={`text-sm px-3 py-1.5 rounded-lg border ${
                preset === key
                  ? "bg-inverted text-inverted-foreground border-transparent font-semibold"
                  : "border-border text-muted-foreground"
              }`}
            >
              {t(`app.kpis.preset.${key}`, label)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 mb-6 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-accent rounded-xl" />
          <div className="h-32 bg-accent rounded-xl" />
        </div>
      )}

      {!error && data && (
        <div className="space-y-8">
          {/* ── Sales ────────────────────────────────────────────────────── */}
          <section>
            <SectionHeading
              title={t("app.kpis.sales.title", "Sales")}
              subtitle={t(
                "app.kpis.sales.subtitle",
                "What went out, what came back, and how far ahead you're booked.",
              )}
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiTile label={t("app.kpis.winRate", "Win rate")} data={data.sales.winRate} format={pct} />
              <KpiTile
                label={t("app.kpis.avgJobValue", "Average job value")}
                data={data.sales.avgJobValue}
                format={money}
              />
              <KpiTile
                label={t("app.kpis.leadConversion", "Lead → quote conversion")}
                data={data.sales.leadToQuoteConversion}
                format={pct}
              />
              <KpiTile
                label={t("app.kpis.backlogWeeks", "Backlog")}
                data={data.sales.backlogWeeks}
                format={weeks}
                hint={t(
                  "app.kpis.backlogHint",
                  "Weeks of accepted work still ahead of you, at this period's pace — not months. A residential shop with 2–6 weeks booked is in good shape.",
                )}
              />
            </div>
          </section>

          {/* ── Profit ───────────────────────────────────────────────────── */}
          <section>
            <SectionHeading
              title={t("app.kpis.profit.title", "Profit")}
              subtitle={t(
                "app.kpis.profit.subtitle",
                "Rolled up across every completed job in the period, off approved hours and logged expenses only.",
              )}
            />
            {data.profit.materialsTrap?.triggered && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                <TriangleAlert size={16} className="shrink-0 mt-0.5" />
                <div>
                  {t(
                    "app.kpis.materialsTrapNote",
                    "These jobs show {buyList} bought off the materials buy-list, but only {expense} was ever entered as an expense. Job costing only reads expenses, so the margin below would be fiction — it's suppressed until materials purchases are logged as expenses too.",
                    {
                      buyList: money(data.profit.materialsTrap.buyListTotal),
                      expense: money(data.profit.materialsTrap.expenseTotal),
                    },
                  )}
                </div>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiTile
                label={t("app.kpis.grossMargin", "Gross margin (typical job)")}
                data={data.profit.grossMarginPct}
                format={pct}
              />
              <KpiTile
                label={t("app.kpis.netMargin", "Net margin (typical job)")}
                data={data.profit.netMarginPct}
                format={pct}
                hint={
                  data.profit.netMarginPct?.reason === "overhead_unknown" ? (
                    <Link href="/app/settings/expense-tracking" className="underline">
                      {t("app.kpis.setCapacity", "Set your weekly job capacity →")}
                    </Link>
                  ) : null
                }
              />
              <KpiTile
                label={t("app.kpis.labourCostPct", "Labour cost, % of revenue")}
                data={data.profit.labourCostPctOfRevenue}
                format={pct}
              />
              <KpiTile
                label={t("app.kpis.revenuePerEmployee", "Revenue per employee")}
                data={data.profit.revenuePerEmployee}
                format={money}
              />
            </div>
          </section>

          {/* ── Execution ────────────────────────────────────────────────── */}
          <section>
            <SectionHeading
              title={t("app.kpis.execution.title", "Execution")}
              subtitle={t(
                "app.kpis.execution.subtitle",
                "How close the estimate was to what happened, and how the schedule held up.",
              )}
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-4">
              <KpiTile
                label={t("app.kpis.onTimeCompletion", "On-time completion")}
                data={data.execution.onTimeCompletion}
                format={pct}
                hint={t(
                  "app.kpis.onTimeHint",
                  "Finished on or before the last scheduled visit date. Not cycle time — jobs carry no start date to measure that against.",
                )}
              />
              <KpiTile
                label={t("app.kpis.utilisation", "Labour utilisation")}
                data={data.execution.utilisation}
                format={pct}
                hint={t(
                  "app.kpis.utilisationHint",
                  "Hours that reached a job, against the hours a guaranteed week promised. Office staff aren't counted — their time is overhead by design.",
                )}
              />
              <div className="rounded-lg border border-border p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  {t("app.kpis.estimateAccuracy", "Estimate accuracy (median variance)")}
                </div>
                {estimateRows.length > 0 ? (
                  <BarComparison rows={estimateRows} formatValue={(v) => `${v > 0 ? "+" : ""}${v}%`} />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "app.kpis.estimateAccuracyThin",
                      "Not enough completed, costed jobs this period to draw a rate from.",
                    )}
                  </p>
                )}
                <Link
                  href="/app/analytics/estimate-accuracy"
                  className="mt-2 inline-block text-xs text-foreground underline"
                >
                  {t("app.kpis.fullReport", "Full report →")}
                </Link>
              </div>
            </div>

            {ganttRows.length > 0 && (
              <div className="rounded-lg border border-border p-4 overflow-x-auto">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
                  {t("app.kpis.schedule", "Recent jobs: scheduled window vs. completion")}
                </div>
                <GanttStrip rows={ganttRows} width={Math.max(520, ganttRows.length ? 560 : 520)} />
                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--chart-1)" }} />
                    {t("app.kpis.legendOnTime", "Finished on time")}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--destructive)" }} />
                    {t("app.kpis.legendLate", "Finished late")}
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* ── Cash ─────────────────────────────────────────────────────── */}
          <section>
            <SectionHeading
              title={t("app.kpis.cash.title", "Cash")}
              subtitle={t("app.kpis.cash.subtitle", "What you're owed, and what's actually come in.")}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("app.kpis.arAging", "Accounts receivable, by age")}
                </div>
                <div className="mt-1 text-2xl font-semibold text-foreground">
                  {data.cash.arAging.value !== null ? money(data.cash.arAging.value) : "—"}
                </div>
                <div className="mt-1 mb-3 text-xs text-muted-foreground">
                  {data.cash.arAging.value !== null
                    ? data.cash.arAging.nothingOutstanding
                      ? t("app.kpis.nothingOwed", "Nothing outstanding right now.")
                      : t("app.kpis.overdueOf", "{overdue} of that is overdue ({count})", {
                          overdue: money(data.cash.arAging.overdueTotal),
                          count: data.cash.arAging.overdueCount,
                        })
                    : data.cash.arAging.reasonText}
                </div>
                {agingRows.length > 0 && <BarComparison rows={agingRows} formatValue={money} />}
                <Link href="/app/analytics/statements" className="mt-3 inline-block text-xs text-foreground underline">
                  {t("app.kpis.fullReport", "Full report →")}
                </Link>
              </div>
              <div className="rounded-lg border border-border p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  {t("app.kpis.revenueTrend", "Money received, last 6 months")}
                </div>
                {data.cash.revenueTrend?.available ? (
                  <Sparkline series={data.cash.revenueTrend.series} formatValue={money} width={280} height={64} />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("app.kpis.noPaymentsYet", "No payments recorded yet.")}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* ── Not tracked ──────────────────────────────────────────────── */}
          <section>
            <SectionHeading
              title={t("app.kpis.notTracked.title", "Not tracked")}
              subtitle={t(
                "app.kpis.notTracked.subtitle",
                "Metrics a dashboard like this usually carries, that FieldQuo does not invent numbers for.",
              )}
            />
            <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
              {data.notTracked.map((item) => (
                <div key={item.key} className="flex items-start gap-2 text-sm">
                  <Info size={14} className="shrink-0 mt-0.5 text-muted-foreground" />
                  <div>
                    <span className="font-medium text-foreground">{item.label}</span>
                    <span className="text-muted-foreground"> — {item.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
