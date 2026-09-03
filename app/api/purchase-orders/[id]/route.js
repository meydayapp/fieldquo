// app/api/purchase-orders/[id]/route.js
//
// One purchase order: read it, send it, cancel it.
//
// ── What PATCH deliberately cannot do ──────────────────────────────────────
//
// It cannot set the status to "received" or "partial". Those two are DERIVED
// from what the lines say has arrived — lib/purchasing/receiving.js's
// derivedStatus() — and an endpoint that let someone type "received" onto an
// order with nothing received against it would be a status that disagrees with
// its own lines. The order would look closed on the list and still be owed
// forty sheets of plywood on the detail screen.
//
// Taking delivery is POST ./receive, which is the only thing that moves an
// order into partial or received.
//
// Next 16: params is a Promise.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { recordActivity } from "@/lib/activity/log";
import {
  PURCHASING_CATEGORY,
  PURCHASING_LEVEL,
  shapePurchaseOrder,
  text,
} from "@/lib/purchasing/access";

/** The two a person may set by hand, and what each one means. */
const SETTABLE = {
  sent: "The order has gone to the supplier.",
  cancelled: "The order will not be filled.",
};

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
    include: { supplier: { select: { name: true } }, lines: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ order: shapePurchaseOrder(order) });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { response: denied } = await levelOrRefusal(
    member,
    PURCHASING_CATEGORY,
    PURCHASING_LEVEL,
    "change a purchase order",
  );
  if (denied) return denied;

  const order = await db.purchaseOrder.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, number: true, status: true, orderedAt: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data = {};

  if (Object.hasOwn(body, "status")) {
    const status = String(body.status || "");
    if (!Object.hasOwn(SETTABLE, status)) {
      return NextResponse.json(
        {
          error:
            "A purchase order is marked partial or received by taking delivery, not by setting a status. You can send it or cancel it.",
        },
        { status: 400 },
      );
    }
    if (order.status === "cancelled") {
      return NextResponse.json({ error: "That order is cancelled." }, { status: 409 });
    }
    if (status === "sent" && order.status !== "draft") {
      return NextResponse.json({ error: "That order has already been sent." }, { status: 409 });
    }
    data.status = status;
    // Only on the transition, so re-saving notes later does not re-date the
    // order. Same reasoning as the purchasedAt tick on a JobMaterial.
    if (status === "sent" && !order.orderedAt) data.orderedAt = new Date();
  }

  if (Object.hasOwn(body, "notes")) data.notes = text(body.notes, 4000);
  if (Object.hasOwn(body, "expectedAt")) {
    const when = body.expectedAt ? new Date(body.expectedAt) : null;
    data.expectedAt = when && !Number.isNaN(when.getTime()) ? when : null;
  }

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const updated = await db.purchaseOrder.update({
    where: { id: order.id },
    data,
    include: { supplier: { select: { name: true } }, lines: { orderBy: { createdAt: "asc" } } },
  });

  if (data.status) {
    await recordActivity(member, {
      action: `purchaseOrder.${data.status}`,
      entityType: "purchaseOrder",
      entityId: updated.id,
      summary: `${updated.number}: ${SETTABLE[data.status]}`,
    });
  }

  return NextResponse.json({ order: shapePurchaseOrder(updated) });
}
