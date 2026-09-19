// lib/platform/costs/stripeFees.js
//
// What Stripe kept on FieldQuo's OWN money, per day.
//
// ══ The platform account, not a contractor's ═════════════════════════════
//
// Two Stripe integrations share one key (lib/stripe.js's warning). This one
// reads the PLATFORM account's balance transactions — the subscription
// charges FieldQuo bills companies (Stripe Billing), the application fees
// it collects on contractors' payments (Connect), the refunds, the payouts
// — and records, per UTC day and per Stripe reporting category, the fee
// Stripe took. A contractor's own processing fees on their own charges live
// on the contractor's connected account and are theirs; they never appear
// here. Nothing here touches a tenant's data.
//
// ══ "What Stripe kept" is the fee, plus Stripe's own fee lines ═══════════
//
// Every balance transaction carries `fee` (Stripe's cut of that
// transaction, in minor units) and `fee_details`. Stripe's monthly extras
// — Billing's percentage, Radar, Tax — arrive as separate transactions of
// type `stripe_fee` whose `amount` is negative and whose `fee` is 0. Both
// are money Stripe kept, so a row's `cents` is the sum of `fee` over its
// transactions plus `-amount` for the `stripe_fee` ones. `units` is the
// gross `amount` of the category, so a "charge" row is gross subscription
// revenue beside what Stripe kept of it, and the page can print the two
// together without a second query.
//
// Docs: stripe.com/docs/api/balance_transactions/list — `created[gte]`,
// `created[lt]`, `limit` ≤ 100, `starting_after`; each object { id, amount,
// currency, fee, fee_details[], net, type, reporting_category, created,
// status }. Minor units throughout; nothing here converts currencies.
import { db } from "@/lib/db";
import { stripe as platformStripe } from "@/lib/stripe";
import { dayKey } from "./dailyLedger";
import { writeDailyRows } from "./ledgerWrite";

export const STRIPE_FEES_SOURCE = "stripe_balance_transactions";

/** Stripe's reporting categories, in English, for the page. */
export const STRIPE_CATEGORY_LABELS = Object.freeze({
  charge: "Charges — subscriptions and top-ups FieldQuo billed",
  payment: "Payments (non-card)",
  refund: "Refunds",
  payment_refund: "Refunds (non-card)",
  dispute: "Disputes",
  dispute_reversal: "Dispute reversals",
  application_fee: "Connect application fees collected",
  application_fee_refund: "Connect application fees refunded",
  payout: "Payouts to FieldQuo's bank",
  payout_reversal: "Payout reversals",
  transfer: "Transfers to connected accounts",
  transfer_reversal: "Transfer reversals",
  fee: "Stripe's own fee lines (Billing, Radar, Tax)",
  connect_collection_transfer: "Connect collection transfers",
  advance: "Advances",
  advance_funding: "Advance funding",
  other_adjustment: "Other adjustments",
  topup: "Top-ups to the balance",
});

export function stripeFeesConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function stripeCategory(reportingCategory, currency) {
  return `${reportingCategory || "unknown"}/${String(currency || "usd").toLowerCase()}`;
}

export function splitStripeCategory(category) {
  const s = String(category || "");
  const i = s.lastIndexOf("/");
  return i < 0 ? { reportingCategory: s, currency: "USD" } : { reportingCategory: s.slice(0, i), currency: s.slice(i + 1).toUpperCase() };
}

/**
 * Balance transactions → ledger rows. PURE.
 *
 * One row per (day, reporting category, currency): `cents` what Stripe
 * kept, `units` the gross amount, `count` the transactions. A transaction
 * with no readable `created` or `amount` is dropped and counted.
 *
 * @returns {{ rows: Array, dropped: number }}
 */
export function normaliseStripeBalanceTransactions(txns, { fetchedAt = new Date() } = {}) {
  const byKey = new Map();
  let dropped = 0;
  const at = fetchedAt instanceof Date ? fetchedAt : new Date(fetchedAt);
  for (const t of Array.isArray(txns) ? txns : []) {
    const created = num(t?.created);
    const day = created === null ? null : dayKey(new Date(created * 1000));
    const amount = num(t?.amount);
    if (!day || amount === null) {
      dropped += 1;
      continue;
    }
    const currency = String(t?.currency || "usd").toUpperCase();
    const reporting = typeof t?.reporting_category === "string" && t.reporting_category ? t.reporting_category : typeof t?.type === "string" ? t.type : "unknown";
    const category = stripeCategory(reporting, currency);
    const key = `${day}|${category}`;
    const cur = byKey.get(key) || { day, provider: "stripe", category, cents: 0, currency, units: 0, unit: "gross, minor units", count: 0, source: STRIPE_FEES_SOURCE, fetchedAt: at };
    const fee = num(t?.fee) || 0;
    const ownFee = t?.type === "stripe_fee" || reporting === "fee" ? -amount : 0;
    cur.cents += fee + ownFee;
    cur.units += amount;
    cur.count += 1;
    byKey.set(key, cur);
  }
  return { rows: [...byKey.values()], dropped };
}

/**
 * Read every balance transaction created in [from, to] inclusive of days,
 * paging by `starting_after`. Returns the raw objects.
 *
 * @param stripe  injectable; the check script hands it a fixture list
 */
export async function fetchStripeBalanceTransactions({ from, to, stripe = platformStripe } = {}) {
  const gte = Math.floor(new Date(`${dayKey(from)}T00:00:00.000Z`).getTime() / 1000);
  const lt = Math.floor(new Date(`${dayKey(to)}T00:00:00.000Z`).getTime() / 1000) + 86_400;
  const out = [];
  let startingAfter;
  for (let guard = 0; guard < 200; guard += 1) {
    // eslint-disable-next-line no-await-in-loop
    const page = await stripe.balanceTransactions.list({ created: { gte, lt }, limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) });
    for (const t of page?.data || []) out.push(t);
    if (!page?.has_more || !page.data?.length) break;
    startingAfter = page.data[page.data.length - 1].id;
  }
  return out;
}

/** The whole pull: fetch, normalise, write. Same shape as the other providers. */
export async function pullStripeFees({ from, to, client = db, now = new Date(), stripe = platformStripe } = {}) {
  if (!stripeFeesConfigured()) return { ok: false, reason: "not_configured", records: 0, rows: 0, written: 0, dropped: 0 };
  const txns = await fetchStripeBalanceTransactions({ from, to, stripe });
  const { rows, dropped } = normaliseStripeBalanceTransactions(txns, { fetchedAt: now });
  const written = await writeDailyRows(rows, { client });
  return { ok: true, from: dayKey(from), to: dayKey(to), records: txns.length, rows: rows.length, written, dropped };
}
