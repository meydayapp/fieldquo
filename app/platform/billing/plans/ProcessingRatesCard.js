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

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetchJson";
import {
  PROCESSING_RATES,
  STRIPE_CARD_RATE_BPS,
  FIELDQUO_CARD_RATE_BPS,
  INSTANT_PAYOUT_RATE,
  publishedSurcharges,
  DISPUTE_FEE_CENTS,
} from "@/lib/stripe/processingFee";
import { INSTANT_PAYOUTS_ENABLED } from "@/lib/stripe/instantPayoutRules";

const pct = (bps) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : bps % 10 === 0 ? 1 : 2)}%`;

const money = (cents, cur) => `${(cents / 100).toFixed(2)} ${String(cur).toUpperCase()}`;

export default function ProcessingRatesCard() {
  const margin = FIELDQUO_CARD_RATE_BPS - STRIPE_CARD_RATE_BPS;
  // Connect account fees: recovered this month and still outstanding, per
  // currency. Read from the ledger, not computed here; a failed read says so.
  const [fees, setFees] = useState(null);
  const [feesError, setFeesError] = useState("");
  useEffect(() => {
    fetchJson("/api/platform/billing/connect-fees")
      .then(setFees)
      .catch((err) => setFeesError(err.message || "Could not read the Connect fee ledger."));
  }, []);
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
        {publishedSurcharges().map((x) => (
          <div key={x.kind} className="flex items-center justify-between py-2">
            <dt className="text-muted-foreground">
              {x.kind === "international" ? "International card surcharge" : "Currency conversion surcharge"}{" "}
              — trued up to Stripe&apos;s actual fee at settlement
            </dt>
            <dd className="tabular-nums text-muted-foreground">{x.formula}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between py-2">
          <dt className="text-foreground">
            Instant payout (contractor pays Stripe&apos;s rate){INSTANT_PAYOUTS_ENABLED ? "" : " — OFF"}
          </dt>
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
        {pct(margin)} of each card payment. Bank debit, surcharges, instant payouts and the dispute
        fee are passed through at cost. Express account fees Stripe bills the platform (monthly
        active account, 0.25% + 25¢ per payout) are recovered on the company&apos;s next payment
        — see the ledger below. Set the instant-payout fee to {INSTANT_PAYOUT_RATE.formula} in
        Stripe → Settings → Connect → Platform pricing → Instant payouts, and Settings → Connect →
        Payouts → Allow debit cards = Yes.
      </p>

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Connect account fees
      </h3>
      {feesError && <p className="mt-1 text-sm text-red-700 dark:text-red-300">{feesError}</p>}
      {fees && Object.keys(fees.totals).length === 0 && (
        <p className="mt-1 text-sm text-muted-foreground">
          No Connect account fees in the ledger yet — the daily cron writes them from Stripe&apos;s
          balance transactions.
        </p>
      )}
      {fees && Object.entries(fees.totals).map(([cur, t]) => (
        <dl key={cur} className="mt-2 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Billed by Stripe ({fees.month})</dt>
            <dd className="tabular-nums text-foreground">{money(t.billedThisMonthCents, cur)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Recovered this month</dt>
            <dd className="tabular-nums text-foreground">{money(t.recoveredThisMonthCents, cur)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Outstanding (a platform cost until a company pays again)</dt>
            <dd className="tabular-nums text-foreground">{money(t.outstandingCents, cur)}</dd>
          </div>
        </dl>
      ))}
    </div>
  );
}
