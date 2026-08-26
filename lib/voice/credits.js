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
export async function balanceFor(companyId, prisma = db) {
  if (!companyId) return 0;
  const agg = await prisma.voiceCreditEntry.aggregate({
    where: { companyId },
    _sum: { cents: true },
  });
  return agg._sum.cents ?? 0;
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
      data: { companyId, cents, kind, stripeRef, ref, callId, note },
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
    note: `${FREE_TRIAL_MINUTES} free minutes to try it out`,
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

/** A statement, newest first — the answer to "where did my credit go". */
export async function recentEntries(companyId, take = 50) {
  if (!companyId) return [];
  return db.voiceCreditEntry.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take,
  });
}
