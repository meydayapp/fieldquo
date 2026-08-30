// lib/ai/topup.js
//
// Turning a paid Stripe Checkout Session into AI credit — pay-as-you-go, not
// a subscription. Mirrors lib/voice/topup.js's settleTopupPayment on purpose:
// the same race exists here (the browser's return redirect and the
// checkout.session.completed webhook can arrive in either order, or both, or
// neither reliably first), and the same fix applies — one idempotent
// settlement, keyed on the Stripe PAYMENT INTENT, that both doors call.
//
// ══ Why a separate file instead of a `kind` argument on the voice one ══════
//
// The two settlements differ in exactly the ways that matter for money:
// different ref prefix (aiTopupRef vs topupRef — see credits.js), a different
// activity-log action, and — the one that actually has to be structurally
// impossible to get wrong — a hardcoded kind: "ai_topup" rather than a value
// threaded through from a caller. lib/voice/credits.js's own header explains
// why the wallet is DERIVED from kind and never passed in: a `pool` or `kind`
// argument can be forgotten, and a forgotten argument on a shared crediting
// function is exactly how a phone top-up ends up paying for a picture. Two
// small files that cannot disagree about which wallet they write to are worth
// more here than one file with a lever in it.
//
// No auto-topup exists for this wallet. Nothing here recurs — a company that
// generates nothing owes nothing, so there is no low-balance emergency an
// automatic card charge would be rescuing them from the way it does for a
// phone that stops answering. If that changes, it is a product decision, not
// a refactor of this file.
import { db } from "@/lib/db";
import { addCredit, balanceFor, normaliseTopup, aiTopupRef, POOLS } from "@/lib/voice/credits";
import { recordActivity } from "@/lib/activity/log";

/**
 * Credit a company for one paid AI top-up.
 *
 * @param session  a Stripe Checkout Session with `kind: "ai_topup"` metadata
 * @param member   the signed-in member, when a person is standing in front of
 *                 this. Absent on the webhook path.
 * @param deps     seams for scripts/check-ai-credit.mjs — see lib/voice/topup.js's
 *                 identical parameter for why this exists.
 * @returns {{credited: boolean, alreadyCredited?: boolean, reason?: string,
 *            cents?: number, balance?: number}}
 */
export async function creditAiTopup(session, { member = null, deps = {} } = {}) {
  const companyId = session?.metadata?.companyId || null;
  if (!companyId) return { credited: false, reason: "no_company" };

  // Same rule as the voice path: a delayed-notification method completes the
  // session `unpaid` and settles minutes later, and crediting then would hand
  // out AI credit against money that may never arrive.
  if (session.payment_status !== "paid") {
    return { credited: false, reason: session.payment_status || "not_paid_yet" };
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;

  // What Stripe actually took, in preference to what was asked for — same
  // reasoning as creditVoiceTopup's identical line.
  const cents = Math.max(
    0,
    Math.round(Number(session.amount_total) || normaliseTopup(session.metadata?.cents) || 0),
  );

  return settleAiTopupPayment({
    companyId,
    cents,
    paymentIntentId,
    stripeRef: session.id,
    member,
    deps,
  });
}

/**
 * The one settlement. Both the return-redirect route and the webhook call
 * this, and whichever arrives second finds the ref already written and
 * reports `alreadyCredited: true` rather than crediting again.
 */
async function settleAiTopupPayment({
  companyId,
  cents,
  paymentIntentId,
  stripeRef,
  member = null,
  deps = {},
}) {
  const prisma = deps.db || db;
  const credit = deps.addCredit || addCredit;
  const readBalance = deps.balanceFor || balanceFor;
  const logActivity = deps.recordActivity || recordActivity;

  if (!companyId) return { credited: false, reason: "no_company" };
  if (!cents) return { credited: false, reason: "no_amount" };

  const ref = aiTopupRef(paymentIntentId || stripeRef);

  const existing = await prisma.voiceCreditEntry.findFirst({
    where: { companyId, ref },
    select: { id: true },
  });
  if (existing) {
    return {
      credited: true,
      alreadyCredited: true,
      cents,
      balance: await readBalance(companyId, prisma, POOLS.AI),
    };
  }

  const amount = `$${(cents / 100).toFixed(2)}`;

  // kind is the literal string, not a parameter — see the module header.
  await credit({
    companyId,
    cents,
    kind: "ai_topup",
    stripeRef,
    ref,
    note: `AI credit top-up ${amount}`,
    prisma,
  });

  await logActivity(member || { companyId }, {
    action: "ai.credit_added",
    entityType: "settings",
    actorName: member ? undefined : "Stripe (payment confirmed)",
    summary: `Added ${amount} of AI credit`,
    metadata: { cents, stripeRef, paymentIntentId },
  }).catch(() => {});

  return {
    credited: true,
    alreadyCredited: false,
    cents,
    balance: await readBalance(companyId, prisma, POOLS.AI),
  };
}
