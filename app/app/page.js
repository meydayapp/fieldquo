// app/app/page.js
"use client";

import { useState, useEffect, useCallback } from "react";
import { countUpcoming } from "@/lib/schedule/jobVisits";
import { formatDuration } from "@/lib/i18n/duration";
import Link from "next/link";
import {
  FileText,
  Receipt,
  Calendar,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Circle,
  AlertCircle,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";

import { isInternalPath } from "@/lib/appUrl";
import OnboardingProgress from "@/app/components/dashboard/OnboardingProgress";
import RevenueGoalCard from "@/app/components/dashboard/RevenueGoalCard";
import AwaitingPayment from "@/app/components/dashboard/AwaitingPayment";

import { useTranslation } from "@/app/hooks/useTranslation";
import { useHasLevel } from "@/app/providers/PermissionProvider";
import { fetchList, fetchArray } from "@/lib/loadState";
import { reportResponseError } from "@/lib/clientErrors";
import { formatMoney } from "@/lib/currency";
import ListState from "@/app/components/ListState";

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
  const [upcomingCount, setUpcomingCount] = useState(0);
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

      {/* ── Money owed, with age ────────────────────────────────────────────
          Absent for anyone the endpoint refused: no panel, no zero, no
          apology. `money` is null until the server sends a body. */}
      {money?.receivables && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Receipt size={16} className="text-muted-foreground" />
              {t("app.dash.owed.title", "Money owed")}
            </h2>
            <Link
              href="/app/invoices"
              className="text-sm text-muted-foreground flex items-center gap-1"
            >
              {t("app.action.viewAll")} <ArrowRight size={14} />
            </Link>
          </div>

          {/* Three different states, and none of them is "$0.00". Nothing
              billed, everything paid, and a real balance are three different
              things to say — AGENTS.md failure class 5. */}
          {money.receivables.noInvoices ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              {t(
                "app.dash.owed.noInvoices",
                "No invoices yet, so nothing is owed to you.",
              )}
            </p>
          ) : money.receivables.nothingOutstanding ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              {t(
                "app.dash.owed.nothing",
                "Nothing outstanding — every invoice you have sent has been settled.",
              )}
            </p>
          ) : (
            <>
              <div className="px-5 py-4 border-b border-border">
                <div className="text-3xl font-bold text-foreground">
                  {formatMoney(money.receivables.total, money.currency)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t(
                    "app.dash.owed.caption",
                    "Across {count} unpaid invoices. Counts the latest version of each invoice, less the payments recorded against it.",
                    { count: money.receivables.count },
                  )}
                </p>
                {money.receivables.overdueCount > 0 && (
                  <p className="text-xs text-destructive mt-1">
                    {t("app.dash.owed.pastDue", "{amount} of that is past due.", {
                      amount: formatMoney(
                        money.receivables.overdueTotal,
                        money.currency,
                      ),
                    })}
                  </p>
                )}
              </div>

              {/* The aging strip. Only rungs with something on them — five
                  empty boxes would be four claims nobody made. */}
              <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 border-b border-border">
                {money.receivables.aging
                  .filter((b) => b.count > 0)
                  .map((b) => (
                    <div
                      key={b.id}
                      className="border border-border rounded-lg px-3 py-2"
                    >
                      <div className="text-[11px] text-muted-foreground">
                        {t(...AGING_LABEL[b.id])}
                      </div>
                      <div
                        className={`text-sm font-semibold ${
                          b.overdue ? "text-destructive" : "text-foreground"
                        }`}
                      >
                        {formatMoney(b.amount, money.currency)}
                      </div>
                    </div>
                  ))}
                {money.receivables.undatedCount > 0 && (
                  <div className="border border-border rounded-lg px-3 py-2">
                    <div className="text-[11px] text-muted-foreground">
                      {t("app.dash.aging.undated", "No due date")}
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      {formatMoney(
                        money.receivables.undatedTotal,
                        money.currency,
                      )}
                    </div>
                  </div>
                )}
              </div>

              {chaseError && (
                <p className="mx-5 mt-3 text-xs text-destructive flex items-start gap-1.5">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                  {chaseError}
                </p>
              )}
              {chaseNote && (
                <p className="mx-5 mt-3 text-xs text-muted-foreground">
                  {chaseNote}
                </p>
              )}

              <div className="divide-y divide-border">
                {money.receivables.invoices.slice(0, 6).map((inv) => (
                  <div
                    key={inv.id}
                    className="px-5 py-3 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {inv.client?.name}
                      </div>
                      {/* Days past due, in red, from the DUE DATE — and an
                          invoice with no due date says exactly that instead of
                          being aged from the day it was raised. */}
                      {inv.dueState === "overdue" ? (
                        <div className="text-xs font-semibold text-destructive">
                          {t(
                            "app.dash.owed.daysPastDue",
                            "{days} days past due",
                            { days: inv.daysPastDue },
                          )}
                        </div>
                      ) : inv.dueState === "undated" ? (
                        <div className="text-xs text-muted-foreground">
                          {t(
                            "app.dash.owed.undated",
                            "No due date on this invoice — it is not overdue",
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          {t("app.dash.owed.dueOn", "Due {date}", {
                            date: new Date(inv.dueDate).toLocaleDateString(
                              undefined,
                              { month: "short", day: "numeric" },
                            ),
                          })}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {inv.invoiceNumber}
                        {inv.amended
                          ? ` · ${t("app.dash.owed.amended", "amended, v{version}", { version: inv.version })}`
                          : ""}
                      </div>
                      {inv.partiallyPaid && (
                        <div className="text-xs text-muted-foreground">
                          {t("app.invoiceLifecycle.partiallyPaid", {
                            paid: formatMoney(inv.paid, money.currency),
                            total: formatMoney(inv.total, money.currency),
                            due: formatMoney(inv.owed, money.currency),
                          })}
                        </div>
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
                              <Mail size={11} className="shrink-0" />
                              {inv.client.email}
                            </div>
                          )}
                          {inv.client?.phone && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Phone size={11} className="shrink-0" />
                              {inv.client.phone}
                            </div>
                          )}
                        </div>
                      )}
                      {inv.client?.address && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                          <MapPin size={11} className="shrink-0" />
                          {[inv.client.address, inv.client.city]
                            .filter(Boolean)
                            .join(", ")}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold text-foreground">
                        {formatMoney(inv.owed, money.currency)}
                      </div>
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
                          they simply cannot see the address they are chasing. */}
                      {money.canRemind &&
                        (inv.client?.email || inv.client?.restricted) && (
                          <button
                            type="button"
                            onClick={() => chase(inv)}
                            disabled={chasing === inv.id}
                            className="mt-1 text-xs font-semibold border border-border rounded-full px-3 py-1.5 disabled:opacity-50"
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
                  className="block px-5 py-3 text-xs text-muted-foreground underline"
                >
                  {t("app.dash.owed.more", "{count} more not shown here", {
                    count: money.receivables.count - 6,
                  })}
                </Link>
              )}

              <div className="px-5 py-3 border-t border-border space-y-1">
                {/* What the automation will do on its own — true either way,
                    and the reason the manual button is not the only answer. */}
                <p className="text-xs text-muted-foreground">
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
                </p>
                {/* Figures that are knowably short say so. Silence here would
                    make an incomplete total look whole. */}
                {money.receivables.notPlaced > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "app.dash.owed.notPlaced",
                      "{count} invoice(s) carry no date at all and are not counted above.",
                      { count: money.receivables.notPlaced },
                    )}
                  </p>
                )}
                {money.receivables.creditsTotal < 0 && (
                  <p className="text-xs text-muted-foreground">
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
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── What has actually come in, month by month ───────────────────────
          The tile above totals invoices marked paid; this counts PAYMENTS. Two
          different questions, and the caption says which one this is rather
          than letting the two quietly disagree. */}
      {money?.revenue && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border gap-3">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <TrendingUp size={16} className="text-muted-foreground" />
              {t("app.dash.revenue.title", "Money received")}
            </h2>
            <div className="flex gap-1.5">
              {(money.periods || []).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTrendMonths(p)}
                  className={`text-xs font-semibold rounded-full px-3 py-1.5 border ${
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
            <p className="px-5 py-6 text-sm text-muted-foreground">
              {t(
                "app.dash.revenue.none",
                "No payments have been recorded yet, so there is no trend to show.",
              )}
            </p>
          ) : (
            <div className="px-5 py-4">
              {/* ── The commentary, and what it deliberately does not do ─────
                  It states the change and stops. No "focus on new sales
                  opportunities": advice generated from one number is a
                  horoscope, and one sentence of it makes every real figure on
                  the panel less believable.

                  The comparison is between the last two COMPLETE months. An
                  unfinished month measured against a finished one would
                  manufacture a collapse on the 2nd of every month. */}
              {money.revenue.headline &&
                (money.revenue.headline.deltaPct === null ? (
                  <p className="text-sm text-foreground">
                    {t(
                      "app.dash.revenue.fromNothing",
                      "{month}: {amount}. Nothing was received in {priorMonth}.",
                      {
                        month: monthLabel(money.revenue.headline.month),
                        amount: formatMoney(
                          money.revenue.headline.amount,
                          money.currency,
                        ),
                        priorMonth: monthLabel(
                          money.revenue.headline.priorMonth,
                        ),
                      },
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-foreground">
                    {t(
                      ...(TREND_SENTENCE[money.revenue.headline.direction] ||
                        TREND_SENTENCE.flat),
                      {
                        month: monthLabel(money.revenue.headline.month),
                        amount: formatMoney(
                          money.revenue.headline.amount,
                          money.currency,
                        ),
                        pct: money.revenue.headline.deltaPct,
                        priorMonth: monthLabel(
                          money.revenue.headline.priorMonth,
                        ),
                      },
                    )}
                  </p>
                ))}

              {money.revenue.series.every((s) => s.amount === 0) ? (
                <p className="text-sm text-muted-foreground mt-2">
                  {t(
                    "app.dash.revenue.noneInPeriod",
                    "No payments were received in this period.",
                  )}
                </p>
              ) : (
                <>
                  <div className="mt-4 flex items-end gap-2 h-32">
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
                            className={`rounded-t ${s.partial ? "bg-muted-foreground" : "bg-primary"}`}
                            style={{ height: `${pct}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex gap-2">
                    {money.revenue.series.map((s) => (
                      <div
                        key={s.month}
                        className="flex-1 text-[10px] text-muted-foreground text-center truncate"
                      >
                        {monthLabel(s.month)}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    {t(
                      "app.dash.revenue.caption",
                      "Payments recorded, by the month they were received. The revenue tile above totals invoices marked paid, which is a different measure.",
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
