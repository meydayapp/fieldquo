// app/api/platform/costs/phone/route.js
//
// GET — "Phone costs vs what we charge": per class (SMS / MMS in and out, per
// country; forwarded and bridged call minutes) every unit price Twilio has
// been seen charging FieldQuo for long enough to count (lib/phoneUsage/
// tiers.js), what companies pay for it, and the multiple — with any class
// below the owner's 2× flagged. Plus the flat rentals, and the price changes
// detected. FieldQuo's own cost data: platform console only, read-only.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { costTableRows, FIXED_COST_ROWS } from "@/lib/phoneUsage/tiers";
import { MARKUP, TEXT_FLOOR_CENTS, PHOTO_FLOOR_CENTS, CALL_FLOOR_CENTS_PER_MINUTE } from "@/lib/phoneUsage/pricing";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [tiers, changes, pending] = await Promise.all([
    db.phoneCostTier.findMany({ orderBy: [{ priceClass: "asc" }, { unitMicros: "asc" }], take: 500 }),
    db.phonePriceChange.findMany({ orderBy: { effectiveAt: "desc" }, take: 20 }),
    db.phoneUsageCharge.count({ where: { settledAt: null } }),
  ]);
  const rows = costTableRows(tiers);
  const fixed = FIXED_COST_ROWS.map((r) => ({ ...r, multiple: r.chargeCents / r.costCents, below2x: r.chargeCents / r.costCents < MARKUP }));
  return NextResponse.json({
    rule: { markup: MARKUP, floors: { textCents: TEXT_FLOOR_CENTS, photoCents: PHOTO_FLOOR_CENTS, callCentsPerMinute: CALL_FLOOR_CENTS_PER_MINUTE } },
    rows,
    fixed,
    // Tiers seen but not yet seen often enough to count — shown so a new
    // price is visible before it is adopted.
    candidates: tiers.filter((t) => !t.adoptedAt).map((t) => ({ priceClass: t.priceClass, costCents: t.unitMicros / 10000, observations: t.observations })),
    changes,
    pendingSettlements: pending,
  });
}
