// app/platform/billing/subscriptions/page.js
//
// Who's paying, who's about to lapse, and who can't actually be billed.
//
// The last of those is the one this screen exists for. A subscription with no
// Stripe id looks completely normal in the database and completely normal in
// the UI — it just never charges anyone. Surfacing it here is the difference
// between noticing in a week and noticing when MRR doesn't match the bank.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, AlertCircle, CreditCard, AlertTriangle } from "lucide-react";
import MetricCard, { money, count } from "@/app/components/platform/MetricCard";

const FILTERS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "trialing", label: "Trialing" },
  { value: "past_due", label: "Past due" },
  { value: "canceled", label: "Canceled" },
];

const STATUS_STYLES = {
  active: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  trialing: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  past_due: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900",
  canceled: "bg-muted text-muted-foreground border-border",
};

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function SubscriptionsPage() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const res = await fetch(`/api/platform/billing/subscriptions?${params}`);
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || `Request failed (${res.status}).`);
      }
      setData(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Subscriptions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Who&apos;s on what, and what needs attention.
        </p>
      </div>

      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="MRR"
            value={money(data.summary.mrr, { compact: true })}
            note={`${count(data.summary.active)} active`}
          />
          <MetricCard
            label="Trialing"
            value={count(data.summary.trialing)}
          />
          <MetricCard
            label="Trials ending"
            value={count(data.summary.expiringSoon)}
            note="Within 7 days"
            tone={data.summary.expiringSoon > 0 ? "warning" : "default"}
          />
          <MetricCard
            label="Not billable"
            value={count(data.summary.unbillable)}
            note="Active but no Stripe subscription"
            tone={data.summary.unbillable > 0 ? "warning" : "default"}
          />
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatus(f.value)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border ${
              status === f.value
                ? "bg-inverted text-inverted-foreground border-inverted"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : !data?.rows?.length ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <CreditCard size={28} className="text-muted-foreground mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">
            No subscriptions{status ? ` with status "${status}"` : ""} yet.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
          {data.rows.map((r) => {
            const urgent =
              r.trialDaysLeft !== null &&
              r.trialDaysLeft >= 0 &&
              r.trialDaysLeft <= 7;

            return (
              <Link
                key={r.id}
                href={`/platform/companies/${r.companyId}`}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-muted"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground truncate">
                      {r.companyName}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        STATUS_STYLES[r.status] ||
                        "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {r.status}
                    </span>
                    {urgent && (
                      <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900">
                        Trial ends in {r.trialDaysLeft}d
                      </span>
                    )}
                    {r.status === "active" && !r.billable && (
                      <span
                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900"
                        title="Active but no Stripe subscription — this company is not being charged"
                      >
                        <AlertTriangle size={10} /> Not billing
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {r.companyEmail || "no email"} · since {formatDate(r.since)}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-medium text-foreground">
                    {r.planName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {money(r.priceMonthly, { compact: true })}/mo
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
