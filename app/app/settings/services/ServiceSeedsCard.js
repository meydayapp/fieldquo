// app/app/settings/services/ServiceSeedsCard.js
//
// The trade's seeded services, under its card on Settings > Services: the
// company's own price beside the benchmark range for each, "Use typical" to
// copy the median in, the median-of-medians for the trade at the top, and
// "Add missing services for my trade" for a company that predates the seed.
//
// ── What is a fact and what is a guideline ─────────────────────────────────
//
// The company's price is the fact: it is the Product row, and every edit here
// writes it through the same PATCH /api/products/[id] the price editor uses.
// The range is a guideline — an industry benchmark, USD quartiles converted
// for a CAD company by lib/pricing/benchmarkFx.js — and the wording says so
// on every card: "Typical range from industry benchmarks — set your own rate."
// A service the benchmark had no figure for shows "set your rate", never a
// padded number.
//
// Owner/admin only for the writes (the routes refuse anyone else); a reader
// who may not see money never reaches this card, because the products
// endpoint refuses and the card shows its refusal rather than an empty list.
"use client";

import { useEffect, useMemo, useState } from "react";
import { ListPlus, Loader2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import { serviceSeedsFor, tradeBenchmarkSummary, benchmarkForSeedKey } from "@/lib/services/seeds";
import { benchmarkIn } from "@/lib/pricing/benchmarkFx";
import { formatMoney } from "@/lib/currency";
import BenchmarkRange from "@/app/components/pricing/BenchmarkRange";

const whole = (n, currency, language) =>
  n == null ? "" : formatMoney(n, currency, language).replace(/[.,]00(?=\D*$)/, "");

export default function ServiceSeedsCard({ category, currency, canEdit, products, productsError, onProductsChange }) {
  const { t, language } = useTranslation();
  const seed = serviceSeedsFor(category.key);
  const summary = useMemo(() => tradeBenchmarkSummary(category.key), [category.key]);
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [open, setOpen] = useState(false);

  // Reset the one-line result when the trade changes under the card.
  useEffect(() => setAddMsg(null), [category.id]);

  if (!seed) return null;

  const prefix = `fq.${category.key}.`;
  const mine = (products || []).filter((p) => typeof p.seedKey === "string" && p.seedKey.startsWith(prefix));
  const typical = summary?.medianOfMedians != null ? benchmarkIn({ median: summary.medianOfMedians, low: null, high: null, currency: "USD", source: "benchmark" }, currency) : null;

  async function addMissing() {
    setAdding(true);
    setAddMsg(null);
    try {
      const res = await fetch("/api/settings/products/seed-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: category.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || (await reportResponseError(res)));
      setAddMsg({
        text:
          data.created > 0
            ? t("app.serviceSeeds.added", { count: data.created })
            : t("app.serviceSeeds.nothingMissing"),
      });
      if (data.created > 0) await onProductsChange?.();
    } catch (err) {
      setAddMsg({ text: err.message, error: true });
    } finally {
      setAdding(false);
    }
  }

  async function usePrice(product, value) {
    setSavingId(product.id);
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitPrice: value }),
      });
      if (!res.ok) {
        await reportResponseError(res);
        return;
      }
      await onProductsChange?.();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-left text-sm font-medium text-foreground">
          {t("app.serviceSeeds.title")}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {t("app.serviceSeeds.count", { have: mine.length, total: summary?.seedable ?? 0 })}
          </span>
        </button>
        {canEdit && (
          <button
            type="button"
            onClick={addMissing}
            disabled={adding}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {adding ? <Loader2 size={12} className="animate-spin" /> : <ListPlus size={12} />}
            {t("app.serviceSeeds.addMissing")}
          </button>
        )}
      </div>
      {addMsg && (
        <p className={`mt-1 text-xs ${addMsg.error ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>{addMsg.text}</p>
      )}
      {typical && (
        <p className="mt-1 text-xs text-muted-foreground">
          {t("app.serviceSeeds.typicalForTrade", {
            amount: whole(typical.median, currency, language),
            count: summary.withRange,
          })}
        </p>
      )}
      <p className="mt-1 text-[11px] text-muted-foreground">{t("app.serviceSeeds.rangeNote")}</p>

      {open && (
        <div className="mt-2 space-y-2">
          {productsError ? (
            <p className="text-xs text-amber-700 dark:text-amber-500">{productsError}</p>
          ) : mine.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("app.serviceSeeds.none")}</p>
          ) : (
            mine.map((p) => (
              <div key={p.id} className="flex flex-col gap-1 rounded-md border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-foreground break-words">{p.name}</div>
                  <BenchmarkRange
                    benchmark={benchmarkForSeedKey(p.seedKey)}
                    currency={currency}
                    price={p.unitPrice}
                    compact
                    onUse={canEdit && savingId !== p.id ? (v) => usePrice(p, v) : undefined}
                  />
                </div>
                <div className="shrink-0 text-sm tabular-nums text-foreground sm:text-right">
                  {savingId === p.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : p.unitPrice != null ? (
                    <>
                      {whole(p.unitPrice, currency, language)}
                      {p.unit ? <span className="text-xs text-muted-foreground"> / {p.unit}</span> : null}
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t("app.serviceSeeds.noPrice")}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
