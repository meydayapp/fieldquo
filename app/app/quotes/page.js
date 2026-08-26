// app/app/quotes/page.js
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { FileText, Plus, Search, ArrowRight } from "lucide-react";
import { fetchArray } from "@/lib/loadState";
import ListState from "@/app/components/ListState";

import { useTranslation } from "@/app/hooks/useTranslation";
const STATUS_STYLES = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  accepted: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  declined: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
};

export default function QuotesPage() {
  const { t } = useTranslation();
  // null until the server answers — see lib/loadState.js. The stat tiles below
  // read this, and four tiles reading "0" is a much more convincing lie than
  // any red banner is a correction.
  const [quotes, setQuotes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [errorKey, setErrorKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErrorKey("");
    const result = await fetchArray("/api/quotes");
    if (result.aborted) return;
    if (result.ok) setQuotes(result.data);
    else setErrorKey(result.errorKey);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = (quotes ?? []).filter((q) => {
    const s = search.toLowerCase();
    return (
      q.quoteNumber?.toLowerCase().includes(s) ||
      q.client?.name?.toLowerCase().includes(s)
    );
  });

  // Null when the load failed or is still running. The tiles render an em dash
  // rather than 0: "Accepted 0" on a transient 401 tells a contractor their
  // won work vanished.
  const stats = quotes && {
    total: quotes.length,
    draft: quotes.filter((q) => q.status === "draft").length,
    sent: quotes.filter((q) => q.status === "sent").length,
    accepted: quotes.filter((q) => q.status === "accepted").length,
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("app.quotes.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("app.quotes.subtitle")}</p>
        </div>
        <Link
          data-tour="quotes-new"
          href="/app/quotes/new"
          className="flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold"
        >
          <Plus size={16} /> {t("app.quotes.new")}
        </Link>
      </div>

      <div data-tour="quotes-stats" className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          // "Sent" here counts quotes whose CURRENT status is sent, while the
          // dashboard's "Quotes sent" counts every quote ever sent. Both are
          // legitimate and they disagree the moment a client accepts one: the
          // dashboard said 2, this tile said 0, and neither said which question
          // it was answering.
          //
          // Renamed rather than redefined. The number is genuinely useful —
          // it is the follow-up list — it just isn't "sent", it's "sent and
          // nobody has replied".
          { label: "Total", value: stats?.total },
          { label: "Draft", value: stats?.draft },
          { label: "Awaiting reply", value: stats?.sent },
          { label: "Accepted", value: stats?.accepted },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-card border border-border rounded-xl p-4 text-center"
          >
            <div className="text-2xl font-bold text-foreground">
              {s.value ?? "—"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div data-tour="quotes-search" className="relative max-w-sm">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("app.quotes.search")}
          className="w-full pl-9 pr-3 py-2.5 border border-border rounded-lg text-sm"
        />
      </div>

      <ListState
        loading={loading}
        errorKey={errorKey}
        onRetry={load}
        isEmpty={filtered.length === 0}
        skeleton={
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-accent rounded-xl" />
            ))}
          </div>
        }
        empty={
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <FileText size={40} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? t("app.quotes.noMatch") : t("app.quotes.emptyTitle")}
            </p>
            {!search && (
              <Link
                href="/app/quotes/new"
                className="text-sm font-medium text-foreground underline mt-2 inline-block"
              >
                {t("app.quotes.empty")}
              </Link>
            )}
          </div>
        }
      >
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {filtered.map((q) => (
            <Link
              key={q.id}
              href={`/app/quotes/${q.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-muted"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <FileText size={18} className="text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">
                      {q.quoteNumber}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLES[q.status]}`}
                    >
                      {q.status}
                    </span>
                    {/* An instant estimate's review state, which `status` alone
                        cannot express. Approving one in Estimate Reviews clears
                        needsReview but deliberately leaves the quote in `draft`
                        — approval is the company confirming the PRICE, not the
                        client accepting the quote. Without this the list showed
                        a bare "draft" either side of the approval, so the
                        approval looked like it hadn't registered and the next
                        step (send it) was invisible. */}
                    {q.autoEstimated && q.needsReview && (
                      <span className="text-xs px-2 py-0.5 rounded-full shrink-0 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                        {t("app.quotes.needsReview")}
                      </span>
                    )}
                    {q.autoEstimated && !q.needsReview && q.status === "draft" && (
                      <span className="text-xs px-2 py-0.5 rounded-full shrink-0 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                        {t("app.quotes.approvedReadyToSend")}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {q.client?.name || "Unknown client"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="font-semibold text-foreground">
                  {/* `pricingHidden` means the API removed the totals for a
                      member without showPricing. Number(undefined) is NaN, so
                      the alternative here is literally "$NaN" on every row. */}
                  {q.pricingHidden ? (
                    <span className="text-muted-foreground font-normal">—</span>
                  ) : (
                    `$${Number(q.total).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}`
                  )}
                </span>
                <ArrowRight size={16} className="text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      </ListState>
    </div>
  );
}
