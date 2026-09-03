// app/api/purchase-orders/[id]/receive/route.js
//
// Taking delivery — the half of purchasing that actually happens in a yard.
//
// ══ Partial is the normal case ═════════════════════════════════════════════
//
// `PurchaseOrderLine.quantityReceived` is a quantity and not a boolean because
// "twelve of the forty turned up" is Tuesday. This endpoint takes a delivery
// NOTE — what is on the van right now — and adds it to what has already
// arrived. It never takes a running total, because a second person entering a
// second delivery would then have to know what the first one said.
//
// ══ Every received quantity becomes a stock movement ═══════════════════════
//
// For lines that name a material. The level is summed from movements and never
// stored (see lib/purchasing/stock.js), so a delivery that updated
// `quantityReceived` and wrote no movement would be a delivery that never
// reached stock — and the reorder alert would keep firing on material sitting
// in the van.
//
// ══ Why one transaction and an idempotency key ════════════════════════════
//
// A driveway connection retries. Without a key, a double-submitted delivery
// note books the stock twice, and a stock ledger is exactly the wrong place to
// find out about a lost round trip. `StockMovement.ref` is unique for this
// reason — the schema comment calls it "idempotency for anything
// machine-written" — so the second attempt collides on the index and this
// answers "already recorded" instead of doubling the shelf.
//
// Next 16: params is a Promise.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { recordActivity } from "@/lib/activity/log";
import { applyDelivery } from "@/lib/purchasing/receiving";
import { toMilli, fromMilli } from "@/lib/purchasing/quantity";
import {
  PURCHASING_CATEGORY,
  PURCHASING_LEVEL,
  shapePurchaseOrder,
  text,
} from "@/lib/purchasing/access";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { response: denied } = await levelOrRefusal(
    member,
    PURCHASING_CATEGORY,
    PURCHASING_LEVEL,
    "take delivery of a purchase order",
  );
  if (denied) return denied;

  const order = await db.purchaseOrder.findFirst({
    where: { id, companyId: member.companyId },
    include: { supplier: { select: { name: true } }, lines: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (order.status === "cancelled") {
    return NextResponse.json(
      { error: "That order was cancelled. Raise a new one for anything that turns up anyway." },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => ({}));

  const key = text(body.idempotencyKey, 80);
  if (!key) {
    // Required, not defaulted. A server-generated key would be a different key
    // on every retry, which is the same as having none — and the whole point
    // is that the RETRY carries the key the first attempt used.
    return NextResponse.json(
      { error: "This delivery is missing its idempotency key." },
      { status: 400 },
    );
  }

  const result = applyDelivery({
    lines: order.lines,
    received: body.received,
    current: order.status,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  if (!result.applied) {
    return NextResponse.json(
      { error: "Nothing on this delivery note. Enter what actually turned up." },
      { status: 400 },
    );
  }

  const byId = new Map(order.lines.map((l) => [l.id, l]));
  const note = text(body.note, 500);
  const now = new Date();

  try {
    await db.$transaction(async (tx) => {
      for (const line of result.lines) {
        if (!line.appliedMilli) continue;
        await tx.purchaseOrderLine.update({
          where: { id: line.id },
          data: { quantityReceived: line.quantityReceived },
        });

        const source = byId.get(line.id);
        // A free-text line ("delivery charge", "pallet deposit") has no
        // material and therefore no shelf to land on. Received, not stocked —
        // and deliberately not invented into a Material, because a materials
        // list that grows a row every time a supplier charges for a pallet is
        // a list nobody can use.
        if (!source?.materialId) continue;

        await tx.stockMovement.create({
          data: {
            companyId: member.companyId,
            materialId: source.materialId,
            quantity: fromMilli(line.appliedMilli),
            kind: "received",
            purchaseOrderId: order.id,
            jobId: order.jobId || null,
            note: note || `Delivery against ${order.number}`,
            ref: `po_receive:${key}:${line.id}`,
            occurredAt: now,
            createdById: member.userId || null,
          },
        });
      }

      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: {
          status: result.status,
          // Set once, when the last line lands. Re-dating it on a later
          // correction would lose when the order actually completed.
          receivedAt: result.status === "received" ? order.receivedAt || now : null,
        },
      });
    });
  } catch (err) {
    if (err?.code === "P2002") {
      // The unique `ref` did its job: this exact delivery note is already in
      // the ledger. Answer with the order as it stands — a retry that says
      // "already done" is a success from the phone's point of view.
      const fresh = await db.purchaseOrder.findFirst({
        where: { id: order.id, companyId: member.companyId },
        include: { supplier: { select: { name: true } }, lines: { orderBy: { createdAt: "asc" } } },
      });
      return NextResponse.json({
        order: shapePurchaseOrder(fresh),
        alreadyRecorded: true,
        overDelivered: [],
      });
    }
    throw err;
  }

  const updated = await db.purchaseOrder.findFirst({
    where: { id: order.id, companyId: member.companyId },
    include: { supplier: { select: { name: true } }, lines: { orderBy: { createdAt: "asc" } } },
  });

  await recordActivity(member, {
    action: "purchaseOrder.received",
    entityType: "purchaseOrder",
    entityId: order.id,
    summary: `Delivery against ${order.number} — now ${result.status}`,
    metadata: {
      lines: result.lines
        .filter((l) => l.appliedMilli)
        .map((l) => ({ id: l.id, received: fromMilli(l.appliedMilli) })),
    },
  });

  return NextResponse.json({
    order: shapePurchaseOrder(updated),
    // Reported, never clamped. Somebody has to decide whether the extra gets
    // paid for — see lib/purchasing/receiving.js's header.
    overDelivered: result.overDelivered,
  });
}

// Kept next to the write it serves: the quantity outstanding on each line, so
// the delivery form can prefill "what's left" without the browser doing
// Decimal arithmetic of its own.
export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { response: denied } = await levelOrRefusal(
    member,
    PURCHASING_CATEGORY,
    PURCHASING_LEVEL,
    "see purchase orders",
  );
  if (denied) return denied;

  const order = await db.purchaseOrder.findFirst({
    where: { id, companyId: member.companyId },
    include: { lines: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    outstanding: order.lines.map((l) => {
      const ordered = toMilli(l.quantity);
      const received = toMilli(l.quantityReceived) ?? 0;
      return {
        id: l.id,
        description: l.description,
        unit: l.unit,
        outstanding: ordered === null ? null : fromMilli(Math.max(0, ordered - received)),
      };
    }),
  });
}
