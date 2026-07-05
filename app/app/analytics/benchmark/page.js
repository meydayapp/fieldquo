// app/(app)/analytics/benchmark/page.js
"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function BenchmarkPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics/benchmark")
      .then((r) => r.json())
      .then((res) => {
        setData(res);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-48 bg-gray-200 rounded" />
          <div className="h-24 bg-gray-200 rounded-lg" />
          <div className="h-24 bg-gray-200 rounded-lg" />
        </div>
      </div>
    );
  }

  const rows = data?.categories || [];
  const optedIn = data?.shareAnonymizedPricing;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg md:text-xl font-semibold">How You Compare</h1>
        <p className="text-sm text-gray-500 mt-1">
          Your average quote pricing vs. the anonymized platform average, by
          service category.
        </p>
      </div>

      {!optedIn && (
        <div className="glass-effect rounded-lg p-4 mb-6 text-sm">
          <p className="mb-2">
            Benchmarking is opt-in. Turn it on in Settings to see how your
            pricing compares — your individual quotes are never shared, only
            aggregated averages.
          </p>
          <a
            href="/settings/business-info"
            className="admin-btn-primary inline-block text-sm"
          >
            Go to Settings
          </a>
        </div>
      )}

      {optedIn && rows.length === 0 && (
        <div className="glass-effect rounded-lg p-6 text-center text-sm text-gray-500">
          Not enough platform data yet for your region/category. Check back as
          more companies join.
        </div>
      )}

      <div className="space-y-3">
        {rows.map((row) => {
          const diff = row.yourAvgPrice - row.platformAvgPrice;
          const pct = row.platformAvgPrice
            ? Math.round((diff / row.platformAvgPrice) * 100)
            : 0;
          const Icon = pct > 3 ? TrendingUp : pct < -3 ? TrendingDown : Minus;
          const tone =
            pct > 3
              ? "text-[#2ea043]"
              : pct < -3
                ? "text-amber-600"
                : "text-gray-500";

          return (
            <div
              key={row.categoryId}
              className="glass-effect card-hover rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{row.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {row.sampleSize} quotes in your region this quarter
                </div>
              </div>

              <div className="flex items-center gap-6 sm:gap-8">
                <div>
                  <div className="text-xs text-gray-500">Your average</div>
                  <div className="font-semibold">
                    ${row.yourAvgPrice.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Platform average</div>
                  <div className="font-semibold">
                    ${row.platformAvgPrice.toLocaleString()}
                  </div>
                </div>
                <div className={`flex items-center gap-1 ${tone}`}>
                  <Icon size={16} />
                  <span className="text-sm font-medium">
                    {pct > 0 ? "+" : ""}
                    {pct}%
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
