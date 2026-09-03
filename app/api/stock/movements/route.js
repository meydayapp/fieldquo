// app/api/stock/movements/route.js
//
// The ledger itself: what moved, which way, and why.
//
// ══ A correction is a movement, not an edit ════════════════════════════════
//
// There is no PATCH and no DELETE here, and that is the design rather than an
// omission. Somebody who counts the van on Friday and finds three fewer bags
// than the ledger says enters an `adjustment` of -3. The wrong count stays,
// the correction stays, and "when did that go missing" remains answerable.
// Editing a movement would erase the only evidence anything was ever off —
// the same reason the voice credit ledger and the commission ledger are
// append-only.
//
// The sign is derived from the kind (lib/purchasing/stock.js's
// normaliseMovement), so "used: +40" cannot enter the ledger as a delivery.
// `adjustment` is the one kind allowed either way, because it is the
// correction.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { recordActivity } from "@/lib/activity/log";
import { normaliseMovement, MOVEMENT_KINDS } from "@/lib/purchasing/stock";
import {
  PURCHASING_CATEGORY,
  PURCHASING_LEVEL,
  shapeMovement,
  text,
} from "@/lib/purchasing/access";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { response: denied } = await levelOrRefusal(
    member,
    PURCHASING_CATEGORY,
    PURCHASING_LEVEL,
    "see stock movements",
  );
  if (denied) return denied;

  const materialId = new URL(request.url).searchParams.get("materialId") || "";

  const movements = await db.stockMovement.findMany({
    where: { companyId: member.companyId, ...(materialId ? { materialId } : {}) },
    orderBy: { occurredAt: "desc" },
    take: 200,
  });

  // StockMovement.materialId carries no Prisma relation, so the names are
  // looked up here rather than included. One extra query for the page, and it
  // keeps the schema's deliberate looseness — a movement outlives the material
  // row it names, the same way JobPhoto.taskId is SetNull so "evidence
  // outlives the record that asked for it".
  const ids = [...new Set(movements.map((m) => m.materialId))];
  const materials = ids.length
    ? await db.material.findMany({
        where: { id: { in: ids }, companyId: member.companyId },
        select: { id: true, name: true },
      })
    : [];
  const names = new Map(materials.map((m) => [m.id, m.name]));

  return NextResponse.json({
    movements: movements.map((m) => shapeMovement(m, names.get(m.materialId))),
  });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { response: denied } = await levelOrRefusal(
    member,
    PURCHASING_CATEGORY,
    PURCHASING_LEVEL,
    "record a stock movement",
  );
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));

  const materialId = text(body.materialId, 64);
  if (!materialId) {
    return NextResponse.json({ error: "Which material moved?" }, { status: 400 });
  }
  // Re-read inside this company. StockMovement has no foreign key on
  // materialId, so nothing in the database would stop a movement against
  // another tenant's material — this check is the whole of that boundary.
  const material = await db.material.findFirst({
    where: { id: materialId, companyId: member.companyId },
    select: { id: true, name: true },
  });
  if (!material) {
    return NextResponse.json({ error: "That material isn't yours." }, { status: 400 });
  }

  const normalised = normaliseMovement({ kind: body.kind, quantity: body.quantity });
  if (!normalised.ok) {
    return NextResponse.json({ error: normalised.error }, { status: 400 });
  }

  let jobId = text(body.jobId, 64);
  if (jobId) {
    const job = await db.job.findFirst({
      where: { id: jobId, companyId: member.companyId },
      select: { id: true },
    });
    if (!job) return NextResponse.json({ error: "That job isn't yours." }, { status: 400 });
  } else {
    jobId = null;
  }

  const movement = await db.stockMovement.create({
    data: {
      companyId: member.companyId,
      materialId: material.id,
      quantity: normalised.quantity,
      kind: normalised.kind,
      jobId,
      note: text(body.note, 500),
      // No `ref`. That column is idempotency for MACHINE-written movements —
      // a PO receipt, an import — and a person pressing a button once is not
      // one of those. Inventing a key here would make a genuine second
      // correction on the same day look like a duplicate and vanish.
      ref: null,
      createdById: member.userId || null,
    },
  });

  await recordActivity(member, {
    action: "stock.movement",
    entityType: "material",
    entityId: material.id,
    summary: `${MOVEMENT_KINDS[normalised.kind].label}: ${normalised.quantity} ${material.name}`,
  });

  return NextResponse.json({ movement: shapeMovement(movement, material.name) }, { status: 201 });
}
