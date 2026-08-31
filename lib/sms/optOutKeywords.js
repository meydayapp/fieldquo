// lib/sms/optOutKeywords.js
//
// Pure: is this inbound SMS body an opt-out or opt-in keyword, and nothing
// else? No database, no Twilio client — so the one rule that matters here
// ("please stop by at 3" is not "STOP") is executable directly, the same
// split lib/reviews/request.js and lib/voice/outbound.js's consentVerdict
// use for their own hard gates.
//
// ══ Exact match, not substring, not word-boundary ══════════════════════════
//
// Twilio's own keyword handling (and every carrier's CTIA-guideline
// implementation) treats the message as an opt-out only when the ENTIRE body
// — after trimming whitespace and a little trailing punctuation — IS the
// keyword. "STOP" opts out. "please stop by at 3" does not, even though the
// word "stop" appears in it: a `\bstop\b` regex would match that sentence too,
// which is exactly the false positive this file exists to refuse. A message
// that is nothing BUT whitespace around the word (" stop ") still opts out,
// because trimming outer whitespace is not the same thing as searching inside
// a sentence.

export const OPT_OUT_KEYWORDS = Object.freeze(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);

// Twilio's own opt-in list also includes YES; deliberately left out here.
// YES is far more likely to mean "confirming an appointment" or "yes I want
// the quote" than "resubscribe me", and a false-positive OPT-IN is a much
// smaller harm than a false-positive OPT-OUT in the other direction — so this
// only recognises the two keywords whose sole common meaning is opting back
// into texts.
export const OPT_IN_KEYWORDS = Object.freeze(["START", "UNSTOP"]);

/**
 * Normalise a message body to the form keyword-matching compares against:
 * trim outer whitespace, strip a SINGLE trailing run of common punctuation
 * (a period, exclamation mark, or question mark — "STOP." and "STOP!" both
 * come from real phones' auto-capitalisation/auto-punctuation), uppercase.
 *
 * Deliberately does NOT strip punctuation from the middle or collapse
 * internal whitespace — "STOP STOP" or "STOP,START" must not accidentally
 * normalise into a single recognised keyword.
 */
export function normalizeSmsBody(body) {
  return String(body ?? "")
    .trim()
    .replace(/[.!?]+$/u, "")
    .toUpperCase();
}

/**
 * Classify an inbound SMS body.
 *
 * @returns "opt_out" | "opt_in" | null
 */
export function classifyInboundSms(body) {
  const normalized = normalizeSmsBody(body);
  if (!normalized) return null;
  if (OPT_OUT_KEYWORDS.includes(normalized)) return "opt_out";
  if (OPT_IN_KEYWORDS.includes(normalized)) return "opt_in";
  return null;
}
