// app/api/settings/subscription/access/route.js
//
// "Is this account in good standing, and if not how long have they got?"
//
// Read-only and deliberately tiny. The banner asks on every page load, so it
// has to be one indexed query and nothing else.
//
// It lives UNDER /api/settings/subscription, which is on the billing allow-list
// in lib/billing/access.js — so a locked-out account can still fetch its own
// status. Without that the banner explaining the lock-out would itself be
// blocked by the lock-out.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { db } from "@/lib/db";
import { accessForCompany, GRACE_DAYS } from "@/lib/billing/access";
import { seesBillingState, isBillingAdmin } from "@/lib/billing/billingAdmin";
import { recommendedTierFor } from "@/lib/billing/recommendedTier";

/** The reasons that describe a free trial — the banner's "Choose a plan" states. */
const TRIAL_REASONS = new Set(["trial_no_plan", "trial_expired", "trial_expired_locked", "trialing"]);

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const access = await accessForCompany(member.companyId);

  // ── `reason` is billing state, and not everyone gets billing state ─────
  //
  // The banner needs to know the account is HEALTHY or in trouble, and how
  // long is left. It does not need to know the company is on a free trial —
  // and "trialing" told a Manager exactly that, right after the trial badge
  // had been taken away from them everywhere else.
  //
  // A healthy account is reported as "ok" to anyone who may not see billing
  // state. The banner renders nothing for a healthy account either way, so
  // this loses no behaviour; it just stops the endpoint answering a question
  // it wasn't asked. Trouble states stay specific for everyone: someone whose
  // employer is about to lose access should know why their work is about to
  // stop, whatever their role.
  const seesDetail =
    member.impersonation || seesBillingState(member.role) || access.level !== "full";

  // ── The trial's own facts, for the owner ────────────────────────────────
  //
  // Which rung fits the roster (lib/billing/recommendedTier.js), the rung
  // the pricing-page link named at signup, and whether a plan is already
  // chosen — so the banner can say "Recommended: Crew · 3 seats + 8 crew" and
  // send "Choose a plan" to that card. Two small reads, only on a trial and
  // only for someone who may see billing state: the banner asks on every
  // page load and a paying company must not pay for a roster count it will
  // never print.
  let trial = null;
  if (seesDetail && TRIAL_REASONS.has(access.reason)) {
    const [company, roster, sub] = await Promise.all([
      db.company.findUnique({ where: { id: member.companyId }, select: { signupTierKey: true } }),
      db.member.findMany({ where: { companyId: member.companyId, active: true }, select: { role: true, permissions: true, active: true } }),
      access.reason === "trialing"
        ? db.subscription.findUnique({ where: { companyId: member.companyId }, select: { plan: { select: { name: true } } } })
        : null,
    ]);
    trial = {
      trialEndsAt: access.trialEndsAt || null,
      hasPlan: access.reason === "trialing",
      planName: sub?.plan?.name || null,
      recommended: recommendedTierFor(roster),
      signupTierKey: company?.signupTierKey || null,
      canChoosePlan: Boolean(member.impersonation) || isBillingAdmin(member.role),
    };
  }

  return NextResponse.json({
    level: access.level,
    daysLeft: access.daysLeft,
    reason: seesDetail ? access.reason : "ok",
    graceDays: GRACE_DAYS,
    // Only present while a brand-new company has no card yet — the minutes
    // before the setup gate sends them back to /signup.
    ...(access.minutesLeft ? { minutesLeft: access.minutesLeft } : {}),
    // A paid plan booked to end on this date (cancel-at-period-end). Full
    // access until then; the banner says so and offers Resume. Billing
    // state, so withheld from anyone who may not see billing state — the
    // same rule as `reason` above.
    ...(access.endsAt && seesDetail ? { endsAt: access.endsAt } : {}),
    ...(trial ? { trial } : {}),
  });
}
