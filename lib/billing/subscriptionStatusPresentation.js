// lib/billing/subscriptionStatusPresentation.js
//
// How each SubscriptionStatus is shown to the CONTRACTOR on their own Account
// & Billing screen.
//
// ── The bug this replaces ──────────────────────────────────────────────────
//
// The badge was `{subscription.status}` with a `capitalize` class and a
// three-branch ternary for the colour: amber for trialing, green for active,
// and `bg-muted` — plain grey — for everything else. "Everything else" is
// `past_due` and `canceled`.
//
// So a company whose renewal had just failed, seven days from losing access to
// their own quote history, read the word **Past_due** in grey. Snake_case,
// untranslated, and the least visible thing on the screen. This is the same
// failure lib/invoices/statusPresentation.js was written for, one enum over,
// and it is worse here because the reader can only fix it by acting on it.
//
// Meanwhile FieldQuo's own staff portal (app/sales/companies/page.js) has
// spelled these four out properly since it shipped. The people selling the
// product could read the status; the people paying for it could not.
//
// ── No words in this file ──────────────────────────────────────────────────
//
// Same split as statusPresentation.js: a label KEY, never a label. English in
// lib/ is English in every office. Keys are written out in full rather than
// built from the value, because `app.status.${status}` is invisible to
// check:translations.
//
// ── Why two of them carry `labelKey: null` ─────────────────────────────────
//
// `app.status.trial` does not exist in app/i18n/appMessages.js yet and this
// pass does not own that catalogue. A key literal that resolves to nothing
// FAILS check:translations, and t() would render the key itself on screen —
// so a name we cannot resolve is worse than the English word. Until the
// catalogue carries it, `fallback` is used verbatim.
//
// To finish it: add `"app.status.trial": "Trial"` (fr: "Essai") and set
// `labelKey` on the `trialing` row below. Nothing else changes.
//
// `past_due` deliberately does NOT wait for a key. `app.status.overdue`
// already exists in the generic status namespace and already says exactly the
// right thing in both gated languages — "Overdue" / "En retard" — and this is
// the one row where the reader has to act. Reusing a generic key is not the
// same as borrowing `app.salesPortal.subPastDue`, which would tie a
// contractor's billing screen to FieldQuo's internal sales tooling.

import { toneClasses } from "@/lib/status/tone";

// Keyed by every value of `enum SubscriptionStatus`. Adding a value to the
// schema without adding it here is what check:money-status-chips catches.
export const SUBSCRIPTION_STATUS_PRESENTATION = {
  // Amber, not green: a trial is real access with a deadline on it, and the
  // countdown beside this badge is the reason someone opened the page.
  trialing: { tone: "reversed", labelKey: null, fallback: "Trial" },
  active: { tone: "positive", labelKey: "app.status.active", fallback: "Active" },
  // The only urgent one. Payment has already failed; a grace clock is running
  // (Subscription.pastDueSince) and it ends in the account going read-only.
  past_due: { tone: "urgent", labelKey: "app.status.overdue", fallback: "Overdue" },
  // Settled, not urgent. Nothing is going to be taken from their card, and
  // colouring a finished relationship red would be a threat we don't mean.
  canceled: {
    tone: "neutral",
    labelKey: "app.status.cancelled",
    fallback: "Cancelled",
  },
};

// A status this file has never heard of still renders as something a human can
// read: the neutral chip, and — through labelKey null — the caller's own
// fallback. Belt to the check's braces.
const UNKNOWN = { tone: "neutral", labelKey: null, fallback: null };

export function subscriptionStatusPresentation(status) {
  return SUBSCRIPTION_STATUS_PRESENTATION[status] || UNKNOWN;
}

/** Chip classes for a status. Never undefined, never half-built. */
export function subscriptionStatusClasses(status) {
  return toneClasses(subscriptionStatusPresentation(status).tone);
}

/**
 * The label to print, resolved.
 *
 * Takes t() rather than importing one, because lib/ has no hook and the caller
 * already has the right one. An unmapped status falls back to the raw value —
 * ugly, but a word beats a blank chip, and the check makes it unreachable.
 */
export function subscriptionStatusLabel(status, t) {
  const { labelKey, fallback } = subscriptionStatusPresentation(status);
  if (labelKey) return t(labelKey);
  return fallback || String(status ?? "");
}
