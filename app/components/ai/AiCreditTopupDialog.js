"use client";

// app/components/ai/AiCreditTopupDialog.js
//
// The AI wallet's refusal, turned into an offer — and the round trip back to
// whatever the person was doing when it happened.
//
// ══ The problem this exists for ════════════════════════════════════════════
//
// lib/voice/spendGate.js already computes everything a good dialog needs: the
// price, the balance, and the exact shortfall. The designer's sidebars threw
// all of it away and rendered a disabled button with a sentence. A server that
// worked out the precise amount somebody is short, handing it to a screen that
// offers no way to pay it, is the dead end the owner reported.
//
// ══ Why this is not the one-click charge that was asked for ════════════════
//
// The ask was a confirm dialog that charges "the credit card information from
// the subscription". That is not available, and the dialog SAYS so rather than
// offering a button that would fail. The full reasoning, with Stripe's own
// wording, is in lib/ai/topupIntent.js's header; the short version is that a
// saved card may only be charged for the usage its terms named, the
// subscription's terms named the subscription, and Stripe additionally saves
// that card with `allow_redisplay: limited` so it would not even be offered
// back on a one-off purchase.
//
// What this DOES fix is everything either side of the payment page: the amount
// is chosen and confirmed here with the shortfall named, the trip to Stripe
// returns to the same design rather than to a settings screen, and the panel
// reopens with what was typed still in it.
//
// ══ Three rules this file is arranged around ═══════════════════════════════
//
//   1. THE BROWSER NEVER SENDS AN AMOUNT. `tiers` carry an id and a label and
//      no cents — see lib/ai/topupOffer.js. Nothing in this file could post a
//      figure if it wanted to, because it never receives one.
//   2. CREDIT IS NEVER CLAIMED UNTIL THE SERVER SAYS IT LANDED. The return leg
//      reports what confirmAiTopup actually found. A payment Stripe has taken
//      but not settled leaves `credited: false`, and the dialog says the
//      credit has not arrived instead of re-enabling a button that will refuse.
//   3. NOTHING IS RESUMED BY SPENDING. The prompt comes back and the panel
//      reopens; the Generate press is still the person's. Auto-submitting
//      after a redirect would take a second payment they never asked for, on
//      the same visit they just paid.
import { useCallback, useEffect, useRef, useState } from "react";
import { CreditCard, Loader2, X } from "lucide-react";

import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import { formatAppMoney } from "@/lib/format/money";
import { CREDIT_CURRENCY } from "@/lib/voice/creditCurrency";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Which dollars this dialog means. The AI wallet is denominated in USD
// (lib/voice/creditCurrency.js) because the vendors bill FieldQuo in USD, and
// every production company is CAD — so a bare "$0.12" here understates what
// the card is about to be charged, which is the exact bug that constant was
// created for. The AI credit settings page already formats this way; this
// dialog is the surface where the money is actually agreed to, and it was the
// last one still saying "$".
//
// The tier BUTTONS keep their short labels ("$10") — those come from
// TOPUP_OPTIONS and read as amounts to choose between, not as a figure being
// quoted. Same split the settings page draws.
const money = (cents) =>
  formatAppMoney(Math.max(0, Number(cents) || 0) / 100, CREDIT_CURRENCY, "en");

/** Where the pending payload lives across the Stripe round trip. */
const storeKey = (key) => `fq.aiTopup.${key}`;

/**
 * ── One settlement per page load, shared by every hook instance ────────────
 *
 * Two of the designer's sidebars mount this hook at once (AI image and
 * Background removal), and both see the same `?aitopup=` on the URL when
 * Stripe sends the browser back. Letting both confirm would be harmless at the
 * server — creditAiTopup keys on the payment intent and the second finds the
 * ref already written — but it would be two round trips and, worse, only one
 * of the two panels would end up holding the answer. A module-scope promise
 * means one request and the SAME result in every panel.
 *
 * Deliberately not a ref: refs are per-instance, which is the thing being
 * fixed. It lives as long as the page does, which is exactly as long as one
 * `?aitopup=` is meaningful.
 */
let settlementFor = { sessionId: null, promise: null };

