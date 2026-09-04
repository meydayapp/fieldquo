// lib/quotes/statusLabels.js
//
// What a quote's status is CALLED and what colour it wears, in the one place
// every screen reads it from. The twin of lib/jobs/statusLabels.js, written for
// the same reason and against the same failure.
//
// ── The bug this closes ────────────────────────────────────────────────────
//
// The quotes list rendered `{q.status}` — the raw column, lowercase, in
// English. A French office read "draft" and "sent" in the middle of an
// otherwise French screen, while the tile eight lines above the row already
// went through t(). Same page, same word, two treatments, and the untranslated
// one was the one a contractor scans forty times a day.
//
// ── Why `accepted` maps to app.status.approved ─────────────────────────────
//
// QuoteStatus's member is `accepted`; the catalogue's string for that state is
// `app.status.approved` ("Approved" / "Acceptée"), and the quote DETAIL page
// already renders exactly that key for exactly this state. A new
// `app.status.accepted` would be a second word for one meaning — which is how
// the list and the detail page end up disagreeing about a quote the client has
// signed. The enum value and the label key are allowed to differ; two labels
// are not.
//
// ── No words in this file ──────────────────────────────────────────────────
//
// Keys plus an English fallback, never a finished sentence chosen here. Same
// split lib/invoices/statusPresentation.js argues: English in lib/ is English
// in every office. The keys are written out in full rather than built from the
// status value, because `app.status.${status}` is invisible to
// check:translations — it cannot see a key that only exists at run time.

/** QuoteStatus -> [translation key, English fallback]. Exhaustive. */
export const QUOTE_STATUS_LABEL_KEYS = {
  draft: ["app.status.draft", "Draft"],
  sent: ["app.status.sent", "Sent"],
  accepted: ["app.status.approved", "Approved"],
  declined: ["app.status.declined", "Declined"],
};

/** Every QuoteStatus, in the order a quote moves through them. */
export const QUOTE_STATUSES = Object.keys(QUOTE_STATUS_LABEL_KEYS);

// The chip classes the list already shipped with, moved here unchanged so the
// label and the colour cannot drift into two files the way the invoice ones
// did. All four are `bg-*-50 / text-*-700` in light and `bg-*-950/40 /
// text-*-300` in dark — the pairing check:quote-list measures rather than
// assumes.
export const QUOTE_STATUS_CLASSES = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  accepted:
    "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  declined: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
};

// A status nobody added still has to render as something a human can read: the
// tidied raw value in a neutral chip, never the word "undefined" in a class
// list and never another status's colour. "Draft" on a signed quote is a false
// statement about a contract.
const UNKNOWN_CLASSES = "bg-muted text-muted-foreground";

/**
 * The human label, given the caller's `t`.
 *
 * Falls back to the tidied raw value rather than an empty string — a badge
 * reading "on_hold" is ugly, a blank badge is a bug report. Neither should
 * happen; only one of them is recoverable.
 */
export function quoteStatusLabel(status, t) {
  const entry = QUOTE_STATUS_LABEL_KEYS[status];
  if (!entry) return String(status || "").replace(/_/g, " ");
  return t ? t(entry[0], entry[1]) : entry[1];
}

/** The chip classes. Never returns undefined, never a half-built string. */
export function quoteStatusClasses(status) {
  return QUOTE_STATUS_CLASSES[status] || UNKNOWN_CLASSES;
}
