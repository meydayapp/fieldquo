// lib/platform/unlock.js
//
// "Unlock company" on /platform/companies/[id]: undo a lock or ending that
// FieldQuo applied, and nothing else.
//
// ══ Why it exists (owner, 2026-10-03) ══════════════════════════════════════
//
// The cancel panel could end a company three ways and nothing could bring one
// back — extend-trial refused by name ("there is no reinstate control yet"),
// the cancel panel said the same, and the only way back was a hand edit of
// three columns. A terms lock pressed on the wrong company, or a company that
// put things right, had no way home.
//
// ══ Which locks are FieldQuo's — read from the rows, never from a label ═════
//
// lib/billing/access.js has exactly two lock sources FieldQuo writes, both
// from app/api/platform/companies/[id]/cancel-subscription:
//
//   Company.platformEnd*       the no-Stripe path: period_end / now / terms on
//                              a card-free trial or a company made by hand.
//                              The trial date is never touched by that write,
//                              so clearing the three columns IS the pre-lock
//                              state: access.js falls back to the trial clock
//                              exactly as it would have read without the
//                              ending (a trial that ran out meanwhile reads as
//                              an expired trial — that is the clock, not us).
//   Subscription.accessLocked* the Stripe path's terms lock. Clearing it
//                              lifts FieldQuo's lock; the Stripe subscription
//                              that route CANCELLED stays cancelled — this
//                              never calls Stripe (owner: "never touch Stripe
//                              subscriptions"), so the company reads as a
//                              cancelled plan (thirty days read-only from
//                              canceledAt, then locked) and may start a plan
//                              again from Billing, which fieldquoEndRefusal
//                              had refused while the lock stood.
//
// Everything else that limits access — a trial that ran out, a failed card
// (past_due), a plan the company cancelled itself — is NOT FieldQuo's lock and
// is refused here: the way out of those is the company's own (choose a plan,
// fix the card, Resume), and "unlocking" them would be FieldQuo handing out
// free access under a label that says otherwise. That is what extend-trial is
// for, with its own reason and audit row.
//
// ══ What it deliberately does NOT restore ══════════════════════════════════
//
//   · Automatic phone-credit top-up. A terms lock switched it off
//     (VoiceAutoTopup.disabledReason "terms_lock"). Switching it back on would
//     re-arm an off-session CARD CHARGE from the platform console, and
//     lib/voice/autoTopup.js keeps exactly one path to `enabled: true` — the
//     company saving a card under terms it accepted. So it stays off and the
//     panel says so; the company switches it back on itself.
//   · Phone numbers the rent run already released after a terms lock. A
//     released number is gone from the carrier; nothing here can buy it back.
//
// Pure and import-free, like cancelOptions.js: the panel renders from it and
// the route decides with it, so the button and the write cannot disagree.

function toDate(value) {
  const d = value instanceof Date ? value : value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

function shortDate(value) {
  const d = toDate(value);
  return d ? d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : null;
}

const MODE_WORDS = {
  terms: "locked for a terms breach",
  now: "ended now",
  period_end: "set to end at the trial's end",
};

/**
 * What FieldQuo locked on this company, and what Unlock would write.
 *
 * @param company       { platformEndsAt, platformEndMode, platformEndReason }
 * @param subscription  { stripeSubscriptionId, status, canceledAt,
 *                        accessLockedAt, accessLockedReason } | null — must be
 *                        passed; undefined throws rather than read "not
 *                        loaded" as "not locked".
 * @returns {{
 *   locked: boolean,
 *   refusal: string|null,
 *   sources: Array<"company_ending"|"subscription_lock">,
 *   summary: string|null,          one sentence: what FieldQuo did
 *   after: string|null,            one sentence: what the company gets back
 *   notRestored: string[],         what Unlock leaves as it is, said out loud
 *   data: { company: object|null, subscription: object|null },
 *   previous: object|null,         the values being cleared, for the audit row
 * }}
 */
export function unlockPlan({ company, subscription } = {}) {
  if (subscription === undefined) {
    throw new Error("unlockPlan: subscription was not read — pass null for a company with no Subscription row");
  }
  const empty = { locked: false, sources: [], summary: null, after: null, notRestored: [], data: { company: null, subscription: null }, previous: null };
  if (!company) return { ...empty, refusal: "Not found" };

  const endsAt = toDate(company.platformEndsAt);
  const hasEnding = Boolean(endsAt || company.platformEndMode);
  const lockedAt = toDate(subscription?.accessLockedAt);
  const hasSubLock = Boolean(lockedAt);

  if (!hasEnding && !hasSubLock) {
    return {
      ...empty,
      refusal:
        "FieldQuo has not locked or ended this company, so there is nothing to unlock. A trial that ran out or a failed payment is the company's own to fix — choose a plan or update the card — or extend the free period above.",
    };
  }

  const sources = [];
  const parts = [];
  const notRestored = [];
  const data = { company: null, subscription: null };
  const previous = {};
  let terms = false;

  if (hasEnding) {
    sources.push("company_ending");
    data.company = { platformEndsAt: null, platformEndMode: null, platformEndReason: null };
    previous.company = {
      platformEndsAt: endsAt ? endsAt.toISOString() : null,
      platformEndMode: company.platformEndMode || null,
      platformEndReason: company.platformEndReason || null,
    };
    const words = MODE_WORDS[company.platformEndMode] || "ended";
    parts.push(`FieldQuo ${words}${endsAt ? ` (${shortDate(endsAt)})` : ""}${company.platformEndReason ? ` — "${company.platformEndReason}"` : ""}.`);
    if (company.platformEndMode === "terms") terms = true;
  }
  if (hasSubLock) {
    sources.push("subscription_lock");
    data.subscription = { accessLockedAt: null, accessLockedReason: null };
    previous.subscription = {
      accessLockedAt: lockedAt.toISOString(),
      accessLockedReason: subscription.accessLockedReason || null,
    };
    parts.push(`FieldQuo locked the subscription for a terms breach (${shortDate(lockedAt)})${subscription.accessLockedReason ? ` — "${subscription.accessLockedReason}"` : ""}.`);
    terms = true;
  }

  let after;
  if (hasSubLock) {
    const canceledAt = toDate(subscription.canceledAt);
    after =
      subscription.stripeSubscriptionId && subscription.status === "canceled"
        ? `The lock is lifted; the Stripe subscription stays cancelled (Unlock never touches Stripe), so the company reads as a cancelled plan — thirty days read-only from ${canceledAt ? shortDate(canceledAt) : "its cancellation"}, then locked — and can start a plan again from Billing.`
        : "The lock is lifted; the company's access follows its subscription again. Stripe is not touched.";
  } else {
    after = "The company's access goes back to what its own trial or plan allows, as if FieldQuo had never ended it — the trial date was never changed.";
  }

  if (terms) {
    notRestored.push(
      "Automatic phone-credit top-up stays off — FieldQuo does not re-arm a card charge. The company switches it back on in its phone settings.",
      "Phone numbers already released after the lock are not restored.",
    );
  }

  return {
    locked: true,
    refusal: null,
    sources,
    summary: parts.join(" "),
    after,
    notRestored,
    data,
    previous,
  };
}
