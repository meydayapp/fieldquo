// lib/voice/quoteCallScope.js
//
// WHICH quotes get a callback, and the words for every quote that doesn't.
//
// ── Why this is its own file, with no imports ──────────────────────────────
//
// Three places need the same table and one of them is a browser bundle. The
// gate lives in lib/voice/triggers.js, which imports Prisma; the settings card
// is a client component. Importing the gate from the card would drag Prisma,
// then pg, then node's `dns` into the browser — the exact trap diagnosisCopy.js
// and readinessCopy.js were split out to avoid. So the constants and the copy
// live here, with no imports at all, and triggers.js re-exports the refusal
// codes so server code still has one place to reach for them.
//
// ── Why the scope is a company decision and not a constant ─────────────────
//
// This trigger was written for one thing: the instant estimate. A figure the
// software produced, reviewed by a human, emailed to the customer — and then a
// call. The original comment argued that a quote an estimator typed by hand
// already has a human who knows the customer, so auto-dialling them was never
// asked for. That reasoning is still sound, and it is still not universal: an
// owner who writes every quote himself and wants the assistant to close them
// has a different business from a company whose estimator met the customer in
// their kitchen yesterday.
//
// So it is a choice, with the OLD behaviour as the default. A company that
// enabled this feature under the narrow rule keeps the narrow rule until
// somebody deliberately widens it.

/**
 * The three answers to "which quotes should the assistant ring about?".
 *
 * `off` is not the same as turning the outbound switch off. The switch also
 * governs appointment reminders and new-enquiry follow-ups; this turns off the
 * quote closer alone, which is the one that reads a price back.
 */
export const QUOTE_CALL_SCOPES = {
  OFF: "off",
  INSTANT: "instant_estimates",
  ALL: "all_quotes",
};

/**
 * What a company that never chose gets.
 *
 * Deliberately the behaviour that already shipped. Changing what an enabled
 * feature does underneath somebody who never asked is the failure this whole
 * setting exists to avoid — a contractor who switched outbound calls on last
 * month, expecting instant-estimate follow-ups, must not discover the assistant
 * ringing every customer he wrote a quote for.
 */
export const DEFAULT_QUOTE_CALL_SCOPE = QUOTE_CALL_SCOPES.INSTANT;

/** Render order on the settings card — narrow, wide, none. */
export const QUOTE_CALL_SCOPE_VALUES = [
  QUOTE_CALL_SCOPES.INSTANT,
  QUOTE_CALL_SCOPES.ALL,
  QUOTE_CALL_SCOPES.OFF,
];

/**
 * A stored value, or anything else, as one of the three.
 *
 * Anything unrecognised — null on a company row written before the column
 * existed, a typo, a value from a future release rolled back — resolves to the
 * default rather than throwing or falling through to "allow". A scope nobody
 * can read must fail closed onto the narrow rule, not the wide one.
 */
export function normaliseQuoteCallScope(value) {
  return QUOTE_CALL_SCOPE_VALUES.includes(value) ? value : DEFAULT_QUOTE_CALL_SCOPE;
}

/**
 * Why an approved-quote callback was not queued. Named, so a log line is useful
 * — and so the settings card can say the same thing the gate decided rather
 * than a second description of it.
 *
 * The first six are decided by the pure gate in triggers.js. The last two are
 * DIAL-TIME facts the pure gate cannot see (it takes no database), surfaced by
 * lib/voice/quoteCallbackReport.js so the card doesn't promise a call that
 * placeQueuedCall will refuse an hour later.
 */
export const CALLBACK_REFUSED = {
  NO_QUOTE: "no_quote",
  OFF: "outbound_off",
  SCOPE_OFF: "quote_calls_off",
  NOT_ESTIMATE: "not_an_estimate",
  DRAFT: "still_a_draft",
  NOT_EMAILED: "not_emailed_yet",
  NO_PHONE: "no_phone",
  DECLINED: "quote_declined",
  // Report-only: mayCall reads the consent rows at dial time. See the note on
  // CALLBACK_REFUSED above.
  NO_CONSENT: "no_consent",
};

