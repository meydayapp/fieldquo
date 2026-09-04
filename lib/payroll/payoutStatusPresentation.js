// lib/payroll/payoutStatusPresentation.js
//
// How each PayoutStatus is shown on the pay-run screen.
//
// ── The bug this replaces ──────────────────────────────────────────────────
//
// app/app/settings/team/payroll/page.js rendered the status as
//
//     <div className="text-xs capitalize text-muted-foreground">{p.status}</div>
//
// — one muted grey line, the same grey for all four values. So a payout that
// FAILED looked exactly like one that was PAID: same colour, same weight, same
// position, one different word in a column nobody scans. The money did not
// leave, the worker was not paid, and the screen said so in the quietest way
// it had available.
//
// That is the invoice-chargeback failure again (lib/invoices/statusPresentation.js
// tells that story), and this time it is somebody's wages.
//
// ── Tones ──────────────────────────────────────────────────────────────────
//
// `failed` is urgent because it is the only row that needs a person today, and
// it is the whole reason this file exists. `processing` is info, not positive:
// the transfer is with Stripe and has not landed, and a green tick on money
// that has not moved is the claim that got the original grey shipped.
//
// ── One key still missing ──────────────────────────────────────────────────
//
// `app.status.failed` is not in app/i18n/appMessages.js and this pass does not
// own that catalogue; a key literal that resolves to nothing fails
// check:translations and renders the key itself on screen. Until it exists the
// English `fallback` is printed, which is honest and readable — and the RED
// chip, which is the half that makes a failed wage payment findable, works
// today in every language.
//
// To finish it: add `"app.status.failed": "Failed"` (fr: "Échec") and set
// `labelKey` on the `failed` row.

import { toneClasses } from "@/lib/status/tone";

// Keyed by every value of `enum PayoutStatus`.
export const PAYOUT_STATUS_PRESENTATION = {
  pending: {
    tone: "neutral",
    labelKey: "app.status.pending",
    fallback: "Pending",
  },
  // In flight at Stripe. Waiting is the correct action, so: info, not positive.
  processing: {
    tone: "info",
    labelKey: "app.status.inProgress",
    fallback: "In progress",
  },
  paid: { tone: "positive", labelKey: "app.status.paid", fallback: "Paid" },
  failed: { tone: "urgent", labelKey: null, fallback: "Failed" },
};

const UNKNOWN = { tone: "neutral", labelKey: null, fallback: null };

export function payoutStatusPresentation(status) {
  return PAYOUT_STATUS_PRESENTATION[status] || UNKNOWN;
}

/** Chip classes for a status. Never undefined, never half-built. */
export function payoutStatusClasses(status) {
  return toneClasses(payoutStatusPresentation(status).tone);
}

/** The label to print, resolved. See subscriptionStatusLabel for why t() is a
 *  parameter rather than an import. */
export function payoutStatusLabel(status, t) {
  const { labelKey, fallback } = payoutStatusPresentation(status);
  if (labelKey) return t(labelKey);
  return fallback || String(status ?? "");
}
