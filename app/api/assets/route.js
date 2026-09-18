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
import { recordActivity } from "@/lib/activity/log";
import {
  ASSET_SELECT,
  withCharge,
  parseAssetBody,
  createAssetRow,
  assetAddedActivity,
} from "@/lib/assets/create";

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
    select: ASSET_SELECT,
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
  // The rules — a cost above zero, salvage below it, a life between 1 and
  // 600 months, no invented life — live in lib/assets/create.js, shared with
  // the fleet screen's own "Add a vehicle" door. The register never relaxes
  // the cost rule: see that file's header for the one door that does.
  const parsed = parseAssetBody(body);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // The linked loan has to be OURS. Without this a hand-written POST could
  // point an asset at another tenant's Debt row, and the response below
  // includes that debt's name and payment.
  const { debtId } = parsed.data;
  const badLink = await ownedIdsRefusal(NextResponse, db, member.companyId, { debtId });
  if (badLink) return badLink;

  const created = await createAssetRow(db, { companyId: member.companyId, data: parsed.data });

  await recordActivity(member, assetAddedActivity(created));

  return NextResponse.json(withCharge(created, new Date()), { status: 201 });
}
