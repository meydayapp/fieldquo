// app/portal/[token]/CardPayPanel.js
//
// The portal's own card form, used only when the company passes its card fee
// on to clients who pay by CREDIT card (Company.clientCardSurcharge) and this
// client may be charged it — the invoice's `cardFee` from GET
// /api/portal/[token]. Everywhere else the card button goes to Stripe's
// hosted page exactly as before.
//
// Why not the hosted page: the fee must be shown BEFORE the client pays, on
// the card they actually used — credit cards only, never debit or prepaid —
// and the hosted page fixes the amount before the card is known. So:
//
//   enter    Stripe's Payment Element (an iframe — the card number never
//            touches this page) → a ConfirmationToken;
//   review   the server reads the card's funding type from Stripe and returns
//            the lines: invoice amount, "Credit card fee 2.4%", total. The
//            client pays that, or goes back and uses another card;
//   confirm  the server charges exactly the reviewed intent; 3-D Secure, if
//            the bank asks, opens via stripe.handleNextAction.
//
// The browser sends ids, never an amount (non-negotiable #5). `dueCents` is
// handed to Stripe.js only as the Elements display amount; the server derives
// the charge from its own rows.
//
// White-label: Stripe's form takes the company's brand colour; no FieldQuo
// word appears anywhere here.
"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, CreditCard, AlertCircle, ArrowLeft, Lock } from "lucide-react";
import { jsonBody } from "@/lib/jsonBody";
import { surchargeRatePercent } from "@/lib/stripe/clientCardSurchargeMath";

// Stripe.js must be loaded from js.stripe.com, never bundled or self-hosted
// (Stripe's PCI requirement — docs.stripe.com/payments/finalize-payments-on-
// the-server, "Set up Stripe.js"). One script tag per page, shared.
const STRIPE_JS = "https://js.stripe.com/endive/stripe.js";
let stripeJsPromise = null;
function loadStripeJs() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Stripe) return Promise.resolve(window.Stripe);
  if (!stripeJsPromise) {
    stripeJsPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = STRIPE_JS;
      s.async = true;
      s.onload = () => (window.Stripe ? resolve(window.Stripe) : reject(new Error("Stripe.js did not load")));
      s.onerror = () => {
        stripeJsPromise = null;
        reject(new Error("Stripe.js did not load"));
      };
      document.head.appendChild(s);
    });
  }
  return stripeJsPromise;
}

