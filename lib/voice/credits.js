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
 * What we charge, per minute, in cents.
 *
 * ══ Where 30¢ comes from ═════════════════════════════════════════════════
 *
 * COST. Retell advertises $0.07/min, but that's the conversation layer alone.
 * Real all-in cost is voice infra + STT/TTS + the LLM + telephony, which lands
 * at roughly $0.13–$0.31/min depending on the model and voice. Budget $0.15–0.18
 * for a sensible mid-range setup, plus about $2/month per number.
 *
 * MARKET, at the time this was set:
 *   Rosie          $49/mo for 250 min (~$0.196/min effective), $0.25/min overage
 *   Goodcall       from $79/mo
 *   Sameday        from $449/mo — trades-specific
 *   Jobber         $450–600/mo for its AI receptionist
 *   Generic SMB    $0.05–$0.30/min, or $0.75–$2.40 per call
 *
 * So 30¢ sits at the top of the per-minute band and an order of magnitude below
 * what the trades-specific platforms charge. That is the position to take: a
 * one-van painter is not paying Jobber $450 a month, and undercutting to 15¢
 * would leave almost no margin against a $0.15 cost while signalling that the
 * feature is cheap.
 *
 * MARGIN. At $0.15 cost, 30¢ is a ~50% gross margin — enough to cover the
 * support load, the failed calls nobody pays for, and the number rental on
 * accounts that barely use it.
 *
 * Not bundled into the subscription on purpose. "250 minutes included" reads
 * well and then punishes exactly the months a contractor is busiest, which is
 * when the tool is proving its worth. Prepaid credit has no cliff.
 *
 * Overridable per deployment — the owner may want a different margin, and this
 * number should be changeable without a code review.
 */
export const CENTS_PER_MINUTE = Number(process.env.VOICE_CENTS_PER_MINUTE || 30);

/**
 * Monthly rental for a number we bought for them.
 *
 * Costs about $2. Charged at $4 — a modest markup covering the number sitting
 * idle in months with no calls, which is most months for a small contractor.
 *
 * Billed on the SUBSCRIPTION, not drawn from credits. A rental silently eating
 * call credit is the thing that makes a balance stop making sense: "credits =
 * talk time" is the whole readability win, and a fixed monthly charge and a
 * variable usage charge are different products that deserve different
 * mechanisms.
 */
export const NUMBER_MONTHLY_CENTS = Number(process.env.VOICE_NUMBER_MONTHLY_CENTS || 400);

/**
 * Free minutes with the first number.
 *
 * Nobody buys a voice worth putting in front of their customers without hearing
 * it first, and a demo recording isn't the same as hearing it answer their own
 * line. Enough for a real trial, small enough that abuse costs us ~$4.
 */
export const FREE_TRIAL_MINUTES = Number(process.env.VOICE_FREE_MINUTES || 30);

/**
 * Top-up sizes.
 *
 * Priced in whole dollars and labelled in MINUTES, because minutes are what a
 * contractor is actually buying. "$25" means nothing; "100 calls of about a
 * minute" is a decision someone can make.
 */
export const TOPUP_OPTIONS = [
  { cents: 2500, label: "$25" },
  { cents: 5000, label: "$50", popular: true },
  { cents: 10000, label: "$100" },
  { cents: 25000, label: "$250" },
];

/** Below this, the UI nags and we email. Roughly ten minutes of calls. */
export const LOW_BALANCE_CENTS = CENTS_PER_MINUTE * 10;

/** Minutes a balance buys, rounded down — never promise a minute they can't use. */
export function minutesFor(cents) {
  if (!(CENTS_PER_MINUTE > 0)) return 0;
  return Math.floor(Math.max(0, Number(cents) || 0) / CENTS_PER_MINUTE);
}

/**
 * What a call of this length costs.
 *
 * Rounded UP to the whole minute, the way every phone system has always billed,
 * and with a floor of one minute so a 3-second wrong number still covers the
 * connection. Both of those are stated on the pricing screen — a rounding rule
 * nobody was told about is the same as a hidden fee.
 */
export function costForSeconds(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  if (s === 0) return 0;
  return Math.max(1, Math.ceil(s / 60)) * CENTS_PER_MINUTE;
}

/** The company's balance in cents. Always a number, never null. */
export async function balanceFor(companyId) {
  if (!companyId) return 0;
  const agg = await db.voiceCreditEntry.aggregate({
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
 */
export async function canTakeCall(companyId) {
  const cents = await balanceFor(companyId);
  return {
    allowed: cents >= CENTS_PER_MINUTE,
    cents,
    minutes: minutesFor(cents),
    low: cents < LOW_BALANCE_CENTS,
  };
}

/**
 * Add credit. Positive cents only.
 *
 * `stripeRef` is required for a top-up so a disputed charge can be traced to
 * the credit it bought. An adjustment (a refund, a goodwill credit) carries a
 * note instead, because someone will have to explain it later.
 */
export async function addCredit({ companyId, cents, kind = "topup", stripeRef, note }) {
  const amount = Math.round(Number(cents) || 0);
  if (!companyId || amount <= 0) return null;

  // Idempotent on the Stripe reference. Webhooks retry, and a retried
  // checkout.session.completed must not double the credit.
  if (stripeRef) {
    const existing = await db.voiceCreditEntry.findFirst({
      where: { companyId, stripeRef },
      select: { id: true },
    });
    if (existing) return existing;
  }

  return db.voiceCreditEntry.create({
    data: { companyId, cents: amount, kind, stripeRef, note },
  });
}

/**
 * Charge for a call. Idempotent on the call id.
 *
 * A provider webhook can arrive twice — `call_ended` and `call_analyzed` both
 * carry a duration — and charging twice for one call is the kind of billing bug
 * that costs the trust, not the money.
 */
export async function chargeCall({ companyId, callId, seconds, note }) {
  const cents = costForSeconds(seconds);
  if (!companyId || !callId || cents <= 0) return null;

  const existing = await db.voiceCreditEntry.findFirst({
    where: { companyId, callId, kind: "call" },
    select: { id: true },
  });
  if (existing) return existing;

  return db.voiceCreditEntry.create({
    data: {
      companyId,
      // Negative: spend. One table for both directions so the balance is an
      // auditable sum rather than two counters that can disagree.
      cents: -cents,
      kind: "call",
      callId,
      note: note || `${Math.ceil((Number(seconds) || 0) / 60)} min`,
    },
  });
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
