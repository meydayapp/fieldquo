// lib/payments/offlinePaymentNote.js
//
// What the client portal says where the Pay button would have been, when the
// company hasn't finished connecting Stripe.
//
// ── Why this is shared, and why it's here rather than inline ────────────────
//
// Three surfaces have to agree about one fact ("this company can't take a card
// yet"): the invoice email, the portal index, and the portal invoice page. The
// email already had its version (lib/email/invoiceEmail.js, gated on
// canTakeCard); the two portal screens had no version at all and rendered the
// button regardless. Writing the fallback twice in JSX would have created
// exactly the copy that rots — the one nobody looks at, on the surface a
// stranger sees.
//
// Pure and string-only: no JSX, no theme, no DOM. The caller decides how to
// paint it, this decides what it says.

/**
 * Turn the company's saved payment methods into the sentence the homeowner
 * reads. Absent methods produce NOTHING rather than an invented "cash" — an
 * empty list is not a statement that they take cash (AGENTS.md recurring
 * failure 5), and guessing wrong sends a client to the door with the wrong
 * thing in hand.
 */
function methodsSentence(paymentMethods, copy) {
  const methods = Array.isArray(paymentMethods) ? paymentMethods : [];
  const pretty = methods
    .map((m) => String(m || "").trim())
    .filter(Boolean)
    .map((m) => m.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase()));
  if (!pretty.length) return null;
  return copy.acceptedMethods(pretty.join(", "));
}

/**
 * The lines to show in place of a Pay button.
 *
 * @param company  { paymentMethods }  — the company as the portal sees it
 * @param copy     clientDocCopy(language), already resolved to the CLIENT's
 *                 language. Passed in rather than resolved here so this stays
 *                 pure and the portal keeps one language decision, made once
 *                 server-side.
 * @returns string[] — always at least one line ("get in touch"), because the
 *          absence of a Pay button with no explanation is the same dead end in
 *          a quieter costume.
 */
export function offlinePaymentLines(company, copy) {
  const methods = methodsSentence(company?.paymentMethods, copy);
  return methods ? [copy.arrangePayment, methods] : [copy.arrangePayment];
}
