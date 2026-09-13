// lib/platform/stripeSync.js
//
// Pull one company's subscription from Stripe and write what Stripe says.
//
// ── Why a pull exists at all ────────────────────────────────────────────────
//
// Every column on Subscription that describes the Stripe side — status,
// period end, trial end, cadence, cancelled-at — was written by webhooks and
// by nothing else. A webhook is a push we cannot see fail: an endpoint that is
// unregistered, pointed at the wrong deployment, or signed with a rotated
// secret delivers nothing and errors nowhere. On 2026-09-13 that left the
// owner's cancelled live-test subscription reading "active" for the rest of
// the day, and every screen offering things Stripe would refuse.
//
// This is the pull. Three callers:
//
//   the platform company page   "Sync from Stripe" — billing:manage, audited
//   /api/cron/billing-sync      every six hours, every live subscription; a
//                               row that disagreed with Stripe is filed as
//                               billing_drift so a webhook outage is visible
//                               within six hours instead of never
//   scripts/sync-subscription   the same function from a shell, for the day
//                               the console is what is broken
//
// It writes ONLY the columns Stripe is the authority on
// (lib/billing/subscriptionFields.js). Plan, customer, retention history and
// the notification markers are ours and are not touched.
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import {
  subscriptionFieldsFromStripe,
  subscriptionDrift,
  SYNCED_COLUMNS,
} from "@/lib/billing/subscriptionFields";

const pick = (row) => Object.fromEntries(SYNCED_COLUMNS.map((c) => [c, row?.[c] ?? null]));

/**
 * Write what a Stripe Subscription object says onto the company's row.
 *
 * The one place a route that already holds Stripe's reply (a cancel, an
 * update, a retrieve) turns it into columns — so the cancel route, the
 * retention offers, the plan change and the periodic sync cannot disagree
 * about what "Stripe said canceled" does to the row.
 *
 * @param {string} companyId
 * @param {object} live      a Stripe Subscription object
 * @param {object} [opts]
 * @param {object} [opts.row] the row, if the caller already read it
 * @returns {Promise<{ fields: object|null, before: object, after: object, changed: Array }>}
 */
export async function writeSubscriptionFromStripe(companyId, live, { row } = {}) {
  const current = row || (await db.subscription.findUnique({ where: { companyId } }));
  if (!current) return { fields: null, before: {}, after: {}, changed: [] };

  // A row that already holds canceledAt keeps it when Stripe's canceled_at is
  // absent — a periodic sync must never restart the 30-day window.
  const fields = subscriptionFieldsFromStripe(live, { now: current.canceledAt || new Date() });
  const changed = subscriptionDrift(current, fields);
  const before = pick(current);
  // Read before the write: `current` may be the caller's own object, and the
  // decision below is about the state the row was in.
  const wasCanceled = current.status === "canceled";
  let after = before;

  if (changed.length) {
    const updated = await db.subscription.update({ where: { companyId }, data: fields });
    after = pick(updated);
    // The same consequence the customer.subscription.deleted webhook applies:
    // a company whose subscription ended is churned, whichever writer noticed.
    if (fields.status === "canceled" && !wasCanceled) {
      await db.company
        .update({ where: { id: companyId }, data: { onboardingStatus: "churned" } })
        .catch(() => {});
    }
  }
  return { fields, before, after, changed };
}

/**
 * @param {string} companyId
 * @returns {Promise<{
 *   ok: boolean,
 *   reason?: "no_row"|"no_stripe_subscription"|"stripe_missing"|"stripe_error",
 *   error?: string,
 *   stripeSubscriptionId?: string,
 *   stripeStatus?: string,
 *   before?: object, after?: object,
 *   changed: Array<{ field: string, before: any, after: any }>,
 * }>}
 */
export async function syncSubscriptionFromStripe(companyId) {
  const row = await db.subscription.findUnique({ where: { companyId } });
  if (!row) return { ok: false, reason: "no_row", changed: [] };
  if (!row.stripeSubscriptionId) {
    return { ok: false, reason: "no_stripe_subscription", changed: [] };
  }

  let live;
  try {
    live = await stripe.subscriptions.retrieve(row.stripeSubscriptionId);
  } catch (err) {
    // "No such subscription" is NOT written as cancelled. The likeliest cause
    // is a key from the other mode (a test-mode id asked of the live key, or
    // the reverse), and writing "canceled" off a key mismatch would lock a
    // paying company out. It is reported, and a human decides.
    const missing = err?.code === "resource_missing";
    return {
      ok: false,
      reason: missing ? "stripe_missing" : "stripe_error",
      error: err?.message || String(err),
      stripeSubscriptionId: row.stripeSubscriptionId,
      changed: [],
    };
  }

  const { before, after, changed } = await writeSubscriptionFromStripe(companyId, live, { row });
  return {
    ok: true,
    stripeSubscriptionId: live.id,
    stripeStatus: live.status,
    before,
    after,
    changed,
  };
}
