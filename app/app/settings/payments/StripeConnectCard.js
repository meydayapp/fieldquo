// app/app/settings/payments/StripeConnectCard.js
//
// The Stripe card of Settings > Payments — the four states an account can be
// in (not started, in progress, awaiting Stripe's review, active) and the
// buttons each offers — as a component, because the home page's "Connect
// Stripe to accept client payments" dialog draws the same card
// (app/components/dashboard/stepPanels.js). Presentational: the state comes
// from useStripeConnect, which both callers run.
//
// The derived flags at the top used to sit in the page body; they moved with
// the markup they decide, and their comments with them.
"use client";

import { CheckCircle2, AlertCircle, CreditCard, ExternalLink } from "lucide-react";
import { humaniseDisabledReason } from "@/lib/stripe/connectAccount";
import { useTranslation } from "@/app/hooks/useTranslation";

/** The same reading of `status` and `company` the page has always made. */
export function connectState(status, company) {
  // Stripe's answer wins whenever we have one; the column is only a fallback
  // for the moment before the status call returns.
  const hasAccount = status?.connected ?? Boolean(company?.stripeAccountId);
  const chargesEnabled =
    status?.chargesEnabled ?? Boolean(company?.stripeChargesEnabled);

  const requirements = status?.requirements || [];
  // Submitted and waiting on Stripe's review. Distinct from "incomplete":
  // there is nothing for the user to do, and prompting them to provide more
  // information is how the same document gets uploaded four times.
  const awaitingReview =
    hasAccount &&
    !chargesEnabled &&
    requirements.length === 0 &&
    (status?.pendingVerification || status?.detailsSubmitted);

  // Only asserted when Stripe actually told us. `payoutsEnabled === false` and
  // "we haven't asked yet" are different, and undefined must not raise an alarm
  // about money on the strength of a status call that hasn't returned.
  const payoutsBlocked = status?.connected === true && status?.payoutsEnabled === false;

  // Submitted and waiting on Stripe, versus waiting on the contractor. The
  // onboarding block already draws this line and says why: prompting someone
  // to "provide more information" while Stripe reviews what they just sent is
  // how the same document gets uploaded four times. The payout banner was
  // making exactly that mistake — it told a contractor whose account had gone
  // INTO review to go and finish what Stripe asks for, when the answer is that
  // there is nothing to do and it clears in a day or three.
  const payoutsUnderReview =
    payoutsBlocked && requirements.length === 0 && status?.pendingVerification;

  return {
    hasAccount,
    chargesEnabled,
    requirements,
    awaitingReview,
    payoutsBlocked,
    payoutsUnderReview,
    notStarted: !hasAccount,
    inProgress: hasAccount && !chargesEnabled && !awaitingReview,
    active: chargesEnabled,
  };
}

/**
 * @param {object} props
 * @param {object|null} props.status — GET /api/stripe/connect/status
 * @param {object|null} props.company — GET /api/settings/business-info
 * @param {boolean} props.connecting
 * @param {boolean} props.rechecking
 * @param {boolean} props.openingDashboard
 * @param {() => void} props.onConnect — start or finish the hosted flow
 * @param {() => void} props.onRecheck
 * @param {() => void} props.onManage — open the Express dashboard
 * @param {() => void} props.onDisconnect — the page's confirm; the dialog offers none
 */
