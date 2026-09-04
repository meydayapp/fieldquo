// lib/platform/subscriptionStatus.js
//
// One table for `SubscriptionStatus`, because three screens were reading it.
//
// ══ Why this is not just a labels object ══════════════════════════════════
//
// `past_due` rendered raw, in the same grey as everything else, on
// /platform/billing/subscriptions — while the filter button one line above it
// said "Past due". That was fixed there. It was NOT fixed on the two screens
// support actually lives in: /platform/companies printed `c.subscription.status`
// straight into the row, and /platform/companies/[id] printed `sub.status` into
// a field labelled "Status". Same enum, same snake_case, same missing colour,
// on the screens somebody opens with a contractor on the phone.
//
// Three copies of a status map is AGENTS.md failure class 4 twice over, and the
// copies that rot are exactly the two nobody looked at. So the table lives here
// and every consumer asks it.
//
// ══ Colour is not decoration here ═════════════════════════════════════════
//
// `past_due` is the one row on the money screen a person must notice without
// reading. Encoding state in FORM as well as in the word is the whole point —
// a red chip is seen before it is read, and grey `past_due` was neither.
//
// The members are held to prisma/schema.prisma's enum by
// scripts/check-platform-truth.mjs, which reads the schema rather than a copy
// typed here — a hardcoded list keeps passing forever after somebody adds a
// member, which is the bug it would be checking for.

export const STATUSES = {
  active: {
    label: "Active",
    className:
      "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  },
  trialing: {
    label: "Trialing",
    className:
      "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  },
  past_due: {
    label: "Past due",
    className:
      "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900",
  },
  canceled: {
    label: "Canceled",
    className: "bg-muted text-muted-foreground border-border",
  },
};

/**
 * Never a bare enum value in a badge — an unknown one says it is unknown.
 *
 * Purple rather than grey for the unrecognised case, on purpose: a value the
 * column can hold and this table cannot name is a bug in this file, and it
 * should look like one rather than blending into the ordinary rows.
 *
 * @param {string|null|undefined} status
 * @returns {{ label: string, className: string }}
 */
export function statusMeta(status) {
  return (
    STATUSES[status] || {
      label: status ? `Unrecognised status: ${status}` : "No status",
      className:
        "bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-900",
    }
  );
}
