// app/platform/page.js
//
// FieldQuo's own dashboard: how the business is doing, not how any one
// company is doing.
//
// The money figures are deliberately labelled apart. MRR is FieldQuo's
// revenue. "Flowing through FieldQuo" is what tenants' clients paid THEM —
// a product-health signal that will be an order of magnitude larger, and
// which would badly overstate the business if the two ever got conflated on
// a slide.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  RefreshCw,
  MailWarning,
  Sparkles,
} from "lucide-react";
import MetricCard, { money, count } from "@/app/components/platform/MetricCard";
import Sparkline from "@/app/components/platform/Sparkline";

export default function PlatformDashboardPage() {
  const [data, setData] = useState(null);
  // Deliberately separate from the overview fetch: an email-health failure
  // must never take the dashboard down, and the dashboard being slow must
  // never delay this warning.
  const [emailHealth, setEmailHealth] = useState(null);
  // Same reasoning. Also the only place the AI key can be checked at all: it's
  // marked Sensitive in Vercel, so it can't be read back or pulled locally —
  // the check has to run where the key already is.
  const [aiHealth, setAiHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/platform/analytics/overview");

      // A 500 from Next in dev returns an HTML error page, not JSON. Calling
      // .json() on it throws a parser error ("The string did not match the
      // expected pattern") which then surfaces as the user-facing message —
      // hiding the real failure. Check status before parsing.
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(
          detail?.error || `Request failed (${res.status}). Check server logs.`,
        );
      }

      setData(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    // Failure is swallowed on purpose. If the check itself can't run we show
    // no banner rather than a scary one — a false alarm here would send
    // someone chasing a DNS problem that doesn't exist.
    fetch("/api/platform/email-health")
      .then((r) => (r.ok ? r.json() : null))
      .then(setEmailHealth)
      .catch(() => {});

    fetch("/api/platform/ai-health")
      .then((r) => (r.ok ? r.json() : null))
      .then(setAiHealth)
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-accent rounded w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-accent rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-accent rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-5">
        <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-semibold">
          <AlertCircle size={18} /> Couldn&apos;t load metrics
        </div>
        <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
        <button
          onClick={load}
          className="mt-3 text-sm font-semibold text-red-700 dark:text-red-300 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const trialShare =
    data.totalCompanies > 0
      ? Math.round((data.trialCompanies / data.totalCompanies) * 100)
      : 0;

  return (
    <div className="space-y-8">
      {/* Loudest thing on the page when it fires, because the failure it
          describes is silent everywhere else: mail is accepted by Resend,
          recorded as sent, and thrown away. No tenant can see this and every
          tenant is affected at once. */}
      {emailHealth && !emailHealth.healthy && emailHealth.problem && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-900 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <MailWarning
              size={20}
              className="text-red-600 dark:text-red-400 shrink-0 mt-0.5"
            />
            <div className="min-w-0">
              <h2 className="font-semibold text-red-800 dark:text-red-200">
                Client email isn&apos;t being delivered
              </h2>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {emailHealth.problem}
              </p>
              <p className="text-xs text-red-700/70 dark:text-red-300/70 mt-2 font-mono">
                Sending as {emailHealth.from}
              </p>
              {/* Three different causes produce the same sentence above, and
                  one of them — a verified domain excluded because a tenant
                  claims it — is not guessable. This shows the raw list. */}
              <a
                href="/api/platform/email-health/domains"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-red-800 dark:text-red-200 underline mt-2 inline-block"
              >
                See what Resend reports
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Amber rather than red: unlike undelivered mail, nothing here is lost.
          Every AI feature degrades to a working non-AI result. It is still the
          only place this is visible — a retired model produces no error
          anywhere, because provider.js catches it and returns "". */}
      {aiHealth && !aiHealth.healthy && aiHealth.problem && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <Sparkles
              size={20}
              className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
            />
            <div className="min-w-0">
              <h2 className="font-semibold text-amber-900 dark:text-amber-200">
                FieldQuo AI isn&apos;t answering
              </h2>
              <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                {aiHealth.problem}
              </p>
              <p className="text-xs text-amber-800/70 dark:text-amber-300/70 mt-2 font-mono">
                OPENAI_MODEL={aiHealth.model}
                {aiHealth.usable?.length
                  ? ` · available: ${aiHealth.usable.join(", ")}`
                  : ""}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            How FieldQuo itself is doing.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* FieldQuo's own revenue */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Your revenue
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="MRR"
            value={money(data.mrr, { compact: true })}
            note={`${count(data.activeSubscriptionCount)} active subscriptions`}
          />
          <MetricCard
            label="ARR"
            value={money(data.arr, { compact: true })}
            note="MRR × 12, at today's rate"
          />
          <MetricCard
            label="Paying companies"
            value={count(data.activeSubscriptionCount)}
            note={`of ${count(data.totalCompanies)} total`}
          />
          <MetricCard
            label="Churned this month"
            value={count(data.churnedThisMonth)}
            tone={data.churnedThisMonth > 0 ? "warning" : "default"}
          />
        </div>
      </section>

      {/* Platform volume — explicitly not revenue */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          Flowing through FieldQuo
        </h2>
        <p className="text-xs text-muted-foreground mb-3">
          What your customers&apos; clients paid <em>them</em>. Product health,
          not your income.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total billed"
            value={money(data.totalBilled, { compact: true })}
            note="All payments recorded, all time"
          />
          <MetricCard
            label="Quoted value"
            value={money(data.quotedValue, { compact: true })}
            note={`${count(data.totalQuotes)} quotes — most never convert`}
          />
          <MetricCard
            label="Invoiced value"
            value={money(data.invoicedValue, { compact: true })}
            note={`${count(data.totalInvoices)} invoices`}
          />
          <MetricCard
            label="This month"
            value={`${count(data.quotesThisMonth)} quotes`}
            note={`${count(data.jobsThisMonth)} jobs created`}
          />
        </div>
      </section>

      {/* Growth */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Growth
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <TrendCard
            title="New companies"
            subtitle="Last 30 days"
            total={data.daily.companies.reduce((s, d) => s + d.count, 0)}
            points={data.daily.companies.map((d) => d.count)}
          />
          <TrendCard
            title="Quotes created"
            subtitle="Last 30 days"
            total={data.daily.quotes.reduce((s, d) => s + d.count, 0)}
            points={data.daily.quotes.map((d) => d.count)}
          />
          <TrendCard
            title="Payments taken"
            subtitle="Last 30 days"
            total={data.daily.payments.reduce((s, d) => s + d.count, 0)}
            points={data.daily.payments.map((d) => d.count)}
          />
        </div>

        <div className="mt-4 bg-card border border-border rounded-xl p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-semibold text-foreground">
              Companies signed up, by month
            </h3>
            <span className="text-xs text-muted-foreground">Last 12 months</span>
          </div>
          <Sparkline
            points={data.monthly.companies.map((m) => m.count)}
            height={90}
          />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{data.monthly.companies[0]?.month}</span>
            <span>
              {data.monthly.companies[data.monthly.companies.length - 1]?.month}
            </span>
          </div>
        </div>
      </section>

      {/* Plan mix */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Plan mix
        </h2>
        <div className="bg-card border border-border rounded-xl p-5">
          {Object.keys(data.planMix || {}).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active subscriptions yet.
            </p>
          ) : (
            <div className="space-y-3">
              {Object.entries(data.planMix)
                .sort((a, b) => b[1] - a[1])
                .map(([plan, n]) => {
                  const pct = Math.round(
                    (n / data.activeSubscriptionCount) * 100,
                  );
                  return (
                    <div key={plan}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-foreground">{plan}</span>
                        <span className="text-muted-foreground">
                          {count(n)} · {pct}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#ff5a00]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </section>

      {/* Trials — the number most worth acting on */}
      {data.trialCompanies > 0 && (
        <section>
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-5 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="font-semibold text-amber-900 dark:text-amber-200">
                {count(data.trialCompanies)} companies on trial
              </div>
              <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                {trialShare}% of all companies. These are the ones worth calling.
              </p>
            </div>
            <Link
              href="/platform/companies"
              className="inline-flex items-center gap-2 bg-amber-900 text-white text-sm font-semibold px-4 py-2 rounded-lg"
            >
              View companies <ArrowRight size={14} />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function TrendCard({ title, subtitle, total, points }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </div>
      <div className="mt-1 text-2xl font-bold text-foreground">
        {count(total)}
      </div>
      <div className="mt-3">
        <Sparkline points={points} />
      </div>
    </div>
  );
}
