// app/app/settings/account-billing/page.js
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { CheckCircle2, ExternalLink, AlertTriangle, Loader2, RefreshCw, X, CalendarClock } from "lucide-react";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";

import CancelFlow from "./CancelFlow";
import {
  annualPriceOf,
  annualSaving,
  isBillingInterval,
} from "@/lib/billing/interval";
import { classifyPlanChange } from "@/lib/platform/planChange";
import {
  subscriptionStatusClasses,
  subscriptionStatusLabel,
} from "@/lib/billing/subscriptionStatusPresentation";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";

// ── What a plan actually gets you, in one line ─────────────────────────────
//
// `maxUsers` is seats PLUS crew, so a Solo plan that bills for one seat was
// describing itself as "up to 6 users". The owner read that, created an
// Administrator, and was surprised when I told him it should have cost a seat
// — the sentence had told him he had six.
//
// One helper because the current-subscription line and the plan cards both say
// this, and the first attempt fixed only the cards. Legacy per-headcount plans
// have no crew concept and keep the old wording: they were sold as a headcount
// and inventing a zero-crew ladder tier for them would misdescribe what they
// bought.
function seatLine(plan, t) {
  if (!plan) return null;
  if (plan.crewSeats != null) {
    return plan.seats === 1
      ? t("app.billing.seatsOneWithCrew", { crew: plan.crewSeats })
      : t("app.billing.seatsWithCrew", { seats: plan.seats, crew: plan.crewSeats });
  }
  if (!plan.maxUsers) return null;
  // Singular and plural are separate strings rather than a stripped "s",
  // because the six languages here don't agree on how plurals work.
  return plan.maxUsers === 1
    ? t("app.billing.upToUsersCapOne", "Up to 1 user")
    : t("app.billing.upToUsersCap", "Up to {count} users", { count: plan.maxUsers });
}

function daysLeft(date) {
  if (!date) return null;
  return Math.max(
    0,
    Math.ceil((new Date(date).getTime() - Date.now()) / 86400000),
  );
}

