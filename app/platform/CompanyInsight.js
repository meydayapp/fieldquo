// app/platform/CompanyInsight.js
//
// One company's numbers, against everyone else's — the panel you open before
// picking up the phone.
//
// ── Why the "we can't compare" states are as designed as the numbers ───────
//
// On today's data every company is too thin to compare and there is no cohort
// to compare against. If those states rendered as blanks or zeroes the panel
// would look broken, and the natural reaction is to distrust the numbers that
// ARE real. So each refusal says which of the three problems it is, and their
// own figure is still shown — that part is true regardless.
"use client";

import { useEffect, useState } from "react";
import { Loader2, X, ArrowUp, ArrowDown, Minus, Phone } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

const WHY = {
  no_data: "They haven't done this yet.",
  their_sample_thin: "Too few to compare — the number shown is the raw ratio.",
  cohort_thin: "Not enough other companies doing this to have a median.",
  no_median: "No usable median across the other companies.",
};

const POSITION = {
  ahead: { icon: ArrowUp, cls: "text-emerald-600 dark:text-emerald-400", word: "ahead of" },
  behind: { icon: ArrowDown, cls: "text-amber-700 dark:text-amber-400", word: "behind" },
  in_line: { icon: Minus, cls: "text-muted-foreground", word: "in line with" },
};

function display(metric) {
  if (metric.value === null) return "—";
  switch (metric.key) {
    case "medianQuoteValue":
      return `$${Number(metric.value).toLocaleString()}`;
    case "medianComposeSeconds":
      return `${metric.value}s`;
    case "medianDecisionDays":
      return `${metric.value}d`;
    case "quotesSent":
      return String(metric.value);
    default:
      return metric.display;
  }
}

function displayMedian(metric) {
  if (metric.cohortMedian === null) return null;
  return display({ ...metric, value: metric.cohortMedian, display: `${metric.cohortMedian}%` });
}

export default function CompanyInsight({ companyId, name, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!companyId) return;
    setData(null);
    setError("");
    fetchJson(`/api/platform/analytics/tenants/${companyId}`)
      .then(setData)
      .catch((err) => setError(err?.message || "Couldn't load this company."));
  }, [companyId]);

  if (!companyId) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="w-full max-w-xl h-full bg-background border-l border-border overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-background border-b border-border px-6 py-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-foreground">{data?.company?.name || name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data
                ? `Compared against ${data.cohortSize} other companies`
                : "Working it out…"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && <p className="text-sm text-muted-foreground">{error}</p>}

          {!data && !error && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          )}

          {data && (
            <>
              {/* ── What to open the call with ─────────────────────────────
                  Only ever drawn from comparable metrics, and only the
                  furthest in each direction — a call opening with eight
                  numbers is a call nobody finishes. */}
              {data.talkingPoints.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-2">
                    <Phone size={12} /> Worth mentioning
                  </h3>
                  <ul className="space-y-2">
                    {data.talkingPoints.map((p, i) => (
                      <li
                        key={i}
                        className={`text-sm ${
                          p.tone === "good"
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-amber-800 dark:text-amber-300"
                        }`}
                      >
                        {p.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Them vs everyone else
                </h3>
                <div className="space-y-2">
                  {data.comparison.map((m) => {
                    const pos = m.position ? POSITION[m.position] : null;
                    const Icon = pos?.icon;
                    return (
                      <div
                        key={m.key}
                        className="rounded-lg border border-border bg-card px-4 py-3"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm text-foreground">{m.label}</span>
                          <span className="text-sm font-semibold tabular-nums text-foreground">
                            {display(m)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-xs">
                          {m.comparable ? (
                            <>
                              {Icon && <Icon size={12} className={pos.cls} />}
                              <span className={pos.cls}>
                                {Math.abs(m.deltaPct)}% {pos.word} the median
                              </span>
                              <span className="text-muted-foreground">
                                ({displayMedian(m)} across {m.cohortSize})
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">
                              {WHY[m.reason] || "Not comparable yet."}
                              {m.sample > 0 && ` ${m.sample} sample(s).`}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {data.trades.length > 0 && (
                <section>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    What they quote
                  </h3>
                  <div className="rounded-lg border border-border bg-card divide-y divide-border">
                    {data.trades.map((t) => (
                      <div key={t.categoryKey} className="px-4 py-2.5 flex items-baseline justify-between gap-3">
                        <span className="text-sm text-foreground">{t.label}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {t.quotes} quote(s) · won {t.winRateLabel} · median{" "}
                          {/* `Number(t.medianQuote || 0)` printed "$0" for a
                              trade whose median did not come back — on the
                              panel written to be read out on a sales call.
                              Every other unknown on this screen is an em
                              dash; this one claimed a figure. */}
                          {Number.isFinite(Number(t.medianQuote)) &&
                          t.medianQuote !== null &&
                          t.medianQuote !== ""
                            ? `$${Number(t.medianQuote).toLocaleString()}`
                            : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
