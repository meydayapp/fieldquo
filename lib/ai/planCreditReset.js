// lib/ai/planCreditReset.js
//
// AI credit plan credit RESETS every month; top-ups persist until used.
//
// ══ The owner's rule, 2026-10-04 ════════════════════════════════════════════
//
// "AI credit plans: monthly credits reset each month and do not roll over;
// when a company hits its monthly limit it can top up." Top-ups are separate:
// they persist until used (the recommendation he was given, adopted here and
// stated on the screen before anyone pays). This reverses the rollover the
// plans were first built with (the AiCreditBundle model comment) — there were
// no plan subscribers on 2026-10-04, so nobody was sold the old promise.
//
// ══ How a reset is written when the balance is a SUM ════════════════════════
//
// lib/voice/credits.js keeps one ledger whose balance is the sum of its rows,
// and that stays true. Two facts make a reset expressible on it:
//
//   1. A plan's monthly grant carries `expiresAt` — the end of the period the
//      invoice paid for (VoiceCreditEntry.expiresAt). Nothing else does.
//   2. DRAW ORDER: spending takes plan credit first, top-ups after. It is the
//      only order that makes "top-ups don't expire" mean anything — spend
//      top-ups first and a company that topped up mid-month would watch its
//      top-up vanish while the expiring plan credit sat untouched. So what is
//      left of a grant at the end of its month is
//
//          planLeft = clamp( min( grant − spentInMonth , balanceAtMonthEnd ), 0 )
//
//      spentInMonth = every AI debit dated inside [grant row, expiresAt)
//      (previous resets excluded — they are not spending). The balance cap
//      covers a balance pushed below the grant by something that is not
//      spending in the window (an older overdraw): what is not there cannot
//      expire.
//
// At the end of the month that amount is written as ONE negative row, kind
// "ai_plan_expiry", ref "ai_plan_expiry:<grant id>" — unique per company, so
// the renewal webhook and the daily sweep racing each other expire it once.
// A month fully spent writes nothing; nothing is ever taken from a top-up.
//
// ══ When it runs ════════════════════════════════════════════════════════════
//
//   · at renewal, inside grantAiBundlePeriod, BEFORE the new month's credit
//     lands (lib/ai/creditBundle.js) — the usual case;
//   · daily, from /api/cron/ai-plan-reset — for a month that ended with no
//     renewal (the plan was cancelled, or the card failed).
//
// Worked examples (both executed by scripts/check-ai-credit.mjs), Busy plan —
// US$50/month for 7,000 credits, month 1–31 October:
//
//   Quiet month. 4,000 spent, no top-up. Plan left 7,000 − 4,000 = 3,000.
//   1 Nov: −3,000 "reset", then +7,000. Balance 7,000, resets 1 Dec.
//
//   Busy month. 6,500 spent by 20 Oct, a 1,000-credit top-up bought, then
//   1,000 more spent. Spent 7,500 in all: the plan's 7,000 first, then 500 of
//   the top-up. Plan left max(0, 7,000 − 7,500) = 0, so 1 Nov writes no
//   reset; +7,000 lands. Balance 7,500 = 7,000 plan (resets 1 Dec) + 500
//   top-up (never expires).
import { db } from "@/lib/db";
import { debitCredit, POOLS } from "@/lib/voice/credits";

export const PLAN_GRANT_KIND = "ai_bundle";
export const PLAN_EXPIRY_KIND = "ai_plan_expiry";

/** The one ledger ref a grant's reset is written under. */
export function planExpiryRef(grantId) {
  return `${PLAN_EXPIRY_KIND}:${grantId}`;
}

const int = (n) => {
  const x = Math.round(Number(n));
  return Number.isFinite(x) ? x : 0;
};

/**
 * What is left of one plan grant, under plan-first draw order. Pure.
 *
 * @param grantCents     the grant (positive)
 * @param spentCents     AI spending since the grant, as a POSITIVE number
 * @param balanceCents   the AI balance at the moment being asked about
 */
export function planCreditLeft({ grantCents, spentCents, balanceCents }) {
  const grant = Math.max(0, int(grantCents));
  const spent = Math.max(0, int(spentCents));
  const balance = int(balanceCents);
  return Math.max(0, Math.min(grant - spent, balance));
}

/**
 * The AI balance split into plan credit (resets) and top-up credit (does
 * not). Pure. A company with no live grant has no plan part — the whole
 * balance is credit that does not expire.
 */
export function splitAiBalance({ balanceCents, grantCents = 0, spentCents = 0, resetsOn = null }) {
  const balance = int(balanceCents);
  const plan = resetsOn ? planCreditLeft({ grantCents, spentCents, balanceCents: balance }) : 0;
  return {
    balanceCents: balance,
    planCents: plan,
    topupCents: Math.max(0, balance - plan),
    resetsOn: resetsOn ? new Date(resetsOn) : null,
  };
}

