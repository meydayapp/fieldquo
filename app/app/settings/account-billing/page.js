// app/app/settings/account-billing/page.js
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { CheckCircle2, ExternalLink, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";

import CancelFlow from "./CancelFlow";
function money(n) {
  return `$${Number(n || 0).toLocaleString()}`;
}

function daysLeft(date) {
  if (!date) return null;
  return Math.max(
    0,
    Math.ceil((new Date(date).getTime() - Date.now()) / 86400000),
  );
}

// ── Hidden, not read-only ──────────────────────────────────────────────────
//
// The decision for this screen. Everything on it is the plan, the price, the
// card and the cancel flow — the company's commercial relationship with
// FieldQuo. There is no half of it an estimator needs in order to do their job,
// so "show it as text" would just be a nicer way of telling them what the
// company pays. Hidden.
//
// A wrapper, so the gate lands BEFORE the screen's hooks run. Written as an
// early return inside AccountBillingScreen it would still fire the mount
// effects, and this page's effects hit Stripe reconciliation — a refusal that
// arrives after the requests have already gone is not a refusal.
//
// The sidebar row is removed too (lib/permissions/settingsAccess.js), but this
// is the one that matters for someone who typed the URL. Neither is the
// security boundary: /api/platform/billing/* and the subscription writes all
// re-check isBillingAdmin.
export default function AccountBillingPage() {
  const access = useSettingsAccess();
  if (!access.canSee("billing")) return <NoAccessPanel capability="billing" />;
  return <AccountBillingScreen />;
}

function AccountBillingScreen() {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyPlanId, setBusyPlanId] = useState(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState("");
  // Whether the account was locked when this page loaded. A ref, not state:
  // it's read once inside an effect that must not re-run when it changes.
  const wasLockedRef = useRef(false);

  useEffect(() => {
    fetch("/api/settings/subscription/access")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) wasLockedRef.current = d.level === "locked";
      })
      .catch(() => {});
  }, []);

  // undefined = not asked yet; null = asked, and we have no country for them.
  const [planCurrency, setPlanCurrency] = useState(undefined);

  function load() {
    return Promise.all([
      fetch("/api/settings/subscription"),
      fetch("/api/settings/plans"),
    ]).then(async ([subRes, planRes]) => {
      // A non-ok subscription response is an { error } body, not a plan — the
      // "no plan" case is a 200 with plan:null. Feeding a 401/500 body into
      // setSubscription would render a corrupt page and, worse, look like "No
      // active plan" to someone who's paying. Leave the data empty so the
      // recovery path shows, and say what actually failed.
      if (!subRes.ok) {
        setSubscription(null);
        setPlans([]);
        setError(t("app.billing.loadFailed", "Couldn't load your subscription. Please try again."));
        return;
      }
      setSubscription(await subRes.json());
      // { plans, currency } since the ladder shipped — the route now filters to
      // the company's own currency rather than listing both, because the two
      // rows of a tier carry the same NUMBER and picking between them is not a
      // currency choice, it is a discount. The array form is still accepted so
      // a cached older response does not empty the page.
      const body = planRes.ok ? await planRes.json() : null;
      const planList = Array.isArray(body) ? body : body?.plans;
      setPlans(Array.isArray(planList) ? planList : []);
      // null means we do not hold their country, so no ladder was returned.
      // Reported so the screen can ask for an address instead of rendering an
      // empty list, which reads as an outage.
      setPlanCurrency(Array.isArray(body) ? undefined : (body?.currency ?? null));
    });
  }

  /**
   * Ask Stripe what the truth is and write it down.
   *
   * Called automatically when we come back from Checkout with a session_id, and
   * manually from the button below. The Subscription row used to be written ONLY
   * by the checkout.session.completed webhook, so a webhook that was delayed,
   * misconfigured or failing left this page saying "No active plan" to a company
   * that had just paid — with no way to recover.
   */
  async function reconcile(sessionId) {
    setSyncing(true);
    setSyncNote("");
    try {
      const res = await fetch("/api/settings/subscription/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionId ? { sessionId } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Through the shared mapper, not straight into the banner. The QA pass
        // that found this page saw the literal word "Unauthorized" printed as
        // user-facing copy — `data.error` is the API's field, and the auth
        // middleware fills it with a bare protocol word. reportResponseError
        // swaps those for a sentence and keeps the raw value for the console.
        reportResponseError(res, setError, t("app.billing.checkFailed", "Couldn't check your subscription with Stripe."));
      } else if (data.reconciled) {
        await load();
      } else {
        // pending / nothing found — say which, rather than leaving the page
        // looking like the payment vanished.
        setSyncNote(data.message || t("app.billing.nothingNew", "Stripe has nothing new for this company yet."));
      }
    } catch {
      setError(t("app.billing.checkUnreachable", "Couldn't reach the server to check your subscription."));
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    // Set on the return from the Stripe billing portal — see the portal route.
    // Someone who was LOCKED OUT and has just fixed their card arrives here,
    // and has to see the app come back now rather than whenever a webhook
    // happens to land. Waiting for one means they pay and stay locked, which is
    // the worst possible outcome of the grace period.
    const fromPortal = params.get("reconcile") === "1";

    load()
      .then(() => {
        // Just came back from Checkout or the portal: confirm it against Stripe
        // instead of hoping the webhook arrived in the second the redirect took.
        if (sessionId || fromPortal) return reconcile(sessionId);
      })
      .then(() => {
        // A lock is enforced in the LAYOUT, which was rendered before any of
        // this ran — so clearing the lock in the database isn't enough to make
        // the app reappear. A reload re-runs the layout with the new state.
        //
        // Only when they actually were locked, so a routine visit to this page
        // doesn't reload itself.
        if (fromPortal && wasLockedRef.current) {
          window.location.href = "/app";
        }
      })
      .catch(() => {
        // A network rejection from load()/reconcile() must not vanish and leave
        // the page looking like there's simply no plan.
        setError(t("app.billing.loadUnreachable", "Couldn't reach the server to load your billing. Please try again."));
      })
      .finally(() => {
        setLoading(false);
        // Drop the query string so a refresh doesn't re-run this and so the
        // session id isn't left sitting in the address bar.
        if (sessionId || fromPortal) {
          window.history.replaceState({}, "", window.location.pathname);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpgrade(planId) {
    setError("");
    setBusyPlanId(planId);
    try {
      const res = await fetch("/api/platform/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("app.billing.checkoutFailed", "Could not start checkout"));
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err.message);
      setBusyPlanId(null);
    }
  }

  async function handleManageBilling() {
    setError("");
    setOpeningPortal(true);
    try {
      const res = await fetch("/api/platform/billing/portal", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // This button used to fail in TOTAL SILENCE — no banner, no spinner, no
        // tab — so a customer whose billing was already broken clicked it
        // repeatedly assuming a slow connection. Both self-serve recovery paths
        // on this page were dead at once.
        reportResponseError(res, setError, t("app.billing.portalFailed", "Could not open billing portal"));
        return;
      }
      window.location.href = data.url;
    } catch {
      setError(t("app.billing.portalUnreachable", "Couldn't reach the server to open billing. Please try again."));
      setOpeningPortal(false);
    }
  }


  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto animate-pulse space-y-4">
        <div className="h-8 w-56 bg-accent rounded" />
        <div className="h-40 bg-accent rounded-xl" />
        <div className="h-64 bg-accent rounded-xl" />
      </div>
    );
  }

  const isTrialing = subscription?.status === "trialing";
  const trialDays = isTrialing ? daysLeft(subscription.trialEndsAt) : null;
  const currentPlanId = subscription?.plan?.id;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("app.billing.title", "Account & Billing")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.billing.subtitle", "Your plan, seats, and payment details.")}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Current plan */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">
                {subscription?.plan?.name || t("app.billing.noActivePlan", "No active plan")}
              </h2>
              {subscription?.status && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                    isTrialing
                      ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                      : subscription.status === "active"
                        ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {subscription.status}
                </span>
              )}
            </div>
            {subscription?.plan && (
              <p className="text-sm text-muted-foreground mt-1">
                {money(subscription.plan.priceMonthly)}{t("app.billing.perMonth", "/month")}
                {subscription.plan.maxUsers
                  ? ` · ${t("app.billing.upToUsers", "up to {count} users", { count: subscription.plan.maxUsers })}`
                  : ""}
              </p>
            )}
            {isTrialing && trialDays !== null && (
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-2 font-medium">
                {t("app.billing.trialEnds", "Trial ends in {days} day{plural}", { days: trialDays, plural: trialDays === 1 ? "" : "s" })}
              </p>
            )}
            {!isTrialing && subscription?.currentPeriodEnd && (
              <p className="text-xs text-muted-foreground mt-2">
                {t("app.billing.nextBillingDate", "Next billing date")}{" "}
                {formatDate(subscription.currentPeriodEnd)}
              </p>
            )}

            {/* The recovery path. Says out loud that a plan can exist in Stripe
                and not here yet, because the alternative — a page that just says
                "No active plan" to someone who has paid — gets people paying
                twice. */}
            {!subscription?.plan && !syncing && (
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                {t("app.billing.recoveryHint", "If you've already paid, your plan may not have reached us yet. Check with Stripe below — nothing is charged again.")}
              </p>
            )}
            {syncing && (
              <p className="text-sm text-muted-foreground mt-2 inline-flex items-center gap-1.5">
                <Loader2 size={13} className="animate-spin" /> {t("app.billing.checkingStripe", "Checking with Stripe…")}
              </p>
            )}
            {syncNote && !syncing && (
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-2 max-w-md">
                {syncNote}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-4">
          <button
            type="button"
            onClick={() => reconcile(null)}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 border border-border rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {syncing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            {t("app.billing.checkWithStripe", "Check with Stripe")}
          </button>
          <button
            onClick={handleManageBilling}
            disabled={openingPortal}
            className="flex items-center gap-1.5 border border-border text-foreground px-4 py-2 rounded-full text-sm font-semibold hover:bg-muted disabled:opacity-60"
          >
            <ExternalLink size={14} />
            {openingPortal ? t("app.billing.opening", "Opening...") : t("app.billing.manageBilling", "Manage billing & payment method")}
          </button>
          {/* ── The OTHER Stripe ─────────────────────────────────────────
              Everything else on this page is FieldQuo charging the company.
              This one link goes the other way: the company's own Connect
              account, where the money their clients paid them lives.

              It belongs here because this is where somebody looks for "my
              money", even though the account it opens is a different Stripe
              account from the subscription above. Labelled by what it shows
              rather than by the button beside it, because two links called
              "Stripe" on one screen is worse than none. Settings > Payments
              still owns connecting, disconnecting and the payout status —
              this is a shortcut, not a second home for it. */}
          <a
            href="/app/settings/payments"
            className="flex items-center gap-1.5 border border-border text-foreground px-4 py-2 rounded-full text-sm font-semibold hover:bg-muted"
          >
            <ExternalLink size={14} />
            {t("app.billing.myEarnings", "See what my clients paid me")}
          </a>
          {subscription?.status && subscription.status !== "canceled" && (
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="text-sm font-medium text-red-600 dark:text-red-400 px-4 py-2 rounded-full hover:bg-red-50 dark:bg-red-950/40"
            >
              {t("app.billing.cancelPlan", "Cancel plan")}
            </button>
          )}
        </div>
      </div>

      {/* Available plans */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-3">{t("app.billing.plansHeading", "Plans")}</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            return (
              <div
                key={plan.id}
                className={`border rounded-xl p-4 ${
                  isCurrent ? "border-inverted" : "border-border"
                }`}
              >
                <h3 className="font-semibold text-foreground">{plan.name}</h3>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {money(plan.priceMonthly)}
                  <span className="text-sm font-normal text-muted-foreground">{t("app.billing.perMonthShort", "/mo")}</span>
                </p>
                {plan.maxUsers && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {/* "Up to 1 users" on the 1-Employee card. Singular and
                        plural are separate strings rather than a stripped "s",
                        because the six languages here don't agree on how
                        plurals work. */}
                    {plan.maxUsers === 1
                      ? t("app.billing.upToUsersCapOne", "Up to 1 user")
                      : t("app.billing.upToUsersCap", "Up to {count} users", {
                          count: plan.maxUsers,
                        })}
                  </p>
                )}
                {plan.aiCopilotEnabled && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("app.billing.aiIncluded", "FieldQuo AI included")}
                  </p>
                )}
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={isCurrent || busyPlanId === plan.id}
                  className={`w-full mt-3 py-2 rounded-full text-sm font-semibold disabled:opacity-60 ${
                    isCurrent
                      ? "bg-muted text-muted-foreground"
                      : "bg-inverted text-inverted-foreground"
                  }`}
                >
                  {isCurrent
                    ? t("app.billing.currentPlan", "Current plan")
                    : busyPlanId === plan.id
                      ? t("app.billing.redirecting", "Redirecting...")
                      : t("app.billing.choosePlan", "Choose plan")}
                </button>
              </div>
            );
          })}
          {/* Two different empty states, because they have two different
              causes and only one of them is actionable by the person reading
              it. "No plans configured yet" in front of somebody whose address
              we simply never captured is a lie that looks like an outage —
              they would contact support about a form field they could have
              filled in themselves. */}
          {plans.length === 0 && planCurrency === null && (
            <div className="col-span-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-foreground">
              <p>{t("app.billing.needCountry")}</p>
              <Link
                href="/app/settings/company"
                className="mt-2 inline-block font-medium underline underline-offset-2"
              >
                {t("app.billing.needCountryCta")}
              </Link>
            </div>
          )}
          {plans.length === 0 && planCurrency !== null && (
            <p className="text-sm text-muted-foreground col-span-3">
              {t("app.billing.noPlans", "No plans configured yet.")}
            </p>
          )}
        </div>
      </div>

      {/* The save flow, not a two-button "are you sure?".
          It asks WHY before offering anything — an offer before you've asked
          reads as haggling, and it spends margin on people who'd have stayed
          for free if asked the right question. See CancelFlow.js. */}
      <CancelFlow
        open={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        periodEnd={subscription?.currentPeriodEnd}
        formatDate={formatDate}
        onCancelled={async () => {
          setShowCancelConfirm(false);
          await load();
        }}
      />
    </div>
  );
}
