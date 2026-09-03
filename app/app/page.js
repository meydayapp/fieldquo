// app/app/page.js
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { countUpcoming } from "@/lib/schedule/jobVisits";
import { formatDuration } from "@/lib/i18n/duration";
import Link from "next/link";
import { Receipt, Calendar, TrendingUp, ArrowRight, Mail, Phone, MapPin } from "lucide-react";

import { isInternalPath } from "@/lib/appUrl";
import OnboardingProgress from "@/app/components/dashboard/OnboardingProgress";
import RevenueGoalCard from "@/app/components/dashboard/RevenueGoalCard";
import AwaitingPayment from "@/app/components/dashboard/AwaitingPayment";
import NeedsToday from "@/app/components/dashboard/NeedsToday";
import HeroRevenue from "@/app/components/dashboard/HeroRevenue";
import SecondaryMetrics from "@/app/components/dashboard/SecondaryMetrics";
import MigrationNotice from "@/app/components/dashboard/MigrationNotice";
import { Figure, FigureText } from "@/app/components/dashboard/Figure";
import { CARD_CLIPPED, INSET } from "@/app/components/dashboard/surface";

import { buildDashboardRank } from "@/lib/dashboard/rank";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useHasLevel } from "@/app/providers/PermissionProvider";
import { fetchList, fetchArray } from "@/lib/loadState";
import { reportResponseError } from "@/lib/clientErrors";
import { formatMoney } from "@/lib/currency";
import ListState from "@/app/components/ListState";

// ── What this page ranks, and why it ranks at all ──────────────────────────
//
// It used to open with three identically-sized tiles and four identically-
// sized panels. Everything was equally important, so nothing was — and two
// overdue invoices sat inside a panel called "Money owed", below three other
// panels, described only as a count. Nobody reading it could tell what needed
// doing.
//
// The order now is: what needs a person today, the one figure the business
// runs on, four supporting figures, then everything else. Nothing was deleted
// to make room — the aging detail, the received-money chart, the goal card,
// recent quotes and the appointments list are all still here, below.
//
// The decisions that ranking involves — is this figure known, is there an
// honest comparison, is the sample big enough to print a percentage — are NOT
// made in this file. They are in lib/dashboard/rank.js, a pure function, so
// scripts/check-dashboard-rank.mjs can execute every one of them against a
// company with nothing, a company with one overdue invoice, and a member the
// endpoints refuse.

// ── The aging ladder's words ───────────────────────────────────────────────
//
// The ids come from lib/analytics/receivables.js, which holds no English on
// purpose. `undated` is deliberately absent from this map: an invoice with no
// due date is not a bucket on the ladder, it is a separate sentence, and giving
// it a rung here would put it in a row of ages it does not have.
const AGING_LABEL = {
  not_due: ["app.dash.aging.notDue", "Not yet due"],
  days_1_30: ["app.dash.aging.d1to30", "1–30 days"],
  days_31_60: ["app.dash.aging.d31to60", "31–60 days"],
  days_61_90: ["app.dash.aging.d61to90", "61–90 days"],
  days_90_plus: ["app.dash.aging.d90plus", "90+ days"],
};

// ── The change, stated and nothing more ────────────────────────────────────
//
// Key and English fallback together, so the sentence reads correctly before the
// catalogue entry lands rather than rendering "app.dash.revenue.down" at a
// contractor. Every one of these says WHAT MOVED and stops there — the
// competitor's "focus on new sales opportunities" is advice derived from one
// number, and a panel that dispenses it is trusted less on the figures too.
const TREND_SENTENCE = {
  up: [
    "app.dash.revenue.up",
    "{month}: {amount} — up {pct}% on {priorMonth}.",
  ],
  down: [
    "app.dash.revenue.down",
    "{month}: {amount} — down {pct}% on {priorMonth}.",
  ],
  flat: [
    "app.dash.revenue.flat",
    "{month}: {amount} — about the same as {priorMonth}.",
  ],
};

