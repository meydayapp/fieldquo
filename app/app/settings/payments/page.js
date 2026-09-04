// app/app/settings/payments/page.js
"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  AlertCircle,
  CreditCard,
  ExternalLink,
  AlertTriangle,
  Copy,
  Check,
  X,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { humaniseDisabledReason } from "@/lib/stripe/connectAccount";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";

function PaymentsPageScreen() {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const [company, setCompany] = useState(null);
  // What Stripe itself says, as opposed to what our database last heard. See
  // the comment on loadStatus below — these disagreeing is the normal case,
  // not the exception.
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rechecking, setRechecking] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [openingDashboard, setOpeningDashboard] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [savingFinancing, setSavingFinancing] = useState(false);
  const [copied, setCopied] = useState(false);
  // Not folded into `copied`: navigator.clipboard is undefined on plain HTTP
  // and refused when the document isn't focused, and a Copy button that
  // silently does nothing is the dead control this codebase keeps hunting.
  // On failure the button says so and points at the text, which is selectable.
  const [copyFailed, setCopyFailed] = useState(false);
  const [error, setError] = useState("");

  // fetchJson, not `fetch().then(r => r.json())`. Unguarded, a 403 or 500 body
  // is `{ error: "…" }` — an object, so `setCompany` succeeded, and every read
  // off it (`company.stripeAccountId`, `company.offerFinancing`) came back
  // undefined. The page then drew "Not connected to Stripe" with a Connect
  // button, to a company that has been taking card payments for a year, with
  // no error anywhere on screen.
  function loadCompany() {
    return fetchJson("/api/settings/business-info")
      .then(setCompany)
      .catch((err) => setError(err.message || t("app.setPayments.loadError")));
  }

  /**
   * Ask Stripe directly.
   *
   * The company row's stripeChargesEnabled is only ever written by the
   * account.updated webhook. If that webhook isn't wired up — no Connect
   * endpoint, wrong secret, or an endpoint not listening for events on
   * connected accounts — the column stays false permanently even though
   * Stripe has approved the account. The page then tells the user to finish
   * something they already finished, and no amount of clicking "Finish Setup"
   * can ever clear it.
   *
   * So the badge is driven by this call, and the webhook is just the
   * background path for when nobody has the page open.
   */
  async function loadStatus() {
    try {
      setStatus(await fetchJson("/api/stripe/connect/status"));
    } catch (err) {
      setError(err.message || t("app.setPayments.statusError"));
    }
  }

  async function recheck() {
    setError("");
    setRechecking(true);
    await Promise.all([loadStatus(), loadCompany()]);
    setRechecking(false);
  }

  useEffect(() => {
    Promise.all([loadCompany(), loadStatus()]).finally(() => setLoading(false));
  }, []);

  // Coming back from Stripe's hosted flow. The account was almost certainly
  // updated seconds ago, and the webhook may not have landed yet — so check
  // rather than render whatever the database happened to hold. The parameter
  // is then stripped so a refresh doesn't repeat it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (!params.get("connected")) return;

    loadStatus();
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  async function handleConnect() {
    setError("");
    setConnecting(true);
    try {
      // fetchJson rather than res.json() — see lib/fetchJson.js. This call
      // was reporting "The string did not match the expected pattern" for
      // weeks, which was Safari's JSON parser choking on a 500 HTML page
      // caused by an unset NEXT_PUBLIC_APP_URL.
      const data = await fetchJson("/api/stripe/connect", { method: "POST" });
      if (!data?.url) throw new Error(t("app.setPayments.noOnboardingLink"));
      window.location.href = data.url;
    } catch (err) {
      setError(err.message || t("app.setPayments.connectError"));
      setConnecting(false);
    }
  }

  async function handleManageInStripe() {
    setError("");
    setOpeningDashboard(true);
    try {
      const data = await fetchJson("/api/stripe/connect/login-link", {
        method: "POST",
      });
      if (!data?.url) throw new Error(t("app.setPayments.noDashboardLink"));
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err.message || t("app.setPayments.dashboardError"));
    } finally {
      setOpeningDashboard(false);
    }
  }

  // Optimistic toggle for "offer Affirm alongside card". We flip the local copy
  // first so the switch responds instantly, then persist. On failure we roll it
  // back — a switch that silently didn't save is exactly the dead control this
  // codebase keeps having to hunt down.
  async function toggleFinancing() {
    if (savingFinancing) return;
    const next = !company?.offerFinancing;
    setError("");
    setSavingFinancing(true);
    setCompany((c) => ({ ...c, offerFinancing: next }));
    try {
      await fetchJson("/api/settings/business-info", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerFinancing: next }),
      });
    } catch (err) {
      setCompany((c) => ({ ...c, offerFinancing: !next }));
      setError(err.message || t("app.setPayments.financingSaveError"));
    } finally {
      setSavingFinancing(false);
    }
  }

  async function handleCopyAccountId(value) {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  }

  async function handleDisconnect() {
    setError("");
    setDisconnecting(true);
    try {
      await fetchJson("/api/stripe/connect/disconnect", { method: "POST" });
      await loadCompany();
    } catch (err) {
      setError(err.message || t("app.setPayments.disconnectError"));
    } finally {
      setDisconnecting(false);
      setShowDisconnectConfirm(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-40 bg-accent rounded" />
          <div className="h-32 bg-accent rounded-xl" />
        </div>
      </div>
    );
  }

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
  // onboarding block above already draws this line and says why: prompting
  // someone to "provide more information" while Stripe reviews what they just
  // sent is how the same document gets uploaded four times. The payout banner
  // was making exactly that mistake — it told a contractor whose account had
  // gone INTO review to go and finish what Stripe asks for, when the answer is
  // that there is nothing to do and it clears in a day or three.
  const payoutsUnderReview =
    payoutsBlocked && requirements.length === 0 && status?.pendingVerification;

  const notStarted = !hasAccount;
  const inProgress = hasAccount && !chargesEnabled && !awaitingReview;
  const active = chargesEnabled;

  // ── Who this block is for ───────────────────────────────────────────────
  //
  // Presence of `accountDetails` IS the permission. The status route only puts
  // the object in the response for an owner (or a read-only support session);
  // an admin receives no such key and there is nothing here to hide. See
  // accountIdentityFor() in lib/stripe/connectAccount.js for why owner rather
  // than the owner|admin the rest of this page runs on.
  const details = status?.accountDetails || null;

  // Stripe gives current_deadline as unix SECONDS. formatCompanyDate returns
  // "" for anything it can't parse, and an empty string is not a date — so the
  // deadline line is dropped rather than rendered as a blank or an epoch.
  const deadlineText =
    status?.currentDeadline > 0
      ? formatDate(new Date(status.currentDeadline * 1000))
      : "";

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div data-tour="payments-header">
        <h1 className="text-2xl font-bold text-foreground">{t("app.settings.payments")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.setPayments.subtitle")}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

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
                  onClick={handleManageInStripe}
                  disabled={openingDashboard}
                  className="flex items-center gap-1.5 border border-border text-foreground px-4 py-2 rounded-full text-sm font-semibold hover:bg-muted disabled:opacity-60"
                >
                  <ExternalLink size={14} />
                  {openingDashboard ? t("app.setPayments.opening") : t("app.setPayments.manageInStripe")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDisconnectConfirm(true)}
                  className="text-sm font-medium text-red-600 dark:text-red-400 px-4 py-2 rounded-full hover:bg-red-50 dark:bg-red-950/40"
                >
                  {t("app.setPayments.disconnect")}
                </button>
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
                onClick={recheck}
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
                  onClick={handleConnect}
                  disabled={connecting}
                  className="bg-inverted text-inverted-foreground px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
                >
                  {connecting ? t("app.setPayments.redirecting") : t("app.setPayments.finishSetup")}
                </button>
                {/* For the case this whole route exists to fix: they finished
                    on Stripe's side and FieldQuo hadn't caught up. */}
                <button
                  type="button"
                  onClick={recheck}
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
                onClick={handleConnect}
                disabled={connecting}
                className="bg-inverted text-inverted-foreground px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
              >
                {connecting ? t("app.setPayments.redirecting") : t("app.setPayments.connectWithStripe")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Your Stripe account ────────────────────────────────────────────
          The contractor holds the Stripe relationship; FieldQuo holds the
          `acct_…` that names it. Until this block existed there was no screen
          in the product that showed a contractor the one value Stripe asks for
          to find their account — Stripe's own docs put it plainly: the ID it
          generates "is different from your account's name and uniquely
          identifies your account". Someone whose payouts are held could not
          identify their own account to the company holding their money.

          Owner-only, by the object simply not being in the response for anyone
          else. It renders even in the not-connected state, where it says in a
          sentence that there is nothing to identify yet. */}
      {details && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold text-foreground">
            {t("app.setPayments.accountTitle")}
          </h2>

          {!details.accountId ? (
            <p className="text-sm text-muted-foreground mt-1">
              {t("app.setPayments.accountNone")}
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mt-1">
                {t("app.setPayments.accountIntro")}
              </p>

              <dl className="mt-5 space-y-5">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("app.setPayments.accountIdLabel")}
                  </dt>
                  <dd className="mt-1.5 flex flex-wrap items-center gap-2">
                    <code className="font-mono text-sm text-foreground break-all select-all rounded bg-muted px-2 py-1">
                      {details.accountId}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopyAccountId(details.accountId)}
                      className="flex items-center gap-1.5 border border-border text-foreground px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-muted"
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      {copied
                        ? t("app.setPayments.accountCopied")
                        : t("app.setPayments.accountCopy")}
                    </button>
                  </dd>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {copyFailed
                      ? t("app.setPayments.accountCopyFailed")
                      : t("app.setPayments.accountIdHelp")}
                  </p>
                </div>

                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("app.setPayments.accountEmailLabel")}
                  </dt>
                  {/* Absence is a sentence. An Express account with no email on
                      file is exactly why someone can't get into Stripe, and a
                      blank row would leave them guessing at their own. */}
                  <dd className="mt-1.5 text-sm text-foreground break-all">
                    {details.email || (
                      <span className="text-muted-foreground">
                        {t("app.setPayments.accountEmailNone")}
                      </span>
                    )}
                  </dd>
                  {details.email && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {t("app.setPayments.accountEmailHelp")}
                    </p>
                  )}
                </div>

                {/* Two switches, said plainly. "Cards work but we're not being
                    paid" is a real and confusing state, and the badge at the
                    top of this page says "Active" throughout it. */}
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("app.setPayments.accountSwitchesLabel")}
                  </dt>
                  <dd className="mt-1.5 text-sm text-foreground space-y-1">
                    <p>
                      {t("app.setPayments.accountCharges")}:{" "}
                      <strong>
                        {status?.chargesEnabled
                          ? t("app.setPayments.accountOn")
                          : t("app.setPayments.accountOff")}
                      </strong>
                    </p>
                    <p>
                      {t("app.setPayments.accountPayouts")}:{" "}
                      <strong>
                        {status?.payoutsEnabled
                          ? t("app.setPayments.accountOn")
                          : t("app.setPayments.accountPaused")}
                      </strong>
                    </p>
                  </dd>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {t("app.setPayments.accountSwitchesHelp")}
                  </p>
                </div>

                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("app.setPayments.accountOutstandingLabel")}
                  </dt>
                  <dd className="mt-1.5 text-sm text-foreground">
                    {requirements.length > 0 ? (
                      <>
                        <ul className="space-y-1.5 list-disc pl-5">
                          {requirements.map((r) => (
                            <li key={r.key}>{r.label}</li>
                          ))}
                        </ul>
                        {/* Only when Stripe actually gave a deadline. Most
                            accounts have none, and an invented one would be a
                            fabricated threat about their money. */}
                        {deadlineText && (
                          <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                            {t("app.setPayments.accountDeadline", {
                              date: deadlineText,
                            })}
                          </p>
                        )}
                      </>
                    ) : status?.pendingVerification ? (
                      // The distinction the payout banner above draws, kept
                      // intact: nothing to send, and sending it again is how
                      // the same document gets uploaded four times.
                      <span className="text-muted-foreground">
                        {t("app.setPayments.accountNothingReviewing")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {t("app.setPayments.accountNothingOutstanding")}
                      </span>
                    )}
                  </dd>
                </div>
              </dl>

              {/* Dashboard FIRST. Stripe's Express dashboard carries a
                  notification banner that collects the currently-due
                  requirements and the account settings that satisfy them, so
                  almost nothing here needs a human at Stripe at all. No support
                  phone number, address or URL is printed anywhere in this
                  block: what Stripe's own documentation describes is support
                  reached from inside the dashboard while signed in, and a
                  channel we guessed at would send a contractor whose payouts
                  are held somewhere that isn't Stripe.
                  Which button to point at depends on which one this page is
                  currently drawing — an Express login link only exists once
                  onboarding is done, so in setup we point at Finish Setup. */}
              <div className="mt-5 rounded-lg border border-border bg-muted/40 px-3.5 py-3 text-sm text-muted-foreground space-y-2">
                <p>
                  {active
                    ? t("app.setPayments.accountWhereActive")
                    : t("app.setPayments.accountWhereSetup")}
                </p>
                <p>{t("app.setPayments.accountSupport")}</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Pay-over-time is only meaningful once the company can actually take
          payments, so it rides on the active Stripe connection rather than
          standing alone. */}
      {active && (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h2 className="font-semibold text-foreground">
                {t("app.setPayments.financingTitle")}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t("app.setPayments.financingDesc")}
              </p>
              <p className="text-xs text-muted-foreground mt-3">
                {t("app.setPayments.financingActivateNote")}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(company?.offerFinancing)}
              onClick={toggleFinancing}
              disabled={savingFinancing}
              className={`relative shrink-0 mt-1 inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-60 ${
                company?.offerFinancing ? "bg-green-600" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  company?.offerFinancing ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t("app.setPayments.neverSees")}
      </p>

      {showDisconnectConfirm && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDisconnectConfirm(false)}
        >
          <div
            className="bg-card rounded-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={26} className="text-amber-500" />
            </div>
            <h2 className="text-lg font-semibold text-foreground text-center">
              {t("app.setPayments.disconnectTitle")}
            </h2>
            <p className="text-sm text-muted-foreground text-center mt-1.5">
              {t("app.setPayments.disconnectDesc")}
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDisconnectConfirm(false)}
                className="flex-1 border border-border text-foreground py-2.5 rounded-lg text-sm font-semibold"
              >
                {t("app.action.cancel")}
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
              >
                {disconnecting ? t("app.setPayments.disconnecting") : t("app.setPayments.disconnect")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Hidden, not read-only ──────────────────────────────────────────────────
//
// This page holds the Stripe connection with live "Manage in Stripe" and
// "Disconnect" controls. QA reached it as an employee on two consecutive
// passes and — correctly — refused to press Disconnect, which would sever the
// company's payment processing.
//
// Nothing on the screen is information a crew member needs, so it is hidden
// entirely rather than rendered read-only. A wrapper rather than an early
// return, so the gate lands before the mount fetch.
export default function PaymentsPage() {
  const access = useSettingsAccess();
  if (!access.canSee("billing")) return <NoAccessPanel capability="billing" />;
  return <PaymentsPageScreen />;
}
