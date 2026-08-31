// app/(app)/analytics/digest/page.js
"use client";

import { useEffect, useState } from "react";
import { ChevronDown, AlertTriangle, TrendingDown } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function DigestPage() {
  const { t } = useTranslation();
  const [digests, setDigests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchJson("/api/analytics/digests");
        setDigests(res);
        if (res[0]) setOpenId(res[0].id);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
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
        <h1 className="text-lg md:text-xl font-semibold">{t("app.digest.title", "Monthly Digest")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.digest.subtitle", "Automated summaries of how your business performed each month.")}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 mb-6 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {!error && digests.length === 0 && (
        <div className="glass-effect rounded-lg p-6 text-center text-sm text-muted-foreground">
          {t(
            "app.digest.empty",
            "No digests yet — your first monthly summary will appear here after your first full month of activity.",
          )}
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
                      {flags.length}{" "}
                      {flags.length === 1
                        ? t("app.digest.flag", "flag")
                        : t("app.digest.flags", "flags")}{" "}
                      {t("app.digest.thisMonth", "this month")}
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

                  {/* Older digests, generated before this existed, carry no
                      callInsights key at all — omitted rather than rendering
                      an empty section for a month that never looked. A digest
                      generated AFTER this shipped always carries one, even
                      when there was nothing to read (see
                      lib/ai/callTranscriptDigest.js — absence is stated, not
                      silently dropped, once the field exists). */}
                  {d.highlightsJson?.callInsights && (
                    <CallInsights ci={d.highlightsJson.callInsights} t={t} />
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

// The conversations behind this month's won and lost quotes — see
// lib/ai/callTranscriptDigest.js for what this reads and the rules it
// follows. Reasons AI didn't run are named rather than the section vanishing
// silently, same rule the emptiness case follows: absence is a statement, not
// a gap in the page.
function CallInsights({ ci, t }) {
  if (!ci.hasData) {
    return (
      <div className="pt-2 border-t border-border/60">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          {t("app.digest.calls.title", "Calls behind this month's decisions")}
        </div>
        <p className="text-sm text-muted-foreground">
          {t(
            "app.digest.calls.none",
            "No won or lost quotes this month were linked to a phone call.",
          )}
        </p>
      </div>
    );
  }

  if (!ci.aiRead) {
    const reasonKey =
      ci.reason === "quota_exceeded"
        ? "app.digest.calls.quotaExceeded"
        : ci.reason === "model_empty"
          ? "app.digest.calls.modelEmpty"
          : "app.digest.calls.unavailable";
    const fallback =
      ci.reason === "quota_exceeded"
        ? "{count} calls behind this month's decisions could have been read, but this month's FieldQuo AI allowance is used up."
        : ci.reason === "model_empty"
          ? "{count} calls were sent for reading but nothing came back — this will try again next month."
          : "{count} calls behind this month's decisions could have been read, but FieldQuo AI isn't available on this deployment.";
    return (
      <div className="pt-2 border-t border-border/60">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          {t("app.digest.calls.title", "Calls behind this month's decisions")}
        </div>
        <p className="text-sm text-muted-foreground">
          {t(reasonKey, fallback, { count: ci.read })}
        </p>
      </div>
    );
  }

  return (
    <div className="pt-2 border-t border-border/60">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
        {t("app.digest.calls.title", "Calls behind this month's decisions")}
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {ci.capped
          ? t(
              "app.digest.calls.summaryCapped",
              "Read the {read} most recent of {total} calls linked to a decision this month.",
              { read: ci.read, total: ci.totalCandidates },
            )
          : t(
              "app.digest.calls.summary",
              "Read {read} of {total} calls linked to a decision this month.",
              { read: ci.read, total: ci.totalCandidates },
            )}
      </p>
      <div className="space-y-3">
        {ci.calls.map((c) => (
          <div key={c.quoteId} className="text-sm rounded-md border border-border p-3">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                  c.outcome === "won"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                    : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                }`}
              >
                {c.outcome === "won"
                  ? t("app.digest.calls.won", "Won")
                  : t("app.digest.calls.lost", "Lost")}
              </span>
              <span className="text-muted-foreground text-xs">
                {c.quoteNumber || t("app.digest.calls.quoteFallback", "Quote")}
              </span>
            </div>
            {c.notes.length > 0 ? (
              <ul className="list-disc pl-4 space-y-0.5">
                {c.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-xs">
                {t(
                  "app.digest.calls.nothingNotable",
                  "Nothing on this call stood out beyond what's already on the quote.",
                )}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