/** "2026-08" → "Aug 26", read on the UTC calendar the series was built on. */
function monthLabel(key) {
  const [y, m] = String(key).split("-").map(Number);
  if (!y || !m) return key;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

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
  //
  // `null`, not 0. /api/appointments failing left this reading 0 — the same
  // fabrication one tile to the left, from the same cause: a count that was
  // never sent, rendered as a fact. A number here only ever comes from an
  // array the server actually returned; anything else leaves the tile absent.
  const [upcomingCount, setUpcomingCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onboardingError, setOnboardingError] = useState("");

  // ── Money owed, and the shape of the money coming in ─────────────────────
  //
  // One endpoint, two panels — see the header of
  // app/api/analytics/receivables/route.js for why they travel together.
  //
  // `null` is "not known", exactly as `overview` above: a member without
  // showPricing, or at invoices:none, is refused, and a refused panel is
  // ABSENT. "$0 owed" over an empty aging chart would be the same fabricated
  // claim the comment at the top of this file exists to describe.
  const [money, setMoney] = useState(null);
  const [moneyErrorKey, setMoneyErrorKey] = useState("");
  const [trendMonths, setTrendMonths] = useState(6);
  // Which invoice is mid-chase, and what came back. Kept per-invoice rather
  // than as one page-level flag so two clicks can't blur into one another.
  const [chasing, setChasing] = useState(null);
  const [chaseNote, setChaseNote] = useState("");
  const [chaseError, setChaseError] = useState("");

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

  const loadMoney = useCallback(async () => {
    const result = await fetchList(
      `/api/analytics/receivables?months=${trendMonths}`,
    );
    if (result.aborted) return;
    if (result.ok) {
      setMoney(result.data);
      setMoneyErrorKey("");
      return;
    }
    setMoney(null);
    // Same split as loadOverview: a 403 is a boundary working, so there is
    // nothing to apologise for and nothing to retry. Everything else says so
    // and offers the retry.
    setMoneyErrorKey(result.status === 403 ? "" : result.errorKey);
  }, [trendMonths]);

  // Its own effect, keyed on the period selector — changing the range must
  // refetch, and the first load must not sit behind the four tiles' skeleton.
  useEffect(() => {
    loadMoney();
  }, [loadMoney]);

  async function chase(invoice) {
    setChasing(invoice.id);
    setChaseNote("");
    setChaseError("");
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/request-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        // Never a bare `if (res.ok)` with no else. The failures this route
        // really returns — no email on file, already settled, a 403 — are
        // sentences the contractor needs, not a button that quietly did
        // nothing.
        await reportResponseError(
          res,
          setChaseError,
          t("app.invoiceDetail.requestError"),
        );
        return;
      }
      const data = await res.json();
      setChaseNote(
        `${t("app.invoiceDetail.paymentRequestSentTo")} ${data?.to || ""}`.trim(),
      );
      // The route stamps sentAt and can move a draft to sent, so the panel is
      // reloaded from the server rather than patched from a guess.
      await loadMoney();
    } finally {
      setChasing(null);
    }
  }

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
        //
        // A body that is not an array is a refusal or a failure, and the count
        // stays null for it. The COUNT is also the whole upcoming list: it used
        // to be the length of the sliced preview, so a company with twelve
        // visits ahead of them read "5".
        if (!Array.isArray(appointmentsData)) return;
        setUpcomingCount(countUpcoming(appointmentsData));
        setUpcomingAppointments(
          appointmentsData
            .filter((a) => new Date(a.scheduledAt) > new Date())
            .slice(0, 5),
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [loadOverview, loadRecentQuotes]);

  // The ranking, decided once per render from the two payloads. Pure, and
  // tested by scripts/check-dashboard-rank.mjs rather than by looking at it.
  const rank = useMemo(
    () => buildDashboardRank({ overview, money, upcomingCount }),
    [overview, money, upcomingCount],
  );

  // ── The one comparison on this page that is genuinely computable ─────────
  //
  // Built here rather than inside the hero component because the key and its
  // English fallback have to stay in this file: scripts/check-dashboard.mjs
  // section 6 reads it to prove the panel states the change and never adds
  // advice to it.
  //
  // buildRevenueTrend compares the last two COMPLETE months, so this is never
  // a part-month measured against a whole one — that would manufacture a
  // collapse on the 2nd of every month. `headline` is null when the window
  // holds fewer than two complete months, and this renders nothing for a null:
  // a first-month company gets the figure and no trend, never an invented one.
  //
  // Built as an ELEMENT rather than a string, so the money inside it is
  // wrapped by the same <FigureText> every other figure on this page goes
  // through. A sentence assembled into a bare string here and rendered
  // somewhere else is the one path by which a figure escapes the tabular
  // digits — scripts/check-dashboard-rank.mjs section 8 closes it.
  const trendSentence = useMemo(() => {
    const h = money?.revenue?.headline;
    if (!h) return null;
    if (h.deltaPct === null) {
      return (
        <FigureText className="mt-2 text-xs text-foreground">
          {t(
            "app.dash.revenue.fromNothing",
            "{month}: {amount}. Nothing was received in {priorMonth}.",
            {
              month: monthLabel(h.month),
              amount: formatMoney(h.amount, money.currency),
              priorMonth: monthLabel(h.priorMonth),
            },
          )}
        </FigureText>
      );
    }
    return (
      <FigureText className="mt-2 text-xs text-foreground">
        {t(...(TREND_SENTENCE[h.direction] || TREND_SENTENCE.flat), {
          month: monthLabel(h.month),
          amount: formatMoney(h.amount, money.currency),
          pct: h.deltaPct,
          priorMonth: monthLabel(h.priorMonth),
        })}
      </FigureText>
    );
  }, [money, t]);

  const sparklineMonths = useMemo(() => {
    const series = rank.hero.received?.series;
    if (!Array.isArray(series) || series.length < 2) return null;
    return [monthLabel(series[0].month), monthLabel(series[series.length - 1].month)];
  }, [rank.hero.received]);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-accent" />
          <div className="h-28 bg-accent" />
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-accent" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("app.dash.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.dash.subtitle")}
        </p>
      </div>

      {/* ── 1. What is waiting on a person ──────────────────────────────────
          Above everything, because it is the only content on this page that is
          waiting on the reader — the panels below are figures, and figures
          keep. Overdue invoices by name and amount, then the three things the
          automation did that still need somebody. Renders itself away when
          there is nothing, so a quiet company is not accused of a backlog it
          does not have. */}
      <NeedsToday
        needs={rank.needsToday}
        onChase={chase}
        chasing={chasing}
        chaseError={chaseError}
        chaseNote={chaseNote}
      />

      {onboardingError && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm px-4 py-3">
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

      {/* The money figures failed to load — but were not refused. One
          rendering of a failed load for the whole app, reassurance sentence
          and retry included. Above the hero rather than inside it, because a
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

      {/* ── 2. The hero figure ──────────────────────────────────────────────
          Absent, not zeroed, for a member the overview endpoint refused. */}
      <HeroRevenue
        hero={rank.hero}
        trendSentence={trendSentence}
        monthLabels={sparklineMonths}
        t={t}
      />

      {/* ── 3. The four that support it ─────────────────────────────────────
          2×2 at every width including a phone. Each tile is independently
          absent — a member with showPricing off sees the one tile that is not
          money rather than three tiles reading zero. */}
      <SecondaryMetrics metrics={rank.metrics} t={t} />

      <div className="flex flex-wrap gap-3">
        {/* Same rule POST /api/quotes enforces — see app/app/quotes/page.js.
            The other two lead to screens a view_only member can genuinely use. */}
        {canCreateQuote && (
          <Link
            href="/app/quotes/new"
            className="bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold"
          >
            {t("app.dash.newQuote", "+ New Quote")}
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

      {/* ── 4. Everything else ──────────────────────────────────────────────
          Demoted, not deleted. The aging detail, the received-money chart with
          its period selector, the goal, the held bookings, recent quotes and
          the appointments list are all still here and all still work. */}
      <div className="border-t border-foreground/15 pt-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("app.dash.rest.title", "The detail")}
        </h2>
      </div>

      {/* The money panels failed to load — but were not refused. Same shape,
          same reasoning as the overview banner above. */}
      {moneyErrorKey && (
        <ListState
          loading={false}
          isEmpty={false}
          errorKey={moneyErrorKey}
          onRetry={loadMoney}
        >
          {null}
        </ListState>
      )}

      {/* ── What has actually come in, month by month ───────────────────────
          The hero figure above totals invoices marked paid; this counts
          PAYMENTS. Two different questions, and the caption says which one this
          is rather than letting the two quietly disagree. */}
      {money?.revenue && (
        <div id="money-received" className={CARD_CLIPPED}>
          <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-foreground/15 gap-3">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <TrendingUp size={16} className="text-muted-foreground" aria-hidden="true" />
              {t("app.dash.revenue.title", "Money received")}
            </h2>
            <div className="flex gap-1.5">
              {(money.periods || []).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTrendMonths(p)}
                  className={`text-xs font-semibold rounded-full px-3 py-2 min-h-[36px] border tabular-nums ${
                    trendMonths === p
                      ? "bg-inverted text-inverted-foreground border-transparent"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {t("app.dash.revenue.monthsOption", "{count}m", { count: p })}
                </button>
              ))}
            </div>
          </div>

          {!money.revenue.available ? (
            <p className="px-4 sm:px-5 py-6 text-sm text-muted-foreground">
              {t(
                "app.dash.revenue.none",
                "No payments have been recorded yet, so there is no trend to show.",
              )}
            </p>
          ) : (
            <div className="px-4 sm:px-5 py-4">
              {/* The month-on-month sentence that used to live here has been
                  promoted into the hero card, beside the sparkline drawn from
                  this same series — one source, two views, and the sentence
                  said twice on one page would be one sentence too many. It is
                  still built in this file (see `trendSentence`), because it
                  states the change and refuses to add advice to it, and that is
                  what scripts/check-dashboard.mjs section 6 reads this file to
                  prove. */}
              {money.revenue.series.every((s) => s.amount === 0) ? (
                <p className="text-sm text-muted-foreground">
                  {t(
                    "app.dash.revenue.noneInPeriod",
                    "No payments were received in this period.",
                  )}
                </p>
              ) : (
                <>
                  <div className="flex items-end gap-2 h-32">
                    {money.revenue.series.map((s, _i, series) => {
                      const max = Math.max(...series.map((r) => r.amount));
                      // A month with nothing in it gets no bar at all. A
                      // minimum-height stub would draw money that never
                      // arrived.
                      const pct =
                        max > 0 && s.amount > 0
                          ? Math.max(4, (s.amount / max) * 100)
                          : 0;
                      return (
                        <div
                          key={s.month}
                          className="flex-1 flex flex-col justify-end h-full"
                          title={`${monthLabel(s.month)} — ${formatMoney(s.amount, money.currency)}`}
                        >
                          <div
                            // The current month is not finished, so its bar is
                            // drawn differently and labelled — comparing it to
                            // a full month at a glance is the mistake this
                            // prevents.
                            className={
                              s.partial ? "bg-muted-foreground" : "bg-primary"
                            }
                            style={{ height: `${pct}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <FigureText as="div" className="mt-2 flex gap-2">
                    {money.revenue.series.map((s) => (
                      <div
                        key={s.month}
                        className="flex-1 text-[10px] text-muted-foreground text-center truncate"
                      >
                        {monthLabel(s.month)}
                      </div>
                    ))}
                  </FigureText>
                  <p className="text-xs text-muted-foreground mt-3">
                    {t(
                      "app.dash.revenue.caption",
                      "Payments recorded, by the month they were received. The revenue figure at the top of the page totals invoices marked paid, which is a different measure.",
                    )}
                    {money.revenue.series.some((s) => s.partial)
                      ? ` ${t("app.dash.revenue.partial", "The last bar is the current month, still in progress.")}`
                      : ""}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Money owed, with age ────────────────────────────────────────────
          The aging detail, demoted below the fold — the overdue rows it used to
          bury are now named at the top of the page. Absent for anyone the
          endpoint refused: no panel, no zero, no apology. */}
      {money?.receivables && (
        <div className={CARD_CLIPPED}>
          <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-foreground/15">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Receipt size={16} className="text-muted-foreground" aria-hidden="true" />
              {t("app.dash.owed.title", "Money owed")}
            </h2>
            <Link
              href="/app/invoices"
              className="text-sm text-muted-foreground flex items-center gap-1"
            >
              {t("app.action.viewAll")} <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>

          {/* Three different states, and none of them is "$0.00". Nothing
              billed, everything paid, and a real balance are three different
              things to say — AGENTS.md failure class 5. */}
          {money.receivables.noInvoices ? (
            <p className="px-4 sm:px-5 py-6 text-sm text-muted-foreground">
              {t(
                "app.dash.owed.noInvoices",
                "No invoices yet, so nothing is owed to you.",
              )}
            </p>
          ) : money.receivables.nothingOutstanding ? (
            <p className="px-4 sm:px-5 py-6 text-sm text-muted-foreground">
              {t(
                "app.dash.owed.nothing",
                "Nothing outstanding — every invoice you have sent has been settled.",
              )}
            </p>
          ) : (
            <>
              <div className="px-4 sm:px-5 py-4 border-b border-foreground/15">
                <Figure className="block text-3xl font-bold text-foreground">
                  {formatMoney(money.receivables.total, money.currency)}
                </Figure>
                <FigureText className="text-xs text-muted-foreground mt-1">
                  {t(
                    "app.dash.owed.caption",
                    "Across {count} unpaid invoices. Counts the latest version of each invoice, less the payments recorded against it.",
                    { count: money.receivables.count },
                  )}
                </FigureText>
                {money.receivables.overdueCount > 0 && (
                  <FigureText className="text-xs text-destructive mt-1">
                    {t("app.dash.owed.pastDue", "{amount} of that is past due.", {
                      amount: formatMoney(
                        money.receivables.overdueTotal,
                        money.currency,
                      ),
                    })}
                  </FigureText>
                )}
              </div>

              {/* The aging strip. Only rungs with something on them — five
                  empty boxes would be four claims nobody made. */}
              <div className="px-4 sm:px-5 py-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 border-b border-foreground/15">
                {money.receivables.aging
                  .filter((b) => b.count > 0)
                  .map((b) => (
                    <div key={b.id} className={`${INSET} px-3 py-2`}>
                      <FigureText className="text-[11px] text-muted-foreground">
                        {t(...AGING_LABEL[b.id])}
                      </FigureText>
                      <Figure
                        className={`block text-sm font-semibold ${
                          b.overdue ? "text-destructive" : "text-foreground"
                        }`}
                      >
                        {formatMoney(b.amount, money.currency)}
                      </Figure>
                    </div>
                  ))}
                {money.receivables.undatedCount > 0 && (
                  <div className={`${INSET} px-3 py-2`}>
                    <div className="text-[11px] text-muted-foreground">
                      {t("app.dash.aging.undated", "No due date")}
                    </div>
                    <Figure className="block text-sm font-semibold text-foreground">
                      {formatMoney(
                        money.receivables.undatedTotal,
                        money.currency,
                      )}
                    </Figure>
                  </div>
                )}
              </div>

              <div className="divide-y divide-foreground/10">
                {money.receivables.invoices.slice(0, 6).map((inv) => (
                  <div
                    key={inv.id}
                    className="px-4 sm:px-5 py-3 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {inv.client?.name}
                      </div>
                      {/* Days past due, in red, from the DUE DATE — and an
                          invoice with no due date says exactly that instead of
                          being aged from the day it was raised. */}
                      {inv.dueState === "overdue" ? (
                        <FigureText className="text-xs font-semibold text-destructive">
                          {t(
                            "app.dash.owed.daysPastDue",
                            "{days} days past due",
                            { days: inv.daysPastDue },
                          )}
                        </FigureText>
                      ) : inv.dueState === "undated" ? (
                        <div className="text-xs text-muted-foreground">
                          {t(
                            "app.dash.owed.undated",
                            "No due date on this invoice — it is not overdue",
                          )}
                        </div>
                      ) : (
                        <FigureText className="text-xs text-muted-foreground">
                          {t("app.dash.owed.dueOn", "Due {date}", {
                            date: new Date(inv.dueDate).toLocaleDateString(
                              undefined,
                              { month: "short", day: "numeric" },
                            ),
                          })}
                        </FigureText>
                      )}
                      <FigureText className="text-xs text-muted-foreground">
                        {inv.invoiceNumber}
                        {inv.amended
                          ? ` · ${t("app.dash.owed.amended", "amended, v{version}", { version: inv.version })}`
                          : ""}
                      </FigureText>
                      {inv.partiallyPaid && (
                        <FigureText className="text-xs text-muted-foreground">
                          {t("app.invoiceLifecycle.partiallyPaid", {
                            paid: formatMoney(inv.paid, money.currency),
                            total: formatMoney(inv.total, money.currency),
                            due: formatMoney(inv.owed, money.currency),
                          })}
                        </FigureText>
                      )}
                      {/* Contact details, subject to clientsProperties. A
                          member on name_address_only keeps the name and the
                          address and is TOLD the rest is hidden — a blank line
                          would read as data nobody has entered. */}
                      {inv.client?.restricted ? (
                        <div className="text-xs text-muted-foreground mt-1">
                          {t("app.access.restricted")}
                        </div>
                      ) : (
                        <div className="mt-1 space-y-0.5">
                          {inv.client?.email && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                              <Mail size={11} className="shrink-0" aria-hidden="true" />
                              {inv.client.email}
                            </div>
                          )}
                          {inv.client?.phone && (
                            <FigureText
                              as="div"
                              className="text-xs text-muted-foreground flex items-center gap-1.5"
                            >
                              <Phone size={11} className="shrink-0" aria-hidden="true" />
                              {inv.client.phone}
                            </FigureText>
                          )}
                        </div>
                      )}
                      {inv.client?.address && (
                        <FigureText
                          as="div"
                          className="text-xs text-muted-foreground flex items-center gap-1.5 truncate"
                        >
                          <MapPin size={11} className="shrink-0" aria-hidden="true" />
                          {[inv.client.address, inv.client.city]
                            .filter(Boolean)
                            .join(", ")}
                        </FigureText>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <Figure className="block text-sm font-semibold text-foreground">
                        {formatMoney(inv.owed, money.currency)}
                      </Figure>
                      {/* ── The reminder really sends ─────────────────────────
                          POST /api/invoices/[id]/request-payment emails the
                          client a portal link through Resend and stamps sentAt
                          once Resend accepts. It enforces invoices at
                          view_create_edit, which is precisely what `canRemind`
                          reports, so this is not a button the server will 403.
                          It refuses with a 400 when the client has no email
                          address, and that sentence is shown rather than
                          swallowed — which is why the button still renders for
                          a member whose access hides the email: they may chase,
                          they simply cannot see the address they are chasing.

                          Also on the overdue rows at the top of the page. Two
                          entry points, one handler and one route: the rows up
                          there are the ones that are LATE, and this list also
                          carries invoices that are not late yet, which a
                          contractor still nudges. */}
                      {money.canRemind &&
                        (inv.client?.email || inv.client?.restricted) && (
                          <button
                            type="button"
                            onClick={() => chase(inv)}
                            disabled={chasing === inv.id}
                            className="mt-1 text-xs font-semibold border border-border rounded-full px-3 py-2 min-h-[36px] disabled:opacity-50"
                          >
                            {t("app.invoiceLifecycle.actionChase")}
                          </button>
                        )}
                      {money.canRemind &&
                        !inv.client?.email &&
                        !inv.client?.restricted && (
                          <div className="mt-1 text-xs text-muted-foreground max-w-[14rem]">
                            {t("app.invoiceLifecycle.noClientEmail", {
                              name:
                                inv.client?.name ||
                                t("app.invoiceLifecycle.thisClient"),
                            })}
                          </div>
                        )}
                    </div>
                  </div>
                ))}
              </div>

              {money.receivables.count > 6 && (
                <Link
                  href="/app/invoices"
                  className="block px-4 sm:px-5 py-3 text-xs text-muted-foreground underline"
                >
                  <FigureText as="span">
                    {t("app.dash.owed.more", "{count} more not shown here", {
                      count: money.receivables.count - 6,
                    })}
                  </FigureText>
                </Link>
              )}

              <div className="px-4 sm:px-5 py-3 border-t border-foreground/15 space-y-1">
                {/* What the automation will do on its own — true either way,
                    and the reason the manual button is not the only answer. */}
                <FigureText className="text-xs text-muted-foreground">
                  {money.automaticReminder
                    ? t(
                        "app.dash.owed.autoReminder",
                        "An automatic reminder goes out {delay} after an invoice's due date.",
                        {
                          // formatDuration, not the raw column. delayUnit is a
                          // database value — "days", "hours" — and passing it
                          // straight through printed an English word inside a
                          // translated sentence: "Автоматичне нагадування ... 3
                          // days ...". lib/i18n/duration.js exists for exactly
                          // this and already carries the six languages.
                          delay: formatDuration(
                            t,
                            money.automaticReminder.delayValue,
                            money.automaticReminder.delayUnit,
                          ),
                        },
                      )
                    : t(
                        "app.dash.owed.noAutoReminder",
                        "No automatic overdue reminder is set up, so nothing chases these on its own.",
                      )}
                </FigureText>
                {/* Figures that are knowably short say so. Silence here would
                    make an incomplete total look whole. */}
                {money.receivables.notPlaced > 0 && (
                  <FigureText className="text-xs text-muted-foreground">
                    {t(
                      "app.dash.owed.notPlaced",
                      "{count} invoice(s) carry no date at all and are not counted above.",
                      { count: money.receivables.notPlaced },
                    )}
                  </FigureText>
                )}
                {money.receivables.creditsTotal < 0 && (
                  <FigureText className="text-xs text-muted-foreground">
                    {t(
                      "app.dash.owed.credits",
                      "{count} invoice(s) have been overpaid by {amount} in total. That is money you hold, not money owed to you, so it is not in the figure above.",
                      {
                        count: money.receivables.credits.length,
                        amount: formatMoney(
                          Math.abs(money.receivables.creditsTotal),
                          money.currency,
                        ),
                      },
                    )}
                  </FigureText>
                )}
              </div>
            </>
          )}
        </div>
      )}

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

      {/* Bookings held for a visit fee that hasn't landed. They have no
          Appointment by design, so they appear on no calendar — this is the one
          place they are visible at all. Renders itself away when empty. */}
      <AwaitingPayment />

      {/* FieldQuo's own migration surcharge waiting on a decision or a
          payment — the "similar to an invoice they'd need to pay" surface
          the data-migration brief asked for. Renders itself away when there
          is nothing quoted or accepted-and-unpaid. */}
      <MigrationNotice />

      <div className="grid lg:grid-cols-2 gap-6">
        <div className={CARD_CLIPPED}>
          <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-foreground/15">
            <h2 className="font-semibold text-foreground">{t("app.dash.recentQuotes")}</h2>
            <Link
              href="/app/quotes"
              className="text-sm text-muted-foreground flex items-center gap-1"
            >
              {t("app.action.viewAll")} <ArrowRight size={14} aria-hidden="true" />
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
              <p className="px-4 sm:px-5 py-6 text-sm text-muted-foreground">
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
            <div className="divide-y divide-foreground/10">
              {(recentQuotes ?? []).map((q) => (
                <Link
                  key={q.id}
                  href={`/app/quotes/${q.id}`}
                  className="flex items-center justify-between px-4 sm:px-5 py-3 hover:bg-muted"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {q.client?.name}
                    </div>
                    <FigureText className="text-xs text-muted-foreground">
                      {q.quoteNumber}
                    </FigureText>
                  </div>
                  <Figure className="text-sm font-semibold text-foreground shrink-0">
                    {formatMoney(q.total, money?.currency)}
                  </Figure>
                </Link>
              ))}
            </div>
          </ListState>
        </div>

        <div className={CARD_CLIPPED}>
          <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-foreground/15">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Calendar size={16} className="text-muted-foreground" aria-hidden="true" />
              {t("app.dash.upcomingAppointments")}
            </h2>
            <Link
              href="/app/appointments"
              className="text-sm text-muted-foreground flex items-center gap-1"
            >
              {t("app.action.viewAll")} <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          <div className="divide-y divide-foreground/10">
            {upcomingAppointments.length === 0 && (
              <p className="px-4 sm:px-5 py-6 text-sm text-muted-foreground">
                <Link href="/app/appointments" className="text-foreground underline">
                  {t("app.dash.nothingScheduledCta", "Nothing scheduled yet — book an appointment")}
                </Link>
              </p>
            )}
            {upcomingAppointments.map((a) => (
              <div key={a.id} className="px-4 sm:px-5 py-3">
                <div className="text-sm font-medium text-foreground">
                  {a.client?.name}
                </div>
                <FigureText className="text-xs text-muted-foreground">
                  {new Date(a.scheduledAt).toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </FigureText>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
