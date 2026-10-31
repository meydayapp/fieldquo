// lib/attribution/contactPatterns.js
//
// The patterns that find a person inside free text, defined once.
//
// ══ Why one file, when only two callers exist ══════════════════════════════
//
// The two callers do OPPOSITE things with the same patterns, and that is
// precisely why they must not each own a copy:
//
//   lib/attribution/loadMonthlyConversations.js  EXTRACTS a phone or an email
//       out of what a homeowner typed, so a conversation can be matched to a
//       client. Meta hands over a display name and nothing else, so without
//       this almost every Facebook conversation is `unmatched` forever.
//
//   lib/ai/conversationReview.js  REMOVES the same things before a transcript
//       is shown to a model.
//
// If the redactor's phone pattern were ever narrower than the extractor's, the
// product would be matching on a number it had convinced itself it had
// redacted. Keeping them the same regex source makes that impossible rather
// than unlikely, and scripts/check-conversation-review.mjs asserts both sides
// against the same five spellings.
//
// ══ Pure, and deliberately not "smart" ═════════════════════════════════════
//
// No library, no locale detection, no phone parser. These run against text a
// stranger typed on a phone, and every clever pattern this repo has tried
// against hostile input has been beaten by an ordinary case — a price with a
// comma in it, a date, a measurement. So each pattern below is narrow, and the
// cost of a miss is the honest one: a conversation stays unmatched, or one
// digit survives redaction inside a fenced block the model is told is data.

/**
 * An email address.
 *
 * Deliberately loose on the local part and strict about needing a dot in the
 * domain: "call me at 3" must not read as an address, and "marie@example.com."
 * at the end of a sentence must not swallow the full stop.
 */
export const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

/**
 * A North American phone number, in the spellings people actually type.
 *
 * Covers all five the check exercises: 613-555-0142, (613) 555-0142,
 * +1 613 555 0142, 6135550142, 1-613-555-0142.
 *
 * The leading country code is optional and, when present, must be followed by
 * a separator or an opening bracket — WITHOUT that rule "$1,6135550142" style
 * runs and long digit strings drag an extra digit in. The trailing boundary is
 * a negative lookahead on a digit rather than \b, because \b is satisfied by
 * the boundary between a digit and a letter and would happily match the first
 * ten digits of a fourteen-digit order number.
 */
export const PHONE_RE =
  /(?<![\d-])(?:(?:\+?1)[\s.-]?)?(?:\((\d{3})\)|(\d{3}))[\s.-]?(\d{3})[\s.-]?(\d{4})(?!\d)/g;

/**
 * A Canadian postal code — A1A 1A1, with or without the space or a hyphen.
 *
 * Distinctive enough to match on its own. A US ZIP deliberately is NOT: five
 * bare digits in a contractor's conversation is far more often a price or a
 * square footage than a postcode, and redacting "12500" out of "we came in at
 * 12500" would destroy the one thing this transcript is being read for. US
 * ZIPs are caught by ADDRESS_RE below, in the context that makes them a
 * postcode rather than a number.
 */
