// lib/voice/credits.js
//
// What a call costs the company, and whether they can afford the next one.
//
// ══ Prepaid, not metered billing ═══════════════════════════════════════════
//
// A one-person painting company will not accept a phone bill that can be any
// number. Usage-based Stripe billing is the obvious engineering answer and the
// wrong product answer here: the failure mode is a contractor waking up to a
// $400 charge because a robocaller found their line, and that is a refund, a
// support call and a cancelled subscription.
//
// So: they buy credit, it draws down, and when it runs low we tell them. The
// worst case is the agent stops answering — which is exactly where they were
// before they bought it. Nobody is ever surprised by an invoice.
//
// ══ The balance is a SUM, not a counter ════════════════════════════════════
//
// Every top-up and every call is a row in VoiceCreditEntry, and the balance is
// their sum. A counter column would be one bad write away from disagreeing with
// the calls that moved it, and the first symptom of that is a company being
// told they have no credit when they've just paid.
//
// It also means "where did my credit go" has a real answer, per call, which is
// the first question anyone asks.
import { db } from "@/lib/db";

/**
 * What we charge for talk time, per minute, in cents.
 *
 * ══ Cost ═════════════════════════════════════════════════════════════════
 *
 * Retell advertises $0.07/min, but that is the conversation layer alone. All-in
 * — voice infra + STT/TTS + the LLM + the carrier leg — lands around
 * $0.13–$0.31/min. Budget ~$0.16 for a sensible mid-range setup.
 *
 * ══ What Jobber actually charges ═════════════════════════════════════════
 *
 * They bill CONVERSATIONS, not minutes: $29/mo for 30, then $0.79 for each one
 * after. (Or $99/mo on Grow, or bundled into the $599/mo Plus plan.)
 *
 * Converted to our unit, at a typical 2-minute call:
 *
 *   Jobber overage   $0.79 / conversation  ≈  $0.395 per minute
 *   Jobber base      $29 / 30 conversations ≈  $0.48 per minute
 *   FieldQuo         $0.35 / minute         =  $0.70 per conversation
 *
 * So we undercut their overage by about 11% per conversation, and their entry
 * bundle by a lot more — while charging NO monthly minimum at all. That last
 * part is the real gap: Jobber's floor is $29/month whether you take one call
 * or none, and a one-van painter in February takes almost none.
 *
 * ══ Why 35¢ and not 30¢ ══════════════════════════════════════════════════
 *
 * 30¢ was set before the Jobber numbers were known, against a market read of
 * "$0.25 overage". Jobber's real overage is $0.79 a conversation — materially
 * higher — so 30¢ was leaving money on the table for no competitive gain.
 *
 * 35¢ keeps us visibly cheaper per conversation, holds a ~55% gross margin
 * against a ~$0.16 cost, and covers what the margin actually has to absorb:
 * failed calls nobody pays for, numbers idle in quiet months, and support.
 *
 * Not bundled as "N conversations included". That reads well and then punishes
 * exactly the months a contractor is busiest, which is when the tool is proving
 * its worth.
 */
// Read through a guard rather than trusted. A typo in the Vercel value —
// "0.35", "35c", an empty string that survives the `||` — makes this NaN, and a
// NaN rate does not fail loudly: costForSeconds returns NaN, debitCredit's
// `Number(cents) || 0` turns it into 0, and every call in the system bills
// nothing while the screens keep saying "35¢ a minute". Silent under-charging is
// the exact failure mode this whole file exists to prevent, so an unusable
// override falls back to the code default instead of poisoning the arithmetic.
function rateFromEnv(raw, fallback) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const CENTS_PER_MINUTE = rateFromEnv(process.env.VOICE_CENTS_PER_MINUTE, 35);

/**
 * Number types, and what each really costs.
 *
 * ══ Toll-free is not the same product ════════════════════════════════════
 *
 * It costs more twice over, and the second one is easy to miss:
 *
 *   1. Higher monthly rental (~$5 through Retell vs ~$2 for a local number).
 *   2. Higher PER MINUTE — on a toll-free number the called party pays the
 *      carrier leg, so every inbound minute costs us roughly 1.5¢ more than
 *      the same minute on a local number.
 *
 * A single flat rate charges a toll-free customer the local price and loses a
 * little on every call they take. Nobody notices that from a dashboard; it
 * shows up in a margin report months later, by which point the customers who
 * cost the most are the ones who liked it best.
 *
 * So the type is stored on the number and both the rental and the per-minute
 * rate follow from it.
 */
