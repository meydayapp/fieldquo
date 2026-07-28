// app/(app)/analytics/digest/page.js
"use client";

import { useEffect, useState } from "react";
import { ChevronDown, AlertTriangle, TrendingDown } from "lucide-react";

export default function DigestPage() {
  const [digests, setDigests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    fetch("/api/analytics/digests")
      .then((r) => r.json())
      .then((res) => {
        setDigests(res);
        setLoading(false);
        if (res[0]) setOpenId(res[0].id);
      });
  }, []);

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-40 bg-accent rounded" />
          <div className="h-40 bg-accent rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg md:text-xl font-semibold">Monthly Digest</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Automated summaries of how your business performed each month.
        </p>
      </div>

      {digests.length === 0 && (
        <div className="glass-effect rounded-lg p-6 text-center text-sm text-muted-foreground">
          No digests yet — your first monthly summary will appear here after
          your first full month of activity.
        </div>
      )}

      <div className="space-y-3">
        {digests.map((d) => {
          const isOpen = openId === d.id;
          const period = `${new Date(d.periodStart).toLocaleDateString(
            "en-US",
            {
              month: "long",
              year: "numeric",
            },
          )}`;
          const flags = d.highlightsJson?.flags || [];

          return (
            <div key={d.id} className="glass-effect rounded-lg overflow-hidden">
              <button
                onClick={() => setOpenId(isOpen ? null : d.id)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div>
                  <div className="font-medium">{period}</div>
                  {flags.length > 0 && (
                    <div className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                      <AlertTriangle size={12} />
                      {flags.length} {flags.length === 1 ? "flag" : "flags"}{" "}
                      this month
                    </div>
                  )}
                </div>
                <ChevronDown
                  size={18}
                  className={`transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                  <p className="text-sm leading-relaxed whitespace-pre-line">
                    {d.summaryText}
                  </p>

                  {flags.length > 0 && (
                    <div className="space-y-2">
                      {flags.map((f, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 text-sm bg-amber-50 dark:bg-amber-950/40 rounded-md p-3"
                        >
                          <TrendingDown
                            size={16}
                            className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0"
                          />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {d.highlightsJson?.metrics && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                      {Object.entries(d.highlightsJson.metrics).map(
                        ([label, value]) => (
                          <div key={label} className="text-center">
                            <div className="text-xs text-muted-foreground capitalize">
                              {label.replace(/_/g, " ")}
                            </div>
                            <div className="font-semibold">{value}</div>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
