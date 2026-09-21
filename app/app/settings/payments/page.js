// app/app/settings/payments/page.js
"use client";

import { useState } from "react";
import { AlertTriangle, Copy, Check } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import useStripeConnect from "./useStripeConnect";
import StripeConnectCard, { connectState } from "./StripeConnectCard";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import ProcessingFeesCard from "./ProcessingFeesCard";
import InstantPayoutCard from "./InstantPayoutCard";
import PaymentMethodsCard from "./PaymentMethodsCard";

// The country Stripe reports for the connected account, in the reader's
// language ("Canada", "Royaume-Uni"), falling back to the code Stripe gave
// when the browser cannot name it. Only for the "Affirm isn't available for
// accounts in …" sentence — never a guess at a country from an address.
function countryName(code, language) {
  if (!code) return "";
  try {
    return new Intl.DisplayNames([language || "en"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

// The one sentence under the Affirm toggle — Stripe's answer for the
// affirm_payments capability on the connected account (lib/stripe/affirm.js),
// never a claim. Off: what switching it on does, and that there is nothing
// to set up in Stripe — the previous copy sent contractors to find an
// "activate Affirm" page that an Express account does not have. On: which
// of the four states Stripe's answer is, because "pending" and "inactive"
// both mean card-only links and only one of them is the contractor's move.
function affirmSentence({ affirm, offerFinancing, t, language }) {
  const status = affirm?.status || null;
  if (status === "unavailable") {
    return t("app.setPayments.affirmUnavailable", {
      country: countryName(affirm?.country, language),
    });
  }
  if (!offerFinancing) return t("app.setPayments.financingNote");
  if (status === "active") return t("app.setPayments.affirmActive");
  if (status === "pending") return t("app.setPayments.affirmPending");
  if (status === "inactive") return t("app.setPayments.affirmInactive");
  return t("app.setPayments.affirmNotRequested");
}

function PaymentsPageScreen() {
  const { t, language } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  // The Stripe half of the page — status, connect, re-check, dashboard — is
  // the hook the home page's set-up dialog also runs (./useStripeConnect.js).
  const {
    company,
    setCompany,
    status,
    loading,
    rechecking,
    connecting,
    openingDashboard,
    error,
    setError,
    loadCompany,
    loadStatus,
    recheck,
    handleConnect,
    handleManageInStripe,
  } = useStripeConnect();
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [savingFinancing, setSavingFinancing] = useState(false);
  const [copied, setCopied] = useState(false);
  // Not folded into `copied`: navigator.clipboard is undefined on plain HTTP
  // and refused when the document isn't focused, and a Copy button that
  // silently does nothing is the dead control this codebase keeps hunting.
  // On failure the button says so and points at the text, which is selectable.
  const [copyFailed, setCopyFailed] = useState(false);

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
      // Switching on is what makes the status poll REQUEST affirm_payments
      // on the connected account (lib/stripe.js ensureChargeCapabilities),
      // and the poll answers with the capability's real status — so ask
      // now, and the sentence under the toggle is Stripe's answer before
      // the contractor's hand leaves the switch, not on some later visit.
      if (next) await loadStatus();
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

  // The same flags the card derives, for the blocks below it that read them.
  const { requirements, active } = connectState(status, company);

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

      <StripeConnectCard
        status={status}
        company={company}
        connecting={connecting}
        rechecking={rechecking}
        openingDashboard={openingDashboard}
        onConnect={handleConnect}
        onRecheck={recheck}
        onManage={handleManageInStripe}
        onDisconnect={() => setShowDisconnectConfirm(true)}
      />

      {/* ── What each payment costs, and instant payouts ────────────────────
          The fee card renders in every state — a contractor deciding whether
          to connect is the person who most needs the number. The instant
          payout card only once there is a Stripe account to pay out from;
          it explains its own refusals. */}
      <ProcessingFeesCard
        currency={company?.currency}
        offerFinancing={Boolean(company?.offerFinancing)}
        connected={Boolean(active)}
        bankDebit={status?.bankDebit || null}
      />
      <InstantPayoutCard
        connected={Boolean(active)}
        onOpenDashboard={handleManageInStripe}
        openingDashboard={openingDashboard}
      />
      {/* The offline methods the invoice email, portal and PDF print as
          "Accepted: …" — Company.paymentMethods had no writer until this. */}
      <PaymentMethodsCard company={company} onSaved={loadCompany} />

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
              {/* Stripe's answer, not ours — see affirmSentence. Coloured only
                  when the toggle is on, because that is when the sentence is
                  a status rather than an explanation. */}
              <p
                className={`text-xs mt-3 ${
                  company?.offerFinancing && status?.affirm?.status === "active"
                    ? "text-green-700 dark:text-green-400"
                    : company?.offerFinancing && status?.affirm?.status
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-muted-foreground"
                }`}
                data-affirm-status={status?.affirm?.status || "none"}
              >
                {affirmSentence({
                  affirm: status?.affirm,
                  offerFinancing: Boolean(company?.offerFinancing),
                  t,
                  language,
                })}
              </p>
              {/* What Stripe is waiting on for the capability itself, in the
                  same words the connection card uses for the account — so the
                  owner knows what to do without going looking for a dashboard
                  page. Only for pending / inactive; an active capability has
                  nothing outstanding by definition. */}
              {company?.offerFinancing &&
                (status?.affirm?.status === "pending" || status?.affirm?.status === "inactive") && (
                  <>
                    {status.affirm.requirements?.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("app.setPayments.affirmAsking", {
                          items: status.affirm.requirements.map((r) => r.label).join("; "),
                        })}
                      </p>
                    )}
                    {status.affirm.disabledReason && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {status.affirm.disabledReason}
                      </p>
                    )}
                    {status.affirm.pendingVerification && !status.affirm.requirements?.length && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("app.setPayments.affirmVerifying")}
                      </p>
                    )}
                  </>
                )}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(company?.offerFinancing)}
              onClick={toggleFinancing}
              // A switch that can never do anything is the dead control this
              // codebase hunts: for a country Affirm does not serve it cannot
              // be switched ON (the sentence beside it says why), but one
              // already on can still be switched off.
              disabled={
                savingFinancing ||
                (status?.affirm?.status === "unavailable" && !company?.offerFinancing)
              }
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
