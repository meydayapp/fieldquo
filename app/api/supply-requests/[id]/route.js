// app/api/supply-requests/[id]/route.js
//
// Moving one request along: requested → ordered → restocked, or cancelled.
//
// ── Restocked writes the movement, and writes it once ──────────────────────
//
// "Restocked" is the delivery. It creates the `received` StockMovement for a
// request matched to a stock material, records that movement's id on the
// request, and moves the status — all in ONE transaction that re-reads the
// row first. Two office tabs pressing Restocked together: the second re-read
// sees `restocked` and refuses; if both somehow pass, the ledger's unique
// `ref` (supply_request:<id>) refuses the second movement and the
// transaction rolls back. The level stays the sum of movements, as
// lib/purchasing/stock.js insists — nothing here edits a level.
//
// ── Who ────────────────────────────────────────────────────────────────────
//
// Ordered and Restocked are purchasing (expenses: view_record_edit_all).
// Cancelling a request that is still `requested` may also be done by the
// person who asked — they changed their mind before anybody acted.
// Next 16: params is a Promise.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";
import { recordActivity } from "@/lib/activity/log";
import { notifyEvent } from "@/lib/notifications/notify";
import { PURCHASING_CATEGORY, PURCHASING_LEVEL, text } from "@/lib/purchasing/access";
import { transition, restockMovementFor } from "@/lib/supplies/state";
import { shapeRequest, REQUEST_INCLUDE, num } from "@/lib/supplies/shape";

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const full = await loadEnforceableMember(db, member.id);
  const office = hasLevel(full, PURCHASING_CATEGORY, PURCHASING_LEVEL);

  const existing = await db.supplyRequest.findFirst({
    where: { id, companyId: member.companyId },
    include: REQUEST_INCLUDE,
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const to = String(body.status || "");
  const step = transition(existing.status, to);
  if (!step.ok) return NextResponse.json({ error: step.error }, { status: 400 });

  const mine = existing.requestedById === member.userId;
  if (to === "cancelled" ? !(office || mine) : !office) {
    return NextResponse.json(
      { error: "Only someone with purchasing access can move a request along." },
      { status: 403 },
    );
  }

  let purchaseOrderId = null;
  if (to === "ordered") {
    // Which PO, if any. Re-read inside this company — a foreign key the
    // browser chose. Optional: "ordered" at the counter with no PO is real.
    purchaseOrderId = text(body.purchaseOrderId, 64);
    if (purchaseOrderId) {
      const po = await db.purchaseOrder.findFirst({
        where: { id: purchaseOrderId, companyId: member.companyId },
        select: { id: true },
      });
      if (!po) return NextResponse.json({ error: "That purchase order isn't yours." }, { status: 400 });
    }
  }

  const restockNote = to === "restocked" ? text(body.note, 200) : null;
  const now = new Date();

  let updated;
  try {
    updated = await db.$transaction(async (tx) => {
      // Re-read under the transaction: the status the decision was made on
      // must be the status being changed.
      const fresh = await tx.supplyRequest.findUnique({ where: { id }, select: { status: true, restockMovementId: true } });
      const again = transition(fresh?.status, to);
      if (!again.ok) throw Object.assign(new Error(again.error), { status: 400 });

      let restockMovementId = null;
      if (to === "restocked") {
        if (fresh.restockMovementId) throw Object.assign(new Error("Already restocked."), { status: 400 });
        const movement = restockMovementFor({ ...existing, restockNote });
        if (movement) {
          // The material must still be this company's — StockMovement has no
          // foreign key, so this check is the whole boundary.
          const material = await tx.material.findFirst({
            where: { id: movement.materialId, companyId: member.companyId },
            select: { id: true },
          });
          if (material) {
            const row = await tx.stockMovement.create({
              data: {
                companyId: member.companyId,
                materialId: movement.materialId,
                quantity: movement.quantity,
                kind: movement.kind,
                jobId: movement.jobId,
                note: movement.note,
                ref: movement.ref,
                createdById: member.userId || null,
              },
              select: { id: true },
            });
            restockMovementId = row.id;
          }
        }
      }

      return tx.supplyRequest.update({
        where: { id },
        data: {
          status: to,
          ...(to === "ordered" && { purchaseOrderId, orderedAt: now, orderedById: member.userId }),
          ...(to === "restocked" && { restockedAt: now, restockedById: member.userId, restockNote, restockMovementId }),
          ...(to === "cancelled" && { cancelledAt: now }),
        },
        include: REQUEST_INCLUDE,
      });
    });
  } catch (err) {
    if (err?.status === 400) return NextResponse.json({ error: err.message }, { status: 400 });
    // P2002 on the movement's ref: the delivery is already on the ledger.
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "This request's delivery is already on the stock ledger." }, { status: 409 });
    }
    throw err;
  }

  await recordActivity(member, {
    action: `supplyRequest.${to}`,
    entityType: "supplyRequest",
    entityId: updated.id,
    summary: `${updated.itemName}: ${to}${restockNote ? ` — ${restockNote}` : ""}`,
  });

  // The requester hears about the two answers. Narrowed to them by
  // recipientUserIds; the actor is never notified of their own action, so an
  // office member restocking their own request simply sees the row change.
  if (to === "ordered" || to === "restocked") {
    void notifyEvent({
      companyId: member.companyId,
      type: `supply.${to}`,
      entityId: updated.id,
      actorUserId: member.userId,
      recipientUserIds: [updated.requestedById],
      params: {
        item: updated.itemName,
        quantity: `${num(updated.quantity)}${updated.unit ? ` ${updated.unit}` : ""}`,
        ...(to === "restocked" && { where: restockNote || "" }),
      },
    });
  }

  return NextResponse.json({ request: shapeRequest(updated) });
}
