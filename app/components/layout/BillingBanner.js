"use client";

// app/components/layout/BillingBanner.js
//
// "Your payment failed. You have N days."
//
// Mounted once in the app layout, above everything, on every screen. Not on the
// billing page alone — someone whose card expired is not looking at the billing
// page, they're looking at tomorrow's jobs, and a warning they have to go and
// find is a warning nobody sees until they're locked out.
//
// ── Why it can't be dismissed ──────────────────────────────────────────────
//
// A dismissible warning about losing access to your business is a warning that
// gets dismissed on day one and remembered on day eight. It stays, it counts
// down, and it gets louder in the last two days.
//
// It is NOT rendered at all when the account is healthy, which is the common
// case — no strip of chrome for the ~99% of companies who have paid.

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CreditCard, CheckCircle2, Sparkles, X } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import ResumePlanButton, { RESUMED_NOTE_KEY } from "@/app/components/billing/ResumePlanButton";

/** Whole days until a date — the trial's own countdown, ceil like TrialBadge. */
function daysUntil(value) {
  if (!value) return null;
  const ms = new Date(value).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export default function BillingBanner() {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const [state, setState] = useState(null);
  const [error, setError] = useState("");
  // The sentence a Resume left behind before it reloaded the app — shown
  // once, on the first render after, then cleared. Read in an effect, not
  // during render: sessionStorage is not there on the server.
  const [resumedNote, setResumedNote] = useState("");

  useEffect(() => {
    let live = true;
    fetch("/api/settings/subscription/access")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setState(d))
      // Silent on failure. A banner that appears because a status check 500'd
      // would tell a paying customer their account is about to be cut off.
      .catch(() => {});
    try {
      const note = window.sessionStorage.getItem(RESUMED_NOTE_KEY);
      if (note) {
        window.sessionStorage.removeItem(RESUMED_NOTE_KEY);
        setResumedNote(note);
      }
    } catch {
      // No storage: nothing to show, nothing lost.
    }
    return () => {
      live = false;
    };
  }, []);

  // ── "Resumed — …" ───────────────────────────────────────────────────────
  //
  // Independent of the access state: after a resume the account is healthy
  // and the banner below renders nothing, which is exactly when this has to
  // say what just happened. Dismissable, because it is a receipt, not a
  // warning.
  const resumedStrip = resumedNote ? (
    <div
      role="status"
      className="px-4 py-3 text-sm bg-green-50 dark:bg-green-950/40 text-green-900 dark:text-green-200 border-b border-green-200 dark:border-green-900"
    >
      <div className="max-w-6xl mx-auto flex items-center gap-x-3">
        <CheckCircle2 size={17} className="shrink-0" />
        <p className="flex-1">{resumedNote}</p>
        <button
          type="button"
          onClick={() => setResumedNote("")}
          aria-label={t("app.action.close", "Close")}
          className="text-green-900/70 dark:text-green-200/70 hover:opacity-100"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  ) : null;

  if (!state) return resumedStrip;
  // ── The free trial ──────────────────────────────────────────────────────
  //
  // Since 2026-09-24 signup ends with no plan and no card (the owner: "move
  // the credit card and plan selection out of the sign up and just move it
  // to the banner that stays at the top always for the owner"). So this is
  // where a plan gets chosen: the countdown, the rung that fits the roster,
  // and one button to Account & Billing — on that card when the pricing page
  // named one. Owner-only by the same rule as everything else here: the
  // route masks the reason to "ok" for anyone who may not see billing state.
  // A trial that DID choose a plan gets the calmer line — what starts when —
  // with the same button reading "Manage plan". Not dismissible, like the
  // rest: a warning about losing access that can be closed is closed on day
  // one and remembered on day thirty-one.
  if (state.level === "full" && (state.reason === "trial_no_plan" || state.reason === "trialing") && state.trial) {
    const trial = state.trial;
    const days = state.daysLeft ?? daysUntil(trial.trialEndsAt);
    const rec = trial.recommended;
    const tier = trial.signupTierKey || rec?.tierKey;
    const href = `/app/settings/account-billing${tier && !trial.hasPlan ? `?tier=${encodeURIComponent(tier)}` : ""}`;
    return (
      <>
        {resumedStrip}
        <div
          role="status"
          className="px-4 py-3 text-sm bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border-b border-amber-200 dark:border-amber-900"
        >
          <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-x-3 gap-y-2">
            <Sparkles size={17} className="shrink-0" />
            <p className="flex-1 min-w-[14rem]">
              <strong>
                {days === 1
                  ? t("app.billingBanner.trialOneDay", "Free trial · 1 day left")
                  : t("app.billingBanner.trialDays", "Free trial · {days} days left", { days })}
              </strong>{" "}
              {trial.hasPlan
                ? t("app.billingBanner.trialWithPlanBody", "{plan} starts on {date}. Nothing is charged until then.", {
                    plan: trial.planName,
                    date: formatDate(trial.trialEndsAt),
                  })
                : t(
                    "app.billingBanner.trialNoPlanBody",
                    "Choose a plan before it ends to keep working. After that the account is read-only for {grace} days, then locks — nothing is deleted.",
                    { grace: state.graceDays ?? 7 },
                  )}
              {!trial.hasPlan && rec ? (
                <span className="block mt-0.5">
                  {t("app.billingBanner.recommended", "Recommended: {plan} · {seats} seats + {crew} crew.", {
                    plan: rec.label,
                    seats: rec.seats,
                    crew: rec.crewSeats,
                  })}
                </span>
              ) : null}
            </p>
            {trial.canChoosePlan ? (
              <Link
                href={href}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap bg-amber-900 text-white dark:bg-amber-200 dark:text-amber-950"
              >
                <CreditCard size={15} />{" "}
                {trial.hasPlan ? t("app.billingBanner.managePlan", "Manage plan") : t("app.billingBanner.choosePlan", "Choose a plan")}
              </Link>
            ) : null}
          </div>
        </div>
      </>
    );
  }
  // A brand-new company that closed the Stripe tab: full access for now, and a
  // countdown to the setup gate. Said here, in amber, with the one link that
  // fixes it — the first version showed nothing and then a 307 to /signup an
  // hour later. The card is required (owner's decision, 2026-09-06).
  if (state.reason === "setup_pending") {
    return (
      <div
        role="alert"
        className="px-4 py-3 text-sm bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border-b border-amber-200 dark:border-amber-900"
      >
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-x-3 gap-y-2">
          <AlertTriangle size={17} className="shrink-0" />
          <p className="flex-1 min-w-[14rem]">
            <strong>Finish signing up — add your card within {state.minutesLeft ?? 60} min to keep this account.</strong>{" "}
            Nothing is charged until your free month is up. After that time you&apos;ll be sent back to the signup page to finish.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap bg-amber-900 text-white dark:bg-amber-200 dark:text-amber-950"
          >
            <CreditCard size={15} /> Add card
          </Link>
        </div>
      </div>
    );
  }
  // ── Ending, not ended ───────────────────────────────────────────────────
  //
  // A paid plan booked to end on its paid-to date (cancel-at-period-end). Full
  // access until then, so this is amber and calm: the date, "nothing more will
  // be charged", and Resume — one click, nothing charged, the plan continues.
  if (state.level === "full" && state.endsAt) {
    return (
      <>
        {resumedStrip}
        <div
          role="alert"
          className="px-4 py-3 text-sm bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border-b border-amber-200 dark:border-amber-900"
        >
          <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-x-3 gap-y-2">
            <AlertTriangle size={17} className="shrink-0" />
            <p className="flex-1 min-w-[14rem]">
              <strong>
                {t("app.billingBanner.endsOn", "Your plan ends on {date} — nothing more will be charged.", {
                  date: formatDate(state.endsAt),
                })}
              </strong>{" "}
              {t("app.billingBanner.endsOnBody", "Everything keeps working until then. Resume any time before that date and the plan simply continues.")}
              {error ? <span className="block mt-1 font-medium">{error}</span> : null}
            </p>
            <ResumePlanButton
              onError={setError}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap bg-amber-900 text-white dark:bg-amber-200 dark:text-amber-950 disabled:opacity-60"
            />
          </div>
        </div>
      </>
    );
  }
  if (state.level === "full") return resumedStrip;

  const locked = state.level === "locked";
  // Cancelling is a DECISION, not a failure. Red chrome and "payment didn't go
  // through" would send someone to check a card that's perfectly fine, and
  // shouting at somebody who chose to leave is the surest way to make sure they
  // don't come back.
  const cancelled = state.reason === "canceled" || state.reason === "canceled_expired";
  // The free trial ran out with no plan chosen. Nobody's card failed, so the
  // sentence names the trial and the button says "Choose a plan", not
  // "Update card" — the same "different situation, different sentence" rule
  // the cancelled branch follows.
  const trialOver = state.reason === "trial_expired";
  const urgent = !cancelled && (locked || state.daysLeft <= 2);

  return (
    <>
    {resumedStrip}
    <div
      role="alert"
      className={`px-4 py-3 text-sm ${
        urgent
          ? "bg-red-600 text-white"
          : "bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border-b border-amber-200 dark:border-amber-900"
      }`}
    >
      <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-x-3 gap-y-2">
        <AlertTriangle size={17} className="shrink-0" />

        <p className="flex-1 min-w-[14rem]">
          {cancelled ? (
            locked ? (
              <>
                <strong>{t("app.billingBanner.cancelledLocked", "Your plan is cancelled.")}</strong>{" "}
                {t("app.billingBanner.cancelledLockedBody", "Resume to pick up where you left off — everything is still here.")}
              </>
            ) : (
              <>
                <strong>
                  {state.daysLeft === 1
                    ? t("app.billingBanner.cancelledOneDay", "Your plan is cancelled — 1 day of read-only left.")
                    : t("app.billingBanner.cancelledDays", "Your plan is cancelled — {days} days of read-only left.", { days: state.daysLeft })}
                </strong>{" "}
                {t("app.billingBanner.cancelledBody", "You can still look at everything and download what you need. Resume any time.")}
              </>
            )
          ) : trialOver ? (
            <>
              <strong>
                {state.daysLeft === 1
                  ? t("app.billingBanner.trialEndedOneDay", "Your trial ended · read-only for 1 more day")
                  : t("app.billingBanner.trialEndedDays", "Your trial ended · read-only for {days} more days", { days: state.daysLeft })}
                .
              </strong>{" "}
              {t("app.billingBanner.trialEndedBody", "You can still see everything, but you can't create or send until you choose a plan. After that the account locks — nothing is deleted.")}
              {state.trial?.recommended ? (
                <span className="block mt-0.5">
                  {t("app.billingBanner.recommended", "Recommended: {plan} · {seats} seats + {crew} crew.", {
                    plan: state.trial.recommended.label,
                    seats: state.trial.recommended.seats,
                    crew: state.trial.recommended.crewSeats,
                  })}
                </span>
              ) : null}
            </>
          ) : locked ? (
            <>
              <strong>Your account is locked.</strong> Update your card to get
              back in — nothing has been deleted.
            </>
          ) : (
            <>
              <strong>
                Your payment didn&apos;t go through
                {state.daysLeft === 1
                  ? " — 1 day left"
                  : ` — ${state.daysLeft} days left`}
                .
              </strong>{" "}
              You can still see everything, but you can&apos;t create or send
              until it&apos;s sorted. After that the account locks.
            </>
          )}
          {error ? <span className="block mt-1 font-medium">{error}</span> : null}
        </p>

        {/* ── Cancelled: Resume, not a link ─────────────────────────────────
            "Start again" was a link to the billing page — pressed FROM the
            billing page it reloaded the billing page, which is what the owner
            saw on 2026-09-14 ("no window, no pop up"). It is now the shared
            Resume button: it POSTs, the label says what the press costs, and
            a Checkout opens only when Stripe needs a card. The plan cards on
            Account & Billing stay the way to a DIFFERENT plan. */}
        {cancelled ? (
          <ResumePlanButton
            onError={setError}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap disabled:opacity-60 ${
              urgent
                ? "bg-white text-red-700"
                : "bg-amber-900 text-white dark:bg-amber-200 dark:text-amber-950"
            }`}
          />
        ) : (
          <Link
            href={`/app/settings/account-billing${
              trialOver && (state.trial?.signupTierKey || state.trial?.recommended?.tierKey)
                ? `?tier=${encodeURIComponent(state.trial.signupTierKey || state.trial.recommended.tierKey)}`
                : ""
            }`}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${
              urgent
                ? "bg-white text-red-700"
                : "bg-amber-900 text-white dark:bg-amber-200 dark:text-amber-950"
            }`}
          >
            <CreditCard size={15} />{" "}
            {trialOver ? t("app.billingBanner.choosePlan", "Choose a plan") : t("app.billingBanner.updateCard", "Update card")}
          </Link>
        )}
      </div>
    </div>
    </>
  );
}