// ── What a number costs US, as far as Retell publishes it ──────────────────
//
// Retell's public pricing page lists "$2.00/month" for a Retell phone number,
// with no separate local/toll-free split, plus "$10.00/Phone number/month" for
// a VERIFIED number (the anti-spam-flag option):
//
//   https://www.retellai.com/pricing   (checked 25/08/2026)
//
// So the $4 local rental below carries roughly $2 of margin, and the $9
// toll-free rental roughly $7 — IF the number is unverified. A verified number
// costs $10 and is therefore sold at a LOSS at either price. Nothing in the
// product buys verified numbers today, and nothing should start without
// revisiting these figures.
//
// ── $1.15 is a real price, and it is not the one we pay ────────────────────
//
// Twilio's console quotes a Canadian local number at $1.15/month, which invites
// the conclusion that the $4 rental carries $2.85 of margin. It does not, on the
// path this product actually uses. lib/voice/numberSearch.js SEARCHES Twilio's
// inventory, but the purchase is still Retell's `/create-phone-number` — the
// number is bought on RETELL's Twilio account and billed to us at Retell's
// published $2.00, not at Twilio's $1.15. Retail is unchanged at $4, so the
// local rental carries ~$2.00 and the picker changed nothing about that.
//
// The $1.15 is reachable, and deliberately not taken here. It would mean buying
// the number on FieldQuo's OWN Twilio account (the credentials already exist,
// for SMS) and attaching it to Retell over an elastic SIP trunk — which is what
// importNumber() in lib/voice/retell.js already does, and which is wired to
// nothing. That saves about $0.85 per number per month, and costs a trunk to
// run, credentials to store, and a second failure mode on every call. Worth
// doing at volume; it is a product decision, not a refactor, and nobody has
// made it.
//
// Deliberately a comment and not a constant. It is a scraped marketing figure,
// not something any API returns and not something the code can check, so
// putting it in a variable would give it the authority of a measurement — the
// same mistake RETELL_COST_CENTS_PER_MINUTE made for per-minute cost. There is
// no per-number cost endpoint; `/get-concurrency` is the only account-level
// read Retell exposes and it says nothing about money. When a real rental line
// shows up on an invoice, record it the way lib/voice/providerCost.js records
// per-call cost — measured, per row, or not at all.
export const NUMBER_TYPES = {
  local: {
    key: "local",
    label: "Local number",
    hint: "A number in your own area code. What most customers expect to see.",
    monthlyCents: 400,
    perMinuteSurchargeCents: 0,
  },
  toll_free: {
    key: "toll_free",
    label: "Toll-free (800/833/844)",
    hint: "Reads as a bigger operation, and free for your customer to call. Costs more to run.",
    monthlyCents: 900,
    // Covers the carrier leg we pay on inbound toll-free, with a little margin.
    perMinuteSurchargeCents: 5,
  },
};

/** The rate for a call on this kind of number. Always a finite number. */
export function ratePerMinute(numberType = "local") {
  const t = NUMBER_TYPES[numberType] || NUMBER_TYPES.local;
  return CENTS_PER_MINUTE + t.perMinuteSurchargeCents;
}

/** Monthly rental for a number type. */
export function monthlyCentsFor(numberType = "local") {
  return (NUMBER_TYPES[numberType] || NUMBER_TYPES.local).monthlyCents;
}

/**
 * Kept for callers that predate per-type pricing. Local, because that's what
 * an unspecified number is.
 */
export const NUMBER_MONTHLY_CENTS = NUMBER_TYPES.local.monthlyCents;

/**
 * A crew texting line, per month.
 *
 * Deliberately the SAME figure as a local voice number, and deliberately not a
 * second opinion about what a phone number is worth. Underneath, both are one
 * Twilio local number at the same US$1.15 — a crew line simply points its
 * inbound messages at us instead of at Retell. Two prices for one commodity is
 * the kind of thing that drifts apart, and the drift always favours whichever
 * screen nobody looks at.
 *
 * NOT part of NUMBER_TYPES: everything in that map carries a
 * `perMinuteSurchargeCents`, because a voice number's real cost is talk time.
 * A crew line has no minutes. Its usage is priced per MESSAGE, in
 * lib/crew/messaging.js, against this same balance — so a company that texts a
 * lot and one that texts twice pay the same rental and different usage, which
 * is what the two constants are for.
 *
 * One constant, one place to change it.
 */
export const CREW_LINE_MONTHLY_CENTS = NUMBER_TYPES.local.monthlyCents;

/**
 * Free minutes with the first number.
 *
 * Nobody puts a voice in front of their own customers without hearing it answer
 * their line first. Enough for a real trial, small enough that abuse costs ~$5.
 */
export const FREE_TRIAL_MINUTES = Number(process.env.VOICE_FREE_MINUTES || 30);

/**
 * The one ref the free trial is ever written under, per company.
 *
 * The gift is deliberate and it is bounded, and "bounded" has to mean something
 * the database enforces. Guarding it on "this company has no active number" —
 * which is what the buy route effectively did — bounds it to once per NUMBER,
 * not once per company: release the number, buy another, collect another 30
 * minutes. That was unreachable only because no release control had been built
 * yet, and the rent-expiry path below builds one.
 *
 * There is no version suffix on purpose. "voice_trial_v2" would be a second
 * gift to every existing company the day someone typed it.
 */
export const TRIAL_REF = "voice_trial";

/**
 * The ref a top-up is written under, keyed on the Stripe PAYMENT INTENT.
 *
 * Two different things can tell us a top-up was paid — the browser coming back
 * to the success URL, and `checkout.session.completed` arriving at a webhook —
 * and they can arrive in either order, or at the same moment. Keyed on the
 * payment intent rather than the session because the intent is the thing the
 * money is actually attached to: it is what a dispute, a refund and Stripe's own
 * retries all name, so a credit traced back from a chargeback lands on one row.
 *
 * The unique (companyId, ref) index is what makes "exactly once" true. The
 * read-then-write inside addCredit is a fast path in front of it, not the
 * guarantee — two concurrent callers can both pass that read.
 *
 * Falls back to the session id when a session somehow carries no intent, which
 * is still stable per payment and still unique.
 */
