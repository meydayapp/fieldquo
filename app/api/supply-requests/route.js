// app/api/supply-requests/route.js
//
// Supply requests: the list, and asking for one.
//
// ── Who may ask, who may see ────────────────────────────────────────────────
//
// ASKING is crew work: any member with a session may post a request, for a
// job they are on (assignedJobWhere) or for stock in general. That is the
// whole point — the crew member at a house with two rolls of tape left has no
// button today.
//
// SEEING all of them is purchasing: the office list requires the same
// `expenses: view_record_edit_all` rung as every other purchasing route
// (lib/purchasing/access.js). A member without it gets their OWN requests,
// which is what the phone screen shows, and is told so in the payload
// (`scope: "mine"`) rather than left to infer it from a short list.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, hasLevel, assignedJobWhere } from "@/lib/permissions/enforce";
import { recordActivity } from "@/lib/activity/log";
import { notifyEvent } from "@/lib/notifications/notify";
import { PURCHASING_CATEGORY, PURCHASING_LEVEL } from "@/lib/purchasing/access";
import { stockLevels } from "@/lib/purchasing/stock";
import { normaliseRequest, lowStockPrefills, SUPPLY_STATUSES } from "@/lib/supplies/state";
import { shapeRequest, REQUEST_INCLUDE as INCLUDE, num } from "@/lib/supplies/shape";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const full = await loadEnforceableMember(db, member.id);
  const office = hasLevel(full, PURCHASING_CATEGORY, PURCHASING_LEVEL);

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";
  const where = {
    companyId: member.companyId,
    ...(office ? {} : { requestedById: member.userId }),
    ...(status && SUPPLY_STATUSES.includes(status) ? { status } : {}),
  };

  const rows = await db.supplyRequest.findMany({
    where,
    include: INCLUDE,
    orderBy: [{ createdAt: "desc" }],
    take: 300,
  });

  // PO numbers, looked up rather than related — the request keeps the id
  // even if the order is later cancelled.
  const poIds = [...new Set(rows.map((r) => r.purchaseOrderId).filter(Boolean))];
  const pos = poIds.length
    ? await db.purchaseOrder.findMany({
        where: { id: { in: poIds }, companyId: member.companyId },
        select: { id: true, number: true },
      })
    : [];
  const numbers = new Map(pos.map((p) => [p.id, p.number]));
  const requests = rows.map((r) => shapeRequest({ ...r, purchaseOrderNumber: numbers.get(r.purchaseOrderId) }));

  // The reorder banner's pre-fills — office only, from the same arithmetic
  // the Stock tab uses, minus anything already asked for.
  let lowStock = [];
  if (office) {
    const [materials, movements] = await Promise.all([
      db.material.findMany({
        where: { companyId: member.companyId },
        select: { id: true, name: true, unit: true, reorderThreshold: true },
        orderBy: { name: "asc" },
      }),
      db.stockMovement.findMany({
        where: { companyId: member.companyId },
        select: { materialId: true, quantity: true },
      }),
    ]);
    lowStock = lowStockPrefills(stockLevels(materials, movements), rows);
  }

  return NextResponse.json({
    requests,
    scope: office ? "company" : "mine",
    open: requests.filter((r) => r.status === "requested" || r.status === "ordered").length,
    lowStock,
  });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const full = await loadEnforceableMember(db, member.id);

  const body = await request.json().catch(() => ({}));
  const materials = await db.material.findMany({
    where: { companyId: member.companyId },
    select: { id: true, name: true, unit: true },
  });
  const { row, error } = normaliseRequest(body, { materials });
  if (error) return NextResponse.json({ error }, { status: 400 });

  // The job is re-read inside this company AND inside the caller's scope: a
  // crew member may only ask for a job they are on, the same rule the job
  // page itself follows.
  let jobId = body.jobId ? String(body.jobId).slice(0, 64) : null;
  if (jobId) {
    const job = await db.job.findFirst({
      where: { id: jobId, companyId: member.companyId, ...assignedJobWhere(full) },
      select: { id: true },
    });
    if (!job) return NextResponse.json({ error: "That job isn't yours." }, { status: 400 });
  } else {
    jobId = null;
  }

  // The low-stock pre-fill may only be claimed by purchasing; a crew phone
  // posting source: "low_stock" is a crew request.
  const source =
    row.source === "field" || hasLevel(full, PURCHASING_CATEGORY, PURCHASING_LEVEL) ? row.source : "field";

  const created = await db.supplyRequest.create({
    data: { ...row, source, companyId: member.companyId, jobId, requestedById: member.userId },
    include: INCLUDE,
  });

  await recordActivity(member, {
    action: "supplyRequest.created",
    entityType: "supplyRequest",
    entityId: created.id,
    summary: `Asked for ${created.quantity} ${created.unit || ""} ${created.itemName}`.replace(/\s+/g, " "),
  });

  // Tell purchasing. Fire-and-forget after the row is committed; a failed
  // push must not un-ask the question.
  void notifyEvent({
    companyId: member.companyId,
    type: "supply.requested",
    entityId: created.id,
    actorUserId: member.userId,
    actorName: created.requestedBy?.name || null,
    params: {
      fromName: created.requestedBy?.name || "Someone",
      item: created.itemName,
      quantity: `${num(created.quantity)}${created.unit ? ` ${created.unit}` : ""}`,
    },
  });

  return NextResponse.json({ request: shapeRequest(created) }, { status: 201 });
}