function settleReturn(sessionId, { force = false } = {}) {
  if (!force && settlementFor.sessionId === sessionId && settlementFor.promise) {
    return settlementFor.promise;
  }
  const promise = fetch(`/api/ai/topup?session_id=${encodeURIComponent(sessionId)}`)
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);
  settlementFor = { sessionId, promise };
  return promise;
}

/**
 * @param {Object} args
 * @param {string} args.pendingKey  namespaces what this caller stashes across
 *   the redirect, so two panels on one screen restore their own work and not
 *   each other's.
 * @param {(pending: any) => void} [args.onResume]  called once, after the trip
 *   back, with whatever `capturePending()` returned before leaving. This is
 *   where a caller reopens its panel and puts the typed text back.
 * @param {() => (void | Promise<void>)} [args.onCredited]  called only when the
 *   server confirms the credit is ON THE LEDGER. Re-fetch your own status here
 *   — do not infer "affordable" from "paid".
 */
export function useAiCreditTopup({ pendingKey, onResume, onCredited }) {
  const [offer, setOffer] = useState(null);
  const [tierId, setTierId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState(null);

  // A ref, not the `submitting` state: two clicks in the same tick both read
  // the pre-render value of state and both pass. This is set synchronously.
  const inFlight = useRef(false);
  const returnHandled = useRef(false);
  // Which Stripe session this page came back from, so "Check again" asks about
  // THAT payment rather than only re-reading a balance and hoping.
  const returnedSession = useRef(null);

  const open = useCallback((refusal) => {
    const tiers = refusal?.topup?.tiers || [];
    setError("");
    setOutcome(null);
    setTierId(refusal?.topup?.recommendedId || tiers[0]?.id || null);
    setOffer({
      priceCents: refusal?.priceCents ?? refusal?.needCents ?? 0,
      balanceCents: refusal?.balanceCents ?? 0,
      shortfallCents: refusal?.shortfallCents ?? 0,
      tiers,
      canBuy: Boolean(refusal?.topup?.canBuy),
    });
  }, []);

  const close = useCallback(() => {
    setOffer(null);
    setOutcome(null);
    setError("");
  }, []);

  const confirm = useCallback(
    async ({ capturePending } = {}) => {
      if (inFlight.current || !tierId) return;
      inFlight.current = true;
      let navigating = false;
      setSubmitting(true);
      setError("");

      // Written BEFORE the request, because the successful branch never comes
      // back — it navigates. A pending payload written after the fetch would
      // be written on the one path that does not need it.
      try {
        sessionStorage.setItem(
          storeKey(pendingKey),
          JSON.stringify({ pending: capturePending ? capturePending() : null }),
        );
      } catch {
        // Private browsing, a full quota, a locked-down profile. Losing the
        // typed prompt is a worse trip back, not a broken payment.
      }

      try {
        const res = await fetch("/api/ai/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // A tier id and a path. No amount — see this file's rule 1 and
          // AGENTS.md non-negotiable #5. `search` is deliberately dropped:
          // safeReturnPath rejects a query string, and the server appends the
          // session id itself.
          body: JSON.stringify({ tierId, returnTo: window.location.pathname }),
        });
        if (!res.ok) {
          await reportResponseError(res);
          setError("start_failed");
          try {
            sessionStorage.removeItem(storeKey(pendingKey));
          } catch {
            /* nothing stored, nothing to clear */
          }
          return;
        }
        const data = await res.json();

        // A demo account never reaches Stripe (lib/ai/topupIntent.js), so
        // there is no redirect and no return leg — the credit is already on
        // the ledger and the panel can carry straight on.
        if (data.simulated) {
          try {
            sessionStorage.removeItem(storeKey(pendingKey));
          } catch {
            /* nothing stored, nothing to clear */
          }
          setOutcome({ kind: "simulated", balanceCents: data.balanceCents });
          await onCredited?.();
          return;
        }

        // Deliberately NOT clearing `submitting` or the in-flight ref here:
        // assign() does not stop this function, so the finally below would
        // re-enable the button for the fraction of a second before the browser
        // actually leaves — long enough for a second click and a second
        // Checkout Session. Nothing else on this path needs the state back,
        // because the page is about to be replaced.
        navigating = true;
        window.location.assign(data.checkoutUrl);
      } catch {
        setError("start_failed");
      } finally {
        if (!navigating) {
          setSubmitting(false);
          inFlight.current = false;
        }
      }
    },
    [tierId, pendingKey, onCredited],
  );

  // ── The trip back ────────────────────────────────────────────────────────
  //
  // Runs once per mount, guarded by a ref because React's development double
  // effect would otherwise confirm twice. The server is idempotent either way;
  // the guard is about not making two requests, not about not double-charging.
  useEffect(() => {
    if (returnHandled.current) return;
    returnHandled.current = true;

    let stashed = null;
    try {
      const raw = sessionStorage.getItem(storeKey(pendingKey));
      if (raw) stashed = JSON.parse(raw);
      sessionStorage.removeItem(storeKey(pendingKey));
    } catch {
      stashed = null;
    }

    const sessionId = new URLSearchParams(window.location.search).get("aitopup");
    // No session id and nothing stashed: an ordinary page load.
    if (!sessionId && !stashed) return;

    // Restore what they were doing FIRST, so a cancelled payment still gets
    // its prompt back. Cancelling is a decision, not an error, and losing the
    // typed text because of it is the same dead end one step earlier.
    if (stashed) onResume?.(stashed.pending);

    if (!sessionId) return;

    // Strip the id before anything awaits, so a refresh mid-confirm is an
    // ordinary page load rather than a second confirmation.
    window.history.replaceState({}, "", window.location.pathname);

    returnedSession.current = sessionId;

    (async () => {
      const data = await settleReturn(sessionId);
      if (data?.credited) {
        setOutcome({ kind: "credited", cents: data.cents, balanceCents: data.balanceCents });
        await onCredited?.();
      } else {
        // NOT "something went wrong". The payment may well have gone through;
        // what is true is that the credit is not on the balance yet, and that
        // is the only thing this screen is allowed to say.
        setOutcome({ kind: "pending" });
      }
      setOffer((current) => current || { standalone: true });
    })();
    // Mount only. `onResume`/`onCredited` identities change with their
    // caller's render; re-running this on that would re-confirm a payment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey]);

  /**
   * "Check again", for the case where Stripe took the money and had not
   * settled it when the browser came back.
   *
   * Asks about THAT payment rather than only re-reading the balance: a balance
   * that has not moved cannot tell the difference between "the webhook is
   * slow" and "the payment failed", and the person is owed the difference.
   */
  const recheck = useCallback(async () => {
    setSubmitting(true);
    try {
      const sessionId = returnedSession.current;
      if (sessionId) {
        const data = await settleReturn(sessionId, { force: true });
        if (data?.credited) {
          setOutcome({ kind: "credited", cents: data.cents, balanceCents: data.balanceCents });
        }
      }
      await onCredited?.();
    } finally {
      setSubmitting(false);
    }
  }, [onCredited]);

  return {
    open,
    close,
    isOpen: Boolean(offer),
    dialogProps: {
      offer,
      tierId,
      onPickTier: setTierId,
      submitting,
      error,
      outcome,
      onConfirm: confirm,
      onRecheck: recheck,
      onClose: close,
    },
  };
}

/**
 * The dialog itself. Purely presentational — every decision above it.
 *
 * @param {Object} props
 * @param {(() => any)} [props.capturePending]  what to hand back to `onResume`
 *   after the trip to Stripe. The AI sidebar returns its prompt.
 */
export function AiCreditTopupDialog({
  offer,
  tierId,
  onPickTier,
  submitting,
  error,
  outcome,
  onConfirm,
  onRecheck,
  onClose,
  capturePending,
}) {
  const { t } = useTranslation();
  if (!offer) return null;

  const settled = outcome?.kind === "credited" || outcome?.kind === "simulated";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("app.aiTopup.title", "Add AI credit")}
    >
      {/* max-h + overflow rather than a fixed height: a phone with the
          keyboard up has very little room, and a fixed-height modal is the
          hazard scripts/check-mobile-surfaces.mjs exists to catch. */}
      <div className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl bg-card shadow-xl sm:max-w-md sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b p-4">
          <div className="flex items-center gap-2">
            <CreditCard className="size-4 shrink-0 text-muted-foreground" />
            <h2 className="text-sm font-semibold">{t("app.aiTopup.title", "Add AI credit")}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("app.aiTopup.close", "Close")}
            className="-m-2 flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4">
          {outcome?.kind === "credited" && (
            <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
              {t("app.aiTopup.credited", "Added {amount} of AI credit. Your balance is {balance}.", {
                amount: money(outcome.cents),
                balance: money(outcome.balanceCents),
              })}
            </p>
          )}

          {outcome?.kind === "simulated" && (
            <p className="rounded-lg bg-muted p-3 text-sm">
              {t(
                "app.aiTopup.simulated",
                "Simulated top-up added — this is a demo account, so no payment was taken. Your balance is {balance}.",
                { balance: money(outcome.balanceCents) },
              )}
            </p>
          )}

          {outcome?.kind === "pending" && (
            <div className="space-y-3">
              <p className="rounded-lg bg-muted p-3 text-sm">
                {t(
                  "app.aiTopup.notLanded",
                  "Stripe hasn't confirmed that payment yet, so nothing has been added to your balance. If it went through, the credit lands on its own within a minute or two.",
                )}
              </p>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full"
                disabled={submitting}
                onClick={onRecheck}
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  t("app.aiTopup.checkAgain", "Check again")
                )}
              </Button>
            </div>
          )}

          {!outcome && !offer.standalone && (
            <>
              <div className="space-y-1">
                <p className="text-sm">
                  {t("app.aiTopup.cost", "This costs {price}. Your AI balance is {balance}.", {
                    price: money(offer.priceCents),
                    balance: money(offer.balanceCents),
                  })}
                </p>
                <p className="text-sm font-medium">
                  {t("app.aiTopup.short", "Add at least {shortfall} to carry on.", {
                    shortfall: money(offer.shortfallCents),
                  })}
                </p>
              </div>

              {!offer.canBuy && (
                <p className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
                  {t(
                    "app.aiTopup.askOwner",
                    "Only an owner or admin can buy AI credit. Ask one of them to top this account up.",
                  )}
                </p>
              )}

              {offer.canBuy && (
                <>
                  <fieldset className="space-y-2">
                    <legend className="mb-2 text-xs font-medium text-muted-foreground">
                      {t("app.aiTopup.chooseAmount", "How much would you like to add?")}
                    </legend>
                    <div className="grid grid-cols-2 gap-2">
                      {offer.tiers.map((tier) => (
                        <button
                          key={tier.id}
                          type="button"
                          onClick={() => onPickTier(tier.id)}
                          aria-pressed={tierId === tier.id}
                          className={cn(
                            "flex min-h-11 flex-col items-center justify-center rounded-lg border px-3 py-2 text-sm",
                            tierId === tier.id
                              ? "border-foreground bg-foreground text-background"
                              : "hover:bg-muted",
                          )}
                        >
                          <span className="font-medium tabular-nums">{tier.label}</span>
                          {!tier.covers && (
                            <span className="text-[11px] opacity-80">
                              {t("app.aiTopup.notEnough", "not enough on its own")}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <p className="text-xs text-muted-foreground">
                    {t(
                      "app.aiTopup.stripeNote",
                      "You'll finish on Stripe's secure payment page. The card on your FieldQuo subscription can't be charged for a one-off purchase like this — a saved card may only be used for what it was saved for. You'll come straight back to this design.",
                    )}
                  </p>

                  {error === "start_failed" && (
                    <p className="text-xs text-destructive">
                      {t(
                        "app.aiTopup.startError",
                        "Couldn't start that payment. Nothing was charged.",
                      )}
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2 border-t p-4">
          <Button type="button" variant="outline" className="h-11 flex-1" onClick={onClose}>
            {settled || outcome
              ? t("app.aiTopup.close", "Close")
              : t("app.aiTopup.cancel", "Cancel")}
          </Button>
          {!outcome && !offer.standalone && offer.canBuy && (
            <Button
              type="button"
              className="h-11 flex-1"
              disabled={submitting || !tierId}
              onClick={() => onConfirm({ capturePending })}
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t("app.aiTopup.continue", "Continue to payment")
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