export function topupRef(paymentRef) {
  return `voice_topup:${paymentRef}`;
}

/**
 * The same guarantee, for a one-off AI credit top-up — see lib/ai/topup.js.
 *
 * Its own prefix rather than reusing topupRef(): the two are different
 * payments, on different Checkout sessions, landing in different wallets
 * (poolForKind routes "ai_topup" to POOLS.AI and "topup" to POOLS.VOICE), and
 * a shared ref prefix would let a voice top-up and an AI top-up for the same
 * underlying payment intent id collide in the unique (companyId, ref) index —
 * which cannot happen today (they're always different Stripe objects) but
 * there is no reason to leave the two wallets' idempotency keys able to
 * shadow each other.
 */
export function aiTopupRef(paymentRef) {
  return `ai_topup:${paymentRef}`;
}

/**
 * Top-up sizes.
 *
 * Priced in whole dollars and labelled in MINUTES, because minutes are what a
 * contractor is actually buying. "$25" means nothing; "100 calls of about a
 * minute" is a decision someone can make.
 */
export const TOPUP_OPTIONS = [
  { cents: 1000, label: "$10" },
  { cents: 3000, label: "$30", popular: true },
  { cents: 5000, label: "$50" },
  { cents: 10000, label: "$100" },
];

/** Any amount, within reason. The floor covers the card fee; the ceiling stops
 *  a typo becoming a $10,000 charge and a refund request. */
export const CUSTOM_TOPUP_MIN_CENTS = 500;
export const CUSTOM_TOPUP_MAX_CENTS = 100000;

/** A custom top-up amount, clamped and rounded to whole dollars. */
export function normaliseTopup(cents) {
  const n = Math.round(Number(cents) || 0);
  if (!Number.isFinite(n) || n < CUSTOM_TOPUP_MIN_CENTS) return null;
  return Math.min(n, CUSTOM_TOPUP_MAX_CENTS);
}

/**
 * The balances a company may ask us to top up BELOW, in cents.
 *
 * Exactly the three the owner named — $5, $10, $20 — and deliberately a closed
 * list rather than a free number. A threshold is half of a standing instruction
 * to charge a card, and "below $2,000" typed into a box is a mistake that bills
 * somebody every fifteen minutes until they notice. Three choices also make the
 * terms statable: the consent wording quotes the figure, and it can only ever be
 * one of these.
 *
 * Labelled in minutes on screen, the same way TOPUP_OPTIONS is, because minutes
 * are what the contractor is actually deciding about.
 */
export const AUTO_TOPUP_THRESHOLDS = [
  { cents: 500, label: "$5" },
  { cents: 1000, label: "$10" },
  { cents: 2000, label: "$20" },
];

/** One of the three, or null. Null is a refusal, never a default. */
export function normaliseAutoTopupThreshold(cents) {
  const n = Math.round(Number(cents) || 0);
  return AUTO_TOPUP_THRESHOLDS.some((t) => t.cents === n) ? n : null;
}

/**
 * One of the offered top-up sizes, or null.
 *
 * Deliberately NOT normaliseTopup(): that one clamps any figure between $5 and
 * $1,000, which is right for a purchase somebody is standing in front of and
 * wrong for a standing authority. An automatic amount has to be one of the four
 * the terms can name, so the sentence "we will charge $30" is checkable against
 * the row rather than being whatever survived a clamp.
 */
export function normaliseAutoTopupAmount(cents) {
  const n = Math.round(Number(cents) || 0);
  return TOPUP_OPTIONS.some((t) => t.cents === n) ? n : null;
}

/**
 * At most this many automatic top-ups in one UTC day.
 *
 * Three, because three is more than any honest day of calls needs at these
 * sizes and it is a number a contractor can be told. It is the last line rather
 * than the first: the in-flight claim and the idempotency key are what stop a
 * loop, and this is what stops a loop nobody noticed from being unbounded.
 */
export const AUTO_TOPUP_MAX_PER_DAY = 3;

/**
 * And no two closer together than this, in minutes.
 *
 * A successful charge credits the ledger in the same call, so the balance is
 * already back up by the time anything asks again — this brake only matters when
 * something has gone wrong in a way nobody predicted. Fifteen minutes is short
 * enough that a genuinely busy line is not left silent and long enough that a
 * malfunction costs one charge rather than a hundred.
 */
export const AUTO_TOPUP_MIN_GAP_MINUTES = 15;

/**
 * How long an in-flight claim is believed before it is treated as abandoned.
 *
 * A serverless invocation that dies between claiming and clearing would
 * otherwise wedge the feature off for ever. Ten minutes is far longer than any
 * PaymentIntent takes, and reclaiming is safe rather than merely tolerable: the
 * reclaim reuses the SAME chargeAttemptToken, so the Stripe idempotency key is
 * the same key, and Stripe returns the original PaymentIntent instead of
 * charging again.
 */
export const AUTO_TOPUP_STALE_CLAIM_MINUTES = 10;

