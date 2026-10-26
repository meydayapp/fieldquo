// app/api/stock/purchase/route.js
//
// "I bought this for the shelf." One call: the material exists afterwards,
// the quantity is on the shelf, and what it cost is in the price history.
//
// ══ Why this is not just POST /api/stock/movements ═════════════════════════
//
// That route moves stock that ALREADY EXISTS — it takes a materialId, re-reads
// it inside the company, and refuses anything else. Correct for what it does,
// and useless for the thing the owner asked for on 2026-10-25: "make somewhere
// i can enter stock i buy for future jobs and are stored as inventory".
//
// Materials could only be born one way in this codebase — lib/jobs/
// sourcingList.js, off a job's material list. `material.create` appeared
// exactly once in the whole repo. So stock bought BEFORE there is a job to
// hang it on had no way into the system at all: the movement form asked
// "Which material?" and the answer was not in the list and could not be put
// there. Purchasing › Stock showed one row, "Primer (2 coats) — 0 gal",
// because a job had once asked for primer.
//
// ══ Why the price goes through recordMaterialPrice ═════════════════════════
//
// Because it already exists and already does the hard half: find-or-create the
// material, write a MaterialPriceEntry (which carries the SUPPLIER — the field
// the owner went looking for on the movement form and did not find), then
// recompute Material.currentAvgCost from every entry rather than nudging it,
// "so one mistyped receipt is diluted by the others, not baked in".
//
// Writing a second averaging loop here is AGENTS.md failure class 4, and the
// copy would be the one that rots. The material is found-or-created HERE
// first so that a purchase with no price still lands; recordMaterialPrice then
// finds that same row by name rather than creating a second one.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findOrCreateMaterial } from "@/lib/stock/findOrCreateMaterial";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { recordActivity } from "@/lib/activity/log";
import { normaliseMovement } from "@/lib/purchasing/stock";
import { PURCHASING_CATEGORY, PURCHASING_LEVEL, text } from "@/lib/purchasing/access";
import { recordMaterialPrice } from "@/lib/jobs/sourcingList";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { response: denied } = await levelOrRefusal(
    member,
    PURCHASING_CATEGORY,
    PURCHASING_LEVEL,
    "add stock",
  );
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));

  const name = text(body.name, 200);
  if (!name) {
    return NextResponse.json({ error: "What did you buy?" }, { status: 400 });
  }

  const quantity = num(body.quantity);
  if (quantity === null || quantity <= 0) {
    return NextResponse.json({ error: "How many did you buy?" }, { status: 400 });
  }

  // The sign and the ledger shape come from the same place every other
  // movement uses, so a purchase cannot be recorded in a way the stock total
  // would read differently from a receipt against a purchase order.
  const normalised = normaliseMovement({ kind: "received", quantity });
  if (!normalised.ok) {
    return NextResponse.json({ error: normalised.error }, { status: 400 });
  }

  const unit = text(body.unit, 40) || null;
  const supplier = text(body.supplier, 200) || null;
  const note = text(body.note, 500) || null;
  const totalCost = num(body.totalCost);

  // One shelf per material, found by name. The rule lives in
  // lib/stock/findOrCreateMaterial.js because purchase orders need the same
  // one, and two copies is how "Frog tape" and "Frog Tape" become two shelves.
  const material = await findOrCreateMaterial({
    companyId: member.companyId,
    name,
    unit,
  });

  // A material that existed with no unit, bought with one, learns it. The
  // reverse is never true: a unit already on the row is the one the shelf has
  // been counted in, and overwriting it would silently restate every movement
  // behind it.
  if (!material.created && !material.unit && unit) {
    await db.material.update({ where: { id: material.id }, data: { unit } });
  }

  const movement = await db.stockMovement.create({
    data: {
      companyId: member.companyId,
      materialId: material.id,
      quantity: normalised.quantity,
      kind: "received",
      note,
      occurredAt: new Date(),
      createdById: member.userId || null,
    },
    select: { id: true, quantity: true, occurredAt: true },
  });

  // Price is OPTIONAL — somebody putting stock on a shelf may not have the
  // receipt to hand, and refusing the quantity over a missing figure would
  // lose the fact that matters most. recordMaterialPrice refuses a
  // non-positive total on its own, so this only asks when there is something
  // to record.
  let unitPrice = null;
  if (totalCost !== null && totalCost > 0) {
    const priced = await recordMaterialPrice({
      companyId: member.companyId,
      name: material.name,
      unit: material.unit || unit,
      qty: quantity,
      actualCost: totalCost,
      supplier,
    });
    unitPrice = priced?.unitPrice ?? null;
  }

  await recordActivity(member, {
    action: "stock.movement",
    entityType: "material",
    entityId: material.id,
    summary: `Bought for stock: ${normalised.quantity} ${material.name}`,
  });

  return NextResponse.json({
    material: { id: material.id, name: material.name, unit: material.unit || unit },
    movement: { id: movement.id, quantity: String(movement.quantity) },
    unitPrice,
    created: material.created,
  });
}
