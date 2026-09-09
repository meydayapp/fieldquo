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
// ══ Three decisions, because two of them could not say what was true ══════
//
// It was accept or reject. The owner hit the case neither one fits: Insulation
// Depot USA came up for review flagged as a possible duplicate, and it IS a
// contractor — he had already accepted the same business at a different Buffalo
// address. Accepting it would bank a third copy of one company and spend seven
// pipeline tasks and an AI brief researching it again; rejecting it would file
// a real contractor as a shop and set doNotContactAt on it. Neither is the
// truth, and a screen that forces a choice between two wrong answers gets a
// wrong answer.
//
// So there is a third: DUPLICATE. "Contractor, and I already have it." It
// resolves the flag, does not promote the row to research, and does not mark
// the business do-not-contact — because the business is fine, this ROW is
// redundant. The row itself is kept, as every other decision here keeps it:
// deleting would let next month's re-ingest rediscover it and ask again.
//
// ══ Accept and reject are not symmetrical ═════════════════════════════════
//
// ACCEPT moves the row into the working queue and queues the research that
// makes it a queue worth having — see the note on the enqueue below. REJECT does NOT delete it: `doNotContactAt` is set instead, which the
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
import { enqueuePipelineTask } from "@/lib/sales/pipeline/tasks";

export async function POST(request, { params }) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const prospectId = String(body?.prospectId ?? "").trim();
  const decision = String(body?.decision ?? "").trim();

  if (!prospectId) return bad("Which prospect?");
  if (decision !== "accept" && decision !== "reject" && decision !== "duplicate") {
    return bad('A review is "accept", "reject" or "duplicate".');
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
    } else if (decision === "duplicate") {
      // ── Redundant row, real business ───────────────────────────────────
      //
      // `rejected` as a status because it leaves the working queue and stops
      // being counted as a prospect to work — but WITHOUT doNotContactAt and
      // WITHOUT the retailer classification, which are the two things that
      // would be false. The business may be rung; this row is simply not the
      // one to ring it from, and the row it duplicates already is.
      //
      // The flag is cleared. It has done its job, and leaving it set is how
      // 197 accepted rows ended up carrying a flag nobody could act on.
      await tx.prospect.update({
        where: { id: prospect.id, status: "needs_review" },
        data: {
          status: "rejected",
          classification: "duplicate",
          classificationReason: prospect.possibleDuplicateOfId
            ? `A superadmin reviewed this and said it is the same business as ${prospect.possibleDuplicateOfId}.`
            : "A superadmin reviewed this and said this business is already in the bank.",
          possibleDuplicateOfId: null,
        },
      });
      // Counted as rejected in the funnel: it left needs_review and it is not
      // an accepted prospect. A fourth counter would need a schema change and
      // would say the same thing the classification already says.
      await tx.prospectCampaign.update({
        where: { id: prospect.campaignId },
        data: { needsReviewCount: { decrement: 1 }, rejectedCount: { increment: 1 } },
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

  // ── Research the row a human just accepted ──────────────────────────────
  //
  // Outside the transaction on purpose: the review is decided and audited
  // whether or not the queue accepts the task, and a failed enqueue must not
  // roll back a superadmin's decision.
  //
  // It has to happen HERE and not only in the discovery handler. Discovery
  // promotes prospects at `discovered`, and a `needs_review` row only reaches
  // that status when somebody accepts it — often days after the campaign
  // finished paging, when no discovery task will ever run again. Without this
  // line the accept button would move a row into a queue that nothing was
  // going to look at, which is a control that appears to work.
  //
  // The same campaign-scoped key the discovery fan-out uses, so accepting a
  // row a later page would also have promoted queues one task, not two.
  if (decision === "accept") {
    await enqueuePipelineTask({
      kind: "ENRICH_BUSINESS",
      prospectId: prospect.id,
      campaignId: prospect.campaignId,
      payload: { prospectId: prospect.id },
      idempotencyKey: `enrich:${prospect.campaignId || "none"}:${prospect.id}`,
    });
  }

  return NextResponse.json({ ok: true });
}

function bad(error) {
  return NextResponse.json({ error }, { status: 400 });
}