/**
 * Should this company be charged, right now?
 *
 * Pure — a config row, a balance, a clock. No database, no Stripe. It lives in
 * this file because it compares a balance to a number, and every judgement about
 * a balance lives in credits.js or spendGate.js; check:voice-spend fails the
 * build if a fourth opinion appears elsewhere. It is also the only way the caps
 * get exercised at all, since by definition nobody runs a runaway by hand.
 *
 * @returns { charge: boolean, reason: string, cents?: number }
 *   reason ∈ not_configured | disabled | no_threshold | no_amount | no_mandate
 *          | no_consent | above_threshold | in_flight | too_soon | daily_cap
 *          | daily_amount_cap | over_authorised | ok
 */
export function autoTopupDecision({ config, balanceCents, now = new Date() }) {
  if (!config) return { charge: false, reason: "not_configured" };
  if (!config.enabled) return { charge: false, reason: "disabled" };

  const threshold = normaliseAutoTopupThreshold(config.thresholdCents);
  if (threshold === null) return { charge: false, reason: "no_threshold" };

  const amount = normaliseAutoTopupAmount(config.amountCents);
  if (amount === null) return { charge: false, reason: "no_amount" };

  // The consent and the instrument, both. A row with a saved card and no
  // acceptedAt is a card we may not use; a row with consent and no card is a
  // company that agreed and never finished. Neither is authority to charge.
  if (!config.acceptedAt || !config.termsText) return { charge: false, reason: "no_consent" };
  if (!config.stripeCustomerId || !config.stripePaymentMethodId || !config.paymentMethodType) {
    return { charge: false, reason: "no_mandate" };
  }

  // Never more than the terms said. amountCents is editable on the settings
  // screen and this is not — it is re-stamped only when the box is ticked again
  // — so a write that raised the amount without re-stating the terms is refused
  // here rather than charged.
  const authorised = Math.round(Number(config.authorisedAmountCents) || 0);
  if (!(authorised > 0) || amount > authorised) {
    return { charge: false, reason: "over_authorised" };
  }

  // ── Only now, the balance ────────────────────────────────────────────────
  //
  // Strictly below, so a company sitting exactly ON their threshold is not
  // charged. "Below $10" is what the terms say, and $10.00 is not below $10.
  const cents = Number.isFinite(Number(balanceCents)) ? Math.round(Number(balanceCents)) : null;
  if (cents === null) return { charge: false, reason: "unknown_balance" };
  if (!(cents < threshold)) return { charge: false, reason: "above_threshold" };

  const nowMs = new Date(now).getTime();

  // ── One in flight, and one only ──────────────────────────────────────────
  const claimedAt = config.chargeInFlightAt ? new Date(config.chargeInFlightAt).getTime() : null;
  if (claimedAt !== null) {
    const age = nowMs - claimedAt;
    if (age < AUTO_TOPUP_STALE_CLAIM_MINUTES * 60_000) {
      return { charge: false, reason: "in_flight" };
    }
    // Stale. Reclaimable, and the caller reuses the existing token so a Stripe
    // retry cannot become a second payment.
  }

  const lastAt = config.lastChargeAt ? new Date(config.lastChargeAt).getTime() : null;
  if (lastAt !== null && nowMs - lastAt < AUTO_TOPUP_MIN_GAP_MINUTES * 60_000) {
    return { charge: false, reason: "too_soon" };
  }

  // The same gap after a FAILED attempt, and it is not symmetry for its own
  // sake. A transient failure does not set lastChargeAt — nothing was charged —
  // so without this the next billed call would try again immediately, and a
  // busy afternoon against an unreachable Stripe becomes a request every few
  // seconds. Three of those and the feature switches itself off, but three
  // attempts an hour apart is a blip and three in ten seconds is a hammer.
  const failedAt = config.lastFailureAt ? new Date(config.lastFailureAt).getTime() : null;
  if (failedAt !== null && nowMs - failedAt < AUTO_TOPUP_MIN_GAP_MINUTES * 60_000) {
    return { charge: false, reason: "too_soon" };
  }

  // ── The daily caps ───────────────────────────────────────────────────────
  //
  // Counted against the row's own day key. A row whose key is not today's has
  // a stale counter, and a stale counter is zero — not something to carry over.
  const today = utcDayKey(now);
  const countToday = config.dayKey === today ? Math.max(0, Number(config.chargesToday) || 0) : 0;
  if (countToday >= AUTO_TOPUP_MAX_PER_DAY) {
    return { charge: false, reason: "daily_cap" };
  }

  const spentToday = config.dayKey === today ? Math.max(0, Number(config.spentTodayCents) || 0) : 0;
  const dailyCeiling = Math.round(Number(config.authorisedDailyCents) || 0);
  if (!(dailyCeiling > 0) || spentToday + amount > dailyCeiling) {
    return { charge: false, reason: "daily_amount_cap" };
  }

  return { charge: true, reason: "ok", cents: amount, thresholdCents: threshold, dayKey: today };
}

/** The UTC day a counter belongs to. UTC so the cap cannot reset twice by
 *  moving between a serverless region and a contractor's timezone. */
export function utcDayKey(now = new Date()) {
  return new Date(now).toISOString().slice(0, 10);
}

