// lib/stripe/instantPayoutRules.js
//
// The PURE half of instant payouts — the eligibility decision and the fee
// arithmetic — with no Stripe client and no database, so the settings card
// (a client component) can import the gate constant and
// scripts/check-processing-fee.mjs can execute every refusal. The half that
// talks to Stripe is lib/stripe/instantPayout.js; its header explains the
// feature.

import { INSTANT_PAYOUT_RATE } from "@/lib/stripe/processingFee";

// The platform switch. ON — the owner, 2026-09-12 (after first saying the
// regular processing time was enough): offered to contractors WITH the fee
// stated plainly, at pass-through cost. Stripe's marketing rules require
// the instant-payout fee to be clear and conspicuous, so the settings card
// says it in a sentence before the button and again on the confirm step,
// never in a tooltip. Set to false and the route answers 404 and the card
// renders nothing; the check flips it through its own seam and asserts the
// shipped default.
export const INSTANT_PAYOUTS_ENABLED = true;

export const INSTANT_PAYOUT_MIN_ACCOUNT_AGE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * PURE — the decision, from Stripe's account and balance objects. Executed by
 * scripts/check-processing-fee.mjs against every refusal.
 *
 * @returns {{ eligible: boolean, reason: string|null, grossCents: number,
 *             netCents: number, feeCents: number, currency: string|null,
 *             destination: {id,last4,object}|null, accountAgeDays: number|null,
 *             expectedRate: string }}
 */
export function instantPayoutEligibility({ company, account, balance, now = Date.now() }) {
  const base = {
    eligible: false,
    reason: null,
    grossCents: 0,
    netCents: 0,
    feeCents: 0,
    currency: null,
    destination: null,
    accountAgeDays: null,
    expectedRate: INSTANT_PAYOUT_RATE.formula,
  };

  if (!company?.stripeAccountId || !account?.id) return { ...base, reason: "not_connected" };
  if (!company.stripeChargesEnabled || !account.charges_enabled) {
    return { ...base, reason: "charges_disabled" };
  }
  if (!account.payouts_enabled) return { ...base, reason: "payouts_disabled" };

  const createdMs = Number(account.created) * 1000;
  const ageDays = Number.isFinite(createdMs) ? Math.floor((now - createdMs) / DAY_MS) : null;
  base.accountAgeDays = ageDays;
  if (ageDays == null || ageDays < INSTANT_PAYOUT_MIN_ACCOUNT_AGE_DAYS) {
    return { ...base, reason: "account_too_new" };
  }

  // The external account that can take an instant payout. Stripe lists the
  // methods per external account; a bank account in Canada says ["standard"].
  const externals = account.external_accounts?.data || [];
  const instantCapable = externals.find((x) =>
    Array.isArray(x?.available_payout_methods) && x.available_payout_methods.includes("instant"),
  );
  if (!instantCapable) {
    return {
      ...base,
      reason: externals.length ? "no_instant_destination" : "no_external_account",
    };
  }
  base.destination = {
    id: instantCapable.id,
    last4: instantCapable.last4 || null,
    object: instantCapable.object || null,
    currency: instantCapable.currency || null,
  };

  // Stripe's balance, expanded with net_available per destination.
  const avail = (balance?.instant_available || []).find(
    (b) => !instantCapable.currency || String(b?.currency).toLowerCase() === String(instantCapable.currency).toLowerCase(),
  ) || balance?.instant_available?.[0];
  if (!avail) return { ...base, reason: "nothing_available" };

  const net = (avail.net_available || []).find((n) => n?.destination === instantCapable.id)
    || avail.net_available?.[0];
  const grossCents = Math.max(0, Math.trunc(Number(avail.amount)) || 0);
  const netCents = Math.max(0, Math.trunc(Number(net?.amount)) || 0);
  base.currency = String(avail.currency || instantCapable.currency || "").toLowerCase() || null;
  base.grossCents = grossCents;
  base.netCents = netCents;
  base.feeCents = Math.max(0, grossCents - netCents);

  if (netCents <= 0) return { ...base, reason: "nothing_available" };

  return { ...base, eligible: true };
}

/**
 * Stripe's fee on this payout as a percentage of gross, from the two numbers
 * Stripe reported — the figure the card prints beside the published 1%. A
 * string with at most two decimals, or null when there is no gross to divide
 * by. Pure.
 */
export function reportedFeePercent({ grossCents, netCents }) {
  const g = Number(grossCents) || 0;
  if (g <= 0) return null;
  const pct = ((g - (Number(netCents) || 0)) / g) * 100;
  return pct.toFixed(pct % 1 === 0 ? 0 : 2);
}
