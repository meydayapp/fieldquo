// app/api/jobs/[id]/materials/shopping-list/route.js
//
// "Add to shopping list": the short lines of a job's material list become
// lines on a DRAFT purchase order for that job — the same PurchaseOrder the
// Purchasing page raises by hand, not a second list that would drift from it.
//
// ── One open draft per job ──────────────────────────────────────────────────
//
// Pressing the button twice appends to the job's existing draft rather than
// raising a second PO-0xx, and a line already on the draft (same description
// and unit) is not added again. The draft is theirs to price, send and
// receive on the Purchasing page; nothing here sets a supplier or a status.
//
// ── The quantity is the SHORTFALL ───────────────────────────────────────────
//
// A line matched to stock with 9 on the shelf and 10 needed goes on the order
// as 1, not 10. An untracked line goes on as the full need. Never a price the
// model produced: `unitCost` is the takeoff's own rate where the line has one
// and null otherwise, so the PO's expectedTotal reads "unpriced" rather than
// a guess. Next 16: params is a Promise.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { assignedJobWhere } from "@/lib/permissions/enforce";
import { recordActivity } from "@/lib/activity/log";
import { nextPoNumber } from "@/lib/purchasing/poNumber";
import { PURCHASING_CATEGORY, PURCHASING_LEVEL, shapePurchaseOrder } from "@/lib/purchasing/access";
import { stockLevels } from "@/lib/purchasing/stock";
import { onHandStatus } from "@/lib/materials/list";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Raising an order is purchasing, so it asks purchasing's level — the same
  // one POST /api/purchase-orders asks. Ticking the list is crew work; putting
  // it on an order is not.
  const { full, response: denied } = await levelOrRefusal(
    member,
    PURCHASING_CATEGORY,
    PURCHASING_LEVEL,
    "raise a purchase order",
  );
  if (denied) return denied;

  const job = await db.job.findFirst({
    where: { id, companyId: member.companyId, ...assignedJobWhere(full) },
    select: { id: true, title: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const wanted = Array.isArray(body.materialIds)
    ? new Set(body.materialIds.map((v) => String(v)))
    : null;

  const lines = await db.jobMaterial.findMany({
    where: { jobId: id, excludedAt: null, purchasedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  // The shortfall, from the same arithmetic the panel shows.
  const stockIds = [...new Set(lines.map((m) => m.stockMaterialId).filter(Boolean))];
  const levels = new Map();
  if (stockIds.length) {
    const [rows, movements] = await Promise.all([
      db.material.findMany({
        where: { id: { in: stockIds }, companyId: member.companyId },
        select: { id: true, name: true, unit: true, reorderThreshold: true },
      }),
      db.stockMovement.findMany({
        where: { companyId: member.companyId, materialId: { in: stockIds } },
        select: { materialId: true, quantity: true },
      }),
    ]);
    for (const l of stockLevels(rows, movements)) levels.set(l.materialId, l);
  }

  const toOrder = [];
  for (const m of lines) {
    if (wanted && !wanted.has(m.id)) continue;
    const level = m.stockMaterialId ? levels.get(m.stockMaterialId) : null;
    const status = onHandStatus(num(m.qty), level ? level.level : null);
    // With no explicit selection, only the SHORT and untracked lines go on —
    // a line the shelf already covers is not a purchase.
    if (!wanted && status.status === "covered") continue;
    const quantity = status.status === "short" ? status.short : num(m.qty);
    if (quantity <= 0) continue;
    toOrder.push({
      description: m.name,
      materialId: level ? m.stockMaterialId : null,
      quantity,
      unit: m.unit,
      unitCost: m.estUnitCost == null ? null : num(m.estUnitCost),
    });
  }
  if (!toOrder.length) {
    return NextResponse.json(
      { error: "Nothing is short — every line is either bought or covered by the shelf." },
      { status: 400 },
    );
  }

  const existing = await db.purchaseOrder.findFirst({
    where: { companyId: member.companyId, jobId: id, status: "draft" },
    include: { lines: true, supplier: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  let order = existing;
  if (order) {
    const have = new Set(order.lines.map((l) => `${l.description.toLowerCase()}|${l.unit || ""}`));
    const fresh = toOrder.filter((l) => !have.has(`${l.description.toLowerCase()}|${l.unit || ""}`));
    if (fresh.length) {
      await db.purchaseOrderLine.createMany({
        data: fresh.map((l) => ({ ...l, purchaseOrderId: order.id })),
      });
    }
    order = await db.purchaseOrder.findUnique({
      where: { id: order.id },
      include: { lines: { orderBy: { createdAt: "asc" } }, supplier: { select: { name: true } } },
    });
    return NextResponse.json({ order: shapePurchaseOrder(order), added: fresh.length, appended: true });
  }

  // Same retry on the in-company number race as POST /api/purchase-orders.
  let created = null;
  for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
    const numbers = await db.purchaseOrder.findMany({
      where: { companyId: member.companyId },
      select: { number: true },
    });
    try {
      created = await db.purchaseOrder.create({
        data: {
          companyId: member.companyId,
          jobId: id,
          number: nextPoNumber(numbers.map((p) => p.number)),
          status: "draft",
          // Unpriced until every line has a rate — an understatement dressed
          // as a total is the thing PurchaseOrder.expectedTotal's comment warns
          // about.
          expectedTotal: null,
          notes: `Shopping list for ${job.title}`,
          lines: { create: toOrder },
        },
        include: { lines: { orderBy: { createdAt: "asc" } }, supplier: { select: { name: true } } },
      });
    } catch (err) {
      if (err?.code !== "P2002") throw err;
    }
  }
  if (!created) {
    return NextResponse.json(
      { error: "Couldn't allocate a purchase order number just now. Try again." },
      { status: 503 },
    );
  }

  await recordActivity(member, {
    action: "purchaseOrder.created",
    entityType: "purchaseOrder",
    entityId: created.id,
    summary: `Raised ${created.number} from the material list for ${job.title}`,
  });

  return NextResponse.json({ order: shapePurchaseOrder(created), added: toOrder.length, appended: false }, { status: 201 });
}