/** Below this, the UI nags and we email. Roughly ten minutes of calls. */
export const LOW_BALANCE_CENTS = CENTS_PER_MINUTE * 10;

/**
 * "Running low" as a function, not a comparison anyone can retype.
 *
 * The threshold showed up inline in the settings API as well as here, which is
 * how a warning ends up appearing on one screen and not another after somebody
 * changes the number. Every judgement about a balance now lives in this file or
 * in spendGate.js, and check:voice-spend fails if a third place appears.
 */
export function isLowBalance(cents) {
  return (Number(cents) || 0) < LOW_BALANCE_CENTS;
}

/**
 * Has this company been served more minutes than it paid for?
 *
 * A different question from `canTakeCall`, and deliberately its own function
 * rather than an inline `< 0` at the one call site that needs it. It is not an
 * affordability test — the answer is already known by the time it is asked, and
 * nothing is refused on it. It is FieldQuo's loss, surfaced: minutes that were
 * served on the pooled Retell account and that nobody covered.
 *
 * It happens for two reasons the enforcement points cannot close on their own.
 * Concurrent calls each individually respect the ceiling in callCeiling.js and
 * together overshoot the balance; and a stretch during which the webhook was
 * down bills late, all at once, from the reconciler. Named here so the
 * judgement lives with every other judgement about a balance — check:voice-spend
 * fails the build if a second copy appears somewhere else.
 */
export function isOverdrawn(cents) {
  const n = Number(cents);
  return Number.isFinite(n) && n < 0;
}

/** Minutes a balance buys, rounded down — never promise a minute they can't use. */
export function minutesFor(cents, numberType = "local") {
  const rate = ratePerMinute(numberType);
  if (!(rate > 0)) return 0;
  return Math.floor(Math.max(0, Number(cents) || 0) / rate);
}

/**
 * What a call of this length costs.
 *
 * Rounded UP to the whole minute, the way every phone system has always billed,
 * and with a floor of one minute so a 3-second wrong number still covers the
 * connection. Both of those are stated on the pricing screen — a rounding rule
 * nobody was told about is the same as a hidden fee.
 *
 * ── Non-finite input is a REFUSAL, not a big number ───────────────────────
 *
 * `Number(x) || 0` handles NaN, null and "" — it does not handle Infinity, and
 * a JSON body containing `1e400` parses to exactly that. The old arithmetic
 * carried it straight through: Math.ceil(Infinity/60) * 35 is Infinity, which
 * debitCredit rounds to Infinity, which Prisma then tries to write into an Int
 * column. Best case a 500; worst case an invented charge of unbounded size on a
 * contractor's prepaid balance.
 *
 * A duration we cannot make sense of is not a long call. It is an unknown, and
 * the rule for an unknown duration is that nobody is billed for it — see
 * lib/voice/reconcileCalls.js, which flags the call for a human instead. Zero
 * here means "this produced no charge", and the caller decides whether that is
 * because the call was empty or because the number was nonsense.
 */
export function costForSeconds(seconds, numberType = "local") {
  const raw = Number(seconds);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const rate = ratePerMinute(numberType);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return Math.max(1, Math.ceil(raw / 60)) * rate;
}

/**
 * The company's balance in cents. Always a number, never null.
 *
 * ── The `prisma` argument ──────────────────────────────────────────────────
 *
 * An injection seam, same as settleBookingFee's. Every function below that
 * MOVES MONEY takes it, and every production caller omits it and gets the real
 * client. It exists so scripts/check-voice-metering.mjs can execute the real
 * ledger — the actual idempotency branches, the actual rounding — against an
 * in-memory Prisma instead of asserting on a copy of the logic. A copy is the
 * version that rots, and this is the one file where a copy that rots means
 * somebody is charged twice.
 */

// ═══════════════════════════════════════════════════════════════════════════
// Two wallets
// ═══════════════════════════════════════════════════════════════════════════
//
// ══ Because Retell and OpenAI do not charge alike ══════════════════════════
//
//   voice  per MINUTE of talk time, plus a number rental that arrives every
//          month whether the phone rings or not. Crew texting joins it: a
//          carrier fee per message, on a line that also rents monthly. The bill
//          has a FLOOR you cannot get under while you hold the line.
//   ai     per TOKEN — and for pictures per image-token, which moves with
//          resolution and quality. Nothing recurs. Generate nothing in March
//          and March costs nothing.
//
// One balance put that recurring floor underneath a usage-only product. A
// contractor who topped up to make adverts would watch the credit drain into a
// rental for a receptionist they never wanted, and every line of the statement
// would be accurate while the product was wrong.
//
// The two are also wanted by different people. Somebody who wants AI adverts
// and photo review very often does not want a robot answering their phone.
//
// ══ Derived from the kind, never passed in ═════════════════════════════════
//
// The obvious design is a `pool` argument. It is the wrong one: an argument can
// be forgotten, and a forgotten argument here means an image quietly billed to
// the phone balance — money moving between wallets with nobody's fingerprints
// on it. So the pool is a pure function of what was bought, and no caller may
// state it. Adding a spend kind means adding it here, which is the point.
export const POOLS = { VOICE: "voice", AI: "ai" };

