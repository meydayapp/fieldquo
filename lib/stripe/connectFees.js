// lib/stripe/connectFees.js
//
// Reading the Connect account fees Stripe bills the PLATFORM, and writing
// one ConnectFeeRecovery row per fee so lib/stripe/connectFeeLedger.js can
// recover it from the company on its next payment. Run daily by
// app/api/cron/connect-fees.
//
// ── Which balance transactions carry these fees ───────────────────────────
//
// Stripe's balance-transaction types (docs.stripe.com/reports/balance-
// transaction-types): Connect's per-account and per-payout fees are billed
// to the platform as balance transactions of type `stripe_fee` — "Stripe
// fees, such as the Connect monthly active account fee or payout fees" — with
// a negative `amount` and a `description` that names the fee and the
// connected account (`acct_…`). `connect_collection_transfer` is the opposite
// direction (Stripe collecting from a connected account's balance to cover
// its own fees, Standard/Custom accounts) and is deliberately not read:
// nothing there was billed to the platform. `application_fee` and `payout`
// types are the platform's own money, not Stripe's fees.
//
// Recognition is by description, because Stripe attaches no account id
// field to a stripe_fee transaction. A fee whose description names no
// connected account is skipped and counted — it is a platform-level Stripe
// fee (a Radar charge, an Identity verification), not a company's — and the
// cron reports how many it skipped so a wording change at Stripe shows up as
// a number, not as silence.
//
// The 0.25% + 25¢ per-payout fee and the C$2 / US$2 monthly active-account
// fee are Stripe Canada / US Connect pricing (stripe.com/en-ca/connect/pricing).
// The monthly fee bills only in a month the account was active; a contractor
// with no payments in a month owes nothing that month.

import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";

const ACCOUNT_RE = /\b(acct_[A-Za-z0-9]+)\b/;

/**
 * PURE — classify one platform balance transaction. Returns the row to write
 * or null when it is not a connected account's Connect fee.
 */
export function classifyFeeTransaction(bt) {
  if (!bt || bt.type !== "stripe_fee") return null;
  const description = String(bt.description || "");
  const m = description.match(ACCOUNT_RE);
  if (!m) return null;
  const feeCents = Math.max(0, -Math.trunc(Number(bt.amount) || 0));
  if (feeCents <= 0) return null;
  const lower = description.toLowerCase();
  const kind = /active/.test(lower)
    ? "active_account"
    : /payout/.test(lower)
      ? "payout"
      : "other";
  const created = new Date((Number(bt.created) || 0) * 1000);
  const period = Number.isFinite(created.getTime()) ? created.toISOString().slice(0, 7) : null;
  return {
    stripeAccountId: m[1],
    stripeBalanceTransactionId: bt.id,
    kind,
    period,
    currency: String(bt.currency || "").toLowerCase(),
    feeCents,
    description: description.slice(0, 300),
  };
}

/**
 * Read the last `days` of platform stripe_fee transactions and write any
 * Connect account fee not yet in the ledger. Idempotent on the balance
 * transaction id.
 *
 * @returns {{ seen, written, skippedNoAccount, skippedUnknownCompany }}
 */
export async function collectConnectFees({ days = 3, now = Date.now() } = {}, deps = {}) {
  const client = deps.stripe || stripe;
  const prisma = deps.db || db;
  const since = Math.floor(now / 1000) - days * 86_400;

  const companies = await prisma.company.findMany({
    where: { stripeAccountId: { not: null } },
    select: { id: true, stripeAccountId: true },
  });
  const byAccount = new Map(companies.map((c) => [c.stripeAccountId, c.id]));

  const stats = { seen: 0, written: 0, skippedNoAccount: 0, skippedUnknownCompany: 0 };
  let startingAfter;
  for (;;) {
    const page = await client.balanceTransactions.list({
      type: "stripe_fee",
      created: { gte: since },
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const bt of page.data || []) {
      stats.seen++;
      const row = classifyFeeTransaction(bt);
      if (!row) {
        stats.skippedNoAccount++;
        continue;
      }
      const companyId = byAccount.get(row.stripeAccountId);
      if (!companyId) {
        stats.skippedUnknownCompany++;
        continue;
      }
      const { stripeAccountId, ...data } = row;
      const existing = await prisma.connectFeeRecovery.findUnique({
        where: { stripeBalanceTransactionId: data.stripeBalanceTransactionId },
        select: { id: true },
      });
      if (existing) continue;
      await prisma.connectFeeRecovery.create({ data: { companyId, ...data } });
      stats.written++;
    }
    if (!page.has_more || !page.data?.length) break;
    startingAfter = page.data[page.data.length - 1].id;
  }
  return stats;
}