/** Sum of AI debits in [from, to), resets excluded, as a positive number. */
async function spentBetween(prisma, companyId, from, to) {
  const agg = await prisma.voiceCreditEntry.aggregate({
    where: {
      companyId,
      pool: POOLS.AI,
      cents: { lt: 0 },
      kind: { not: PLAN_EXPIRY_KIND },
      createdAt: { gte: from, lt: to },
    },
    _sum: { cents: true },
  });
  return -(agg._sum.cents ?? 0);
}

/** The AI balance as it stood just before `at`. */
async function balanceBefore(prisma, companyId, at) {
  const agg = await prisma.voiceCreditEntry.aggregate({
    where: { companyId, pool: POOLS.AI, createdAt: { lt: at } },
    _sum: { cents: true },
  });
  return agg._sum.cents ?? 0;
}

/**
 * Expire what is left of ONE grant whose month has ended. Idempotent on the
 * ledger ref. A grant whose month has not ended is refused, never expired
 * early.
 *
 * @returns {{ expired: number, reason?: string }}
 */
export async function expirePlanGrant(grant, { prisma = db, now = new Date(), debit = debitCredit } = {}) {
  if (!grant?.id || grant.kind !== PLAN_GRANT_KIND || !grant.expiresAt) return { expired: 0, reason: "not_a_plan_grant" };
  const end = new Date(grant.expiresAt);
  if (!(end <= now)) return { expired: 0, reason: "month_not_over" };

  const already = await prisma.voiceCreditEntry.findFirst({
    where: { companyId: grant.companyId, ref: planExpiryRef(grant.id) },
    select: { id: true, cents: true },
  });
  if (already) return { expired: 0, reason: "already_reset" };

  const from = new Date(grant.createdAt);
  const [spent, balance] = await Promise.all([
    spentBetween(prisma, grant.companyId, from, end),
    balanceBefore(prisma, grant.companyId, end),
  ]);
  const left = planCreditLeft({ grantCents: grant.cents, spentCents: spent, balanceCents: balance });
  if (left <= 0) return { expired: 0, reason: "month_fully_spent" };

  await debit({
    companyId: grant.companyId,
    cents: left,
    kind: PLAN_EXPIRY_KIND,
    ref: planExpiryRef(grant.id),
    note: `AI credit plan — unused ${left.toLocaleString()} of this month's ${int(grant.cents).toLocaleString()} credits reset on ${end.toISOString().slice(0, 10)} (plan credit doesn't roll over; top-ups do)`,
    prisma,
  });
  return { expired: left };
}

/**
 * Expire every ended plan month — one company's (at renewal) or everyone's
 * (the daily sweep). Looks back `lookbackDays` only: a month that ended
 * longer ago than that was already reset by a run that has since happened,
 * and re-reading every historical grant every night would be the slow scan
 * the expiresAt index exists to avoid.
 */
export async function expireDuePlanCredit({ companyId = null, prisma = db, now = new Date(), lookbackDays = 40, debit = debitCredit } = {}) {
  const since = new Date(now.getTime() - lookbackDays * 86400000);
  const grants = await prisma.voiceCreditEntry.findMany({
    where: {
      kind: PLAN_GRANT_KIND,
      expiresAt: { lte: now, gte: since },
      ...(companyId ? { companyId } : {}),
    },
    orderBy: { expiresAt: "asc" },
    take: 500,
  });
  let expired = 0;
  let companies = 0;
  for (const grant of grants) {
    const r = await expirePlanGrant(grant, { prisma, now, debit });
    if (r.expired > 0) {
      expired += r.expired;
      companies += 1;
    }
  }
  return { grants: grants.length, reset: companies, expiredCents: expired };
}

/**
 * The split the AI credit screen shows: plan credit left and when it resets,
 * and top-up credit that never expires. Reads the company's live grant —
 * the newest plan grant whose month has not ended.
 */
export async function aiPlanCreditStatus(companyId, { prisma = db, now = new Date(), balanceCents = null } = {}) {
  if (!companyId) return null;
  const [grant, balance] = await Promise.all([
    prisma.voiceCreditEntry.findFirst({
      where: { companyId, kind: PLAN_GRANT_KIND, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
    }),
    balanceCents === null
      ? prisma.voiceCreditEntry
          .aggregate({ where: { companyId, pool: POOLS.AI }, _sum: { cents: true } })
          .then((a) => a._sum.cents ?? 0)
      : Promise.resolve(balanceCents),
  ]);
  if (!grant) return splitAiBalance({ balanceCents: balance });
  const spent = await spentBetween(prisma, companyId, new Date(grant.createdAt), now);
  return splitAiBalance({ balanceCents: balance, grantCents: grant.cents, spentCents: spent, resetsOn: grant.expiresAt });
}
