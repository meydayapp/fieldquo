// app/api/assets/route.js
//
// The asset register behind Settings → Overhead: the truck, the trailer, the
// spray rig. Capital items that were bought once and are used up over years.
//
// ── Why these are not Expense rows ─────────────────────────────────────────
//
// See the Asset model in prisma/schema.prisma. Short version: an Expense is
// money that left, and a $60,000 truck is money that turned into a thing whose
// cost lands over sixty months.
//
// ── Why this reuses the "fixedCosts" cost-basis gate ───────────────────────
//
// An asset's depreciation is a fixed monthly cost. It lands in the same
// overhead total as the rent, on the same screen, and it moves the same price
// floor — so it is the same class of data and it takes the same rule:
// jobCosting AND user:manage (lib/permissions/costBasis.js). A crew member
// holds neither and cannot read the register.
//
// Declaring a seventh resource key would have meant a second gate expression
// for one number, and the bug costBasis.js was written to fix was exactly two
// gates for one number disagreeing with each other — a route whose write
// succeeded where its read 403'd. One number, one rule.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import {
  requireCostBasisRead,
  requireCostBasisWrite,
} from "@/lib/permissions/costBasis";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
import { assetCharge } from "@/lib/accounting/depreciation";
import { recordActivity } from "@/lib/activity/log";

const SELECT = {
  id: true,
  name: true,
  cost: true,
  salvageValue: true,
  inServiceDate: true,
  usefulLifeMonths: true,
  disposedOn: true,
  active: true,
  debtId: true,
  notes: true,
  debt: { select: { id: true, name: true, monthlyPayment: true } },
};

/**
 * The row plus what it currently charges.
 *
 * Computed here rather than left to the browser: the same maths already
 * decides the company's price floor on the server, and a second copy in
 * client JavaScript is the copy that drifts — the screen would then disagree
 * with the number it is explaining.
 */
function withCharge(row, asOf) {
  const charge = assetCharge(row, asOf);
  return {
    ...row,
    monthlyDepreciation: Math.round(charge.monthly * 100) / 100,
    accumulatedDepreciation: Math.round(charge.accumulated * 100) / 100,
    bookValue: Math.round(charge.bookValue * 100) / 100,
    chargeable: charge.chargeable,
    // Why the charge is what it is. A $0 with no reason beside it reads as a
    // broken screen; "sold in March" reads as an answer.
    chargeReason: charge.reason,
  };
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireCostBasisRead(full, "fixedCosts");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const rows = await db.asset.findMany({
    where: { companyId: member.companyId },
    select: SELECT,
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  return NextResponse.json(rows.map((row) => withCharge(row, now)));
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Same rule as the read, deliberately: an asset row raises the company's
  // price floor on every quote written afterwards, so creating one you cannot
  // see is the sharpest version of the write/read mismatch costBasis.js
  // exists to prevent.
  const full = await loadEnforceableMember(db, member.id);
  try {
    requireCostBasisWrite(full, "fixedCosts");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const cost = Number(body?.cost);
  const salvageValue = body?.salvageValue === "" || body?.salvageValue == null
    ? 0
    : Number(body.salvageValue);
  const usefulLifeMonths = Number(body?.usefulLifeMonths);
  const debtId = body?.debtId || null;

  if (!name) {
    return NextResponse.json(
      { error: "Give the asset a name — the truck, the trailer, the spray rig." },
      { status: 400 },
    );
  }
  // `> 0`: a zero-cost asset depreciates nothing and would sit in the register
  // changing no number on the screen it was entered from — a row that appears
  // to work and doesn't.
  if (!Number.isFinite(cost) || cost <= 0) {
    return NextResponse.json(
      { error: "Enter what it cost, greater than zero." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(salvageValue) || salvageValue < 0) {
    return NextResponse.json(
      { error: "Salvage value can't be negative." },
      { status: 400 },
    );
  }
  // Refused rather than clamped. A salvage value above cost means the item
  // appreciates, the depreciable base would be negative, and a negative charge
  // would LOWER the company's price floor. The library floors it at zero as a
  // last defence; the person typing it deserves to be told instead.
  if (salvageValue >= cost) {
    return NextResponse.json(
      { error: "Salvage value has to be less than what it cost — otherwise there's nothing to depreciate." },
      { status: 400 },
    );
  }
  // No default life. Inventing five years for a blank field is padding absent
  // data with a default, and the output is a price floor (AGENTS.md #5).
  // 600 months is fifty years, past which this is a building, not equipment.
  if (!Number.isInteger(usefulLifeMonths) || usefulLifeMonths < 1 || usefulLifeMonths > 600) {
    return NextResponse.json(
      { error: "How many months will you get out of it? Between 1 and 600." },
      { status: 400 },
    );
  }

  const inServiceDate = body?.inServiceDate ? new Date(body.inServiceDate) : new Date();
  if (Number.isNaN(inServiceDate.getTime())) {
    return NextResponse.json({ error: "That in-service date isn't a date." }, { status: 400 });
  }

  // The linked loan has to be OURS. Without this a hand-written POST could
  // point an asset at another tenant's Debt row, and the response below
  // includes that debt's name and payment.
  const badLink = await ownedIdsRefusal(NextResponse, db, member.companyId, { debtId });
  if (badLink) return badLink;

  const created = await db.asset.create({
    data: {
      companyId: member.companyId,
      name,
      cost,
      salvageValue,
      usefulLifeMonths,
      inServiceDate,
      debtId,
      notes: typeof body?.notes === "string" ? body.notes.trim() || null : null,
    },
    select: SELECT,
  });

  await recordActivity(member, {
    action: "settings.asset_added",
    entityType: "settings",
    entityId: created.id,
    summary: `Added asset ${name} at $${cost} over ${usefulLifeMonths} months`,
    metadata: { name, cost, usefulLifeMonths, linkedToDebt: !!debtId },
  });

  return NextResponse.json(withCharge(created, new Date()), { status: 201 });
}
