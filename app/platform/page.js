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
  PhoneOff,
  Sparkles,
} from "lucide-react";
import MetricCard, { money, count } from "@/app/components/platform/MetricCard";
import Sparkline from "@/app/components/platform/Sparkline";
import TenantBoard from "./TenantBoard";

export default function PlatformDashboardPage() {
  // ── Two boards, because they are two businesses ─────────────────────────
  //
  // "Your revenue" and "Flowing through FieldQuo" sat one above the other, and
  // the dashboard's largest number was a tenant figure. Both the owner and an
  // external QA pass read $473,558 of CUSTOMERS' invoices as FieldQuo income.
  //
  // Adjacency was the problem — a heading is easy to skim past, a tab is not.
  // Nothing on one board can be mistaken for the other now, because they are
  // never on screen together.
  const [board, setBoard] = useState("fieldquo");

  const [data, setData] = useState(null);
  // Deliberately separate from the overview fetch: an email-health failure
  // must never take the dashboard down, and the dashboard being slow must
  // never delay this warning.
  const [emailHealth, setEmailHealth] = useState(null);
  // Same reasoning. Also the only place the AI key can be checked at all: it's
  // marked Sensitive in Vercel, so it can't be read back or pulled locally —
  // the check has to run where the key already is.
  const [aiHealth, setAiHealth] = useState(null);
  // FieldQuo's own phone pool, and whether the call meter is running. Both are
  // platform-wide facts no tenant can see: one Retell account carries every
  // company's calls, and call billing hangs off a webhook whose failure looks
  // exactly like a phone nobody rang. See app/api/platform/voice-health.
  const [voiceHealth, setVoiceHealth] = useState(null);
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

    fetch("/api/platform/voice-health")
      .then((r) => (r.ok ? r.json() : null))
      .then(setVoiceHealth)
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

  // `totalCompanies` now means "finished checkout" — an abandoned signup is no
  // longer in the denominator. See the count in
  // app/api/platform/analytics/overview/route.js: with those ten rows counted,
  // this percentage was computed against a population a third of which had
  // never given a card, so it understated the trial share of the real book.
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

      {/* ── The shared phone pool ─────────────────────────────────────────
          Red when a tenant's caller is being dropped right now, amber when
          something needs doing this week. The line under it is always shown
          when there is anything to report, because the concurrency figure is
          READ from Retell and the credit figure is DERIVED from our own call
          records — and confusing those two is how a confident dashboard sends
          someone to look in the wrong place. Retell exposes no balance
          endpoint; see lib/voice/pool.js. */}
      {voiceHealth?.alerts?.length > 0 &&
        (() => {
          const critical = voiceHealth.alerts.some((a) => a.level === "critical");
          const tone = critical
            ? "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-900"
            : "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-900";
          const ink = critical
            ? "text-red-800 dark:text-red-200"
            : "text-amber-900 dark:text-amber-200";
          const body = critical
            ? "text-red-700 dark:text-red-300"
            : "text-amber-800 dark:text-amber-300";
          const c = voiceHealth.concurrency;
          return (
            <div className={`${tone} border rounded-xl p-5`}>
              <div className="flex items-start gap-3">
                <PhoneOff size={20} className={`${ink} shrink-0 mt-0.5`} />
                <div className="min-w-0">
                  <h2 className={`font-semibold ${ink}`}>
                    {critical
                      ? "The phone pool is at its limit"
                      : "The phone pool needs attention"}
                  </h2>
                  <ul className={`text-sm ${body} mt-1 space-y-1`}>
                    {voiceHealth.alerts.map((a) => (
                      <li key={a.code}>{a.message}</li>
                    ))}
                  </ul>
                  <p className={`text-xs ${body} opacity-70 mt-2 font-mono`}>
                    {c
                      ? `concurrency ${c.current}/${c.limit} (read from Retell)`
                      : "concurrency unavailable"}
                    {voiceHealth.spend
                      ? ` · ~${voiceHealth.spend.minutes} min served in ${voiceHealth.spend.days}d ≈ $${(voiceHealth.spend.cents / 100).toFixed(2)} provider cost (derived, not read)`
                      : ""}
                    {/* The measured half, deliberately printed right next to
                        the derived one. This is Retell's OWN per-call cost
                        against what we actually billed — the only figures on
                        this line that are read rather than assumed — and the
                        coverage is stated because it is measured on the calls
                        Retell has priced, not on all of them. */}
                    {voiceHealth.margin?.covered > 0
                      ? ` · measured margin $${(voiceHealth.margin.spreadCents / 100).toFixed(2)} on $${(voiceHealth.margin.billedCents / 100).toFixed(2)} billed` +
                        (voiceHealth.margin.marginRatio !== null
                          ? ` (${Math.round(voiceHealth.margin.marginRatio * 100)}%)`
                          : "") +
                        ` from ${voiceHealth.margin.covered}/${voiceHealth.margin.total} calls` +
                        (voiceHealth.margin.costCentsPerRealMinute
                          ? ` · Retell ${voiceHealth.margin.costCentsPerRealMinute.toFixed(1)}¢/real min`
                          : "")
                      : ""}
                    {voiceHealth.meter?.companiesOverdrawn
                      ? ` · ${voiceHealth.meter.companiesOverdrawn} overdrawn`
                      : ""}
                  </p>
                  {/* ── The remedy, next to the diagnosis ──────────────────
                      This banner named a fault nobody could act on: it said
                      call events were not arriving and offered no button, no
                      setting and no plan. The cause is documented in
                      lib/voice/readiness.js — an agent provisioned from a
                      preview URL or a laptop keeps that origin's webhook_url
                      forever, so the phone answers and the events go nowhere,
                      which is exactly why the money is right and the call list
                      is empty.

                      Shown only for the alert it actually addresses. A repair
                      link under "you are at your concurrency limit" would be a
                      button that fixes a different problem. */}
                  {voiceHealth.alerts.some((a) => /webhook/i.test(a.message || "")) && (
                    <Link
                      href="/platform/voice-webhooks"
                      className={`inline-block mt-3 text-sm font-semibold underline underline-offset-2 ${ink}`}
                    >
                      Check where Retell is posting call events →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

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

      <div
        role="tablist"
        aria-label="Which business you're looking at"
        className="inline-flex items-center gap-1 p-1 rounded-lg bg-muted"
      >
        {[
          ["fieldquo", "FieldQuo", "Our subscription revenue"],
          ["tenants", "Our customers", "What they run through the product"],
        ].map(([key, label, hint]) => (
          <button
            key={key}
            role="tab"
            aria-selected={board === key}
            title={hint}
            onClick={() => setBoard(key)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              board === key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {board === "fieldquo" && (
      <>
      {/* FieldQuo's own revenue */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Your revenue
        </h2>
        {/* ── Collectable first, nominal second ──────────────────────────
            The old card showed $1,335 MRR while not one subscription could
            raise a charge — every plan was missing its Stripe price. The gap
            between these two numbers is the most actionable thing on the page:
            it is exactly the revenue that is one configuration fix away. */}
        {data.outlook?.nothingCollectable && (
          <div className="mb-3 rounded-lg border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-3">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              None of these {count(data.outlook.nominalCount)} subscriptions can
              actually be charged.
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
              {money(data.outlook.blockedMrr, { compact: true })}/mo is blocked
              on plans with no Stripe price. Add the prices and this becomes
              real revenue.
            </p>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Collectable MRR"
            value={money(data.outlook?.collectableMrr ?? data.mrr, { compact: true })}
            note={
              data.outlook
                ? `${count(data.outlook.collectableCount)} of ${count(data.outlook.nominalCount)} subscriptions can bill`
                : `${count(data.activeSubscriptionCount)} active subscriptions`
            }
            tone={data.outlook?.nothingCollectable ? "warning" : "default"}
          />
          <MetricCard
            label="On paper"
            value={money(data.outlook?.nominalMrr ?? data.mrr, { compact: true })}
            note="What you'd bill if every plan were configured"
          />
          <MetricCard
            label="This month"
            value={money(data.outlook?.thisMonth?.expected ?? 0, { compact: true })}
            note={
              data.outlook
                ? `${count(data.outlook.thisMonth.converting)} trial(s) convert before month end`
                : "—"
            }
          />
          <MetricCard
            label="Next month"
            value={money(data.outlook?.nextMonth?.expected ?? 0, { compact: true })}
            note={
              data.outlook
                ? `+${count(data.outlook.nextMonth.converting)} more converting`
                : "—"
            }
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-4">
          <MetricCard
            label="Annual run rate"
            value={money(data.outlook?.annualRunRate ?? data.arr, { compact: true })}
            note="Collectable MRR × 12"
          />
          <MetricCard
            label="Paying companies"
            value={count(data.outlook?.collectableCount ?? data.activeSubscriptionCount)}
            // "companies" now means companies that finished checkout. The ten
            // that never did are counted on their own below and on
            // /platform/signups, not folded into this denominator.
            note={`of ${count(data.totalCompanies)} companies`}
          />
          {/* "Trialing subscriptions", not "In trial". This tile counts
              SUBSCRIPTION rows Stripe calls trialing; the banner lower down
              counts COMPANIES in a free month, which also includes the ones
              that never reached checkout and so have no subscription row at
              all. The two are different numbers on purpose and used to be
              labelled as if they were the same one. */}
          <MetricCard
            label="Trialing subscriptions"
            value={count(data.outlook?.trials?.count ?? 0)}
            note={
              data.outlook?.trials?.lapsed
                ? `${count(data.outlook.trials.lapsed)} already lapsed — nothing transitioned them`
                : `${money(data.outlook?.trials?.nominalValue ?? 0, { compact: true })}/mo in pipeline`
            }
            tone={data.outlook?.trials?.lapsed > 0 ? "warning" : "default"}
          />
          <MetricCard
            label="Churned this month"
            value={count(data.churnedThisMonth)}
            tone={data.churnedThisMonth > 0 ? "warning" : "default"}
          />
        </div>
      </section>

      </>
      )}

      {board === "tenants" && (
      <>
      {/* How the companies using FieldQuo are actually doing.
          Lifted into its own component: it fetches its own data and this page
          already had 400 lines of FieldQuo's own numbers. */}
      <TenantBoard />
      </>
      )}

      {board === "fieldquo" && (
      <>
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
                {count(data.trialCompanies)} companies in an unpaid free month
              </div>
              {/* The split is printed, not just the total. This number was
                  wrong for months behind the label "companies on trial" and
                  nobody could tell, because there was no way to take it apart
                  and ask which companies it meant. */}
              <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                {count(data.trialBreakdown?.trialingSubscription ?? 0)} trialing in
                Stripe · {count(data.trialBreakdown?.awaitingCheckout ?? 0)} signed up,
                not through checkout yet. {trialShare}% of companies that finished
                checkout — these are the ones worth calling.
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

      {/* ── Incomplete signups ───────────────────────────────────────────────
          Separate from the trial banner above it, and that separation is the
          whole point. Everything in that banner has either given a card or is
          in a Stripe trial that will ask for one. Everything in this one closed
          the checkout tab and was counted as a customer anyway — on this
          dashboard, on the company list, and in every adoption rate. They are
          out of those numbers now and in this one instead. */}
      {data.incompleteSignups > 0 && (
        <section>
          <div className="bg-card border border-border rounded-xl p-5 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="font-semibold text-foreground">
                {count(data.incompleteSignups)}{" "}
                {data.incompleteSignups === 1 ? "person" : "people"} started a signup
                and never finished it
              </div>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                No card, no subscription, not counted as companies anywhere above.
                Nothing has been deleted. They are the warmest leads FieldQuo has:
                they wanted this enough to type their business in.
              </p>
            </div>
            <Link
              href="/platform/signups"
              className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg"
            >
              Who they are <ArrowRight size={14} />
            </Link>
          </div>
        </section>
      )}
      </>
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
