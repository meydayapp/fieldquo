"use client";

// app/components/designer/hooks/useAiImageStatus.js
//
// Shared by AiSidebar.js and RemoveBgSidebar.js — both need the same answer
// (is the feature on, is the vendor wired, can we afford it, what does it
// cost) from the same endpoint, and a second copy of this fetch is the one
// that drifts out of sync with app/api/designer/ai-image-status/route.js's
// actual response shape.
import { useEffect, useState } from "react";

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
  return `$${(Math.max(0, Number(cents) || 0) / 100).toFixed(2)}`;
}

const REASON_COPY = {
  feature_unavailable: "AI image tools aren't switched on for this account.",
  vendor_unavailable: "AI image tools aren't connected on this deployment yet.",
  insufficient_balance: "balance", // filled in with the numbers by the caller
  unavailable: "Couldn't check AI image availability right now.",
};

/** The one line explaining why the button is disabled — never blank, never
 * "something went wrong". */
export function disabledReasonText(status) {
  if (!status) return "";
  if (status.reason === "insufficient_balance") {
    return `This costs ${centsToDollars(status.priceCents)}. Your AI balance is ${centsToDollars(
      status.balanceCents,
    )} — top up ${centsToDollars(status.shortfallCents)} to use it.`;
  }
  return REASON_COPY[status.reason] || "This isn't available right now.";
}
