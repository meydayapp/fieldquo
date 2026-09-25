// app/(app)/analytics/benchmark/page.js
//
// Pricing insights: the PRESET LIBRARY — every seeded trade's services and
// add-ons with a Min / Median / Max range and the company's own price beside
// each, editable in place — and, under it, the "How you compare" block that
// was this whole page until 2026-09-24: the company's average quote against
// the anonymised platform average, per enabled trade.
//
// ── Two sections, two sources ──────────────────────────────────────────────
//
// The library's ranges come from the seeds (lib/services/presetLibrary.js —
// derived, converted and rounded there, never a source's number verbatim)
// and the company's prices from its own Product rows. "Your price" writes
// `Product.unitPrice` through PATCH /api/products/[id], the same route the
// price editor and Settings > Services use, so there is one price and one
// way to change it. The compare block is unchanged: /api/analytics/benchmark,
// gated on showPricing, k-anonymous.
//
// The "Like me" segment is drawn and disabled. The cohort behind it — the
// FieldQuo median across companies that share, k-anonymous — does not exist
// yet, and a segment that switched to the same numbers would be a control
// that appears to work and does not. The note beside it says what it waits
// for, in the owner's words: it arrives as more companies share.
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyMoney, useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { formatMoney } from "@/lib/currency";
import { libraryTrades, libraryForTrade, positionInRange } from "@/lib/services/presetLibrary";
import { offeredOnly } from "@/lib/products/offered";

const whole = (n, currency, language) =>
  n == null ? null : formatMoney(n, currency, language).replace(/[.,]00(?=\D*$)/, "");

