// app/platform/companies/[id]/CompanyHealth.js
//
// The panel support reads first: is this account healthy, and if not, why?
// The score is never shown alone — the signals that produced it sit right
// underneath, so staff can act on the reason rather than trust a number.
"use client";

import { useEffect, useState } from "react";
import { Loader2, Activity, Check, X, AlertTriangle } from "lucide-react";

const BAND = {
  healthy: { label: "Healthy", cls: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-950/40", ring: "#10b981" },
  at_risk: { label: "At risk", cls: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-950/40", ring: "#f59e0b" },
  dormant: { label: "Dormant", cls: "text-red-700 dark:text-red-300", bg: "bg-red-50 dark:bg-red-950/40", ring: "#ef4444" },
  new: { label: "Too new to score", cls: "text-blue-700 dark:text-blue-300", bg: "bg-blue-50 dark:bg-blue-950/40", ring: "#3b82f6" },
};

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-bold text-foreground tabular-nums">{value}</div>
    </div>
  );
}

export default function CompanyHealth({ companyId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/platform/companies/${companyId}/health`)
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          throw new Error(d?.error || `Request failed (${res.status}).`);
        }
        return res.json();
      })
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const band = data ? BAND[data.band] || BAND.at_risk : null;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <Activity size={16} className="text-muted-foreground" />
        Health
      </h2>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!data && !error && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 size={15} className="animate-spin" /> Loading…
        </div>
      )}

      {data && (
        <>
          <div className="flex items-center gap-4 flex-wrap">
            {/* The score as a ring — readable at a glance across a room. */}
            <div
              className="relative w-20 h-20 rounded-full grid place-items-center shrink-0"
              style={{
                background: `conic-gradient(${band.ring} ${data.score * 3.6}deg, var(--muted, #e5e7eb) 0deg)`,
              }}
            >
              <div className="w-[62px] h-[62px] rounded-full bg-card grid place-items-center">
                <span className="text-xl font-extrabold text-foreground tabular-nums">{data.score}</span>
              </div>
            </div>
            <div className="min-w-0">
              <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full ${band.bg} ${band.cls}`}>
                {band.label}
              </span>
              <p className="text-xs text-muted-foreground mt-1.5">
                {data.brandNew
                  ? `Account is ${data.ageDays} days old — not enough history for a fair score.`
                  : data.metrics.lastSeenDays == null
                    ? "No recorded activity yet."
                    : `Last active ${data.metrics.lastSeenDays} day(s) ago.`}
              </p>
              {data.metrics.lastActivity && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {data.metrics.lastActivity.summary}
                  {data.metrics.lastActivity.actorName ? ` — ${data.metrics.lastActivity.actorName}` : ""}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            <Metric label="Quotes sent 30d" value={data.metrics.quotesSent30} />
            <Metric label="Invoices 30d" value={data.metrics.invoices30} />
            <Metric label="Payments 30d" value={data.metrics.payments30} />
            <Metric label="Open jobs" value={data.metrics.jobsOpen} />
            <Metric label="Team" value={data.metrics.activeMembers} />
            <Metric label="AI calls 30d" value={data.metrics.aiCalls30} />
            <Metric label="AI cost 30d" value={`$${data.metrics.aiCostUsd30.toFixed(2)}`} />
            <Metric label="Subscription" value={data.metrics.subscriptionStatus || "—"} />
          </div>

          {/* Why the score is what it is. Problems first — that's what support acts on. */}
          <ul className="mt-4 space-y-1.5">
            {[...data.signals].sort((a, b) => Number(a.ok) - Number(b.ok)).map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                {s.ok ? (
                  <Check size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                ) : (
                  <X size={14} className="text-red-500 mt-0.5 shrink-0" />
                )}
                <span className={s.ok ? "text-muted-foreground" : "text-foreground"}>{s.label}</span>
              </li>
            ))}
          </ul>

          {!data.metrics.subscriptionStatus && !data.brandNew && (
            <p className="mt-3 text-xs flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              No subscription row — they may be on a trial that never converted, or checkout never completed.
            </p>
          )}
        </>
      )}
    </div>
  );
}
