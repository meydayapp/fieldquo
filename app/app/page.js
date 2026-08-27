// app/app/page.js
"use client";

import { useState, useEffect, useCallback } from "react";
import { countUpcoming } from "@/lib/schedule/jobVisits";
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
import AwaitingPayment from "@/app/components/dashboard/AwaitingPayment";

import { useTranslation } from "@/app/hooks/useTranslation";
import { useHasLevel } from "@/app/providers/PermissionProvider";
import { fetchList, fetchArray } from "@/lib/loadState";
import ListState from "@/app/components/ListState";

export default function DashboardPage() {
  const { t } = useTranslation();
  const canCreateQuote = useHasLevel("quotes", "view_create_edit");
  const [onboarding, setOnboarding] = useState(null);
  // ── "$0 revenue this month" was a refusal wearing a number ───────────────
  //
  // GET /api/analytics/overview refuses a member without the showPricing
  // toggle (requireToggle, see that route), and GET /api/quotes refuses one at
  // quotes:none. Both were read as `r.ok ? r.json() : null`, so the tiles
  // below rendered `overview?.revenue || 0` — and a crew member was told the
  // company had billed nothing and sent no quotes this month. That is not a
  // missing figure, it is a different and alarming claim about the business.
  //
  // The shape is lib/loadState.js's, not a new one invented here: `null` means
  // "not known", a figure only ever renders from a body the server actually
  // sent, and the failure sentence comes from the same map every other refused
  // list on the app uses.
  //
  // Refused and broken are held apart because they need opposite treatments. A
  // 403 has nothing to retry and nothing to apologise for — this person simply
  // does not see money — so the tiles are absent and no banner appears. Any
  // other failure is temporary, so it says so and offers a retry.
  const [overview, setOverview] = useState(null);
  const [overviewErrorKey, setOverviewErrorKey] = useState("");
  const [quotesErrorKey, setQuotesErrorKey] = useState("");
  const [recentQuotes, setRecentQuotes] = useState(null);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  // Separate from the preview list above, which is capped at five.
  const [upcomingCount, setUpcomingCount] = useState(0);
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

  const loadOverview = useCallback(async () => {
    const result = await fetchList("/api/analytics/overview");
    if (result.aborted) return;
    if (result.ok) {
      setOverview(result.data);
      setOverviewErrorKey("");
      return;
    }
    // Back to "not known" rather than left holding a stale figure — a retry
    // that fails must not keep last minute's revenue on screen as if current.
    setOverview(null);
    // The 403 branch is the whole point: a refusal leaves no error key, so the
    // tiles are simply absent and nothing apologises for a boundary working as
    // designed. Every other status keeps its sentence and its retry.
    setOverviewErrorKey(result.status === 403 ? "" : result.errorKey);
  }, []);

  const loadRecentQuotes = useCallback(async () => {
    const result = await fetchArray("/api/quotes");
    if (result.aborted) return;
    if (result.ok) {
      setRecentQuotes(result.data.slice(0, 5));
      setQuotesErrorKey("");
      return;
    }
    setRecentQuotes(null);
    setQuotesErrorKey(result.errorKey);
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
      // These two set their own state and never reject — see lib/loadState.js,
      // which exists so a refused list cannot be flattened into an empty one
      // on the way in.
      loadOverview(),
      loadRecentQuotes(),
      fetch("/api/appointments").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([, , appointmentsData]) => {
        // /api/appointments now returns job visits alongside appointments, so
        // both of these finally count the crew work a company actually
        // schedules — this tile read 0 against jobs that plainly had visits.
        const all = Array.isArray(appointmentsData) ? appointmentsData : [];
        // The COUNT is the whole upcoming list. It used to be the length of
        // the sliced preview, so a company with twelve visits ahead of them
        // read "5" — the tile silently topped out at the size of the list
        // below it.
        setUpcomingCount(countUpcoming(all));
        setUpcomingAppointments(
          all
            .filter((a) => new Date(a.scheduledAt) > new Date())
            .slice(0, 5),
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [loadOverview, loadRecentQuotes]);

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
        // The dismiss POST returns the recomputed status, so the card re-renders
        // from the server's view rather than a locally-guessed one.
        onStatusChange={setOnboarding}
        onEmployeeAdded={() => {
          // no-store, same as the first load: this refetch exists precisely
          // because the numbers just changed, and a cached copy would show the
          // count the contractor is trying to watch move.
          fetch("/api/onboarding-status", { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => data && setOnboarding(data));
        }}
      />

      {/* The money figures failed to load — but were not refused. One
          rendering of a failed load for the whole app, reassurance sentence
          and retry included. Above the grid rather than inside it, because a
          full-width panel occupying one grid cell reads as a broken tile. */}
      {overviewErrorKey && (
        <ListState
          loading={false}
          isEmpty={false}
          errorKey={overviewErrorKey}
          onRetry={loadOverview}
        >
          {null}
        </ListState>
      )}

      {/* KPI cards.
          The first three are all read off /api/analytics/overview, so they
          render only from a body it actually sent. `overview` is null while
          unknown, refused or failed — and ListCount's rule applies to a tile
          as much as to a header: the honest rendering of a number you were
          refused is no number. Upcoming visits comes from /api/appointments
          and is unaffected by any of this. */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {overview && (
          <>
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <TrendingUp size={16} /> {t("app.dash.revenueThisMonth")}
              </div>
              <div className="text-2xl font-bold text-foreground mt-2">
                ${(overview.revenue || 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <FileText size={16} /> {t("app.dash.quotesSent")}
              </div>
              <div className="text-2xl font-bold text-foreground mt-2">
                {overview.quotesSent || 0}
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Receipt size={16} /> {t("app.dash.conversionRate")}
              </div>
              <div className="text-2xl font-bold text-foreground mt-2">
                {overview.conversionRate != null
                  ? `${Math.round(overview.conversionRate * 100)}%`
                  : "—"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {t("app.dash.conversionRateCaption", "% of sent quotes clients accepted")}
              </div>
            </div>
          </>
        )}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Calendar size={16} /> {t("app.dash.upcomingVisits")}
          </div>
          <div className="text-2xl font-bold text-foreground mt-2">
            {upcomingCount}
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
        {/* Same rule POST /api/quotes enforces — see app/app/quotes/page.js.
            The other two lead to screens a view_only member can genuinely use. */}
        {canCreateQuote && (
          <Link
            href="/app/quotes/new"
            className="bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold"
          >
            + New Quote
          </Link>
        )}
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

      {/* Bookings held for a visit fee that hasn't landed. They have no
          Appointment by design, so they appear on no calendar — this is the one
          place they are visible at all. Renders itself away when empty. */}
      <AwaitingPayment />

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
          {/* `recentQuotes` is null until GET /api/quotes answers, so
              "No quotes yet — create your first quote" can no longer appear
              over a list that was refused. A member at quotes:none gets a 403
              here, and inviting them to write their first quote is the same
              lie ListState was built to stop. */}
          <ListState
            loading={false}
            errorKey={quotesErrorKey}
            onRetry={loadRecentQuotes}
            isEmpty={Array.isArray(recentQuotes) && recentQuotes.length === 0}
            empty={
              <p className="px-5 py-6 text-sm text-muted-foreground">
                {canCreateQuote ? (
                  <Link href="/app/quotes/new" className="text-foreground underline">
                    {t("app.dash.noQuotesCta", "No quotes yet — create your first quote")}
                  </Link>
                ) : (
                  t(
                    "app.access.cannotCreateQuote",
                    "Your access level lets you view quotes, not create them. Ask an owner or admin if you need to write one.",
                  )
                )}
              </p>
            }
          >
            <div className="divide-y divide-border">
              {(recentQuotes ?? []).map((q) => (
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
          </ListState>
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
