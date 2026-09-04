"use client";

// app/components/designer/hooks/useAiImageStatus.js
//
// Shared by AiSidebar.js and RemoveBgSidebar.js — both need the same answer
// (is the feature on, is the vendor wired, can we afford it, what does it
// cost) from the same endpoint, and a second copy of this fetch is the one
// that drifts out of sync with app/api/designer/ai-image-status/route.js's
// actual response shape.
import { useEffect, useState } from "react";
import { formatAppMoney } from "@/lib/format/money";
import { CREDIT_CURRENCY } from "@/lib/voice/creditCurrency";

/**
 * @returns {{
 *   loading: boolean,
 *   status: null | {
 *     vendorReady: boolean,
 *     featureAvailable: boolean,
 *     allowed: boolean,
 *     priceCents: number,
 *     balanceCents: number,
 *     shortfallCents: number,
 *     reason: string,
 *     // Present ONLY when reason === "insufficient_balance" — a closed list
 *     // of top-up tiers (ids and labels, never amounts) plus whether this
 *     // member may buy at all. See lib/ai/topupOffer.js. Null on every other
 *     // refusal, because money does not fix a switched-off feature or an
 *     // unwired vendor, and offering a payment for either would take money
 *     // that changes nothing.
 *     topup: null | { tiers: Array<{id: string, label: string, covers: boolean}>,
 *                     recommendedId: string, canBuy: boolean },
 *   },
 *   refresh: () => void,
 * }}
 */
export function useAiImageStatus(active) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    setLoading(true);
    fetch("/api/designer/ai-image-status")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) {
          // A failed status check is not "affordable" — fail closed, the
          // same direction every other refusal in this feature fails.
          setStatus({
            vendorReady: false,
            featureAvailable: false,
            allowed: false,
            priceCents: 0,
            balanceCents: 0,
            shortfallCents: 0,
            reason: "unavailable",
            // No offer on a failed status check either. We do not know that
            // money is the problem, and a top-up button here would charge a
            // card against a guess.
            topup: null,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [active, nonce]);

  return { status, loading, refresh: () => setNonce((n) => n + 1) };
}

/** Cents to a dollar string, for the price/balance lines the coordinator
 * asked refusals to always show. */
export function centsToDollars(cents) {
  // US dollars, and the string says so. The AI image balance is the same
  // USD credit ledger as voice (lib/voice/creditCurrency.js), so a bare "$"
  // in a refusal quoted a Canadian contractor a price about 40% below what
  // their card would be charged.
  return formatAppMoney(Math.max(0, Number(cents) || 0) / 100, CREDIT_CURRENCY, "en");
}

// The reason the server gave, and the string that explains it. Each carries
// its English text alongside the key so the no-translator path below still
// says something true — the key is what a French screen actually renders.
const REASON_COPY = {
  feature_unavailable: [
    "app.aiImage.reason.featureUnavailable",
    "AI image tools aren't switched on for this account.",
  ],
  vendor_unavailable: [
    "app.aiImage.reason.vendorUnavailable",
    "AI image tools aren't connected on this deployment yet.",
  ],
  // insufficient_balance is deliberately absent: it is the one reason whose
  // sentence is built from numbers, out of the top-up dialog's own strings.
  unavailable: [
    "app.aiImage.reason.unavailable",
    "Couldn't check AI image availability right now.",
  ],
};

/**
 * The one line explaining why the button is disabled — never blank, never
 * "something went wrong".
 *
 * ── Why `t` is a parameter and not a hook call ─────────────────────────────
 *
 * This is a pure function so scripts/check-paid-refusals.mjs can execute it
 * against every reason instead of reading it, and because both sidebars call
 * it inside their render rather than at the top. Callers already hold `t`.
 *
 * The money sentence goes through the SAME two catalogue strings the top-up
 * dialog renders one click later (app.aiTopup.cost / app.aiTopup.short). It
 * used to be an English template built here, so a French contractor read an
 * English refusal and then a French dialog quoting the same two numbers — the
 * one place in this flow where the wording has to match, because the person is
 * checking that the amount they are about to pay is the amount they were just
 * told they were short.
 *
 * `t` is optional so a caller that has not got one still gets the English
 * sentence rather than an empty box — which is why REASON_COPY carries the key
 * AND the English for each reason rather than the key alone.
 */
export function disabledReasonText(status, t) {
  if (!status) return "";
  const english = (_key, fallback, values) =>
    String(fallback).replace(/\{(\w+)\}/g, (m, name) =>
      values && values[name] !== undefined ? String(values[name]) : m,
    );
  const say = typeof t === "function" ? t : english;
  if (status.reason === "insufficient_balance") {
    const cost = say("app.aiTopup.cost", "This costs {price}. Your AI balance is {balance}.", {
      price: centsToDollars(status.priceCents),
      balance: centsToDollars(status.balanceCents),
    });
    const short = say("app.aiTopup.short", "Add at least {shortfall} to carry on.", {
      shortfall: centsToDollars(status.shortfallCents),
    });
    return `${cost} ${short}`;
  }
  const [key, fallback] = REASON_COPY[status.reason] || [
    "app.aiImage.reason.generic",
    "This isn't available right now.",
  ];
  return say(key, fallback);
}
