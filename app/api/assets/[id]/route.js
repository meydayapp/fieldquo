// app/api/assets/[id]/route.js
//
// Editing one asset. Two operations that matter and one that is housekeeping:
//
//   PATCH  disposedOn  — sold, traded in, written off. This is the honest end
//                        of an asset's life and it STOPS the charge from that
//                        date, which is what a delete cannot do: the months it
//                        was in service really did cost the business money.
//   PATCH  debtId      — link the loan that bought it, or unlink. This is the
//                        control that removes the double count, so it has to
//                        be reachable after the fact; almost nobody enters the
//                        asset and the loan in the same sitting.
//   PATCH  cost, salvageValue, usefulLifeMonths, inServiceDate
//                      — the cost basis itself, through the same parser the
//                        create uses (lib/assets/create.js, partial mode).
//                        Exists because the fleet screen may add a van with
//                        NO purchase price; without a door to add the price
//                        afterwards that blank would be permanent, and
//                        "optional" would have been a dead end.
//   DELETE             — for the row typed with a wrong figure. A register with
//                        no way to remove a mis-typed $600,000 truck would
//                        silently raise the price floor on every quote written
//                        afterwards, which is the argument the fixed-costs
//                        delete route already makes.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { requireCostBasisWrite } from "@/lib/permissions/costBasis";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
import { recordActivity } from "@/lib/activity/log";
import { ASSET_SELECT as SELECT, withCharge, parseAssetBody } from "@/lib/assets/create";

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireCostBasisWrite(full, "fixedCosts");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const existing = await db.asset.findFirst({
    where: { id: _params.id, companyId: member.companyId },
    select: { id: true, name: true, cost: true, salvageValue: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data = {};

  // The cost basis, validated against the row's REAL resulting state: a PATCH
  // that only lowers the cost is checked against the salvage value already on
  // the row, so the two can never cross one field at a time.
  const costKeys = ["cost", "salvageValue", "usefulLifeMonths", "inServiceDate", "name", "notes"];
  if (costKeys.some((k) => body?.[k] !== undefined)) {
    const picked = Object.fromEntries(costKeys.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));
    const parsed = parseAssetBody(picked, { partial: true, existing });
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
    Object.assign(data, parsed.data);
  }

  if (body?.debtId !== undefined) {
    const debtId = body.debtId || null;
    // Same reason as the create: a foreign loan on our asset would charge this
    // company's overhead against another company's terms.
    const badLink = await ownedIdsRefusal(NextResponse, db, member.companyId, { debtId });
    if (badLink) return badLink;
    data.debtId = debtId;
  }

  if (body?.disposedOn !== undefined) {
    if (body.disposedOn === null || body.disposedOn === "") {
      // Un-disposing is allowed: the date is the most likely thing to be typed
      // wrong on this screen, and there is no other way back.
      data.disposedOn = null;
    } else {
      const when = new Date(body.disposedOn);
      if (Number.isNaN(when.getTime()))
        return NextResponse.json({ error: "That disposal date isn't a date." }, { status: 400 });
      data.disposedOn = when;
    }
  }

  if (body?.active !== undefined) data.active = !!body.active;

  if (body?.category !== undefined) {
    const parsed = parseAssetBody({ category: body.category }, { partial: true, existing });
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
    data.category = parsed.data.category;
  }

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const updated = await db.asset.update({
    where: { id: existing.id },
    data,
    select: SELECT,
  });

  await recordActivity(member, {
    action: "settings.asset_updated",
    entityType: "settings",
    entityId: existing.id,
    summary: `Updated asset ${existing.name}`,
    metadata: {
      disposedOn: data.disposedOn === undefined ? undefined : data.disposedOn,
      linkedToDebt: data.debtId === undefined ? undefined : !!data.debtId,
      cost: data.cost === undefined ? undefined : data.cost,
      usefulLifeMonths: data.usefulLifeMonths === undefined ? undefined : data.usefulLifeMonths,
    },
  });

  return NextResponse.json(withCharge(updated, new Date()));
}

export async function DELETE(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireCostBasisWrite(full, "fixedCosts");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const existing = await db.asset.findFirst({
    where: { id: _params.id, companyId: member.companyId },
    select: { id: true, name: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.asset.delete({ where: { id: existing.id } });

  await recordActivity(member, {
    action: "settings.asset_removed",
    entityType: "settings",
    summary: `Removed asset ${existing.name}`,
    metadata: { name: existing.name },
  });

  return NextResponse.json({ success: true });
}
