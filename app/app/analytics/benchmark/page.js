// app/(app)/analytics/benchmark/page.js
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";

export default function BenchmarkPage() {
  const money = useCompanyMoney();
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchJson("/api/analytics/benchmark");
        setData(res);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-48 bg-accent rounded" />
          <div className="h-24 bg-accent rounded-lg" />
          <div className="h-24 bg-accent rounded-lg" />
        </div>
      </div>
    );
  }

  const rows = data?.categories || [];
  const optedIn = data?.shareAnonymizedPricing;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg md:text-xl font-semibold">{t("app.benchmark.title", "How You Compare")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "app.benchmark.subtitle",
            "Your average quote pricing vs. the anonymized platform average, by service category.",
          )}
        </p>
        {/* /app/analytics/digest worked and was linked from NOTHING. It's the
            other half of this page — this one is "how do I compare", that one
            is "what changed this week" — so it belongs here rather than
            needing its own nav slot for a page you read occasionally. */}
        <div className="flex flex-wrap gap-4 mt-2">
          <Link
            href="/app/analytics/digest"
            className="inline-flex items-center gap-1.5 text-sm text-foreground underline"
          >
            {t("app.benchmark.weeklyDigests", "Weekly digests")}
          </Link>
          {/* Same reasoning as the digest link above it: /app/analytics/statements
              is the third page in this group and the sidebar has one row for all
              of them ("Insights" → this page). A working page nothing links to
              is a page nobody finds — the failure /app/tasks and the digest were
              both fixed for. The page gates itself; this is the door, not the
              lock. */}
          <Link
            href="/app/analytics/statements"
            className="inline-flex items-center gap-1.5 text-sm text-foreground underline"
          >
            {t("app.benchmark.financialStatements", "Financial statements")}
          </Link>
          {/* Fourth page in the group, same reasoning as the two above: the
              sidebar has one "Insights" row for all of them, and a page nothing
              links to is a page nobody finds. It gates itself. */}
          <Link
            href="/app/analytics/win-loss"
            className="inline-flex items-center gap-1.5 text-sm text-foreground underline"
          >
            {t("app.benchmark.winLoss", "Won and lost")}
          </Link>
          {/* And the fifth, on the same argument. This one is the pair to the
              statements link: that says what the business earned, this says
              whether the estimates it was earned against were any good. */}
          <Link
            href="/app/analytics/estimate-accuracy"
            className="inline-flex items-center gap-1.5 text-sm text-foreground underline"
          >
            {t("app.benchmark.estimateAccuracy", "Estimate accuracy")}
          </Link>
          {/* Sixth link, same argument, and the newest of the group: sales,
              profit, execution and cash in one place — most of it numbers none
              of the five pages above ever showed (average job value, backlog in
              weeks, the margin roll-up, revenue per employee, on-time
              completion, utilisation as a rate). It also has its own row in
              the sidebar (app.nav.kpis) because it's the one a contractor is
              most likely to open first. */}
          <Link
            href="/app/analytics/kpis"
            className="inline-flex items-center gap-1.5 text-sm text-foreground underline"
          >
            {t("app.benchmark.kpis", "KPI dashboard")}
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 mb-6 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {!error && !optedIn && (
        <div className="glass-effect rounded-lg p-4 mb-6 text-sm">
          <p className="mb-2">
            {t(
              "app.benchmark.optInNote",
              "Benchmarking is opt-in. Turn it on in Settings to see how your pricing compares — your individual quotes are never shared, only aggregated averages.",
            )}
          </p>
          <a
            href="/app/settings/company"
            className="inline-flex items-center justify-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-5 py-2.5 rounded-lg disabled:opacity-60"
          >
            {t("app.benchmark.goToSettings", "Go to Settings")}
          </a>
        </div>
      )}

      {!error && optedIn && rows.length === 0 && (
        <div className="glass-effect rounded-lg p-6 text-center text-sm text-muted-foreground">
          {t(
            "app.benchmark.notEnoughData",
            "Not enough platform data yet for your region/category. Check back as more companies join.",
          )}
        </div>
      )}

      <div className="space-y-3">
        {rows.map((row) => {
          // A zero platform average is a denominator, not a comparison. This
          // used to fall through to `pct = 0`, which rendered a grey dash and
          // "0%" — the same pixels as "you are exactly on the platform
          // average", which is the one thing that cannot be known when there
          // is nothing to average against. Null now, and the cell says so.
          const base = Number(row.platformAvgPrice);
          const mine = Number(row.yourAvgPrice);
          const comparable =
            Number.isFinite(base) && Number.isFinite(mine) && base !== 0;
          const pct = comparable ? Math.round(((mine - base) / base) * 100) : null;
          const Icon = pct === null ? Minus : pct > 3 ? TrendingUp : pct < -3 ? TrendingDown : Minus;
          const tone =
            pct === null
              ? "text-muted-foreground"
              : pct > 3
                ? "text-[#2ea043]"
                : pct < -3
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground";

          return (
            <div
              key={row.categoryId}
              className="glass-effect card-hover rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{row.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {t("app.benchmark.sampleLine", { count: row.sampleSize })}
                </div>
              </div>

              <div className="flex items-center gap-6 sm:gap-8">
                {/* formatAppMoney(null) is "$0.00" — see lib/format/money.js.
                    Every amount on this row is therefore gated before it
                    reaches the formatter, because an average nobody could
                    compute must not print as a price anybody charges. */}
                <div>
                  <div className="text-xs text-muted-foreground">{t("app.benchmark.yourAverage", "Your average")}</div>
                  <div className="font-semibold">
                    {row.yourAvgPrice === null || row.yourAvgPrice === undefined
                      ? "—"
                      : money(row.yourAvgPrice)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t("app.benchmark.platformAverage", "Platform average")}</div>
                  <div className="font-semibold">
                    {row.platformAvgPrice === null || row.platformAvgPrice === undefined
                      ? "—"
                      : money(row.platformAvgPrice)}
                  </div>
                </div>
                <div className={`flex items-center gap-1 ${tone}`}>
                  <Icon size={16} />
                  <span className="text-sm font-medium">
                    {pct === null ? "—" : `${pct > 0 ? "+" : ""}${pct}%`}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
