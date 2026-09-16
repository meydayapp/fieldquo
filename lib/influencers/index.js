// lib/influencers/index.js
//
// The influencer programme: a customer company whose referral link earns a
// sales commission instead of a free month.
//
// ══ What an influencer IS ══════════════════════════════════════════════════
//
// A company. Not a rep, not a platform user — an ordinary tenant with an
// owner, a trial, a quote pipeline, that happened to sign up through an
// influencer promo link (lib/platform/promoCodes.js) or was converted by a
// superadmin. The owner's words: "the influencer that signs up becomes like
// a sales rep. They get the same trial as a regular company (1 free month),
// but when someone uses their referral link, instead of the influencer
// getting a free month like a regular company, they get one of the
// commission plans I have, with the same rules."
//
// "With the same rules" is the design. The commission engine
// (lib/sales/commission.js) reads SalesAttribution → SalesRep → plan and
// knows nothing about influencers; the weekly payout batch
// (lib/sales/payouts.js) closes every rep's earned entries and knows nothing
// either. So an influencer is given a SalesRep row — kind "influencer",
// Company.influencerRepId pointing at it — and every referral that lands on
// /refer/<code> becomes a SalesAttribution on that row through the SAME
// captureAttributionWithin() the rep signup link uses. No second engine, no
// second set of rules, and nothing here decides an amount.
//
// ══ What a kind "influencer" SalesRep is NOT ═══════════════════════════════
//
// A login. It never has a password, never has an accepted invite, and
// lib/sales/invite.js's canAuthenticate() refuses the kind on top of that.
// The influencer reads their ledger on /app/influencer, through the company
// gate, scoped to their own influencerRepId — never through /sales.
//
// ══ One reward, never both ═════════════════════════════════════════════════
//
// lib/referrals/index.js branches at the two places a referrer would earn:
// applySignupReferral() writes an attribution instead of nothing, and
// grantReferrerCredit() refuses outright when the referrer is an influencer.
// The referee's own month is untouched — the person clicking an influencer's
// link is promised the same thing as anyone clicking any link.
//
// The pure parts are executed by scripts/check-influencer.mjs against a
// scripted client.

import { db } from "@/lib/db";
import { recordError } from "@/lib/platform/errorLog";
import { ensureReferralCode } from "@/lib/referrals";
import { captureAttributionWithin, INFLUENCER_SOURCE } from "@/lib/sales/attribution";
import { codeFromName } from "@/lib/sales/repCode";

/**
 * The vocabulary of SalesRep.kind. "agency" (2026-09-16) is a call-centre
 * account that manages its own reps and is the payee for what they earn —
 * lib/sales/agency.js. It signs in like a rep; an influencer never does.
 */
export const REP_KINDS = Object.freeze(["rep", "influencer", "agency"]);
export const INFLUENCER_KIND = "influencer";

/** The attribution door an influencer referral comes through. */
export { INFLUENCER_SOURCE };

/**
 * Is this company an influencer? Both columns, deliberately — the schema
 * comment on Company.influencerAt says why a date with no ledger is not one.
 */
export function isInfluencer(company) {
  return Boolean(company?.influencerAt && company?.influencerRepId);
}

export function isInfluencerRep(rep) {
  return rep?.kind === INFLUENCER_KIND;
}

/**
 * The SalesRep.code for an influencer's ledger row.
 *
 * Prefixed so it can never be mistaken for a staff rep's /signup?sales=
 * slug: the column is unique across both kinds, and an influencer called
 * "Dan" must not take the code the owner meant to hand a rep called Dan. The
 * influencer's own shareable link is their COMPANY referral code, not this.
 */
