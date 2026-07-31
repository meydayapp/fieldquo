// app/api/quotes/[id]/approve-estimate/route.js
//
// Approve (or adjust-and-approve) an auto-generated instant estimate. This is
// the RBAC gate the whole instant-quote flow hangs on: until someone with
// quote:approve-estimate clears needsReview, the draft cannot be sent, so no
// price a human hasn't seen ever reaches the homeowner as binding.
//
// The reviewer may set the final total here — the range midpoint is a starting
// point, not a commitment. Approving preserves estimateData (what the homeowner
// was shown) untouched, so "what we quoted" and "what they saw" stay distinct.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { recordActivity } from "@/lib/activity/log";
import { can } from "@/lib/permissions";
import { onQuoteApproved } from "@/lib/voice/triggers";

export async function POST(request, { params }) {
  const { id } = await params;

  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!can(member.role, "quote:approve-estimate")) {
    return NextResponse.json(
      { error: "You don't have permission to approve estimates. Ask a supervisor, admin or owner." },
      { status: 403 },
    );
  }

  const quote = await db.quote.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, autoEstimated: true, needsReview: true },
  });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!quote.autoEstimated) {
    return NextResponse.json({ error: "That quote isn't an instant estimate." }, { status: 400 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    /* empty body = approve at the current total */
  }

  const data = {
    needsReview: false,
    reviewedById: member.userId,
    reviewedAt: new Date(),
  };

  // Optional adjust-and-approve. Only touch the total when a positive number is
  // supplied — an approval that forgets the total shouldn't zero the quote.
  const finalTotal = Number(body?.total);
  if (Number.isFinite(finalTotal) && finalTotal > 0) {
    data.total = finalTotal;
    data.subtotal = finalTotal;
  }

  await db.quote.update({ where: { id }, data });

  await recordActivity(member, {
    action: "estimate.approved",
    entityType: "quote",
    entityId: id,
    summary:
      data.total != null
        ? `Approved instant estimate at ${data.total}`
        : "Approved instant estimate",
    metadata: data.total != null ? { total: data.total } : undefined,
  });

  // Best-effort: if the company turned on outbound calls, queue one to confirm
  // and schedule. Never allowed to fail the approval — a queuing hiccup must not
  // block a reviewer clearing needsReview.
  await onQuoteApproved(id).catch((err) =>
    console.error("[approve-estimate] couldn't queue outbound call:", err?.message),
  );

  return NextResponse.json({ ok: true });
}
