// app/api/jobs/[id]/materials/route.js
//
// The job's sourcing list — what to buy, and ticking it off.
//
// Next 16: params is a Promise.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import {
  regenerateSourcingList,
  recordMaterialPrice,
  sourcingProgress,
} from "@/lib/jobs/sourcingList";
import { taskForJobMaterials } from "@/lib/tasks/autoCreate";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Decimal columns come back as Decimal objects; the browser wants numbers. */
function shape(m) {
  return {
    id: m.id,
    name: m.name,
    qty: num(m.qty),
    unit: m.unit,
    categoryKey: m.categoryKey,
    estUnitCost: m.estUnitCost == null ? null : num(m.estUnitCost),
    actualCost: m.actualCost == null ? null : num(m.actualCost),
    supplier: m.supplier,
    purchasedAt: m.purchasedAt,
    addedByHand: m.addedByHand,
    sortOrder: m.sortOrder,
  };
}

async function listFor(jobId) {
  const materials = await db.jobMaterial.findMany({
    where: { jobId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const shaped = materials.map(shape);
  return { materials: shaped, progress: sourcingProgress(shaped) };
}

/** The job must belong to the caller's company. Checked on every verb. */
async function ownJob(jobId, companyId) {
  return db.job.findFirst({
    where: { id: jobId, companyId },
    select: { id: true },
  });
}

export async function GET(request, { params }) {
  const { id } = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await ownJob(id, member.companyId)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(await listFor(id));
}

// Rebuild from the quote, or add one line by hand.
export async function POST(request, { params }) {
  const { id } = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "jobs", "view_create_edit", "change a job's materials");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  if (!(await ownJob(id, member.companyId)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));

  if (body.regenerate) {
    const result = await regenerateSourcingList(id, member.companyId);
    if (!result)
      return NextResponse.json(
        { error: "This job has no quote to derive materials from." },
        { status: 400 },
      );
    await taskForJobMaterials(id);
    return NextResponse.json({ ...(await listFor(id)), ...result });
  }

  const name = String(body.name || "")
    .trim()
    .slice(0, 200);
  if (!name)
    return NextResponse.json({ error: "A name is required" }, { status: 400 });

  const last = await db.jobMaterial.findFirst({
    where: { jobId: id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await db.jobMaterial.create({
    data: {
      jobId: id,
      name,
      qty: Math.max(0, num(body.qty)) || 1,
      unit:
        String(body.unit || "each")
          .trim()
          .slice(0, 24) || "each",
      // Hand-added lines survive a regenerate. Nobody derived "gas for the
      // compactor" from a takeoff, so nothing derived should delete it.
      addedByHand: true,
      estUnitCost: body.estUnitCost == null ? null : num(body.estUnitCost),
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
  await taskForJobMaterials(id);
  return NextResponse.json(await listFor(id), { status: 201 });
}

// Tick one line, or untick it.
export async function PATCH(request, { params }) {
  const { id } = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "jobs", "view_create_edit", "change a job's materials");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const body = await request.json().catch(() => ({}));
  const line = await db.jobMaterial.findFirst({
    where: {
      id: String(body.materialId || ""),
      job: { companyId: member.companyId },
    },
  });
  if (!line) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (line.jobId !== id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const purchased = body.purchased !== false;
  const actualCost = body.actualCost == null ? null : num(body.actualCost);

  const updated = await db.jobMaterial.update({
    where: { id: line.id },
    data: {
      // Unticking clears the receipt with it. A line that is "not bought" but
      // still carries a supplier and a price is a row nobody can explain, and
      // the price history entry it already wrote stays — that purchase did
      // happen, and un-ticking a checkbox does not un-happen it.
      purchasedAt: purchased ? line.purchasedAt || new Date() : null,
      purchasedById: purchased ? member.userId : null,
      actualCost: purchased ? actualCost : null,
      supplier: purchased
        ? String(body.supplier || "")
            .trim()
            .slice(0, 120) || null
        : null,
      ...(body.qty !== undefined && { qty: Math.max(0, num(body.qty)) }),
    },
  });

  // The loop closing: what this company actually paid becomes their own price
  // history, which is the honest way to fill in the unit costs the price books
  // ship unset. Only on the transition INTO purchased, so editing a supplier
  // name does not write a second identical data point.
  if (purchased && !line.purchasedAt && actualCost > 0) {
    await recordMaterialPrice({
      companyId: member.companyId,
      name: updated.name,
      unit: updated.unit,
      qty: num(updated.qty),
      actualCost,
    });
  }

  await taskForJobMaterials(id);
  return NextResponse.json(await listFor(id));
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "jobs", "view_create_edit", "change a job's materials");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const materialId = new URL(request.url).searchParams.get("materialId") || "";
  const line = await db.jobMaterial.findFirst({
    where: { id: materialId, jobId: id, job: { companyId: member.companyId } },
    select: { id: true },
  });
  if (!line) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.jobMaterial.delete({ where: { id: line.id } });
  await taskForJobMaterials(id);
  return NextResponse.json(await listFor(id));
}