export default function BenchmarkPage() {
  const money = useCompanyMoney();
  const { currency } = useCompanyPreferences();
  const { t, language } = useTranslation();
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
        <h1 className="text-lg md:text-xl font-semibold">{t("app.benchmark.pageTitle", "Pricing insights")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "app.benchmark.pageSubtitle",
            "The preset library — typical ranges for every trade's services and add-ons beside your own price — and how your quotes compare to the anonymised platform average.",
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
          {/* Seventh, same argument: Reports › Commissions. It gates itself
              (your own figures unless payroll or job costing says otherwise),
              and is also linked from Payroll, where people look for pay. */}
          <Link
            href="/app/analytics/commissions"
            className="inline-flex items-center gap-1.5 text-sm text-foreground underline"
          >
            {t("app.commissions.reportTitle")}
          </Link>
        </div>
      </div>

      <PresetLibrary currency={currency} language={language} t={t} />

      <h2 className="mt-8 text-base font-semibold" data-benchmark-compare>{t("app.benchmark.title", "How You Compare")}</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-4">
        {t(
          "app.benchmark.subtitle",
          "Your average quote pricing vs. the anonymized platform average, by service category.",
        )}
      </p>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 mb-6 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {!error && !optedIn && (
        <div className="glass-effect rounded-lg p-4 mb-6 text-sm">
          <p className="mb-2">
            {t(
              "app.benchmark.sharingOffNote",
              "Benchmark sharing is switched off for your company. It is on by default under the Terms you accepted; turn it back on in Settings to see how your pricing compares — your individual quotes are never shared, only aggregated averages.",
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

/**
 * The preset library: trade tabs → services and add-ons → Min / Median /
 * Max and the company's own price, editable inline.
 */
function PresetLibrary({ currency: providerCurrency, language, t }) {
  // The provider carries the billing currency once the layout has it; until
  // then (and in a harness that mounts the page alone) business-info answers
  // it, exactly as Settings > Services does. Never a guessed "$".
  const [infoCurrency, setInfoCurrency] = useState(null);
  const currency = providerCurrency || infoCurrency || "CAD";
  const [enabled, setEnabled] = useState(null); // the company's enabled trade keys, null until answered
  const [products, setProducts] = useState([]);
  const [productsError, setProductsError] = useState("");
  const [trade, setTrade] = useState(null);
  const [segment] = useState("national");

  const loadProducts = async () => {
    try {
      const res = await fetch("/api/products");
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setProductsError(body?.error || t("app.access.pricingHidden"));
        setProducts([]);
        return;
      }
      // A removed service (lib/products/offered.js) is not the company's
      // price any more; its row reads "not in your catalogue".
      setProducts(offeredOnly(body));
      setProductsError("");
    } catch {
      setProductsError(t("app.load.network"));
    }
  };

  useEffect(() => {
    loadProducts();
    (async () => {
      try {
        const res = await fetch("/api/settings/business-info");
        const body = res.ok ? await res.json().catch(() => null) : null;
        if (typeof body?.currency === "string" && body.currency) setInfoCurrency(body.currency);
      } catch {
        // The provider's currency, or the schema default, stands.
      }
    })();
    (async () => {
      try {
        const res = await fetch("/api/settings/service-categories");
        const body = await res.json().catch(() => null);
        setEnabled(res.ok && Array.isArray(body) ? body.filter((c) => c.enabled).map((c) => c.key) : []);
      } catch {
        setEnabled([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trades = useMemo(() => libraryTrades(enabled || []), [enabled]);
  useEffect(() => {
    if (enabled && !trade && trades.length) setTrade(trades[0].key);
  }, [enabled, trade, trades]);

  const library = useMemo(() => (trade ? libraryForTrade(trade, { products, currency, language }) : null), [trade, products, currency, language]);

  return (
    <section data-preset-library className="glass-effect rounded-lg p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{t("app.benchmark.libraryTitle", "Preset library")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(
              "app.benchmark.libraryNote",
              "Typical ranges from industry benchmarks, converted to your currency and rounded — a guideline, not a fact about your company. Min and Max are the lower and upper quartiles. Your price is your own catalogue row; change it here or in Settings.",
            )}
          </p>
        </div>
        {/* The segment: national today, "like me" when the FieldQuo cohort
            exists. Drawn disabled, with the reason, rather than left out. */}
        <div className="flex items-center gap-2" data-benchmark-segment>
          <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
            <button type="button" className={`rounded-md px-2.5 py-1 font-medium ${segment === "national" ? "bg-inverted text-inverted-foreground" : "text-muted-foreground"}`} aria-pressed={segment === "national"}>
              {t("app.benchmark.segmentNational", "National")}
            </button>
            <button type="button" disabled title={t("app.benchmark.segmentLikeMeNote", "Coming as more companies share their figures.")} className="rounded-md px-2.5 py-1 font-medium text-muted-foreground disabled:opacity-50" aria-pressed={false}>
              {t("app.benchmark.segmentLikeMe", "Like me")}
            </button>
          </div>
          <span className="text-[11px] text-muted-foreground">{t("app.benchmark.segmentLikeMeNote", "Coming as more companies share their figures.")}</span>
        </div>
      </div>

      {enabled === null ? (
        <div className="mt-3 animate-pulse h-8 w-64 bg-accent rounded" />
      ) : (
        <div className="mt-3 -mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" data-benchmark-trades>
          {trades.map((tr) => (
            <button
              key={tr.key}
              type="button"
              role="tab"
              aria-selected={trade === tr.key}
              onClick={() => setTrade(tr.key)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${trade === tr.key ? "border-foreground bg-inverted text-inverted-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              {tr.label}
              {tr.enabled && <span className="ml-1 opacity-70">•</span>}
            </button>
          ))}
        </div>
      )}

      {productsError && <p className="mt-2 text-xs text-amber-700 dark:text-amber-500">{productsError}</p>}

      {library && (
        <div className="mt-3 space-y-4">
          <LibraryTable
            title={t("app.benchmark.services", "Services")}
            rows={library.services.map((s) => ({ key: s.seedKey, name: s.name, unit: s.unit, range: s.range, product: s.product, pricedBy: s.pricedBy }))}
            currency={currency}
            language={language}
            canEdit={!productsError}
            onSaved={loadProducts}
            t={t}
            emptyText={t("app.benchmark.noServices", "No seeded services for this trade.")}
          />
          <LibraryTable
            title={t("app.benchmark.addOns", "Add-ons")}
            rows={library.addOns.map((a) => ({ key: a.name, name: a.name, unit: a.unit, range: a.preset != null ? { min: null, median: a.preset, max: null, currency } : null, product: a.product, preset: true }))}
            currency={currency}
            language={language}
            canEdit={!productsError}
            onSaved={loadProducts}
            t={t}
            emptyText={t("app.benchmark.noAddOns", "No standard add-ons for this trade.")}
          />
        </div>
      )}
    </section>
  );
}

function LibraryTable({ title, rows, currency, language, canEdit, onSaved, t, emptyText }) {
  return (
    <div data-library-table>
      <h3 className="text-sm font-medium">{title} <span className="text-xs font-normal text-muted-foreground">({rows.length})</span></h3>
      {rows.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="mt-1 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-1 pr-2 font-medium">{t("app.benchmark.colService", "Service")}</th>
                <th className="py-1 pr-2 text-right font-medium">{t("app.benchmark.colMin", "Min")}</th>
                <th className="py-1 pr-2 text-right font-medium">{t("app.benchmark.colMedian", "Median")}</th>
                <th className="py-1 pr-2 text-right font-medium">{t("app.benchmark.colMax", "Max")}</th>
                <th className="py-1 pl-2 text-right font-medium">{t("app.benchmark.colYourPrice", "Your price")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <LibraryRow key={r.key} row={r} currency={currency} language={language} canEdit={canEdit} onSaved={onSaved} t={t} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LibraryRow({ row, currency, language, canEdit, onSaved, t }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const price = row.product?.unitPrice ?? null;
  const pos = positionInRange(price, row.range);
  const tone = pos === "above" ? "text-[#2ea043]" : pos === "below" ? "text-amber-600 dark:text-amber-400" : "text-foreground";

  async function save() {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      setErr(t("app.benchmark.priceInvalid", "Enter a price of zero or more."));
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const res = await fetch(`/api/products/${row.product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitPrice: n }),
      });
      if (!res.ok) {
        setErr(await reportResponseError(res));
        return;
      }
      setEditing(false);
      await onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-t border-border/60 align-top" data-library-row>
      <td className="py-1.5 pr-2">
        <div className="text-foreground">{row.name}</div>
        <div className="text-[11px] text-muted-foreground">
          {row.unit ? t(`app.quoteReview.unit_${row.unit}`, row.unit) : null}
          {row.pricedBy ? ` · ${t("app.benchmark.pricedByTakeoff", "priced by the takeoff")}` : null}
          {row.preset ? ` · ${t("app.benchmark.presetOnly", "preset price, no range yet")}` : null}
        </div>
      </td>
      <td className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">{whole(row.range?.min, currency, language) ?? "—"}</td>
      <td className="py-1.5 pr-2 text-right tabular-nums text-foreground">{whole(row.range?.median, currency, language) ?? "—"}</td>
      <td className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">{whole(row.range?.max, currency, language) ?? "—"}</td>
      <td className="py-1.5 pl-2 text-right tabular-nums">
        {!row.product ? (
          <span className="text-[11px] text-muted-foreground">{t("app.benchmark.notInCatalogue", "not in your catalogue")}</span>
        ) : editing ? (
          <span className="inline-flex items-center gap-1">
            <input
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setEditing(false);
              }}
              className="w-24 rounded border border-border bg-background px-1.5 py-0.5 text-right text-sm text-foreground"
              autoFocus
            />
            <button type="button" onClick={save} disabled={saving} className="rounded bg-inverted px-2 py-0.5 text-[11px] font-semibold text-inverted-foreground disabled:opacity-50">
              {saving ? <Loader2 size={11} className="inline animate-spin" /> : t("app.benchmark.save", "Save")}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-[11px] text-muted-foreground">{t("app.benchmark.cancel", "Cancel")}</button>
          </span>
        ) : (
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => {
              setValue(price ?? "");
              setEditing(true);
            }}
            title={t("app.benchmark.editPrice", "Edit your price")}
            className={`font-medium underline-offset-2 hover:underline disabled:no-underline ${tone}`}
          >
            {price != null ? whole(price, currency, language) : t("app.serviceSeeds.noPrice")}
          </button>
        )}
        {err && <div className="text-[11px] text-red-600 dark:text-red-400">{err}</div>}
      </td>
    </tr>
  );
}
