// app/api/jobs/[id]/materials/from-stock/route.js
//
// Take a material off the shelf for this job, instead of buying it again.
//
// The owner, 2026-10-28: "if there are items in the inventory (shelf) i should
// be able to pick from those instead of asking me how many did i buy.. i
// should be able to select from inventory in case i already have it."
//
// The list already KNEW — every line matched to a stock row carries "on hand",
// summed from its movements, and a line short of what is on the shelf is drawn
// as short. What it could not do was act on it: the only button was a tick
// that asks what you paid, which is the wrong question for tape you bought
// three weeks ago.
//
// ── Why this is a route of its own ─────────────────────────────────────────
//
// The PATCH beside it already does two different things (a tick, and a
// used-quantity edit) and says so in a comment that exists because the second
// was once mistaken for the first. A third shape sharing that body is how the
// next person blanks a receipt by accident. This one writes three rows or
// none, which a branch inside a general-purpose PATCH cannot promise.
//
// ── The money ──────────────────────────────────────────────────────────────
//
// The expense comes from lib/purchasing/useFromStock.js — the same writer the
// Stock tab's own "Used on a job" calls, priced at the material's running
// average. The line is marked bought and its actualCost LEFT NULL on purpose:
// reconcileJobPurchases books an expense from actualCost, so a line carrying
// both would pay for the same tape twice.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, assignedJobWhere, permissionErrorResponse } from "@/lib/permissions/enforce";
import { requireCost } from "@/app/api/invoices/costingWrite";
import { stockLevels, normaliseMovement } from "@/lib/purchasing/stock";
import { bookStockUse } from "@/lib/purchasing/useFromStock";
import { recordActivity } from "@/lib/activity/log";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  let full = null;
  try {
    full = await loadEnforceableMember(db, member.id);
    // Not the crew tick. This books money against the job, which is the
    // office's write wherever else it happens.
    requireCost(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const body = await request.json().catch(() => ({}));
  const line = await db.jobMaterial.findFirst({
    where: {
      id: String(body.materialId || ""),
      job: { companyId: member.companyId, ...assignedJobWhere(full) },
    },
    select: { id: true, jobId: true, name: true, qty: true, unit: true, stockMaterialId: true, purchasedAt: true, actualCost: true },
  });
  if (!line || line.jobId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!line.stockMaterialId) {
    return NextResponse.json(
      { error: "This line isn't matched to anything on your shelf, so there's nothing to take.", code: "not_tracked" },
      { status: 400 },
    );
  }
  // Already paid for by hand. Taking it from stock as well would cost the job
  // twice for one material, which is precisely what this route is built to
  // avoid — so it refuses rather than quietly adding a second expense.
  if (line.actualCost != null) {
    return NextResponse.json(
      { error: "This line already has a cost on it. Clear the cost first if it came off the shelf instead.", code: "already_costed" },
      { status: 409 },
    );
  }

  const material = await db.material.findFirst({
    where: { id: line.stockMaterialId, companyId: member.companyId },
    select: { id: true, name: true, unit: true, currentAvgCost: true, reorderThreshold: true },
  });
  if (!material) {
    return NextResponse.json({ error: "That material isn't on your shelf any more.", code: "not_tracked" }, { status: 400 });
  }

  // Default to what the line asked for, so the common case is one tap.
  const asked = body.quantity === undefined || body.quantity === null || body.quantity === ""
    ? Number(line.qty)
    : Number(body.quantity);
  const normalised = normaliseMovement({ kind: "used", quantity: asked });
  if (!normalised.ok) return NextResponse.json({ error: normalised.error }, { status: 400 });

  // ── Only what is actually there ──────────────────────────────────────────
  //
  // A shelf cannot go negative by somebody taking from it: that is what the
  // "Correction after a count" movement is for, and letting this door write a
  // negative level would make the count screen lie. Read fresh, here, rather
  // than trusted from whatever the browser was last shown.
  const movements = await db.stockMovement.findMany({
    where: { companyId: member.companyId, materialId: material.id },
    select: { materialId: true, quantity: true },
  });
  const level = stockLevels([material], movements)[0];
  const onHand = Number(level?.level ?? 0);
  const want = Math.abs(Number(normalised.quantity));
  if (want > onHand) {
    return NextResponse.json(
      {
        error: `There ${onHand === 1 ? "is" : "are"} only ${onHand}${material.unit ? ` ${material.unit}` : ""} of ${material.name} on the shelf.`,
        code: "short",
        onHand,
      },
      { status: 409 },
    );
  }

  // Three writes or none: a movement without its expense understates the job,
  // and a tick without its movement empties a shelf nobody took anything from.
  const result = await db.$transaction(async (tx) => {
    const movement = await tx.stockMovement.create({
      data: {
        companyId: member.companyId,
        materialId: material.id,
        quantity: normalised.quantity,
        kind: normalised.kind,
        jobId: line.jobId,
        note: `For ${line.name}`,
        ref: null,
        createdById: member.userId || null,
      },
      select: { id: true },
    });
    const costed = await bookStockUse({
      prisma: tx,
      companyId: member.companyId,
      material,
      jobId: line.jobId,
      movementId: movement.id,
      quantity: normalised.quantity,
      userId: member.userId || null,
    });
    await tx.jobMaterial.update({
      where: { id: line.id },
      data: {
        purchasedAt: new Date(),
        purchasedById: member.userId || null,
        actualQty: want,
        // Deliberately untouched: see the header. The money came from the
        // shelf, and a cost here would book it a second time.
      },
    });
    return { movementId: movement.id, costed };
  });

  await recordActivity(member, {
    action: "jobMaterial.takenFromStock",
    entityType: "jobMaterial",
    entityId: line.id,
    summary: `Took ${want}${material.unit ? ` ${material.unit}` : ""} of ${material.name} from stock for ${line.name}`,
    metadata: {
      jobId: line.jobId,
      materialId: material.id,
      movementId: result.movementId,
      quantity: want,
      amount: result.costed.amount,
      // Named so "why did the job's cost not move" has an answer in the trail
      // rather than only on the screen that happened to be open.
      ...(result.costed.reason ? { notCosted: result.costed.reason } : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    took: want,
    onHand: onHand - want,
    costed: result.costed.amount,
    // The screen says this out loud rather than leaving somebody to notice the
    // job's cost did not move.
    reason: result.costed.reason,
  });
}
