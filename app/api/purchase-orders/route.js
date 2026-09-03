// app/api/purchase-orders/route.js
//
// Purchase orders: the list, and raising one.
//
// ── The number is per company ───────────────────────────────────────────────
//
// `@@unique([companyId, number])` on the model, and lib/purchasing/poNumber.js
// only ever sees ONE company's numbers. Two companies both having PO-001 is
// correct — see that file's header for why a global sequence would be a leak
// as well as a surprise.
//
// The collision that IS possible is two people in the SAME company raising an
// order in the same second. Both read the same highest number and both try to
// write it; the unique index refuses the second. That is handled below by
// retrying rather than by locking, because a retry is cheap, correct, and does
// not hold a transaction open across a human's form submission.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { recordActivity } from "@/lib/activity/log";
import { nextPoNumber } from "@/lib/purchasing/poNumber";
import { toMilli, fromMilli } from "@/lib/purchasing/quantity";
import {
  PURCHASING_CATEGORY,
  PURCHASING_LEVEL,
  shapePurchaseOrder,
  text,
} from "@/lib/purchasing/access";
import { toCents, centsToAmount } from "@/lib/receipts/money";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { response: denied } = await levelOrRefusal(
    member,
    PURCHASING_CATEGORY,
    PURCHASING_LEVEL,
    "see purchase orders",
  );
  if (denied) return denied;

  const status = new URL(request.url).searchParams.get("status") || "";

  const orders = await db.purchaseOrder.findMany({
    where: { companyId: member.companyId, ...(status ? { status } : {}) },
    include: { supplier: { select: { name: true } }, lines: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ orders: orders.map(shapePurchaseOrder) });
}

/**
 * Lines, validated before anything is written.
 *
 * A quantity that cannot be read is refused rather than stored as zero: a
 * purchase order line for zero of something is an order for nothing, and it
 * would then read as fully received the moment anybody looked at it.
 */
function readLines(raw, companyMaterialIds) {
  const rows = Array.isArray(raw) ? raw : [];
  const lines = [];

  for (const [i, line] of rows.entries()) {
    const description = text(line?.description, 300);
    if (!description) return { error: `Line ${i + 1} needs a description.` };

    const qty = toMilli(line?.quantity);
    if (qty === null) return { error: `Line ${i + 1}: that quantity couldn't be read.` };
    if (qty <= 0) return { error: `Line ${i + 1} needs a quantity above zero.` };

    // A materialId is a foreign key the browser chose. Checked against THIS
    // company's materials — a route that refuses to read another tenant's row
    // and then happily stores a pointer to one is the exact hole
    // scripts/check-tenant-scope.mjs was written for.
    const materialId = text(line?.materialId, 64);
    if (materialId && !companyMaterialIds.has(materialId)) {
      return { error: `Line ${i + 1} refers to a material that isn't yours.` };
    }

    const unitCostCents = toCents(line?.unitCost);

    lines.push({
      description,
      materialId: materialId || null,
      quantity: fromMilli(qty),
      unit: text(line?.unit, 24),
      unitCost: unitCostCents === null ? null : centsToAmount(unitCostCents),
    });
  }

  return { lines };
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { response: denied } = await levelOrRefusal(
    member,
    PURCHASING_CATEGORY,
    PURCHASING_LEVEL,
    "raise a purchase order",
  );
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));

  // Both foreign keys are re-read inside this company before they are stored.
  let supplierId = text(body.supplierId, 64);
  if (supplierId) {
    const supplier = await db.supplier.findFirst({
      where: { id: supplierId, companyId: member.companyId },
      select: { id: true },
    });
    if (!supplier) {
      return NextResponse.json({ error: "That supplier isn't yours." }, { status: 400 });
    }
  } else {
    supplierId = null;
  }

  let jobId = text(body.jobId, 64);
  if (jobId) {
    const job = await db.job.findFirst({
      where: { id: jobId, companyId: member.companyId },
      select: { id: true },
    });
    if (!job) {
      return NextResponse.json({ error: "That job isn't yours." }, { status: 400 });
    }
  } else {
    jobId = null;
  }

  const materials = await db.material.findMany({
    where: { companyId: member.companyId },
    select: { id: true },
  });
  const { lines, error } = readLines(body.lines, new Set(materials.map((m) => m.id)));
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (!lines.length) {
    return NextResponse.json({ error: "A purchase order needs at least one line." }, { status: 400 });
  }

  // ── expectedTotal is computed here, never accepted from the browser ───────
  //
  // Same rule as add-on repricing (AGENTS.md non-negotiable #5): the client
  // posts quantities and unit costs, the server does the multiplication. In
  // cents, one line at a time, so no float ever touches it.
  let expectedCents = 0;
  let priced = true;
  for (const line of lines) {
    if (line.unitCost === null) {
      priced = false;
      break;
    }
    const qtyMilli = toMilli(line.quantity);
    const unitCents = toCents(line.unitCost);
    expectedCents += Math.round((qtyMilli * unitCents) / 1000);
  }

  const notes = text(body.notes, 4000);
  const expectedAt = body.expectedAt ? new Date(body.expectedAt) : null;

  // Retry on the in-company race described in the header. Five attempts is
  // generous for a collision that needs two people in the same second.
  let created = null;
  let lastError = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await db.purchaseOrder.findMany({
      where: { companyId: member.companyId },
      select: { number: true },
    });
    const number = nextPoNumber(existing.map((p) => p.number));

    try {
      created = await db.purchaseOrder.create({
        data: {
          companyId: member.companyId,
          supplierId,
          jobId,
          number,
          status: "draft",
          // `null` when any line is unpriced. A partial sum presented as the
          // expected total is an understatement dressed as a fact — the same
          // call JobMaterial's sourcing panel already makes for `unpriced`.
          expectedTotal: priced ? centsToAmount(expectedCents) : null,
          currency: text(body.currency, 3),
          expectedAt: expectedAt && !Number.isNaN(expectedAt.getTime()) ? expectedAt : null,
          notes,
          lines: { create: lines },
        },
        include: { supplier: { select: { name: true } }, lines: true },
      });
      break;
    } catch (err) {
      // P2002 is the unique index doing its job. Anything else is a real
      // failure and must not be retried into a loop.
      if (err?.code !== "P2002") throw err;
      lastError = err;
    }
  }

  if (!created) {
    console.error("[purchase-orders] number collision persisted", lastError?.message);
    return NextResponse.json(
      { error: "Couldn't allocate a purchase order number just now. Try again." },
      { status: 503 },
    );
  }

  await recordActivity(member, {
    action: "purchaseOrder.created",
    entityType: "purchaseOrder",
    entityId: created.id,
    summary: `Raised ${created.number}${created.supplier?.name ? ` for ${created.supplier.name}` : ""}`,
  });

  return NextResponse.json({ order: shapePurchaseOrder(created) }, { status: 201 });
}
