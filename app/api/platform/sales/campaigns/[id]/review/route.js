// app/api/platform/sales/campaigns/[id]/review/route.js
//
// A human deciding what the classifier could not.
//
// ══ This is what makes `needs_review` a state and not a bin ════════════════
//
// lib/sales/discovery/classify.js sends a row here whenever the evidence
// points both ways — a flooring business with a showroom, a landscaper filed
// under `nursery_and_gardening`. Measured, that is about 5.6% of what a
// campaign finds.
//
// Without this route those rows would be written, counted in a funnel, and
// never seen by anybody. A classifier that is allowed to say "I don't know"
// only earns that by there being somebody to ask.
//
// ══ Accept and reject are not symmetrical ═════════════════════════════════
//
// ACCEPT moves the row into the working queue and leaves everything else
// alone. REJECT does NOT delete it: `doNotContactAt` is set instead, which the
// schema comment says survives every pipeline transition. Deleting would let
// the next month's re-ingest rediscover the same paint store and put it back
// in front of a rep, so the decision has to outlive the row's status.
//
// ══ The counters move with the row ════════════════════════════════════════
//
// In the same transaction, so the funnel cannot drift from what it describes.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { isCallReady } from "@/lib/sales/discovery/normalise";

export async function POST(request, { params }) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const prospectId = String(body?.prospectId ?? "").trim();
  const decision = String(body?.decision ?? "").trim();

  if (!prospectId) return bad("Which prospect?");
  if (decision !== "accept" && decision !== "reject") {
    return bad('A review is either "accept" or "reject".');
  }

  const prospect = await db.prospect.findUnique({ where: { id: prospectId } });
  if (!prospect || prospect.campaignId !== id) {
    return NextResponse.json({ error: "That prospect is not in this campaign." }, { status: 404 });
  }
  // Re-read at the moment of the write, not trusted from the page. Two
  // superadmins with the same list open would otherwise both move the
  // counters for one row.
  if (prospect.status !== "needs_review") {
    return bad("Somebody has already reviewed this one.");
  }

  const ready = isCallReady(prospect);

  await db.$transaction(async (tx) => {
    if (decision === "accept") {
      await tx.prospect.update({
        where: { id: prospect.id, status: "needs_review" },
        data: {
          status: "discovered",
          classification: "contractor",
          classificationReason: "A superadmin reviewed this and said it is a contractor.",
        },
      });
      await tx.prospectCampaign.update({
        where: { id: prospect.campaignId },
        data: {
          needsReviewCount: { decrement: 1 },
          acceptedCount: { increment: 1 },
          ...(ready ? { readyCount: { increment: 1 } } : {}),
          ...(prospect.websiteUrl ? {} : { noWebsiteCount: { increment: 1 } }),
        },
      });
    } else {
      await tx.prospect.update({
        where: { id: prospect.id, status: "needs_review" },
        data: {
          status: "rejected",
          classification: "retailer",
          classificationReason: "A superadmin reviewed this and said it is not a contractor.",
          // Survives every later pipeline transition, so next month's ingest
          // cannot put it back in front of a rep.
          doNotContactAt: new Date(),
          doNotContactReason: "Reviewed as a shop or supplier, not a contractor.",
        },
      });
      await tx.prospectCampaign.update({
        where: { id: prospect.campaignId },
        data: { needsReviewCount: { decrement: 1 }, rejectedCount: { increment: 1 } },
      });
    }

    await tx.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: "sales_prospect_reviewed",
        details: {
          // The campaign id READ BACK off the prospect, not the one from the
          // URL. They are equal — the guard above refuses when they are not —
          // but writing the request's copy makes the audit row a record of what
          // was asked rather than of what was found, and scripts/
          // check-tenant-scope.mjs is right to insist on the difference.
          campaignId: prospect.campaignId,
          prospectId: prospect.id,
          businessName: prospect.businessName,
          decision,
          // What the classifier said, so a pattern of overturned verdicts is
          // visible in the audit log and the rules can be corrected.
          machineReason: prospect.classificationReason,
        },
      },
    });
  });

  return NextResponse.json({ ok: true });
}

function bad(error) {
  return NextResponse.json({ error }, { status: 400 });
}
