// lib/billing/subscriptionFields.js
//
// One mapping from a Stripe Subscription object to our Subscription columns.
//
// ══ Why this is its own module ═════════════════════════════════════════════
//
// On 2026-09-13 the owner cancelled his own $1 live-test subscription from the
// product. Stripe ended it at once. Our row went on saying `active` with no
// canceledAt, because the cancel route wrote nothing and waited for the
// customer.subscription.deleted webhook — and no Stripe event had reached
// the deployment all day. Every screen that read the row then offered things
// Stripe could no longer do: a pause ("A canceled subscription can only
// update its cancellation_details"), a plan change ("cannot migrate a
// subscription that is currently in the canceled status"), a second cancel
// ("No such subscription"). Each surfaced as a 502 and a "try again".
//
// The rule now: a route that mutates a subscription at Stripe holds Stripe's
// reply in its hand, and that reply IS the truth — it writes the mapped fields
// itself, in the same request. The webhook is a second writer of the same
// facts, not the only one. Both go through this function so "what does a
// Stripe object mean for our row" is answered once. It is pure so a check can
// execute it against every shape Stripe sends.
//
// ══ Stripe's statuses are not our enum ═════════════════════════════════════
//
// `SubscriptionStatus` in prisma/schema.prisma is trialing | active |
// past_due | canceled. Stripe also says incomplete, incomplete_expired,
// unpaid and paused. The webhook used to write `obj.status` straight through,
// which is a Prisma error the moment dunning gives up (`unpaid`) — the exact
// moment the row most needs updating. The mapping is explicit below and says
// why for each one that is not the identity.
import { intervalFromStripeSubscription } from "@/lib/billing/interval";
import { CLEAR_PENDING } from "@/lib/platform/planChange";

/**
 * Stripe status → SubscriptionStatus, or undefined for "do not write".
 *
 *   unpaid              dunning exhausted — still an account that owes; the
 *                       grace clock (pastDueSince) is the right consequence
 *   paused              trial ended with no card (Stripe's paused, not our
 *                       retention pause, which is pause_collection and keeps
 *                       status active) — same consequence as unpaid
 *   incomplete_expired  the first payment never completed and Stripe gave
 *                       up: there is no subscription to speak of, which for
 *                       the company is a cancellation
 *   incomplete          the first payment is still being attempted; nothing
 *                       to say yet, so the column is left alone
 */
export function subscriptionStatusFromStripe(status) {
  switch (status) {
    case "trialing":
    case "active":
    case "past_due":
    case "canceled":
      return status;
    case "unpaid":
    case "paused":
      return "past_due";
    case "incomplete_expired":
      return "canceled";
    default:
      return undefined;
  }
}

const secondsToDate = (s) => (Number.isFinite(Number(s)) && Number(s) > 0 ? new Date(Number(s) * 1000) : null);

/**
 * The period end, wherever this API version puts it. 2025-01-27.acacia has it
 * on the subscription; the 2025-03 "basil" versions moved it onto each item.
 * Reading both means a client-version bump cannot silently null the column.
 */
export function periodEndFromStripe(obj) {
  const top = secondsToDate(obj?.current_period_end);
  if (top) return top;
  const items = Array.isArray(obj?.items?.data) ? obj.items.data : [];
  let latest = null;
  for (const item of items) {
    const d = secondsToDate(item?.current_period_end);
    if (d && (!latest || d > latest)) latest = d;
  }
  return latest;
}

/**
 * The columns a Stripe Subscription object settles, ready for
 * `db.subscription.update({ data })`.
 *
 * @param {object} obj   a Stripe Subscription (from retrieve, update, cancel,
 *                       or a webhook's data.object)
 * @param {object} [opts]
 * @param {Date}   [opts.now]  what "cancelled now" means when Stripe's own
 *                       canceled_at is absent. A caller re-syncing a row that
 *                       already holds canceledAt should pass THAT, so a
 *                       periodic sync never restarts the 30-day window.
 * @returns {object}     never includes a key it cannot settle — an undefined
 *                       is Prisma's "leave it alone"
 */
export function subscriptionFieldsFromStripe(obj, { now = new Date() } = {}) {
  if (!obj || typeof obj !== "object" || typeof obj.id !== "string") {
    throw new Error("subscriptionFieldsFromStripe: not a Stripe subscription object");
  }
  const status = subscriptionStatusFromStripe(obj.status);
  const fields = {};
  if (status) fields.status = status;

  const periodEnd = periodEndFromStripe(obj);
  if (periodEnd) fields.currentPeriodEnd = periodEnd;

  // null once the trial is over: the countdown must stop, and Stripe's
  // absence of trial_end is a statement, not a gap.
  fields.trialEndsAt = secondsToDate(obj.trial_end);

  const interval = intervalFromStripeSubscription(obj);
  if (interval) fields.billingInterval = interval;

  if (status === "canceled") {
    // Stripe's own timestamp where it has one, not ours: a webhook can arrive
    // late or be replayed, and a replay months later would otherwise restart
    // the read-only window and hand a churned account another month.
    fields.canceledAt = secondsToDate(obj.canceled_at) || now;
    // The failed-payment clock must not survive into a cancellation, and a
    // plan change booked for the 1st has nothing to land on.
    fields.pastDueSince = null;
    Object.assign(fields, CLEAR_PENDING);
  } else if (status === "active" || status === "trialing") {
    // Paid, or not yet due. The grace clock and its two warning markers are
    // cleared so a LATER failure gets a fresh seven days.
    fields.pastDueSince = null;
    fields.graceWarnedAt = null;
    fields.graceFinalWarnedAt = null;
  }

  return fields;
}

/** The columns a sync compares; `updatedAt` and ids are noise here. */
export const SYNCED_COLUMNS = Object.freeze([
  "status",
  "currentPeriodEnd",
  "trialEndsAt",
  "billingInterval",
  "canceledAt",
]);

const same = (a, b) => {
  const av = a instanceof Date ? a.getTime() : a ?? null;
  const bv = b instanceof Date ? b.getTime() : b ?? null;
  return av === bv;
};

/**
 * Which synced columns differ between what the row held and what Stripe says.
 * Pure, so the drift cron's "this row was wrong" is executable in a check.
 */
export function subscriptionDrift(row, fields) {
  return SYNCED_COLUMNS.filter((col) => col in fields && !same(row?.[col], fields[col])).map((col) => ({
    field: col,
    before: row?.[col] ?? null,
    after: fields[col] ?? null,
  }));
}

/**
 * Is this Stripe error the one that means "that subscription is already
 * cancelled"? Three phrasings were seen on 2026-09-13, one per route:
 *
 *   update  "A canceled subscription can only update its cancellation_details
 *            and metadata."
 *   migrate "cannot migrate a subscription that is currently in the canceled
 *            status"
 *   cancel  "No such subscription" (resource_missing)
 *
 * A route that gets one of these must not answer "try again" — nothing about
 * retrying changes the state. It answers "already cancelled" and syncs.
 */
export function isCanceledSubscriptionError(err) {
  if (!err) return false;
  if (err.code === "resource_missing") return true;
  const type = err.type || err.rawType;
  const msg = String(err.message || "");
  return (
    (type === "invalid_request_error" || type === "StripeInvalidRequestError" || !type) &&
    /canceled subscription|in the canceled status|status of canceled|has been canceled/i.test(msg)
  );
}