const AI_KINDS = new Set([
  "image_generation",
  "image_vision",
  // A top-up and a refund have to name their wallet too, or money crosses
  // between them at exactly the moments money moves.
  "ai_topup",
  "ai_adjustment",
  "ai_bundle",
  // The one-time demo grant — see grantDemoAiCredit below. Its own kind
  // rather than reusing "ai_bundle" or "ai_topup": neither is true. Nobody
  // paid for it and it isn't a subscription, and a statement line that says
  // "AI credit top-up" over money nobody spent would read as a real charge to
  // whoever eventually audits a demo account's ledger.
  "ai_demo_grant",
  // A top-up a rep performed DURING a demo. Distinct from "ai_demo_grant"
  // (one-off, fixed ref, granted by the seeder) because a rep may top up more
  // than once while showing the flow, and distinct from "ai_topup" because
  // nobody paid. See creditDemoTopup below.
  "ai_demo_topup",
]);

/** Which wallet does this kind belong to? Total: an unknown kind is voice. */
export function poolForKind(kind) {
  return AI_KINDS.has(String(kind || "")) ? POOLS.AI : POOLS.VOICE;
}

export async function balanceFor(companyId, prisma = db, pool = POOLS.VOICE) {
  if (!companyId) return 0;
  const agg = await prisma.voiceCreditEntry.aggregate({
    // Scoped to one wallet. The default is voice, so every caller written
    // before there were two keeps answering the question it was asking — and
    // every one of them is a phone or crew question, checked at the time.
    where: { companyId, pool },
    _sum: { cents: true },
  });
  return agg._sum.cents ?? 0;
}

/** The AI wallet — pictures and photo review. */
export function aiBalanceFor(companyId, prisma = db) {
  return balanceFor(companyId, prisma, POOLS.AI);
}

/**
 * Can the agent take another call?
 *
 * Checked BEFORE answering, not after. Answering a call the company can't pay
 * for means either eating the cost or cutting someone off mid-sentence, and
 * cutting off a potential customer is the worse of the two by a distance.
 *
 * The threshold is one minute rather than zero: starting a call with 4 cents of
 * credit guarantees the cut-off we just said we won't do.
 *
 * `numberType` is optional and defaults to local, because the two callers that
 * predate it (provision.js, outboundCall.js) pass a company id alone. Passing it
 * matters on toll-free: the one-minute floor there is 40¢, and checking against
 * the 35¢ local rate lets a call start that ends 5¢ in the red.
 */
export async function canTakeCall(companyId, numberType = "local", prisma = db) {
  const cents = await balanceFor(companyId, prisma);
  const rate = ratePerMinute(numberType);
  return {
    allowed: cents >= rate,
    cents,
    minutes: minutesFor(cents, numberType),
    low: isLowBalance(cents),
  };
}

/**
 * Add credit. Positive cents only.
 *
 * `stripeRef` is required for a top-up so a disputed charge can be traced to
 * the credit it bought. An adjustment (a refund, a goodwill credit) carries a
 * note instead, because someone will have to explain it later.
 *
 * `ref` is the stronger guarantee: a unique index on (companyId, ref) means the
 * DATABASE refuses a second row, rather than a read-then-write that two
 * concurrent callers can both walk through. The free-trial grant uses it, and
 * that one has to hold forever rather than for the length of one request.
 */
export async function addCredit({ companyId, cents, kind = "topup", stripeRef, ref, note, prisma = db }) {
  const amount = Math.round(Number(cents) || 0);
  if (!companyId || !Number.isFinite(amount) || amount <= 0) return null;

  // Idempotent on the Stripe reference. Webhooks retry, and a retried
  // checkout.session.completed must not double the credit.
  if (stripeRef) {
    const existing = await prisma.voiceCreditEntry.findFirst({
      where: { companyId, stripeRef },
      select: { id: true },
    });
    if (existing) return existing;
  }

  return writeEntry({ companyId, cents: amount, kind, stripeRef, ref, note, prisma });
}

/**
 * Take money OFF the balance. Positive `cents` in, negative row out.
 *
 * The single writer for every kind of spend — talk time, the up-front month on a
 * new number, and each month after. One writer because the two rules that make
 * the ledger trustworthy (spend is always negative, and a spend with a ref
 * happens exactly once) have to hold for all of them, and the way they stop
 * holding is a second copy that forgot one.
 *
 * Does NOT check the balance. Affording it is the gate's job — see
 * lib/voice/spendGate.js — and conflating "may they" with "record it" would mean
 * the webhook, which bills a call that already happened and cannot be un-taken,
 * had to route around the check.
 */
export async function debitCredit({ companyId, cents, kind, ref, callId, note, prisma = db }) {
  const amount = Math.round(Number(cents) || 0);
  // `Number.isFinite` and not just `> 0`: Math.round(Infinity) is Infinity,
  // which passes `amount <= 0` and then goes to Postgres as the value of an Int
  // column. costForSeconds already refuses non-finite input, but this is the
  // single writer for every kind of spend and it must not depend on its callers
  // having been careful.
  if (!companyId || !kind || !Number.isFinite(amount) || amount <= 0) return null;

  // Legacy key. Call rows written before `ref` existed carry callId alone, so a
  // re-delivered webhook for one of those still has to find its own row.
  if (callId) {
    const existing = await prisma.voiceCreditEntry.findFirst({
      where: { companyId, callId, kind },
      select: { id: true },
    });
    if (existing) return existing;
  }

  return writeEntry({ companyId, cents: -amount, kind, ref, callId, note, prisma });
}