async function post(token, body) {
  const res = await fetch(`/api/portal/${token}/card-pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: jsonBody(body, "payment"),
  });
  const d = await res.json().catch(() => null);
  return { ok: res.ok, d };
}

export default function CardPayPanel({
  token,
  invoiceId,
  stageId = null,
  dueCents,
  form, // { publishableKey, currency }
  rateBps,
  copy,
  money,
  accent,
  accentOn,
  otherWaysFree = false,
  onPaid,
}) {
  const mountRef = useRef(null);
  const stripeRef = useRef(null);
  const elementsRef = useRef(null);
  const [phase, setPhase] = useState("loading"); // loading | enter | review | paying
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState(null);
  const pct = surchargeRatePercent(rateBps);
  const f = copy.cardFee;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const Stripe = await loadStripeJs();
        if (cancelled) return;
        const stripe = Stripe(form.publishableKey);
        const elements = stripe.elements({
          mode: "payment",
          amount: Math.max(1, Math.trunc(Number(dueCents)) || 1),
          currency: String(form.currency || "cad").toLowerCase(),
          paymentMethodCreation: "manual",
          // Card only: the fee is decided per card, and the PaymentIntent the
          // server creates is card-only to match.
          paymentMethodTypes: ["card"],
          appearance: { theme: "stripe", variables: { colorPrimary: accent || "#06356b" } },
        });
        const element = elements.create("payment", {
          layout: "tabs",
          // Apple Pay / Google Pay show an amount in their own sheet before
          // the card is known — they could not show the fee that card will
          // carry, so they are not offered on this form.
          wallets: { applePay: "never", googlePay: "never" },
        });
        element.mount(mountRef.current);
        stripeRef.current = stripe;
        elementsRef.current = elements;
        setPhase("enter");
      } catch {
        if (!cancelled) {
          setError(f.formUnavailable);
          setPhase("enter");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // The form is built once per open panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function continueToReview() {
    const stripe = stripeRef.current;
    const elements = elementsRef.current;
    if (!stripe || !elements || busy) return;
    setBusy(true);
    setError("");
    try {
      const { error: submitError } = await elements.submit();
      if (submitError) throw new Error(submitError.message || f.reenterCard);
      const { error: tokenError, confirmationToken } = await stripe.createConfirmationToken({
        elements,
        params: { return_url: `${window.location.origin}/portal/${token}?paid=true` },
      });
      if (tokenError) throw new Error(tokenError.message || f.reenterCard);
      const { ok, d } = await post(token, {
        step: "review",
        invoiceId,
        stageId,
        confirmationTokenId: confirmationToken.id,
      });
      if (!ok || !d?.review) throw new Error(d?.error || f.reenterCard);
      setReview(d.review);
      setPhase("review");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function payNow() {
    if (!review || busy) return;
    setBusy(true);
    setError("");
    setPhase("paying");
    try {
      let { ok, d } = await post(token, { step: "confirm", invoiceId, stageId, intentId: review.intentId });
      if (ok && d?.status === "requires_action" && d.clientSecret) {
        const { error: actionError } = await stripeRef.current.handleNextAction({ clientSecret: d.clientSecret });
        if (actionError) throw new Error(actionError.message || f.declined);
        ({ ok, d } = await post(token, { step: "finalize", invoiceId, stageId, intentId: review.intentId }));
      }
      // The review no longer stands (the balance or the fee changed) or the
      // card was declined: the error says which.
      if (!ok) throw new Error(d?.error || f.declined);
      if (d?.status === "succeeded" || d?.status === "processing") {
        onPaid?.();
        return;
      }
      throw new Error(f.declined);
    } catch (err) {
      // Every failure goes back to the card form: a reviewed payment that did
      // not complete is used up (its token is spent, or the figures moved),
      // so the next try is a fresh review — never a silent retry of a
      // different amount.
      setError(err.message);
      setReview(null);
      setPhase("enter");
    } finally {
      setBusy(false);
    }
  }

  const reviewing = phase === "review" || phase === "paying";

  return (
    <div data-card-pay-panel className="rounded-2xl border border-black/10 bg-white p-4 sm:p-5 space-y-3 text-left">
      {/* Said before a card is entered: what the fee is, that only credit
          cards carry it, and how not to pay it. */}
      <p className="text-sm text-[#2d2520]" data-card-fee-notice>
        {f.notice(pct)}
      </p>
      <p className="text-xs text-[#2d2520]/65">
        {otherWaysFree ? f.avoidAll : f.avoidDebit}
      </p>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Kept mounted through the review so "Use a different card" returns
          to the card the client typed, not an empty form. */}
      <div className={reviewing ? "hidden" : ""}>
        <div ref={mountRef} className="min-h-[3rem]" />
        {phase === "loading" && (
          <div className="flex justify-center py-4 text-[#2d2520]/50">
            <Loader2 size={18} className="animate-spin" />
          </div>
        )}
        {phase === "enter" && (
          <button
            type="button"
            onClick={continueToReview}
            disabled={busy || !stripeRef.current}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 py-3 rounded-full text-sm font-bold disabled:opacity-60"
            style={{ backgroundColor: accent, color: accentOn }}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
            {f.continue}
          </button>
        )}
      </div>

      {reviewing && review && (
        <div data-card-fee-review className="space-y-2">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between text-[#2d2520]/80">
              <dt>{f.invoiceAmount}</dt>
              <dd className="tabular-nums">{money(review.baseCents / 100)}</dd>
            </div>
            {review.surchargeCents > 0 ? (
              <div className="flex justify-between text-[#2d2520]/80" data-card-fee-line>
                <dt>{f.line(surchargeRatePercent(review.rateBps))}</dt>
                <dd className="tabular-nums">{money(review.surchargeCents / 100)}</dd>
              </div>
            ) : (
              <p className="text-xs text-[#2d2520]/65" data-card-fee-none>
                {review.funding === "debit" || review.funding === "prepaid" ? f.noFeeThisCard : f.noFeeThisPayment}
              </p>
            )}
            <div className="flex justify-between pt-1 font-semibold text-[#2d2520] border-t border-black/5">
              <dt>{f.total}</dt>
              <dd className="tabular-nums">{money(review.totalCents / 100)}</dd>
            </div>
          </dl>
          {review.last4 && (
            <p className="text-xs text-[#2d2520]/60">{f.cardEnding(review.brand || "", review.last4)}</p>
          )}
          {review.surchargeCents > 0 && (
            <p className="text-xs text-[#2d2520]/60">{f.noTax}</p>
          )}
          <button
            type="button"
            onClick={payNow}
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-full text-sm font-bold disabled:opacity-60"
            style={{ backgroundColor: accent, color: accentOn }}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
            {copy.pay(money(review.totalCents / 100))}
          </button>
          <button
            type="button"
            onClick={() => {
              setReview(null);
              setError("");
              setPhase("enter");
            }}
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-[#2d2520]/70 disabled:opacity-60"
          >
            <ArrowLeft size={13} /> {f.differentCard}
          </button>
        </div>
      )}
    </div>
  );
}
