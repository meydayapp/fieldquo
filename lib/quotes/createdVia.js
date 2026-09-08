// lib/quotes/createdVia.js
//
// How a quote came into existence, as one word, written by every creator.
//
// ══ Why this exists ════════════════════════════════════════════════════════
//
// The owner's question was "connect a message from Meta to a quote created —
// by the company, and by the AI agent — link the association for stats". The
// second half of that is unanswerable without this column: a quote row carries
// createdById (WHO), and a user id cannot distinguish a rep who typed the quote
// from a rep whose AI employee typed it for them, because both end up stamped
// with the same person.
//
// ══ The set is the real one, not a plausible one ═══════════════════════════
//
// Every value below has a creation site in this repo that writes it. There is
// no "self_quote" here even though a self-quote form obviously exists: that
// form creates a LeadRequest, never a Quote (app/api/self-quote/route.js calls
// createLead). The quote appears later, when a member converts the lead —
// which is `lead_conversion`, and the enquiry's own origin is on
// LeadRequest.source where it already lived. Inventing a `self_quote` value
// here would put the same fact in two columns and let them disagree.
//
// ══ Not an enum, and what replaces the guarantee ═══════════════════════════
//
// See the column's own comment in prisma/schema.prisma. The guarantee an enum
// would have bought is bought instead by scripts/check-conversation-review.mjs,
// which reads every `quote.create(` call site in the repo and asserts each one
// passes a value from this list.
//
// ══ NULL is a value, and it means "not recorded" ═══════════════════════════
//
// Every quote written before this column existed is null and stays null.
// Back-filling "staff" onto them would be a guess dressed as a record — most
// of them probably were staff-built, and "probably" is not what a column that
// feeds a stats screen may contain. createdViaLabel(null) is the sentence a
// screen prints, and it says the truth.

/**
 * The closed set, in the order a screen should list them: the ways a human
 * makes a quote, then the ways the product makes one, then the ways history
 * gets loaded in.
 */
export const QUOTE_CREATED_VIA = Object.freeze([
  /** A signed-in member built it — POST /api/quotes, or the Good/Better/Best
   *  builder at POST /api/quotes/tier-group. The ordinary case. */
  "staff",
  /** A member converted a LeadRequest — lib/leads/convertLead.js. Where the
   *  enquiry itself came from is LeadRequest.source, reachable through
   *  Quote.lead; this value only says a person turned an enquiry into a quote. */
  "lead_conversion",
  /** The public instant estimator drafted it with nobody signed in —
   *  app/api/instant-quote/[companySlug]/request, through
   *  lib/estimate/createEstimateQuote.js. Lands in draft with needsReview. */
  "instant_quote",
  /** The phone assistant drafted it off a call — lib/estimate/callEstimate.js,
   *  through the same createEstimateDraft. Same function, different caller,
   *  which is exactly why the value is a parameter and not derived inside it. */
  "voice_call",
  /**
   * The AI employee's own tool created it.
   *
   * RESERVED, and nothing in this repo writes it yet — that creator lives in
   * lib/aiEmployee/, being built alongside this. It is listed here so that when
   * it lands there is one spelling of it, and so the stats screen this column
   * exists for can already separate "the agent quoted them" from "a person
   * did" — which is the exact split the owner asked for.
   */
  "ai_employee",
  /** The past-jobs importer back-filled work that was won, done and paid before
   *  this company used FieldQuo — lib/jobs/importPastJob.js. */
  "import",
  /** The paid data-migration service created it on the company's behalf —
   *  lib/migrations/writes.js. See AGENTS.md non-negotiable 3. */
  "migration",
  /** The demo seeder — lib/demo/seedDemo.js. Present so demo rows can be told
   *  apart from real ones in any figure computed off this column. */
  "demo",
]);

const SET = new Set(QUOTE_CREATED_VIA);

/** True for a value this column may hold. Null is NOT valid input to a
 *  creator — it is what an old row already holds — so this returns false. */
export function isCreatedVia(value) {
  return typeof value === "string" && SET.has(value);
}

/**
 * The value a creator writes, refusing anything it doesn't recognise.
 *
 * Throws rather than falling back to "staff". A creator that passes a typo
 * would otherwise file its quotes under "a human typed this", which is the one
 * wrong answer that nobody would ever notice — it looks exactly like the
 * ordinary case.
 */
export function requireCreatedVia(value) {
  if (!isCreatedVia(value)) {
    throw new TypeError(
      `Unknown Quote.createdVia ${JSON.stringify(value)} — add it to QUOTE_CREATED_VIA in lib/quotes/createdVia.js first.`,
    );
  }
  return value;
}

/**
 * The t() key for a value, or the "we don't know" key for null.
 *
 * Two separate keys for null and for an unrecognised string, because they are
 * different facts: null is a quote written before the column existed, and an
 * unrecognised string is a creator this build has never heard of — a newer
 * deploy's value read by an older screen. Collapsing both into "Other" would
 * hide the second, which is the one worth seeing.
 */
export function createdViaLabelKey(value) {
  if (value === null || value === undefined) return "app.quotes.createdVia.notRecorded";
  if (!isCreatedVia(value)) return "app.quotes.createdVia.unknown";
  return `app.quotes.createdVia.${value}`;
}
