// app/app/page.js
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  Receipt,
  Calendar,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Circle,
} from "lucide-react";

import { isInternalPath } from "@/lib/appUrl";
import OnboardingProgress from "@/app/components/dashboard/OnboardingProgress";
import RevenueGoalCard from "@/app/components/dashboard/RevenueGoalCard";

import { useTranslation } from "@/app/hooks/useTranslation";
export default function DashboardPage() {
  const { t } = useTranslation();
  const [onboarding, setOnboarding] = useState(null);
  const [overview, setOverview] = useState(null);
  const [recentQuotes, setRecentQuotes] = useState([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onboardingError, setOnboardingError] = useState("");

  // Safety net for missed/misrouted checkout.session.completed webhooks.
  // successUrl (app/api/companies/route.js) redirects here with the real
  // Stripe session id; reconcile it directly against Stripe so the
  // Subscription row exists immediately instead of depending entirely on the
  // webhook — see /api/platform/billing/reconcile-session.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (!sessionId) return;

    fetch("/api/platform/billing/reconcile-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .catch((err) => console.error("[reconcile-session]", err))
      .finally(() => {
        params.delete("session_id");
        // A signup that began from "add this quote to your project" carries
        // where to return. Honour it only once the subscription is reconciled,
        // and only for an internal path — never an open redirect.
        const next = params.get("next");
        params.delete("next");
        const qs = params.toString();
        window.history.replaceState(null, "", `/app${qs ? `?${qs}` : ""}`);
        // A real redirect sink, so the check has to cover `/\evil.com` too —
        // shared rule, see lib/appUrl.
        if (isInternalPath(next)) {
          window.location.href = next;
        }
      });
  }, []);

  useEffect(() => {
    fetch("/api/onboarding-status", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            data.reason || data.error || "Could not load onboarding",
          );
        }
        return data;
      })
      .then(setOnboarding)
      .catch((error) => {
        console.error(error);
        setOnboardingError(error.message);
      });

    Promise.all([
      fetch("/api/analytics/overview").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/quotes").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/appointments").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([overviewData, quotesData, appointmentsData]) => {
        setOverview(overviewData);
        setRecentQuotes(
          Array.isArray(quotesData) ? quotesData.slice(0, 5) : [],
        );
        const upcoming = (
          Array.isArray(appointmentsData) ? appointmentsData : []
        )
          .filter((a) => new Date(a.scheduledAt) > new Date())
          .slice(0, 5);
        setUpcomingAppointments(upcoming);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-accent rounded" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-accent rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("app.dash.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.dash.subtitle")}
        </p>
      </div>

      {onboardingError && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
          Onboarding status unavailable: {onboardingError}
        </div>
      )}
      {/* Onboarding checklist — only shown while incomplete */}
      <OnboardingProgress
        status={onboarding}
        onEmployeeAdded={() => {
          // no-store, same as the first load: this refetch exists precisely
          // because the numbers just changed, and a cached copy would show the
          // count the contractor is trying to watch move.
          fetch("/api/onboarding-status", { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => data && setOnboarding(data));
        }}
      />

      {/* KPI cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <TrendingUp size={16} /> {t("app.dash.revenueThisMonth")}
          </div>
          <div className="text-2xl font-bold text-foreground mt-2">
            ${(overview?.revenue || 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <FileText size={16} /> {t("app.dash.quotesSent")}
          </div>
          <div className="text-2xl font-bold text-foreground mt-2">
            {overview?.quotesSent || 0}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Receipt size={16} /> {t("app.dash.conversionRate")}
          </div>
          <div className="text-2xl font-bold text-foreground mt-2">
            {overview?.conversionRate != null
              ? `${Math.round(overview.conversionRate * 100)}%`
              : "—"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {t("app.dash.conversionRateCaption", "% of sent quotes clients accepted")}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Calendar size={16} /> {t("app.dash.upcomingVisits")}
          </div>
          <div className="text-2xl font-bold text-foreground mt-2">
            {upcomingAppointments.length}
          </div>
        </div>
      </div>

      {/* Yearly goal + pace. Renders itself away for a non-admin with no goal
          set, so it's never a dead prompt. */}
      <RevenueGoalCard
        goal={overview?.goal}
        canEdit={Boolean(overview?.canEditGoal)}
        onSaved={() =>
          fetch("/api/analytics/overview")
            .then((r) => (r.ok ? r.json() : null))
            .then(setOverview)
        }
      />

      <div className="flex flex-wrap gap-3">
        <Link
          href="/app/quotes/new"
          className="bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold"
        >
          + New Quote
        </Link>
        <Link
          href="/app/clients"
          className="border border-border px-4 py-2.5 rounded-full text-sm font-semibold"
        >
          {t("app.dash.viewClients")}
        </Link>
        <Link
          href="/app/appointments"
          className="border border-border px-4 py-2.5 rounded-full text-sm font-semibold"
        >
          {t("app.dash.scheduleAppointment")}
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">{t("app.dash.recentQuotes")}</h2>
            <Link
              href="/app/quotes"
              className="text-sm text-muted-foreground flex items-center gap-1"
            >
              {t("app.action.viewAll")} <ArrowRight size={14} />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentQuotes.length === 0 && (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                <Link href="/app/quotes/new" className="text-foreground underline">
                  {t("app.dash.noQuotesCta", "No quotes yet — create your first quote")}
                </Link>
              </p>
            )}
            {recentQuotes.map((q) => (
              <Link
                key={q.id}
                href={`/app/quotes/${q.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-muted"
              >
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {q.client?.name}
                  </div>
                  <div className="text-xs text-muted-foreground">{q.quoteNumber}</div>
                </div>
                <div className="text-sm font-semibold text-foreground">
                  ${Number(q.total).toLocaleString()}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">
              {t("app.dash.upcomingAppointments")}
            </h2>
            <Link
              href="/app/appointments"
              className="text-sm text-muted-foreground flex items-center gap-1"
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {upcomingAppointments.length === 0 && (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                <Link href="/app/appointments" className="text-foreground underline">
                  {t("app.dash.nothingScheduledCta", "Nothing scheduled yet — book an appointment")}
                </Link>
              </p>
            )}
            {upcomingAppointments.map((a) => (
              <div key={a.id} className="px-5 py-3">
                <div className="text-sm font-medium text-foreground">
                  {a.client?.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(a.scheduledAt).toLocaleString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