export default function StripeConnectCard({
  status,
  company,
  connecting,
  rechecking,
  openingDashboard,
  onConnect,
  onRecheck,
  onManage,
  onDisconnect,
}) {
  const { t } = useTranslation();
  const {
    requirements,
    awaitingReview,
    payoutsBlocked,
    payoutsUnderReview,
    notStarted,
    inProgress,
    active,
  } = connectState(status, company);

  return (
    <div data-tour="payments-stripe" className="bg-card border border-border rounded-xl p-6">
      {active && (
        <div className="flex items-start gap-3">
          <CheckCircle2
            size={22}
            className="text-green-600 dark:text-green-400 shrink-0 mt-0.5"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-foreground">
                {t("app.setPayments.stripeConnected")}
              </h2>
              <span className="text-xs bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full font-medium">
                {t("app.status.active")}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {t("app.setPayments.activeDesc")}
            </p>

            {/* ── Taking payments and BEING PAID are two different switches ──
                The status route has always returned payoutsEnabled and no
                screen has ever rendered it. An account can have
                charges_enabled true and payouts_enabled false at the same
                time — Stripe keeps accepting the client's card and holds the
                money, so from in here everything looks like it is working
                while nothing reaches the bank. Nobody finds out from a
                screen; they find out from an empty account weeks later.

                Shown only in the `active` block on purpose: while charges are
                off there is no money to be held, and saying it there would be
                a second alarm about the same unfinished onboarding. */}
            {payoutsBlocked && (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                <p className="font-semibold">
                  {payoutsUnderReview
                    ? t("app.setPayments.payoutsReviewing")
                    : t("app.setPayments.payoutsHeld")}
                </p>
                <p className="mt-0.5">
                  {payoutsUnderReview
                    ? t("app.setPayments.payoutsReviewingDesc")
                    : t("app.setPayments.payoutsHeldDesc")}
                </p>
                {/* Stripe's own reason, and now actually humanised — this
                    comment used to claim it was while the line below printed
                    `rejected.listed` in a monospace font to a contractor
                    whose money was being held. More specific than anything we
                    could infer, and absent rather than guessed at when Stripe
                    gives none. */}
                {!payoutsUnderReview && status?.disabledReason && (
                  <p className="mt-1 text-xs">
                    {humaniseDisabledReason(status.disabledReason)}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-3 mt-4">
              <button
                type="button"
                onClick={onManage}
                disabled={openingDashboard}
                className="flex items-center gap-1.5 border border-border text-foreground px-4 py-2 rounded-full text-sm font-semibold hover:bg-muted disabled:opacity-60"
              >
                <ExternalLink size={14} />
                {openingDashboard ? t("app.setPayments.opening") : t("app.setPayments.manageInStripe")}
              </button>
              {onDisconnect && (
                <button
                  type="button"
                  onClick={onDisconnect}
                  className="text-sm font-medium text-red-600 dark:text-red-400 px-4 py-2 rounded-full hover:bg-red-50 dark:bg-red-950/40"
                >
                  {t("app.setPayments.disconnect")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {awaitingReview && (
        <div className="flex items-start gap-3">
          <AlertCircle size={22} className="text-blue-500 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold text-foreground">
              {t("app.setPayments.reviewingTitle")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              {t("app.setPayments.reviewingDesc")}
            </p>
            <button
              type="button"
              onClick={onRecheck}
              disabled={rechecking}
              className="border border-border text-foreground px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
            >
              {rechecking ? t("app.setPayments.checking") : t("app.setPayments.checkAgain")}
            </button>
          </div>
        </div>
      )}

      {inProgress && (
        <div className="flex items-start gap-3">
          <AlertCircle size={22} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold text-foreground">
              {t("app.setPayments.needsThingsTitle")}
            </h2>

            {requirements.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground mt-1 mb-3">
                  {t("app.setPayments.needsThingsIntro")}
                </p>
                {/* Naming the actual outstanding items rather than saying "a
                    bit more information". Stripe's hosted flow sometimes
                    shows a clean summary while still holding a requirement
                    open — with the list here, at least the two screens can
                    be compared. */}
                <ul className="text-sm text-muted-foreground mb-4 space-y-1.5 list-disc pl-5">
                  {requirements.map((r) => (
                    <li key={r.key}>{r.label}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                {t("app.setPayments.notFinished")}
              </p>
            )}

            {status?.disabledReason && (
              <p className="text-xs text-muted-foreground mb-4">
                {t("app.setPayments.stripeReason")}{" "}
                <span>{humaniseDisabledReason(status.disabledReason)}</span>
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onConnect}
                disabled={connecting}
                className="bg-inverted text-inverted-foreground px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
              >
                {connecting ? t("app.setPayments.redirecting") : t("app.setPayments.finishSetup")}
              </button>
              {/* For the case this whole route exists to fix: they finished
                  on Stripe's side and FieldQuo hadn't caught up. */}
              <button
                type="button"
                onClick={onRecheck}
                disabled={rechecking}
                className="border border-border text-foreground px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
              >
                {rechecking ? t("app.setPayments.checking") : t("app.setPayments.alreadyDone")}
              </button>
            </div>
          </div>
        </div>
      )}

      {notStarted && (
        <div className="flex items-start gap-3">
          <CreditCard size={22} className="text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold text-foreground">{t("app.setPayments.notConnected")}</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              {t("app.setPayments.notConnectedDesc")}
            </p>
            <button
              type="button"
              onClick={onConnect}
              disabled={connecting}
              className="bg-inverted text-inverted-foreground px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
            >
              {connecting ? t("app.setPayments.redirecting") : t("app.setPayments.connectWithStripe")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
