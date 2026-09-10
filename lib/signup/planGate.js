// lib/signup/planGate.js
//
// The setup gate, asked by the REQUEST instead of by the screen.
//
// ══ Why this file exists ═══════════════════════════════════════════════════
//
// lib/signup/setupGate.js already holds the decision — who may use the product
// before anyone has paid, with the grace window, the Stripe evidence and the
// demo/impersonation exemptions its header explains. But it was called from
// exactly ONE place: app/app/layout.js's getSetupRedirect(). That is a SCREEN
// redirect, and a gate in the screen is not a gate in the request. A stale tab,
// a saved fetch, a script, or any client-facing route could still put a priced
// offer in a homeowner's inbox under a company that never finished checkout.
//
// The owner, looking at ~20 companies reading "pending · Never finished
// checkout · No plan", several of them holding quotes: "there should be
// something stopping a company with no plan from sending quotes… maybe
// prompting them to complete it".
//
// Same shape the codebase has settled on everywhere else the screen was doing
// the enforcing: app/api/sales/calls/route.js recomputes the calling gate from
// rows it reads in that request, lib/migrations/state.js's canWrite() is read
// fresh immediately before each write, and lib/sales/outreachSender.js re-asks
// before anything leaves the building. The screen's copy is a courtesy; the
// route's is the control.
//
// ══ What is gated, and what deliberately is not ════════════════════════════
//
// SENDING, not DRAFTING. A contractor who has not paid can still build a quote,
// price it, add photos and see the product work — that is the thing that makes
// them want to pay, and locking the builder would be locking the trial itself.
// What needs a plan is the OUTWARD act: emailing a quote or an invoice, minting
// a public link, ringing the client, taking a payment, publishing a website or
// a social post. Everything a stranger can see carries the company's name, and
// FieldQuo is the one carrying it for them.
//
// ══ One opinion about who has paid ═════════════════════════════════════════
//
// Nothing here re-decides anything. The gathering below is the same gathering
// getSetupRedirect does — accessForCompany's reason, Company.isDemo/createdAt,
// then Stripe only when the answer would otherwise be "no" — and the decision
// itself is setupGateDecision(). Two readings of one billing rule is how one of
// them ships wrong.
//
// ══ A door, not a wall ═════════════════════════════════════════════════════
//
// The refusal is a 402 carrying `planRequired`, which names the reason and the
// path that fixes it. lib/signup/planRequired.js turns that into the prompt the
// owner asked for; lib/clientErrors.js routes it there automatically, so a call
// site that only ever reported failures still opens the door instead of toasting
// a dead end.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { accessForCompany } from "@/lib/billing/access";
import { stripeSubscriptionExists } from "@/lib/billing/checkoutEvidence";
import { setupGateDecision, FINISH_SIGNUP_PATH } from "./setupGate";

/**
 * 402, not 403.
 *
 * The same reasoning lib/currentMember.js's billing gate gives: "Forbidden"
 * reads as a permissions problem and sends people to their admin, while Payment
 * Required sends them to the one screen where this can be fixed. It is a
 * different state from that gate's 402 — no Subscription row at all, rather
 * than one that lapsed — which is why the body carries `planRequired` and not
 * `billing`: the two prompts say different sentences and lead to different
 * places.
 */
export const PLAN_REQUIRED_STATUS = 402;

/**
 * Has this company finished signing up — INCLUDING paying for it?
 *
 * Gathers, then defers. Returns setupGateDecision's own
 * `{ action, reason, path? }`, unchanged, so a caller (and a check script) sees
 * exactly which branch fired.
 *
 * @param member  the member from memberOrRefusal — needs `companyId`, `role`,
 *                `impersonation` and, when the caller resolved it normally,
 *                `billingAccess`.
 * @param now     injectable, so the checks aren't time-dependent.
 */
