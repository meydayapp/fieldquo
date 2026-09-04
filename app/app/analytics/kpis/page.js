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
// keeps for the same reason. `MoneyTile` keeps the identical discipline for
// the Money flow section below, off a slightly different envelope shape (see
// its own comment).
//
// ── Money flow lives here, on its own endpoint ──────────────────────────────
//
// Income, expenses, what's left, and the daily chart are a NEW section on
// THIS page rather than a second dashboard — a contractor already has one
// place to check business health, and a second screen for "money" would be
// the /app/tasks failure again (built, and findable only by someone who
// already knew it existed). It fetches from its own route,
// app/api/analytics/money-flow, and keeps its own loading/error state:
// lib/analytics/moneyFlow.js's aggregation is gated on
// expenses:view_record_edit_all, a different permission axis than the
// jobCosting toggle the rest of this page requires, so a member who can see
// everything else here might still be refused just this section — and that
// refusal renders inside the section, not as a blank page.
//
// It reuses this page's own period selector (`range`/`preset` below) rather
// than adding a second one — one control governs the whole page, the way the
// owner asked for it.
//
// ── The comparison is like-for-like, and that took a fix ────────────────────
//
// "This quarter" (this page's default) and "This month" run to the LAST day
// of the period, not to today. Money flow's trend arrows used to measure that
// whole range against the same-length window before it — so on the 3rd of
// September three days of income were compared against a full prior month and
// the tile read "Down 91% on last period", precisely and meaninglessly, every
// month for everybody until about the 28th. lib/analytics/moneyFlow.js's
// `elapsedRange` now clamps the comparison to the days that have HAPPENED and
// sizes the prior window to match; the tiles still total the whole selected
// range, because "what have I taken this month" means everything logged
// against it. `flow.comparison` says which basis was used
// ("full_period" | "to_date" | "none"). The trend SENTENCE still reads "on
// last period" — the precise mid-period wording needs a catalogue key this
// pass could not add (app/i18n is owned elsewhere); it is reported as owed.
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
import FlowChart from "@/app/components/charts/FlowChart";

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
function reasonMessage(t, data) {
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
function KpiTile({ label, data, format, hint }) {
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
function MoneyTile({ label, figure, trend, money, t, hint }) {
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
      <div className="mt-1 text-2xl font-semibold text-foreground">
        {hasValue ? money(figure.value) : "—"}
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
                : t("app.kpis.moneyFlow.trend.fromZero", "Up from $0 last period")
            : null
          : figure?.reasonText ||
            t("app.kpis.finance.backlogUnknown", "No data yet.")}
      </div>
      {hint}
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

  // Money flow is its own endpoint (app/api/analytics/money-flow/route.js) —
  // keeping the aggregation out of the KPI route rather than folding it in —
  // but its own loading/error state, so a member who can see this page but
  // lacks expenses:view_record_edit_all (a different permission axis than the
  // jobCosting toggle the rest of this page gates on) sees a refusal in just
  // this section instead of the whole dashboard going blank.
  const [flow, setFlow] = useState(null);
  const [flowLoading, setFlowLoading] = useState(true);
  const [flowError, setFlowError] = useState("");

  // Business costs — payroll, fixed costs and marketing spend — is its own
  // endpoint too (app/api/analytics/finance-overview/route.js), for the same
  // reason Money flow is: its permission union (jobCosting + payroll:view_all
  // + user:manage, see the route) is narrower than either the base KPI gate
  // or Money flow's own, so a member who can see everything else on this
  // page might still be refused just this section, and the refusal belongs
  // inside the section, not as a blank page.
  const [finance, setFinance] = useState(null);
  const [financeLoading, setFinanceLoading] = useState(true);
  const [financeError, setFinanceError] = useState("");

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

  const loadFlow = useCallback(async () => {
    setFlowLoading(true);
    setFlowError("");
    try {
      const res = await fetchJson(`/api/analytics/money-flow?from=${range.from}&to=${range.to}`);
      setFlow(res);
    } catch (err) {
      setFlowError(err.message);
      setFlow(null);
    } finally {
      setFlowLoading(false);
    }
  }, [range.from, range.to]);

  const loadFinance = useCallback(async () => {
    setFinanceLoading(true);
    setFinanceError("");
    try {
      const res = await fetchJson(`/api/analytics/finance-overview?from=${range.from}&to=${range.to}`);
      setFinance(res);
    } catch (err) {
      setFinanceError(err.message);
      setFinance(null);
    } finally {
      setFinanceLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadFlow();
  }, [loadFlow]);

  useEffect(() => {
    loadFinance();
  }, [loadFinance]);

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

  // Score distribution for the customer section's mini bar chart. Only built
  // once the KPI itself has a real value — `raw.counts` exists on the
  // below-floor/no-data envelopes too (buildCsat only omits it below the
  // floor), but a chart under the floor would show real-looking bars under a
  // card that just said "not enough data yet", which is the exact
  // contradiction AGENTS.md's empty-state discipline exists to prevent.
  const csatRows = useMemo(() => {
    const counts = data?.customer?.csat?.value !== null ? data?.customer?.csat?.raw?.counts : null;
    if (!counts) return [];
    return [1, 2, 3, 4, 5].map((n) => ({ key: String(n), label: String(n), value: counts[n] || 0 }));
  }, [data]);

  // "Other" and "Uncategorised" are moneyFlow.js's own bucket names (English
  // constants, not user data) and get translated here; every other row is a
  // category string a contractor typed on an expense, shown exactly as
  // recorded — the same choice lib/analytics/expenseSummaryData.js makes for
  // Expense Tracking's own category breakdown, so the two screens never
  // disagree about what a category is called.
  const flowCategoryRows = useMemo(() => {
    const rows = flow?.categories;
    if (!Array.isArray(rows)) return [];
    return rows.map((c) => ({
      key: c.name,
      label:
        c.name === "Other"
          ? t("app.kpis.moneyFlow.other", "Other")
          : c.name === "Uncategorised"
            ? t("app.kpis.moneyFlow.uncategorised", "Uncategorised")
            : c.name,
      value: c.value,
    }));
  }, [flow, t]);

  // Committed work — accepted quotes on open jobs, not yet invoiced. Already
  // computed by lib/analytics/kpis.js's buildBacklogWeeks (data.sales.
  // backlogWeeks), fetched once for the Sales card above; reading its `raw`
  // here rather than fetching it a second time from finance-overview is the
  // reuse AGENTS.md asks for (failure class 4) — the two screens can never
  // show a different backlog dollar figure because there is only one query.
  // `raw.backlogValue` is always a real number (0 when nothing's open), even
  // on the `no_throughput_reference` branch where `value` (weeks) is null —
  // see buildBacklogWeeks's own comments.
  const backlogRaw = data?.sales?.backlogWeeks?.raw || null;

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

      <div data-tour="kpis-period" className="glass-effect rounded-lg p-4 mb-6">
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

          {/* ── Money flow ───────────────────────────────────────────────── */}
          <section>
            <SectionHeading
              title={t("app.kpis.moneyFlow.title", "Money flow")}
              subtitle={t(
                "app.kpis.moneyFlow.subtitle",
                "What came in, what went out, and what's left for this period — day by day. Income is actual payments received; expenses are what's been logged or imported, never a guess at what's missing.",
              )}
            />
            {flowError && (
              <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 mb-3 text-sm text-red-700 dark:text-red-300">
                {flowError}
              </div>
            )}
            {flowLoading && !flow && !flowError && (
              <div className="animate-pulse space-y-3">
                <div className="h-24 bg-accent rounded-lg" />
                <div className="h-40 bg-accent rounded-lg" />
              </div>
            )}
            {!flowError && flow && (
              <>
                {flow.materialsTrap?.triggered && (
                  <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                    <TriangleAlert size={16} className="shrink-0 mt-0.5" />
                    <div>
                      {t(
                        "app.kpis.moneyFlow.materialsTrapNote",
                        "These jobs show {buyList} bought off the materials buy-list this period, but only {expense} of that was ever entered as an expense. The expense total below is real — it just doesn't include those purchases. Log them as expenses, or import them from a bank statement, to see the true number.",
                        {
                          buyList: money(flow.materialsTrap.buyListTotal),
                          expense: money(flow.materialsTrap.expenseTotal),
                        },
                      )}
                    </div>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-3 mb-4">
                  <MoneyTile
                    label={t("app.kpis.moneyFlow.income", "Income")}
                    figure={flow.income}
                    trend={flow.trends?.income}
                    money={money}
                    t={t}
                  />
                  <MoneyTile
                    label={t("app.kpis.moneyFlow.expenses", "Expenses")}
                    figure={flow.expenses}
                    trend={flow.trends?.expenses}
                    money={money}
                    t={t}
                    hint={
                      !flow.expenses.available ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          <Link href="/app/settings/expense-tracking/import" className="underline">
                            {t("app.kpis.moneyFlow.importCsv", "Import a bank statement →")}
                          </Link>
                        </p>
                      ) : flow.expenses.incomplete ? (
                        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                          {t(
                            "app.kpis.moneyFlow.expensesIncompleteHint",
                            "Some materials were bought off the buy-list and never logged — see the note above.",
                          )}
                        </p>
                      ) : null
                    }
                  />
                  <MoneyTile
                    label={t("app.kpis.moneyFlow.remaining", "Remaining")}
                    figure={flow.remaining}
                    trend={flow.trends?.remaining}
                    money={money}
                    t={t}
                  />
                </div>

                <div className="rounded-lg border border-border p-4 mb-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
                    {t("app.kpis.moneyFlow.chartTitle", "Income vs. expenses, by day")}
                  </div>
                  {flow.chartAvailable ? (
                    <>
                      <div className="overflow-x-auto">
                        {/* Width is sized to the days that HAPPENED. "This
                            quarter" runs to the last day of the quarter, so
                            on the 3rd most of the series is the future —
                            moneyFlow.js flags those and FlowChart drops them
                            rather than drawing a flat $0 line to the right. */}
                        <FlowChart
                          series={flow.days}
                          width={Math.max(
                            560,
                            (flow.days || []).filter((d) => !d.future).length * 10,
                          )}
                          height={180}
                          emptyLabel={t(
                            "app.kpis.moneyFlow.noChart",
                            "Nothing recorded yet, so there's no chart to draw.",
                          )}
                        />
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: "var(--chart-1)" }}
                          />
                          {t("app.kpis.moneyFlow.legendIncome", "Income")}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: "var(--destructive)" }}
                          />
                          {t("app.kpis.moneyFlow.legendExpenses", "Expenses")}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t(
                        "app.kpis.moneyFlow.noChart",
                        "Nothing recorded yet, so there's no chart to draw.",
                      )}{" "}
                      <Link href="/app/settings/expense-tracking/import" className="underline">
                        {t("app.kpis.moneyFlow.importCsv", "Import a bank statement →")}
                      </Link>
                    </p>
                  )}
                </div>

                <div className="rounded-lg border border-border p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                    {t("app.kpis.moneyFlow.categoriesTitle", "Where the money went")}
                  </div>
                  {flowCategoryRows.length > 0 ? (
                    <BarComparison rows={flowCategoryRows} formatValue={money} />
                  ) : flow.expenses.available ? (
                    <p className="text-xs text-muted-foreground">
                      {t("app.kpis.moneyFlow.noCategories", "No expenses in this period.")}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t("app.kpis.moneyFlow.noExpensesYet", "No expenses have been logged yet.")}{" "}
                      <Link href="/app/settings/expense-tracking/import" className="underline">
                        {t("app.kpis.moneyFlow.importCsv", "Import a bank statement →")}
                      </Link>
                    </p>
                  )}
                </div>
              </>
            )}
          </section>

          {/* ── Business costs ──────────────────────────────────────────────
              The owner's own ask: "we have all the information from
              expenses, payroll, jobs etc." — payroll, fixed costs and
              committed work each had a screen that computed them (Payroll,
              Settings → Overhead, the Backlog card above) but no shared money
              view. This section reuses every one of those, unchanged, rather
              than re-deriving any of them — see app/api/analytics/
              finance-overview/route.js's header for why nothing here is
              summed into one "total money out" figure. */}
          <section>
            <SectionHeading
              title={t("app.kpis.finance.title", "Business costs")}
              subtitle={t(
                "app.kpis.finance.subtitle",
                "Payroll, fixed costs, marketing spend, and work already committed — built from what FieldQuo already knows, no bank statement required.",
              )}
            />
            {financeError && (
              <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 mb-3 text-sm text-red-700 dark:text-red-300">
                {financeError}
              </div>
            )}
            {financeLoading && !finance && !financeError && (
              <div className="animate-pulse space-y-3">
                <div className="h-24 bg-accent rounded-lg" />
              </div>
            )}
            {!financeError && finance && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MoneyTile
                  label={t("app.kpis.finance.payrollTitle", "Payroll this period")}
                  figure={finance.payroll}
                  money={money}
                  t={t}
                  hint={
                    finance.payroll?.incomplete ? (
                      <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                        {t(
                          "app.kpis.finance.payrollUnratedHint",
                          "{count} hours logged by {workers} have no pay rate on file and aren't counted here.",
                          {
                            count: finance.payroll.raw?.unratedHours ?? 0,
                            workers: finance.payroll.raw?.unratedWorkers ?? 0,
                          },
                        )}
                      </p>
                    ) : finance.payroll?.raw?.pendingHours > 0 ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t(
                          "app.kpis.finance.payrollPendingHint",
                          "{hours}h still awaiting approval, not counted yet.",
                          { hours: finance.payroll.raw.pendingHours },
                        )}
                      </p>
                    ) : null
                  }
                />
                {/* Same MoneyTile as its neighbours now: the route sends
                    fixedCosts in moneyFlow.js's figure() envelope, so a
                    company that has never recorded rent, a wage, a loan or an
                    asset reads "—" and the reason instead of a confident
                    "$0.00 per month" — which is a statement about a business
                    that pays rent. It used to render `monthlyTotal` straight
                    through a formatter, which turned four empty tables into a
                    precise-looking figure. */}
                <MoneyTile
                  label={t("app.kpis.finance.fixedCostsTitle", "Fixed costs")}
                  figure={finance.fixedCosts}
                  money={money}
                  t={t}
                  hint={
                    <>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t(
                          "app.kpis.finance.fixedCostsHint",
                          "Per month, regardless of the period above — rent, overhead pay and debt.",
                        )}
                      </p>
                      <Link
                        href="/app/settings/overhead"
                        className="mt-2 inline-block text-xs underline text-foreground"
                      >
                        {t("app.kpis.finance.fixedCostsLink", "See the breakdown →")}
                      </Link>
                    </>
                  }
                />
                <MoneyTile
                  label={t("app.kpis.finance.marketingTitle", "Marketing spend")}
                  figure={finance.marketing}
                  money={money}
                  t={t}
                  hint={
                    finance.marketing?.available ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t(
                          "app.kpis.finance.marketingOverlapHint",
                          "May overlap with a cost also logged in Expense Tracking — not combined with Expenses above.",
                        )}
                      </p>
                    ) : null
                  }
                />
                <div className="rounded-lg border border-border p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("app.kpis.finance.backlogTitle", "Committed, not yet invoiced")}
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-foreground">
                    {backlogRaw ? money(backlogRaw.backlogValue) : "—"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {backlogRaw
                      ? t(
                          "app.kpis.finance.backlogCount",
                          "{count} accepted, open jobs.",
                          { count: backlogRaw.backlogJobCount },
                        )
                      : t("app.kpis.finance.backlogUnknown", "No data yet.")}
                  </div>
                </div>
              </div>
            )}
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

          {/* ── Quality ──────────────────────────────────────────────────── */}
          <section>
            <SectionHeading
              title={t("app.kpis.quality.title", "Quality")}
              subtitle={t(
                "app.kpis.quality.subtitle",
                "Work that had to be revisited, and scope that changed after the client said yes.",
              )}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <KpiTile
                label={t("app.kpis.reworkCallbackRate", "Rework / callback rate")}
                data={data.quality.reworkCallbackRate}
                format={pct}
                hint={t(
                  "app.kpis.reworkCallbackHint",
                  "Completed jobs the company had to go back to for a redo or a warranty return. A client who thought something was missing and wasn't doesn't count against this — see the job page for how to record which is which.",
                )}
              />
              <KpiTile
                label={t("app.kpis.changeOrderRate", "Change-order rate")}
                data={data.quality.changeOrderRate}
                format={pct}
                hint={t(
                  "app.kpis.changeOrderHint",
                  "Completed jobs with at least one scope change logged after the quote was accepted — never inferred from an ordinary quote or invoice edit.",
                )}
              />
            </div>
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
                    : reasonMessage(t, data.cash.arAging)}
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

          {/* ── Customer ─────────────────────────────────────────────────── */}
          <section>
            <SectionHeading
              title={t("app.kpis.customer.title", "Customer")}
              subtitle={t(
                "app.kpis.customer.subtitle",
                "What clients say after the work is done — one question, sent alongside the review-request email.",
              )}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <KpiTile
                label={t("app.kpis.csat", "Customer satisfaction")}
                data={data.customer.csat}
                format={(v) => `${v} / 5`}
                hint={t(
                  "app.kpis.csatHint",
                  "Average of the one-question survey sent after a job. Only companies with a review link set today collect this — it rides the same email.",
                )}
              />
              {csatRows.length > 0 && (
                <div className="rounded-lg border border-border p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                    {t("app.kpis.csatBreakdown", "Answers by score")}
                  </div>
                  <BarComparison rows={csatRows} formatValue={(v) => v} />
                  {data.customer.csat.raw?.lowScoreCount > 0 && (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                      {t(
                        "app.kpis.csatLowScoreNote",
                        "{count} of these rated 1 or 2 — worth a follow-up call.",
                        { count: data.customer.csat.raw.lowScoreCount },
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ── Not tracked ──────────────────────────────────────────────── */}
          <section data-tour="kpis-not-tracked">
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
