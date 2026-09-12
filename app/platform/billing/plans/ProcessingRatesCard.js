"use client";

// Read-only. The processing fees a contractor pays on each client payment,
// shown to the platform beside the plans it sells — from the SAME constants
// the charge creators use (lib/stripe/processingFee.js), so this card cannot
// say one thing while the checkout charges another.
//
// Not editable here on purpose: the rates are constants with their source
// (Stripe's published pricing) in a comment beside each, and a change is a
// code change executed by scripts/check-processing-fee.mjs. A database
// override would be a second place for the same number — the class of
// duplication this codebase keeps removing. Editability is a follow-up if
// the owner ever wants to move the rate without a deploy.

import {
  PROCESSING_RATES,
  STRIPE_CARD_RATE_BPS,
  FIELDQUO_CARD_RATE_BPS,
  INSTANT_PAYOUT_RATE,
} from "@/lib/stripe/processingFee";
import { DISPUTE_FEE_CENTS } from "@/lib/stripe/disputeRecovery";

const pct = (bps) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : bps % 10 === 0 ? 1 : 2)}%`;

export default function ProcessingRatesCard() {
  const margin = FIELDQUO_CARD_RATE_BPS - STRIPE_CARD_RATE_BPS;
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="font-semibold text-foreground">Processing fees passed to contractors</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Taken as the application fee on every homeowner charge. Source of truth:{" "}
        <code className="font-mono text-xs">lib/stripe/processingFee.js</code> — read-only here.
      </p>
      <dl className="mt-4 divide-y divide-border text-sm">
        {Object.values(PROCESSING_RATES).map((r) => (
          <div key={r.method} className="flex items-center justify-between py-2">
            <dt className="text-foreground">
              {r.method === "card"
                ? "Card (CAD, USD)"
                : r.method === "acss_debit"
                  ? "Pre-authorized debit (CAD)"
                  : "ACH debit (USD)"}
            </dt>
            <dd className="tabular-nums font-medium text-foreground">{r.formula}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between py-2">
          <dt className="text-foreground">Instant payout (contractor pays Stripe&apos;s rate)</dt>
          <dd className="tabular-nums font-medium text-foreground">{INSTANT_PAYOUT_RATE.formula}</dd>
        </div>
        <div className="flex items-center justify-between py-2">
          <dt className="text-foreground">Dispute fee, recovered from the contractor</dt>
          <dd className="tabular-nums font-medium text-foreground">
            ${(DISPUTE_FEE_CENTS / 100).toFixed(2)}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        Stripe charges the platform {pct(STRIPE_CARD_RATE_BPS)} + 30¢ on cards; FieldQuo keeps{" "}
        {pct(margin)} of each card payment. Bank debit, instant payouts and the dispute fee are
        passed through at cost. Express account fees Stripe bills the platform (per active account
        and per payout) are not passed through. Set the instant-payout fee to{" "}
        {INSTANT_PAYOUT_RATE.formula} in Stripe → Connect → Platform pricing.
      </p>
    </div>
  );
}
