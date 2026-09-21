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
 * The method names from an invoice's rendered "How to pay" block
 * (lib/payments/offlineMethods.js buildHowToPay), as one sentence. Absent
 * methods produce NOTHING rather than an invented "cash" — an empty list is
 * not a statement that they take cash (AGENTS.md recurring failure 5), and
 * guessing wrong sends a client to the door with the wrong thing in hand.
 * The labels are already in the document's language; the sentence around
 * them is in the client's.
 */
function methodsSentence(howToPay, copy) {
  const labels = (howToPay?.methods || []).map((m) => String(m?.label || "").trim()).filter(Boolean);
  if (!labels.length) return null;
  return copy.acceptedMethods(labels.join(", "));
}

/**
 * The lines to show in place of a Pay button on the portal INDEX, where a
 * row has room for a sentence and the invoice page carries the addresses.
 *
 * @param howToPay the invoice's rendered block, from GET /api/portal/[token]
 * @param copy     clientDocCopy(language), already resolved to the CLIENT's
 *                 language. Passed in rather than resolved here so this stays
 *                 pure and the portal keeps one language decision, made once
 *                 server-side.
 * @returns string[] — always at least one line ("get in touch"), because the
 *          absence of a Pay button with no explanation is the same dead end in
 *          a quieter costume.
 */
export function offlinePaymentLines(howToPay, copy) {
  const methods = methodsSentence(howToPay, copy);
  return methods ? [copy.arrangePayment, methods] : [copy.arrangePayment];
}