/**
 * Can somebody press "call this client" on THIS quote, right now?
 *
 * ── A manual call is a different act from an automatic one ────────────────
 *
 * approvedQuoteCallGate answers "should we ring this client without being
 * asked?", and most of what it refuses is about SCOPE — which quotes the
 * company signed up for. A person clicking a button on one quote has just
 * made that decision themselves, so scope cannot be the thing that stops them:
 * a button that is visible and refuses is the dead control this codebase is
 * swept for.
 *
 * What a human's click does NOT override:
 *
 *   OFF          the company turned outbound calling off entirely. That is the
 *                master switch, not a preference about which quotes.
 *   DRAFT        the quote still needs review. The agent reads the total back,
 *                and a figure nobody has approved is not one to say out loud.
 *   NOT_EMAILED  the client has not received it. Reading a total to somebody
 *                who has never seen it in writing is how a number becomes a
 *                commitment nobody can point at.
 *   NO_PHONE     there is nothing to dial.
 *
 * Consent and calling hours are deliberately absent from BOTH gates: they are
 * re-checked at dial time by placeQueuedCall, because a person can withdraw
 * consent between the click and the call, and the call must lose that race.
 */
export function manualQuoteCallGate(quote) {
  if (!quote) return { allowed: false, reason: CALLBACK_REFUSED.NO_QUOTE };
  if (!quote.company?.outboundCallsEnabled) {
    return { allowed: false, reason: CALLBACK_REFUSED.OFF };
  }
  if (quote.needsReview) return { allowed: false, reason: CALLBACK_REFUSED.DRAFT };
  if (!quote.sentAt) return { allowed: false, reason: CALLBACK_REFUSED.NOT_EMAILED };
  if (!quote.client?.phone) return { allowed: false, reason: CALLBACK_REFUSED.NO_PHONE };
  return { allowed: true };
}

/** The i18n key for one refusal. */
export const callbackReasonKey = (reason) => `app.setVoice.callback.${reason}`;
/** The i18n key for one scope's name. */
export const scopeLabelKey = (scope) => `app.setVoice.scope.${scope}`;
/** The i18n key for one scope's explanation. */
export const scopeHintKey = (scope) => `app.setVoice.scopeHint.${scope}`;

/**
 * One sentence per refusal, keyed exactly as callbackReasonKey builds it.
 *
 * These are the ENGLISH FALLBACK; app/i18n/appMessages.js carries the real
 * catalogue under the same keys. Written for the owner staring at a card that
 * says the feature is on: every one of them names the thing he could change.
 */
export const CALLBACK_REASON_TEXT = {
  "app.setVoice.callback.no_quote": "That quote no longer exists.",
  "app.setVoice.callback.outbound_off": "Automatic calls are switched off.",
  "app.setVoice.callback.quote_calls_off": "Quote callbacks are set to off.",
  "app.setVoice.callback.not_an_estimate":
    "Not an instant estimate — somebody typed this quote. Switch to “every quote I send” to have these called.",
  "app.setVoice.callback.still_a_draft": "Still waiting for someone to approve the estimate.",
  "app.setVoice.callback.not_emailed_yet": "Not emailed to the client yet.",
  "app.setVoice.callback.no_phone": "No phone number on the client.",
  "app.setVoice.callback.quote_declined": "The client turned this quote down.",
  "app.setVoice.callback.no_consent":
    "Nobody at this number has asked to be contacted, so the assistant won't ring it.",
};

/** Short name for each scope, on the settings card. */
export const SCOPE_LABEL_TEXT = {
  "app.setVoice.scope.instant_estimates": "Instant estimates only",
  "app.setVoice.scope.all_quotes": "Every quote I send",
  "app.setVoice.scope.off": "No quote callbacks",
};

/** What choosing it actually does. */
export const SCOPE_HINT_TEXT = {
  "app.setVoice.scopeHint.instant_estimates":
    "Only quotes the software priced and someone approved. What this has always done.",
  "app.setVoice.scopeHint.all_quotes":
    "Including quotes you wrote yourself — the assistant rings once after you send, to answer questions and ask if they want to go ahead.",
  "app.setVoice.scopeHint.off":
    "No calls about quotes. Appointment reminders and new-enquiry follow-ups carry on.",
};