export function influencerRepCode(name, attempt = 0) {
  const base = `inf-${codeFromName(name)}`.slice(0, 26);
  return attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Decide, without a database, whether a company can be enrolled.
 *
 * @returns {{ok:true}|{ok:false, reason:string}}
 */
export function decideEnrolment({ company, ownerEmail, plan, emailTakenBy = null }) {
  if (!company?.id) return { ok: false, reason: "unknown_company" };
  if (isInfluencer(company)) return { ok: false, reason: "already_influencer" };
  if (!ownerEmail || typeof ownerEmail !== "string" || !ownerEmail.includes("@")) {
    return { ok: false, reason: "no_owner_email" };
  }
  if (!plan?.id) return { ok: false, reason: "no_plan" };
  if (plan.active === false) return { ok: false, reason: "inactive_plan" };
  // SalesRep.email is unique. A staff rep who is also a customer — or a
  // previous enrolment that was half undone — would collide, and the honest
  // answer is to refuse and log rather than to crash a signup or to quietly
  // take over the rep's ledger.
  if (emailTakenBy) return { ok: false, reason: "email_taken" };
  return { ok: true };
}

/**
 * Enrol a company as an influencer, inside a transaction the caller owns.
 *
 * Creates the ledger row, stamps the company, and mints their referral code
 * if they do not have one yet (so the link on /app/influencer exists the
 * moment they land). Returns `{ ok, reason, rep }`.
 *
 * `engagement` is set to "freelancer" here, explicitly. The schema says the
 * column must never be DEFAULTED, and it is not: an influencer is a freelance
 * affiliate by the terms of the programme — nobody is on FieldQuo's payroll
 * for posting a link — and lib/sales/payoutDetails.js's payoutReadiness()
 * would otherwise hold every influencer payout for a decision the superadmin
 * already made when they minted the code.
 */
export async function enrolInfluencerWithin(tx, { companyId, commissionPlanId }) {
  const company = await tx.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      referralCode: true,
      influencerAt: true,
      influencerRepId: true,
      members: {
        where: { role: "owner" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { user: { select: { email: true, name: true } } },
      },
    },
  });
  const owner = company?.members?.[0]?.user || null;
  const ownerEmail = owner?.email ? owner.email.trim().toLowerCase() : null;
  const plan = commissionPlanId
    ? await tx.salesCommissionPlan.findUnique({
        where: { id: commissionPlanId },
        select: { id: true, active: true },
      })
    : null;
  const existing = ownerEmail
    ? await tx.salesRep.findUnique({ where: { email: ownerEmail }, select: { id: true, kind: true, active: true } })
    : null;
  // A company that was an influencer before and was stopped (unenrolInfluencer
  // below) still owns its old ledger — same email, kind "influencer",
  // inactive. Re-enrolling REACTIVATES that row under the newly chosen plan
  // rather than refusing "email already a rep's login": its paid history is
  // theirs, and a second ledger for one person would split it. A REP's login
  // on that email is still a refusal — a person cannot be both.
  const reactivate = existing && existing.kind === INFLUENCER_KIND ? existing : null;
  const emailTakenBy = existing && !reactivate ? existing : null;

  const verdict = decideEnrolment({ company, ownerEmail, plan, emailTakenBy });
  if (!verdict.ok) return { ...verdict, rep: null, company };
  if (reactivate) {
    const rep = await tx.salesRep.update({
      where: { id: reactivate.id },
      data: { active: true, commissionPlanId: plan.id, name: company.name },
    });
    await tx.company.update({
      where: { id: company.id },
      data: { influencerAt: new Date(), influencerRepId: rep.id },
    });
    await ensureReferralCode(company, tx);
    return { ok: true, reason: null, rep, company, reactivated: true };
  }

  // Pre-checked rather than create-and-catch: a refused INSERT inside a
  // Postgres transaction aborts the whole transaction, so a P2002 here could
  // not be retried without losing every write before it.
  let code = null;
  for (let attempt = 0; attempt < 5 && !code; attempt++) {
    const candidate = influencerRepCode(company.name, attempt);
    const taken = await tx.salesRep.findUnique({ where: { code: candidate }, select: { id: true } });
    if (!taken) code = candidate;
  }
  if (!code) throw new Error("Could not mint a unique influencer ledger code");

  const rep = await tx.salesRep.create({
    data: {
      kind: INFLUENCER_KIND,
      email: ownerEmail,
      name: company.name,
      code,
      active: true,
      commissionPlanId: plan.id,
      engagement: "freelancer",
      accruesPaidLeave: false,
    },
  });
  await tx.company.update({
    where: { id: company.id },
    data: { influencerAt: new Date(), influencerRepId: rep.id },
  });
  await ensureReferralCode(company, tx);

  return { ok: true, reason: null, rep, company };
}