/**
 * The create, with the unique-ref collision treated as success.
 *
 * P2002 here means somebody else already wrote this exact entry — a cron that
 * overlapped itself, a webhook delivered twice. That is the outcome we wanted,
 * so it returns the row that won rather than throwing at a caller who would only
 * swallow it anyway.
 */
async function writeEntry({ companyId, cents, kind, stripeRef, ref, callId, note, prisma = db }) {
  try {
    return await prisma.voiceCreditEntry.create({
      // `pool` is derived here and nowhere else. Every row in the ledger passes
      // through this function, so a wallet cannot be chosen by a caller — and
      // therefore cannot be chosen wrongly by a caller who forgot.
      data: { companyId, cents, kind, pool: poolForKind(kind), stripeRef, ref, callId, note },
    });
  } catch (err) {
    if (ref && err?.code === "P2002") {
      return prisma.voiceCreditEntry.findFirst({ where: { companyId, ref } });
    }
    throw err;
  }
}

/**
 * Charge for a call. Idempotent on the call id.
 *
 * A provider webhook can arrive twice — `call_ended` and `call_analyzed` both
 * carry a duration — and charging twice for one call is the kind of billing bug
 * that costs the trust, not the money.
 */
export async function chargeCall({ companyId, callId, seconds, numberType, note, prisma = db }) {
  // numberType is what makes toll-free bill at the toll-free rate. Without it
  // every call charged the local price, which is the exact leak NUMBER_TYPES
  // exists to close — and one that only shows up in a margin report.
  const cents = costForSeconds(seconds, numberType);
  if (!companyId || !callId || cents <= 0) return null;

  return debitCredit({
    companyId,
    cents,
    prisma,
    kind: "call",
    // Both keys. `callId` is what rows written before refs existed match on;
    // `ref` is what the unique index enforces for everything written from here.
    callId,
    ref: `call:${callId}`,
    // The rate is recorded in the note, not just the total. "3 min" alone
    // can't be checked against a price that may have changed since.
    note:
      note ||
      `${Math.ceil((Number(seconds) || 0) / 60)} min @ ${ratePerMinute(numberType)}¢`,
  });
}

/**
 * The free minutes that come with a company's first number.
 *
 * FieldQuo choosing to spend, which is fine — nobody puts a voice in front of
 * their own customers without hearing it answer their line first. What makes it
 * a gift rather than a hole is that it lands exactly once per company: the
 * unique (companyId, ref) index refuses the second one outright, so releasing a
 * number and buying another grants nothing.
 *
 * Priced at the rate of the number they actually bought, so 30 minutes means 30
 * minutes on a toll-free line too rather than 26.
 *
 * @returns the entry — the fresh one, or the one already there.
 */
export async function grantFreeTrial({ companyId, numberType = "local" }) {
  if (!companyId || !(FREE_TRIAL_MINUTES > 0)) return null;
  return addCredit({
    companyId,
    cents: FREE_TRIAL_MINUTES * ratePerMinute(numberType),
    kind: "trial",
    ref: TRIAL_REF,
    // ── Credit, not minutes ────────────────────────────────────────────
    //
    // Said as MONEY on the statement, because money is what it is and money is
    // what the rentals take out of it. The grant is FREE_TRIAL_MINUTES priced
    // at the per-minute rate — about $10.50 today — and a local number takes $4
    // of that the moment it is bought, a crew line another $4. Telling somebody
    // they have "30 free minutes" and then charging $8 of rentals against it
    // leaves them holding $2.50 and wondering where their minutes went.
    //
    // The constant keeps its name because that IS how the figure is derived.
    // What changes is what a human is told.
    note: `$${(FREE_TRIAL_MINUTES * ratePerMinute(numberType) / 100).toFixed(2)} of credit to get started`,
  });
}

/** Has this company already had its one free trial? */
export async function trialGranted(companyId) {
  if (!companyId) return false;
  const row = await db.voiceCreditEntry.findFirst({
    where: { companyId, ref: TRIAL_REF },
    select: { id: true },
  });
  return Boolean(row);
}

