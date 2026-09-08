// app/api/platform/billing/pending-change/route.js
//
// "Keep my current plan" — undo a plan change booked for the end of the
// period before it lands.
//
// Its own route rather than an action flag on /checkout because the two do
// opposite things to the company's money and a reader of the access log
// should be able to tell them apart by path. Same gate as the change itself:
// whoever may book a downgrade may un-book it, and nobody else may — a
// supervisor un-booking the owner's planned saving is the same class of
// problem as a supervisor cancelling the subscription.
//
// Tenant-scoped by the member's own companyId, never by an id in the request.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { cancelPendingPlanChange } from "@/lib/platform/stripeBilling";
import { recordError } from "@/lib/platform/errorLog";
import { recordActivity } from "@/lib/activity/log";

export async function DELETE(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  const subscription = await db.subscription.findUnique({
    where: { companyId: member.companyId },
  });

  // Nothing booked is not an error: the state the person asked for is already
  // true. Answered plainly so a page that raced a webhook does not show a red
  // banner over a card that has just, correctly, disappeared.
  if (!subscription?.pendingPlanId && !subscription?.stripeScheduleId) {
    return NextResponse.json({ ok: true, cancelled: false, note: "No plan change is pending." });
  }

  try {
    await cancelPendingPlanChange(subscription);
    await recordActivity(member, {
      action: "billing.plan_change_cancelled",
      entityType: "settings",
      summary: "Kept the current plan — cancelled the scheduled plan change",
      metadata: {
        pendingPlanId: subscription.pendingPlanId,
        pendingBillingInterval: subscription.pendingBillingInterval,
        stripeScheduleId: subscription.stripeScheduleId,
      },
    }).catch(() => {});
    return NextResponse.json({ ok: true, cancelled: true });
  } catch (err) {
    await recordError({
      area: "billing",
      code: err?.code || err?.type || null,
      message: `Cancelling a pending plan change failed: ${err?.message}`,
      companyId: member.companyId,
      detail: { stripeScheduleId: subscription.stripeScheduleId, pendingPlanId: subscription.pendingPlanId },
    }).catch(() => {});
    return NextResponse.json(
      { error: "Couldn't undo the scheduled change just now. Your plan change is still booked — nothing else was changed." },
      { status: 502 },
    );
  }
}