/**
 * The transactional wrapper. Never throws on a refusal: an enrolment that
 * cannot happen is logged to the platform error log with the reason, and the
 * caller (a signup, or a superadmin button) is told why.
 */
export async function enrolInfluencer({ companyId, commissionPlanId, via = "unknown" }) {
  try {
    const out = await db.$transaction((tx) =>
      enrolInfluencerWithin(tx, { companyId, commissionPlanId }),
    );
    if (!out.ok) {
      await recordError({
        area: "influencer",
        code: out.reason,
        companyId,
        message: `Influencer enrolment refused (${via}): ${out.reason}`,
        detail: { commissionPlanId, via },
      });
    }
    return out;
  } catch (err) {
    await recordError({
      area: "influencer",
      code: "enrol_threw",
      companyId,
      message: `Influencer enrolment threw (${via}): ${err?.message}`,
      detail: { commissionPlanId, via },
    });
    return { ok: false, reason: "error", rep: null, company: null };
  }
}

/**
 * Attribute a company that arrived on an influencer's link, inside the
 * caller's transaction.
 *
 * Thin on purpose: the decision — self-dealing, already attributed, inactive
 * ledger — is decideAttribution()'s, and it is the same decision a rep's
 * signup link gets. The only thing this adds is the source.
 */
/**
 * The reverse of enrolment — the owner's "I can manually deactivate it like a
 * sales rep, turning them back to a regular company."
 *
 * In one transaction: Company.influencerAt / influencerRepId are cleared, so
 * from this instant the company is under the ORDINARY referral rules again
 * (lib/referrals grants the referrer month; the attribution branch never
 * fires); the ledger SalesRep row is set inactive — never deleted — so every
 * SalesCommissionEntry already earned stays payable through the normal
 * batch; the referral code is kept, because the link a follower already has
 * must keep working. Attributions already written stay written: money earned
 * before today is still theirs.
 *
 * @returns {{ ok, reason, ledgerId }}
 */
export async function unenrolInfluencerWithin(tx, { companyId }) {
  const company = await tx.company.findUnique({
    where: { id: companyId },
    select: { id: true, influencerAt: true, influencerRepId: true },
  });
  if (!company) return { ok: false, reason: "unknown_company", ledgerId: null };
  if (!isInfluencer(company)) return { ok: false, reason: "not_influencer", ledgerId: null };
  const ledgerId = company.influencerRepId;
  await tx.salesRep.update({ where: { id: ledgerId }, data: { active: false } });
  await tx.company.update({
    where: { id: company.id },
    data: { influencerAt: null, influencerRepId: null },
  });
  return { ok: true, reason: null, ledgerId };
}

export async function unenrolInfluencer({ companyId, via = "unknown" }) {
  try {
    const out = await db.$transaction((tx) => unenrolInfluencerWithin(tx, { companyId }));
    if (!out.ok) {
      await recordError({
        area: "influencer",
        code: out.reason,
        companyId,
        message: `Influencer unenrolment refused (${via}): ${out.reason}`,
        detail: { via },
      });
    }
    return out;
  } catch (err) {
    await recordError({
      area: "influencer",
      code: "unenrol_threw",
      companyId,
      message: `Influencer unenrolment threw (${via}): ${err?.message}`,
      detail: { via },
    });
    return { ok: false, reason: "error", ledgerId: null };
  }
}

export async function attributeInfluencerReferralWithin(tx, { companyId, influencerRepId }) {
  return captureAttributionWithin(tx, {
    companyId,
    salesRepId: influencerRepId,
    source: INFLUENCER_SOURCE,
  });
}

/**
 * Where a referred company is, in one word the influencer can act on.
 *
 * Derived from the subscription row and the onboarding status, both of which
 * the product already uses to decide access (lib/billing/access.js), so this
 * cannot say "paying" about a company the app is locking out. `past_due`
 * reads as paying: the subscription is live and the commission engine's
 * retention clock is still running on it.
 */
export function referredStatus({ onboardingStatus, subscription } = {}) {
  if (onboardingStatus === "churned" || onboardingStatus === "suspended") return "churned";
  const s = subscription?.status || null;
  if (s === "canceled") return "churned";
  if (s === "active" || s === "past_due") return "paying";
  if (s === "trialing") return "trial";
  return "signedUp";
}
