// lib/sms/followUpTextRules.js
//
// The pure rules about the TEXT a follow-up rule sends: whether the company
// switched follow-up texts on, which message type a trigger uses, and the one
// sentence the cron's response says about each outcome.
//
// ── Why they are not in followUpText.js ───────────────────────────────────
//
// Exactly the split lib/sms/documentTextRules.js made from
// lib/sms/documentText.js, for the same reason and with the same payoff. The
// settings route wants nothing but a boolean, and the follow-ups page wants
// to know which triggers may text at all — importing the sender for either
// pulled @/lib/db and the whole Twilio SDK into a screen that saves a line of
// text. A pure rule is also a rule scripts/check-follow-up-sms.mjs can
// EXECUTE against hostile input, which is where the real bugs in this repo
// have been found.

/** The follow-up trigger → the message type, and the SmsDelivery purpose. */
export const FOLLOW_UP_TEXT_TYPE = Object.freeze({
  lead_no_response: "lead_follow_up",
  quote_no_response: "quote_follow_up",
});

/**
 * Are follow-up TEXTS on for this company?
 *
 * ── OFF unless the company said yes, and why that is the opposite call ────
 *
 * documentTextOn() next door defaults ON, and says why: off-by-default meant
 * no booking in FieldQuo ever texted, because nobody found the switch. The
 * reasoning does not carry here, and the difference is who asked for the
 * text. A document text goes out because somebody pressed Send on a quote
 * the homeowner is waiting for. A follow-up text goes out because a cron
 * noticed silence — to a person who has not replied, possibly three times
 * over two weeks, at the company's expense per message. That is the contact
 * a consent complaint gets made about, and the absence of a decision is not
 * consent.
 *
 * So this is `=== true`, not `!== false`: an undefined column (a caller who
 * forgot the select, a row read before the column existed) reads as off.
 * Compare documentTextOn, which THROWS on a missing select because reading
 * its column as "off" would silence a text the company wanted. The two lean
 * opposite ways because the cost of being wrong runs opposite ways — and
 * both lean away from texting somebody who did not ask.
 *
 * @param company { followUpSmsOn }
 */
export function followUpTextOn(company) {
  return company?.followUpSmsOn === true;
}

/**
 * May this trigger send by text at all?
 *
 * The same answer triggerMaySms() gives in lib/followUps/triggers.js, derived
 * here from the type map rather than restated — two lists of "which triggers
 * text" is how one of them gains a trigger whose wording does not exist.
 * triggers.js is the copy a screen or a route asks (it imports no SMS code);
 * this is the copy the sender asks.
 */
export function followUpTextType(triggerEvent) {
  return FOLLOW_UP_TEXT_TYPE[triggerEvent] || null;
}

// ── What the cron's response says, and what it does not ───────────────────
//
// Every reason below is a state somebody can act on, which is why none of
// them is swallowed: the cron counts them by reason in its JSON, the way it
// already counts email stop reasons, so "nothing went out" is never reported
// as "nothing was due".
//
// "switched_off" is the one that is NOT a per-entity failure — it is one
// decision the company made, so the cron reports it once per rule rather than
// once per lead. A count of 400 "switched_off" would say nothing except that
// a company has 400 leads.

/** The reasons sendFollowUpText can decline, for the cron's own counters. */
export const FOLLOW_UP_TEXT_REASONS = Object.freeze([
  "ok",
  "no_company",
  "switched_off",
  "no_wording",
  "no_phone",
  "opted_out",
  "no_link",
  "phone_unverified",
  "failed",
]);

/**
 * The first name the greeting uses.
 *
 * Deliberately the same rule as clientFirstName in
 * lib/sms/documentTextRules.js and as buildQuoteEmail's own greeting, by
 * re-export rather than a second implementation: a homeowner who got "Hi Ana"
 * when the quote went out must not get "Hi Ana Cristina Morales" a week
 * later. Change one and you change all of them, which is the point.
 */
export { clientFirstName } from "@/lib/sms/documentTextRules";
