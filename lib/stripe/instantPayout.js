// lib/stripe/instantPayout.js
//
// A contractor pulling their Stripe balance to a debit card NOW, instead of
// waiting for Stripe's payout schedule. The owner's reason for offering it:
// "maybe we can capture that 1%" — Stripe charges the platform 1% for an
// instant payout and the platform bills the connected account the same 1%
// through Stripe's Platform Pricing Tool (a dashboard setting, not code), so
// the feature costs FieldQuo nothing and the contractor gets same-day money.
//
// ── What the browser gets, and what it never gets ─────────────────────────
//
// Gross (what is instantly available) and net (what Stripe will actually
// send, after its fee and the platform's). The browser never sends an
// amount: the route pays out the whole net figure Stripe reported, because
// a partial instant payout is a second product with its own arithmetic and
// the owner asked for a button, not a form. The platform's margin is not
// sent as a rate — the screen shows Stripe's gross and net and the published
// 1%, and nothing that would let a reader work out what FieldQuo keeps if
// the dashboard is ever set differently.
//
// ── The gate ──────────────────────────────────────────────────────────────
//
// Only a company that can take charges, on a Stripe account at least 30 days
// old. Stripe's Connect risk guidance: the PLATFORM is liable for a connected
// account's negative balance, and an instant payout is the fastest way a
// disputed charge becomes money the platform cannot claw back — a new
// account with one payment and one chargeback is the textbook case. Thirty
// days is Stripe's own "new account" window for payout risk.
//
// Eligibility is decided from Stripe's answers, not our columns: the debit
// card on file must list `instant` in its available_payout_methods, and the
// balance object must report an instant_available amount for the currency.
// Canada in particular needs a debit card (bank accounts there are standard
// payouts only); when that is the reason, the card says so and links to the
// Express dashboard to add one.

import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import {
  INSTANT_PAYOUT_MIN_ACCOUNT_AGE_DAYS,
  instantPayoutEligibility,
  reportedFeePercent,
} from "@/lib/stripe/instantPayoutRules";

export { INSTANT_PAYOUT_MIN_ACCOUNT_AGE_DAYS, instantPayoutEligibility, reportedFeePercent };

/**
 * Read what Stripe knows: the connected account (with its external accounts)
 * and its balance with net_available expanded.
 */
export async function loadInstantPayoutState(company, deps = {}) {
  const client = deps.stripe || stripe;
  const opts = { stripeAccount: company.stripeAccountId };
  const [account, balance] = await Promise.all([
    client.accounts.retrieve(company.stripeAccountId, { expand: ["external_accounts"] }),
    client.balance.retrieve({ expand: ["instant_available.net_available"] }, opts),
  ]);
  return { account, balance };
}

// One payout at a time per company, per server instance. The Stripe
// idempotency key is per request (a retry of the SAME request replays; a new
// click is a new key), so this is what refuses a double-click that arrives
// before the first has returned. Across instances the second request is
// refused by Stripe instead — the first took the whole net balance.
const inFlight = new Set();

/**
 * Create the payout and record it. Every number comes from Stripe: the amount
 * is Stripe's own net_available for the destination, never a request body.
 *
 * @returns {{ ok: true, payout, row } | { ok: false, reason, status }}
 */
export async function createInstantPayout({ company, userId, requestId }, deps = {}) {
  const client = deps.stripe || stripe;
  const prisma = deps.db || db;
  const now = deps.now ?? Date.now();

  if (!company?.id) return { ok: false, reason: "no_company", status: 400 };
  if (inFlight.has(company.id)) return { ok: false, reason: "in_flight", status: 409 };
  inFlight.add(company.id);
  try {
    const { account, balance } = await loadInstantPayoutState(company, deps);
    const decision = instantPayoutEligibility({ company, account, balance, now });
    if (!decision.eligible) return { ok: false, reason: decision.reason, status: 409, decision };

    const payout = await client.payouts.create(
      {
        amount: decision.netCents,
        currency: decision.currency,
        method: "instant",
        destination: decision.destination.id,
        metadata: { companyId: company.id, requestedBy: userId || "" },
      },
      {
        stripeAccount: company.stripeAccountId,
        idempotencyKey: `fq-instant-payout-${company.id}-${requestId}`,
      },
    );

    // Recorded after Stripe confirms — the row states that money moved.
    // If this write fails the payout still exists at Stripe under its own
    // id; logged loudly rather than thrown, because throwing would tell the
    // contractor it failed when their card is already being credited.
    let row = null;
    try {
      row = await prisma.instantPayout.create({
        data: {
          companyId: company.id,
          stripePayoutId: payout.id,
          currency: decision.currency,
          grossCents: decision.grossCents,
          netCents: decision.netCents,
          destination: decision.destination.id,
          createdById: userId || null,
        },
      });
    } catch (err) {
      console.error("[instant-payout] payout created but not recorded:", payout.id, err?.message);
    }
    return { ok: true, payout, row, decision };
  } finally {
    inFlight.delete(company.id);
  }
}
