// app/api/platform/sales/reps/[id]/payouts/route.js
//
// One rep's payout batches, newest first, with the proof on each — the
// Payments section of their card on /platform/sales/reps. Scoped to the rep
// in the query (lib/sales/payoutAdmin.js's repPayouts), and re-summed the
// way every payout figure is.
//
// Same readers as /api/platform/sales/payouts: superadmin and admin.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { db } from "@/lib/db";
import { canViewPayouts, repPayouts } from "@/lib/sales/payoutAdmin";

export async function GET(request, { params }) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewPayouts(admin.role)) {
    return NextResponse.json({ error: "Only superadmins and admins can read a rep's payouts" }, { status: 403 });
  }

  const { id } = await params;
  const rep = await db.salesRep.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!rep) return NextResponse.json({ error: "No such rep" }, { status: 404 });

  const view = await repPayouts({ salesRepId: rep.id });
  return NextResponse.json({ rep, ...view, canMarkPaid: admin.role === "superadmin" });
}