/**
 * One-time AI credit for a sales demo — the same shape as grantFreeTrial
 * immediately above, one wallet over.
 *
 * ══ 1,000 credits, owner-approved ═══════════════════════════════════════════
 *
 * At COST_PER_CREDIT_DOLLARS ($0.005 — lib/ai/imageEconomics.js), 1,000
 * credits cost FieldQuo $5 per demo, $50 across the ten demo companies that
 * exist today. Buys roughly 83 generated images (12 credits each) or 40 deep
 * photo reads (25 credits each) — enough to run a real sales call without a
 * paywall in the way. Not derived from BUNDLES or from a margin: this is
 * FieldQuo spending on a demo, not a product a demo company bought, so there
 * is no margin to protect and no reason the figure should move when a bundle
 * price does.
 *
 * ══ A grant, never a bypass — three reasons ══════════════════════════════
 *
 * The obvious shortcut is an `isDemo` branch inside checkSpend/reserveSpend so
 * a demo account never gets refused. That is deliberately NOT what this is:
 *
 *   1. OpenAI charges FieldQuo per call whether or not the company is a demo.
 *      A bypass is an unbounded bill; a grant is $5, once, forever capped at
 *      whatever 1,000 credits buys.
 *   2. A second code path through the spend gate is one more place the two
 *      rules that make the ledger trustworthy — spend is always negative, and
 *      a spend with a ref happens exactly once — would have to be
 *      re-verified, and it is the path nobody watches, which is how it rots.
 *      lib/voice/spendGate.js's checkSpend/reserveSpend/priceSpend and
 *      lib/features/gate.js's featureAllowsSpend stay exactly the single path
 *      they already are; check:ai-credit asserts none of them mentions
 *      `isDemo` at all.
 *   3. A prospect on a sales call is looking at the real balance and the real
 *      price UI, because that IS the thing being sold. Hiding it behind a
 *      bypass makes a demo company's first genuine invoice — if it is ever
 *      converted from a sandbox to a real tenant — the first time anyone sees
 *      what image generation actually costs, which is the opposite of what a
 *      demo is for.
 *
 * ══ Exactly once, the same way the trial is ═══════════════════════════════
 *
 * DEMO_AI_CREDIT_REF has no version suffix, on purpose, for the identical
 * reason TRIAL_REF has none: "ai_demo_credit_v2" would be a second grant to
 * every demo company the day someone typed it. The unique (companyId, ref)
 * index is what makes "exactly once" true regardless of how many times
 * applyIndustry() re-dresses or resets the account — see lib/demo/seedDemo.js,
 * which calls this on every pass rather than trying to track "have we granted
 * this one yet" itself.
 *
 * Callers must check `company.isDemo` themselves before calling this — same
 * division of labour as grantFreeTrial, which does not re-verify a number was
 * actually bought. This function's OWN safety is the ref, not a re-read of
 * the company; a real tenant should never be able to reach this call at all.
 */
export const DEMO_AI_CREDIT_CENTS = 1000;
export const DEMO_AI_CREDIT_REF = "ai_demo_credit";

export async function grantDemoAiCredit(companyId, prisma = db) {
  if (!companyId) return null;
  return addCredit({
    companyId,
    cents: DEMO_AI_CREDIT_CENTS,
    kind: "ai_demo_grant",
    ref: DEMO_AI_CREDIT_REF,
    note: `${DEMO_AI_CREDIT_CENTS.toLocaleString()} AI credits for the sales demo`,
    prisma,
  });
}

/**
 * Credit a top-up a rep SIMULATED during a sales demo. No money changed hands.
 *
 * ── Why not just reuse the real top-up path with a fake Stripe session ──────
 *
 * Because settleTopupPayment's whole contract is "a payment cleared, turn it
 * into credit", and its idempotency keys off a real Stripe id. Handing it an
 * invented one would put a lie in the function that has to be readable when
 * somebody is looking at a chargeback — the exact thing lib/voice/topup.js's
 * header says it refused to do when it declined to dress a PaymentIntent up as
 * a Checkout Session.
 *
 * ── Why the ref is unique per call, when the demo AI grant's is fixed ───────
 *
 * grantDemoAiCredit uses a fixed ref because it must land exactly once no
 * matter how many times the account is re-dressed. This is the opposite: a rep
 * demonstrating the top-up screen may run it three times in one walkthrough,
 * and each is a separate thing that happened. Uniqueness comes from the
 * timestamp; there is no external event to replay, so there is nothing to be
 * idempotent AGAINST.
 *
 * The caller checks isDemo. This function's own safety is that its `kind`
 * names it as simulated in the ledger, so a statement for a demo account can
 * never be mistaken for one where money moved.
 */
export async function creditDemoTopup({ companyId, cents, pool = POOLS.VOICE, prisma = db }) {
  if (!companyId) return null;
  const amount = Math.max(0, Math.round(Number(cents) || 0));
  if (!amount) return null;
  const ai = pool === POOLS.AI;
  return addCredit({
    companyId,
    cents: amount,
    kind: ai ? "ai_demo_topup" : "demo_topup",
    ref: `demo_topup_${ai ? "ai" : "voice"}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    note: `Simulated top-up for the sales demo — no payment was taken`,
    prisma,
  });
}

/** Has this demo already had its one AI credit grant? */
export async function demoAiCreditGranted(companyId) {
  if (!companyId) return false;
  const row = await db.voiceCreditEntry.findFirst({
    where: { companyId, ref: DEMO_AI_CREDIT_REF },
    select: { id: true },
  });
  return Boolean(row);
}

/**
 * A statement, newest first — the answer to "where did my credit go".
 *
 * `pool` is optional and filters to one wallet — the unified AI-credit view
 * (app/api/settings/ai/credit/route.js) needs the AI statement without the
 * voice one interleaved, the same way the voice settings screen has only ever
 * wanted its own. Omitted, this returns exactly what it always has: every
 * row, both wallets, oldest callers unaffected.
 */
export async function recentEntries(companyId, take = 50, pool = undefined) {
  if (!companyId) return [];
  return db.voiceCreditEntry.findMany({
    where: { companyId, ...(pool ? { pool } : {}) },
    orderBy: { createdAt: "desc" },
    take,
  });
}