// "billed monthly" / "billed yearly" — the cadence as a phrase, for the
// sentences below that name a plan AND how it is paid for. A plan change is
// often only a cadence change, and "Your plan changes to Solo on 1 Oct" with
// no cadence would read as nothing happening.
function cadenceLabel(interval, t) {
  return interval === "year"
    ? t("app.billing.cadenceYearly", "billed yearly")
    : t("app.billing.cadenceMonthly", "billed monthly");
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
  const money = useCompanyMoney();
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
  // ── The change being confirmed, and the change that is booked ────────────
  //
  // `confirming` is the plan card that was clicked plus what classifyPlanChange
  // says will happen to it — shown in a dialog BEFORE anything is posted,
  // because since the owner's 2026-09-08 decision a downgrade or a cadence
  // switch does not happen today, and a button that silently books something
  // for the 1st is a control that appears to do one thing and does another.
  // `cancellingPending` is the "Keep my current plan" request in flight.
  const [confirming, setConfirming] = useState(null);
  const [cancellingPending, setCancellingPending] = useState(false);
  // ── Which cadence an upgrade is bought on ────────────────────────────────
  //
  // null until the subscription loads, then seeded from what the company is
  // ALREADY on. This route used to send no cadence at all, so a company that
  // took the one-year commitment at signup and changed tier here was moved to
  // monthly without being told — the two months they had committed for, gone.
  //
  // Seeded rather than defaulted to monthly for the same reason: the safe
  // assumption for somebody who has already chosen is what they chose.
  const [billingInterval, setBillingInterval] = useState(null);
  // Two different questions that were briefly one variable: `onYear` is the
  // cadence they are BILLED on, `billingInterval` is the cadence the plan cards
  // are being priced in. They start equal and diverge the moment somebody flips
  // the switch to compare — at which point the current-plan line above must not
  // move.
  const onYear = subscription?.billingInterval === "year";
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
      const sub = await subRes.json();
      setSubscription(sub);
      // Only on the first load. Re-seeding on every refresh would yank the
      // control back under someone who had just switched it.
      setBillingInterval((current) =>
        current ?? (isBillingInterval(sub?.billingInterval) ? sub.billingInterval : "month"),
      );
      // { plans, currency } since the ladder shipped — the route now filters to
      // the company's own currency rather than listing both, because the two
      // rows of a tier carry the same NUMBER and picking between them is not a
      // currency choice, it is a discount. The array form is still accepted so
      // a cached older response does not empty the page.
      // ── A failed request is not "we don't know your country" ──────────────
      //
      // This read a non-ok response as `body = null`, which made `currency`
      // null, which made the page say "we need to know where your business is"
      // — to a company whose Canadian address was on file and had already been
      // priced in CAD. The route was throwing on a bad Prisma query and the
      // screen turned a 500 into a question about the customer's address.
      //
      // `undefined` means we could not ask. `null` means we asked and they
      // genuinely have no country. Only the second is the customer's problem.
      const body = planRes.ok ? await planRes.json() : null;
      const planList = Array.isArray(body) ? body : body?.plans;
      setPlans(Array.isArray(planList) ? planList : []);
      if (!planRes.ok) {
        setPlanCurrency(undefined);
        setError(
          t("app.billing.loadFailed", "Couldn't load your subscription. Please try again."),
        );
      } else {
        setPlanCurrency(Array.isArray(body) ? undefined : (body?.currency ?? null));
      }
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

  // What pressing a plan card will DO, said before it is pressed.
  //
  // Only a company with a live subscription is changing plan; one without is
  // buying, and goes straight to Checkout as before. The current plan is
  // looked up in the plan list rather than taken off the subscription
  // payload, because the list carries tierKey/sortOrder — the rank the
  // classifier needs — and the route guarantees the current plan is in it.
  function planChangeFor(plan) {
    const currentPlan = plans.find((p) => p.id === currentPlanId) || subscription?.plan;
    if (!subscription?.plan || !currentPlan) return null;
    return classifyPlanChange({
      currentPlan,
      currentInterval: subscription.billingInterval,
      nextPlan: plan,
      nextInterval: billingInterval || "month",
    });
  }

  function handleChoosePlan(plan) {
    setError("");
    const change = planChangeFor(plan);
    if (!change) {
      // No live subscription: nothing to confirm, this is a purchase.
      return submitPlan(plan.id);
    }
    setConfirming({ plan, change });
  }

  async function submitPlan(planId) {
    setError("");
    setBusyPlanId(planId);
    try {
      const res = await fetch("/api/platform/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The cadence goes with the plan. The server revalidates it against
        // the plan's own priceAnnual and refuses rather than falling back —
        // "1 year commitment" on screen with a monthly charge on the card is
        // the failure this whole path exists to prevent.
        body: JSON.stringify({ planId, interval: billingInterval || "month" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("app.billing.checkoutFailed", "Could not start checkout"));
      // Booked for the end of the period. Nothing changed today, so there is
      // nothing to reconcile — reload the row and show the pending card.
      if (data.scheduled) {
        setConfirming(null);
        await load();
        setSyncNote(
          t("app.billing.changeScheduled", "Done — your plan changes on {date}. Nothing is charged until then.", {
            date: data.effectiveAt ? formatDate(data.effectiveAt) : "",
          }),
        );
        setBusyPlanId(null);
        return;
      }
      // A company already subscribed is moved in place (no Checkout, no
      // second subscription) and the server answers `changed` instead of a
      // URL. Reload so the page reads the new plan off the row.
      if (data.changed !== undefined) {
        if (data.changed === false && data.note) setError(data.note);
        else window.location.href = "/app/settings/account-billing?reconcile=1";
        setBusyPlanId(null);
        setConfirming(null);
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err.message);
      setBusyPlanId(null);
      setConfirming(null);
    }
  }

  // "Keep my current plan" — release the booked change. The server clears the
  // pending columns itself, so the card goes on the reload whether or not the
  // subscription_schedule.released webhook has arrived.
  async function handleKeepCurrentPlan() {
    setError("");
    setSyncNote("");
    setCancellingPending(true);
    try {
      const res = await fetch("/api/platform/billing/pending-change", { method: "DELETE" });
      if (!res.ok) {
        reportResponseError(res, setError, t("app.billing.keepPlanFailed", "Couldn't undo the scheduled change. Your plan change is still booked."));
        return;
      }
      await load();
    } catch {
      setError(t("app.billing.keepPlanUnreachable", "Couldn't reach the server to undo the scheduled change."));
    } finally {
      setCancellingPending(false);
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
  // The plan a booked change moves them to, named from the list. The
  // subscription payload carries only the id (it is what the row holds), and
  // a card reading "Switching to clx8… on the 1st" is not a sentence.
  const pendingPlan = subscription?.pendingPlanId
    ? plans.find((p) => p.id === subscription.pendingPlanId) || null
    : null;
  const currentPlanLine = subscription?.plan
    ? `${subscription.plan.name} (${cadenceLabel(subscription.billingInterval, t)})`
    : "";

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
              {/* ── The badge, from the enum, with a colour ─────────────────
                  This was `{subscription.status}` under `capitalize`, with
                  grey for anything that wasn't trialing or active. `past_due`
                  is one of those two: a company seven days from losing access
                  to its own quote history read the word "Past_due" in the
                  quietest style on the page. The mapping is exhaustive over
                  the schema enum now, and check:money-status-chips fails the
                  build if a fifth value is ever added without a tone. */}
              {subscription?.status && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${subscriptionStatusClasses(
                    subscription.status,
                  )}`}
                >
                  {subscriptionStatusLabel(subscription.status, t)}
                </span>
              )}
            </div>
            {subscription?.plan && (
              <p className="text-sm text-muted-foreground mt-1">
                {/* Quoted on the cadence they are actually billed on. An
                    annual company reading "/month" here has to multiply in
                    their head to recognise their own invoice, and the figure
                    they land on is not the one they pay — the year is two
                    months cheaper than twelve of them. */}
                {onYear && annualPriceOf(subscription.plan) !== null
                  ? `${money(annualPriceOf(subscription.plan))}${t("app.billing.perYear", "/year")}`
                  : `${money(subscription.plan.priceMonthly)}${t("app.billing.perMonth", "/month")}`}
                {seatLine(subscription.plan, t) ? ` · ${seatLine(subscription.plan, t)}` : ""}
                {onYear ? ` · ${t("app.billing.oneYearCommitment", "1 year commitment")}` : ""}
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

        {/* ── A change booked for the end of the period ───────────────────
            Rendered from the row's pending columns and nothing else: the
            "Keep my current plan" button exists only while pendingPlanId is
            set, because releasing a schedule that is not there is a button
            that does nothing. The plan they are on today stays in the
            heading above — that IS what they are on today. */}
        {subscription?.pendingPlanId && (
          <div className="mt-4 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
            <p className="text-sm font-semibold text-foreground inline-flex items-center gap-1.5">
              <CalendarClock size={15} />
              {t("app.billing.pendingTitle", "Switching to {plan} ({cadence}) on {date}", {
                plan: pendingPlan?.name || t("app.billing.pendingUnnamedPlan", "another plan"),
                cadence: cadenceLabel(subscription.pendingBillingInterval, t),
                date: subscription.pendingEffectiveAt ? formatDate(subscription.pendingEffectiveAt) : "",
              })}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("app.billing.pendingBody", "Until then you keep {current}. Nothing is charged before that date.", {
                current: currentPlanLine,
              })}
            </p>
            <button
              type="button"
              onClick={handleKeepCurrentPlan}
              disabled={cancellingPending}
              className="mt-3 inline-flex items-center gap-1.5 border border-border rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {cancellingPending ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
              {t("app.billing.keepMyPlan", "Keep my current plan")}
            </button>
          </div>
        )}

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
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-base font-semibold text-foreground">{t("app.billing.plansHeading", "Plans")}</h2>

          {/* ── How often, chosen before which tier ────────────────────────
              This screen used to have no cadence control and sent none, so
              every upgrade was bought monthly — including by companies who had
              taken the one-year commitment at signup and were quietly moved
              off it. The switch is seeded from what they are already on.

              Rendered only when some plan on offer actually HAS an annual
              price. A toggle whose other half cannot be bought is a control
              that appears to work. */}
          {plans.some((p) => annualPriceOf(p) !== null) && (
            <div className="inline-flex rounded-full border border-border p-0.5 text-xs font-semibold">
              {[
                ["month", t("app.billing.payMonthly", "Monthly")],
                ["year", t("app.billing.payYearly", "1 year commitment")],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setBillingInterval(value)}
                  aria-pressed={billingInterval === value}
                  className={`px-3 py-1.5 rounded-full ${
                    billingInterval === value
                      ? "bg-inverted text-inverted-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {plans.map((plan) => {
            // ── "Current plan" is the tier AND the cadence ────────────────
            //
            // Their own tier with the switch flipped to the year is a real
            // purchase — it is how a monthly company takes the commitment —
            // so the button stays live and says so. Disabling it on the tier
            // alone would leave the only route to the annual deal being to
            // downgrade and come back.
            const sameTier = plan.id === currentPlanId;
            const isCurrent =
              sameTier && (subscription?.billingInterval || "month") === billingInterval;
            // null means this tier has no annual option — not "free", and not
            // "fall back to monthly". See lib/billing/interval.js.
            const yearly = billingInterval === "year" ? annualPriceOf(plan) : null;
            const saving = yearly !== null ? annualSaving(plan) : null;
            // The server refuses this combination, so the button must not offer
            // it. Refusing on both sides rather than trusting either.
            const unsellable = billingInterval === "year" && annualPriceOf(plan) === null;
            return (
              <div
                key={plan.id}
                className={`border rounded-xl p-4 ${
                  isCurrent ? "border-inverted" : "border-border"
                }`}
              >
                <h3 className="font-semibold text-foreground">{plan.name}</h3>
                {/* The yearly figure is the plan's OWN priceAnnual, never twelve
                    times the monthly one — the ladder gives two months free, and
                    an operator can type a different deal per tier. A tier with no
                    annual price shows its monthly one and says so on the button
                    below, rather than displaying a year it cannot sell. */}
                <p className="text-2xl font-bold text-foreground mt-1">
                  {money(yearly !== null ? yearly : plan.priceMonthly)}
                  <span className="text-sm font-normal text-muted-foreground">
                    {yearly !== null
                      ? t("app.billing.perYearShort", "/yr")
                      : t("app.billing.perMonthShort", "/mo")}
                  </span>
                </p>
                {yearly !== null && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("app.billing.perMonthEquivalent", "{amount} a month", {
                      amount: money(yearly / 12),
                    })}
                  </p>
                )}
                {/* The saving is the REASON to commit, so it is said in money
                    and in months — "two months free" is checkable against the
                    monthly price; a percentage is a number to trust. Hidden at
                    zero rather than printed as "Save $0". */}
                {yearly !== null && saving > 0 && (
                  <p className="text-xs font-medium text-green-700 dark:text-green-400 mt-0.5">
                    {t("app.billing.annualSaving", "Save {amount} a year", {
                      amount: money(saving),
                    })}
                  </p>
                )}
                {seatLine(plan, t) && (
                  <p className="text-xs text-muted-foreground mt-1">{seatLine(plan, t)}</p>
                )}
                {billingInterval === "year" && yearly === null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("app.billing.monthlyOnly", "This plan is billed monthly only.")}
                  </p>
                )}
                {plan.aiCopilotEnabled && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("app.billing.aiIncluded", "FieldQuo AI included")}
                  </p>
                )}
                <button
                  onClick={() => handleChoosePlan(plan)}
                  disabled={isCurrent || unsellable || busyPlanId === plan.id}
                  className={`w-full mt-3 py-2 rounded-full text-sm font-semibold disabled:opacity-60 ${
                    isCurrent || unsellable
                      ? "bg-muted text-muted-foreground"
                      : "bg-inverted text-inverted-foreground"
                  }`}
                >
                  {isCurrent
                    ? t("app.billing.currentPlan", "Current plan")
                    : unsellable
                      ? t("app.billing.noAnnual", "Not sold yearly")
                      : busyPlanId === plan.id
                        ? t("app.billing.redirecting", "Redirecting...")
                        : sameTier
                          ? t("app.billing.switchToYearly", "Switch to yearly")
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

      {/* ── What happens if you press Confirm, before you press it ───────
          Two sentences, both facts about code. A downgrade or a cadence
          switch is booked for the period end (schedulePlanChange, no
          prorations) and nothing is charged today; an upgrade is applied now
          and prorated (changeSubscriptionPlan, create_prorations). The
          wording branches on the SAME classifier the route uses, so the
          sentence and the action cannot come apart. */}
      {confirming && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <h2 className="font-bold text-foreground">
                {t("app.billing.confirmChangeTitle", "Change your plan")}
              </h2>
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="ml-auto text-muted-foreground hover:text-foreground"
                aria-label={t("app.action.close", "Close")}
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-foreground">
                {confirming.change.applies === "period_end"
                  ? t("app.billing.confirmDeferredBody", "Your plan changes to {plan} ({cadence}) on {date}. Until then you keep {current}. Nothing is charged today.", {
                      plan: confirming.plan.name,
                      cadence: cadenceLabel(billingInterval || "month", t),
                      date: subscription?.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : t("app.billing.endOfPeriod", "the end of your current billing period"),
                      current: currentPlanLine,
                    })
                  : t("app.billing.confirmUpgradeBody", "Your plan changes to {plan} ({cadence}) right away. The difference for the rest of this billing period is prorated today.", {
                      plan: confirming.plan.name,
                      cadence: cadenceLabel(billingInterval || "month", t),
                    })}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2 px-5 py-4 border-t border-border">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="border border-border rounded-full px-4 py-2 text-sm font-semibold"
              >
                {t("app.action.cancel", "Cancel")}
              </button>
              <button
                type="button"
                onClick={() => submitPlan(confirming.plan.id)}
                disabled={busyPlanId === confirming.plan.id}
                className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {busyPlanId === confirming.plan.id && <Loader2 size={14} className="animate-spin" />}
                {confirming.change.applies === "period_end"
                  ? t("app.billing.confirmDeferredCta", "Schedule the change")
                  : t("app.billing.confirmUpgradeCta", "Change plan now")}
              </button>
            </div>
          </div>
        </div>
      )}

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