export const POSTCODE_RE = /(?<![A-Za-z0-9])[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d(?![A-Za-z0-9])/g;

/** Street types, English and Québec French, as they get abbreviated in chat. */
const STREET_WORDS =
  "street|st|avenue|ave|av|road|rd|drive|dr|boulevard|blvd|boul|lane|ln|court|ct|crescent|cres|place|pl|terrace|terr|trail|way|circle|cir|highway|hwy|route|rue|chemin|montee|montée|rang";

/** Words that follow a unit number. */
const UNIT_WORDS = "apt|apartment|unit|suite|ste";

/**
 * Case-insensitive for one word, spelled out rather than asked for with the
 * `i` flag.
 *
 * The flag applies to the WHOLE pattern, including `[A-Z]`, which is how the
 * French branch below knows where a street name ends. Under `i`,
 * "59 rue de l'Acropole je serai la" reads the next three words as more of
 * the street name. Measured, not feared: that is what the address on a real
 * Instagram lead looked like.
 */
const ci = (word) =>
  [...word]
    .map((c) => {
      const upper = c.toUpperCase();
      const lower = c.toLowerCase();
      return upper === lower ? c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : `[${upper}${lower}]`;
    })
    .join("");
const anyOf = (list) => list.split("|").map(ci).join("|");

/** Spaces and tabs, never a line break: an address does not span messages. */
const SP = String.raw`[^\S\r\n]`;
const WORD = String.raw`[A-Za-zÀ-ÿ'’.-]+`;
/** "rue DE LA Savane", "boul. Saint-Joseph" — the little words in between. */
const CONNECTOR = `(?:${anyOf("de|du|des|la|le|les|au|aux")}|[dD]['’])`;
/** A street name proper: capitalised, possibly behind an elided article. */
const NAME_WORD = String.raw`(?:[ldLD]['’])?[A-ZÀ-Þ][A-Za-zÀ-ÿ'’-]+`;
/** Two letters or more, so the lone "J" of a postcode is never a city. */
const CITY_WORD = String.raw`[A-Za-zÀ-ÿ'’.-]{2,}`;

/**
 * A street address, in both orders a street type is written.
 *
 * English puts the type last — "12 Elm St". French puts it first — "59 rue de
 * l'Acropole". The pattern used to know only the English order, so every
 * French address was cut at the type and the street name thrown away:
 * "59 rue de", "480 boul.", "25 chemin de". For a contractor in Gatineau that
 * is most of them, and it was silent, because a truncated address still looks
 * like an address on the screen.
 *
 * Anchored on the NUMBER in both branches, so "we did a job on Elm Street last
 * year" (no number, no house) is still left alone: it is a place, not
 * somebody's home, and stripping it would remove context the assessment wants.
 */
export const ADDRESS_RE = new RegExp(
  String.raw`\b\d{1,6}[A-Za-z]?(?:${SP}*-${SP}*\d{1,6})?${SP}+` +
    // French: type, any little words, then the name itself.
    `(?:(?:${anyOf(STREET_WORDS)})\\b\\.?(?:${SP}+${CONNECTOR})*(?:${SP}+${NAME_WORD}){1,3}` +
    // English: up to four name words, then the type.
    `|(?:${WORD}${SP}+){0,4}(?:${anyOf(STREET_WORDS)})\\b\\.?)` +
    `(?:${SP}*,?${SP}*(?:${anyOf(UNIT_WORDS)}|#)${SP}*[A-Za-z0-9-]+)?` +
    `(?:${SP}*,${SP}*${CITY_WORD}(?:${SP}+${CITY_WORD}){0,2})?` +
    `(?:${SP}*,?${SP}*[A-Z]{2}\\b)?` +
    `(?:${SP}+\\d{5}(?:-\\d{4})?\\b)?`,
  "g",
);

/**
 * Every regex above, fresh.
 *
 * A `g` regex carries `lastIndex` between calls, so a module-level constant
 * reused across two `.test()` calls answers false every other time — a bug
 * that looks like flaky redaction and is in fact state. Callers that iterate
 * take a clone from here rather than the shared object.
 */
export function freshPatterns() {
  return {
    email: new RegExp(EMAIL_RE.source, EMAIL_RE.flags),
    phone: new RegExp(PHONE_RE.source, PHONE_RE.flags),
    postcode: new RegExp(POSTCODE_RE.source, POSTCODE_RE.flags),
    address: new RegExp(ADDRESS_RE.source, ADDRESS_RE.flags),
  };
}

/** The first email in a string, or null. */
export function firstEmail(text) {
  const m = String(text ?? "").match(new RegExp(EMAIL_RE.source, ""));
  return m ? m[0] : null;
}

/** The first phone number in a string, or null. */
export function firstPhone(text) {
  const m = String(text ?? "").match(new RegExp(PHONE_RE.source, ""));
  return m ? m[0] : null;
}