export async function planDecision(member, now = new Date()) {
  // ── A support session is never a signup ─────────────────────────────────
  //
  // Answered before any query, exactly as setupGateDecision answers it first:
  // an impersonated member carries a real companyId, and a demo sandbox has no
  // Subscription row at all. Allowing here is not a way to send — impersonation
  // is read-only and assertReadOnly() has already refused every POST that is
  // not the demo sandbox (non-negotiable #2). A demo sandbox IS allowed to
  // send, because that is the demo: a FieldQuo-owned fixture, not a customer.
  if (member?.impersonation) {
    return setupGateDecision({ impersonating: true, now });
  }

  // `billingAccess` is attached by getCurrentMember on every ordinary request.
  // The fallback is the SAME function it used, not a second reading — a member
  // resolved with skipBillingGate, or by a route that built its own, must not
  // silently skip the gate.
  const access =
    member?.billingAccess || (await accessForCompany(member?.companyId, now));

  // "setup_pending" is accessForCompany's name for the state this gate owns:
  // no Subscription row, still inside CHECKOUT_GRACE_MS. It is the same
  // absence as "no_subscription" with the clock attached, so it is handed on
  // as that — otherwise setupGateDecision would read it as "a subscription
  // exists" and allow for a reason that isn't true. The outcome is the same
  // (the grace branch allows it); the reason it gives is honest.
  const billingReason =
    access?.reason === "setup_pending" ? "no_subscription" : access?.reason || null;

  // Every paying, trialing, past-due, cancelled or locked company leaves here
  // without paying for a query. Trialing especially: the first month is free
  // (non-negotiable #1) and a trial is a Subscription row like any other, so a
  // company on it never reaches the branches below.
  if (billingReason !== "no_subscription") {
    return setupGateDecision({
      hasSession: true,
      companyId: member?.companyId || null,
      membershipExists: true,
      billingReason,
      role: member?.role || null,
      now,
    });
  }

  const company = member?.companyId
    ? await db.company.findUnique({
        where: { id: member.companyId },
        select: { id: true, isDemo: true, createdAt: true },
      })
    : null;

  const base = {
    impersonating: false,
    hasSession: true,
    companyId: member?.companyId || null,
    membershipExists: true,
    billingReason,
    role: member?.role || null,
    isDemo: Boolean(company?.isDemo),
    companyCreatedAt: company?.createdAt || null,
    // ── `false`, and this is the whole trick ────────────────────────────────
    //
    // The first pass exists so the cheap allows — impersonation, a demo
    // fixture, a company created in the last hour — never pay for a Stripe
    // round trip. For that, the pass has to be able to say NO.
    //
    // setupGateDecision reads `null` as "we could not find out", which is
    // evidence FOR the company and always allows. So a provisional pass with
    // null can never refuse, and the `if (allow) return` below would swallow
    // every case — which is exactly the bug this same two-pass shape had in
    // app/app/layout.js's getSetupRedirect(), where it made
    // stripeSubscriptionExists unreachable and the whole gate a no-op (fixed
    // there in this change too).
    //
    // `false` is the honest value here: at this point nobody has produced any
    // evidence of a checkout. Only the reasons that do not depend on Stripe
    // can allow, and everything else falls through to actually asking it.
    stripeSubscription: false,
    now,
  };

  const provisional = setupGateDecision(base);
  if (provisional.action === "allow") return provisional;

  // Only now does it matter. Stripe holds the subscription object from the
  // moment checkout completes, before our webhook lands, which is what stops
  // someone who has just paid being refused the first thing they try to send.
  const stripeSubscription = await stripeSubscriptionExists({
    id: member?.companyId,
  });
  return setupGateDecision({ ...base, stripeSubscription });
}

/**
 * The JSON body a refused send becomes.
 *
 * Pure and exported so scripts/check-plan-gate.mjs runs it rather than reads
 * it: whether this is a door or a wall is a property of what a browser
 * receives, not of the sentence in the source.
 *
 * @param decision  from planDecision()
 * @param action    the verb phrase the sentence ends with ("send this quote")
 */
export function planRefusalBody(decision, action = "do that") {
  // A billing admin gets the path; anyone else gets told who to ask. That split
  // is setupGateDecision's, not a second rule — `redirect` carries a path
  // because isBillingAdmin() said this person may open checkout, and
  // `setup_incomplete` carries none because /signup would offer an invited
  // estimator a SECOND company beside the one they were invited to.
  const path = decision?.path || null;

  return {
    error: path
      ? `Your company hasn't finished signing up — no plan has been paid for yet, so nothing can go out to a client under your name. Choose your plan to finish, then ${action}.`
      : `This company hasn't finished signing up — no plan has been paid for yet, so nothing can go out to a client under its name. Ask the owner or an admin to finish choosing a plan, then ${action}.`,
    planRequired: {
      reason: decision?.reason || "checkout_never_completed",
      // Named `path` rather than `url` so it is obviously in-app; the prompt
      // links to it directly.
      path,
      canFinish: Boolean(path),
      action,
    },
  };
}

/**
 * The gate a route calls, in the shape memberOrRefusal and levelOrRefusal
 * already taught every handler to read:
 *
 *   const { member, response } = await memberOrRefusal(request);
 *   if (response) return response;
 *   const { response: unpaid } = await planOrRefusal(member, "send this quote");
 *   if (unpaid) return unpaid;
 *
 * @returns {{ decision }} when allowed, or {{ decision, response }} to return
 *          as-is.
 */
export async function planOrRefusal(member, action) {
  const decision = await planDecision(member);
  if (decision.action === "allow") return { decision };

  return {
    decision,
    response: NextResponse.json(planRefusalBody(decision, action), {
      status: PLAN_REQUIRED_STATUS,
    }),
  };
}

export { FINISH_SIGNUP_PATH };
