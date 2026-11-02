// lib/sms/documentTextRules.js
//
// The pure rules about the text that carries a quote's or an invoice's link:
// whether it is switched on, how the client is greeted, which message type a
// document is, and the one sentence a screen says about the outcome.
//
// ── Why they are not in documentText.js ────────────────────────────────────
//
// Two readers need them and neither should pay for the send. The quote and
// invoice PAGES are client components, and the settings route wants nothing
// but a boolean — importing the sender for it pulled @/lib/db and the whole
// Twilio SDK into a screen that saves a line of text.
//
// The same split lib/booking/bookingText.js made from
// lib/booking/finalizeBooking.js, for the same reason, and with the same
// payoff: a pure rule can be executed against hostile input by
// scripts/check-sms-template.mjs, which is where the real bugs in this repo
// have been found.

/** quote | invoice → the message type, and the SmsDelivery purpose. */
export const DOCUMENT_TEXT_TYPE = Object.freeze({ quote: "quote_sent", invoice: "invoice_sent" });

/**
 * Is the document text on for this company? Pure — the send path and the
 * switch on Settings › Messages both ask it, so the screen can never say
 * "Off" while texts go out or the reverse.
 *
 * ON unless the company deliberately turned it off, which is why the column
 * defaults TRUE rather than carrying a "did they choose" stamp:
 * bookingSmsConfirmation defaulted false for the same billable-SMS reason and
 * the result was that no booking in FieldQuo ever texted, because nobody
 * found the switch.
 *
 * @param company { documentSmsOn } — it MUST be selected. An unselected
 *                column reads as undefined, and reading that as "off" would
 *                silence the text for every company whose caller forgot it.
 */
export function documentTextOn(company) {
  if (!company) return false;
  if (!("documentSmsOn" in company)) {
    throw new Error("documentTextOn: documentSmsOn was not selected");
  }
  return company.documentSmsOn !== false;
}

/**
 * The first name the greeting uses.
 *
 * The same rule buildQuoteEmail applies to its own greeting
 * (lib/email/quoteEmail.js: `String(client?.name || "").split(" ")[0]`), so
 * the text and the letter address the person identically — a "Hi Ana" email
 * beside a "Hi Ana Cristina Morales" text reads like two different senders.
 * Change one and change the other.
 *
 * Null rather than "" for a client with no name: the wording drops the
 * greeting entirely, rather than sending "Hi ." to an organisation filed
 * under a company name.
 */
export function clientFirstName(client) {
  const first = String(client?.name || "").trim().split(/\s+/)[0] || "";
  return first || null;
}

// ── What is NOT reported, and why ──────────────────────────────────────────
//
// "switched_off" says nothing: the company turned document texts off on
// Settings › Messages and does not need telling again on every send. Nagging
// about a decision somebody made is how a banner becomes something people
// read past — including the lines that matter.
//
// "follow_up" likewise: a follow-up deliberately sends no text (the wording
// is "your quote is ready", which is false a week on), so there is no outcome
// to report.
//
// Everything a sender could ACT on does get said: no phone on the client, an
// opt-out, or a text that was attempted and failed. The last one above all —
// a green "Sent to ana@example.com" over a text that never left is exactly
// the half-truth AGENTS.md puts first.

/**
 * @param sms  the `sms` object from the send route's response
 * @returns an app-message key, or null when there is nothing to say
 */
export function documentTextNoteKey(sms) {
  if (!sms || typeof sms !== "object") return null;
  if (sms.texted === true) {
    // A demo tenant's text is recorded exactly like a real one, so this flag
    // is the only thing that can stop the screen claiming a phone buzzed.
    //
    // The two comparisons are deliberately asymmetric, and both lean the same
    // way — away from claiming a delivery. `texted` must be exactly true, so
    // a truthy-but-not-true value cannot become "their phone buzzed"; a
    // truthy `simulated` is enough to say it didn't, because the cost of
    // being wrong runs one way only.
    return sms.simulated ? "app.docText.simulated" : "app.docText.texted";
  }
  switch (sms.reason) {
    case "no_phone":
      return "app.docText.noPhone";
    case "opted_out":
      return "app.docText.optedOut";
    case "failed":
      return "app.docText.failed";
    // The card-free trial has not verified a mobile yet. Its own sentence,
    // because "the text didn't go" would be true and useless: this one is
    // fixable in a minute and the screen it is fixed on is named.
    case "phone_unverified":
      return "app.docText.phoneUnverified";
    default:
      return null;
  }
}
