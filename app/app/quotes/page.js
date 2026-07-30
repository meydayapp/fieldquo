// app/app/quotes/page.js
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FileText, Plus, Search, ArrowRight } from "lucide-react";

import { useTranslation } from "@/app/hooks/useTranslation";
const STATUS_STYLES = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  accepted: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  declined: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
};

export default function QuotesPage() {
  const { t } = useTranslation();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/quotes")
      .then((r) => r.json())
      .then((data) => setQuotes(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = quotes.filter((q) => {
    const s = search.toLowerCase();
    return (
      q.quoteNumber?.toLowerCase().includes(s) ||
      q.client?.name?.toLowerCase().includes(s)
    );
  });

  const stats = {
    total: quotes.length,
    draft: quotes.filter((q) => q.status === "draft").length,
    sent: quotes.filter((q) => q.status === "sent").length,
    accepted: quotes.filter((q) => q.status === "accepted").length,
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto animate-pulse space-y-4">
        <div className="h-8 w-40 bg-accent rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-accent rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("app.quotes.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("app.quotes.subtitle")}</p>
        </div>
        <Link
          href="/app/quotes/new"
          className="flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold"
        >
          <Plus size={16} /> {t("app.quotes.new")}
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats.total },
          { label: "Draft", value: stats.draft },
          { label: "Sent", value: stats.sent },
          { label: "Accepted", value: stats.accepted },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-card border border-border rounded-xl p-4 text-center"
          >
            <div className="text-2xl font-bold text-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="relative max-w-sm">
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

      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <FileText size={40} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {search ? "No quotes match your search." : "No quotes yet."}
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
      ) : (
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
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {q.client?.name || "Unknown client"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="font-semibold text-foreground">
                  $
                  {Number(q.total).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
                <ArrowRight size={16} className="text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
