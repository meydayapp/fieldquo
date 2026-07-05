// app/api/payouts/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { runContractorPayoutsForCompany } from "@/lib/payroll/stripeConnectPayout";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payouts = await db.payout.findMany({
    where: { worker: { companyId: member.companyId } },
    include: { worker: { select: { id: true, name: true, type: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(payouts);
}

// Runs contractor payouts for a period across the whole company. Employee payroll
// (via the embedded provider) is a separate, not-yet-wired flow — see the payroll
// compliance note from earlier. This endpoint only ever touches worker.type === "contractor".
export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage"); // owner/admin-only, moves real money
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners/admins can run payouts" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { periodStart, periodEnd } = body;

  if (!periodStart || !periodEnd) {
    return NextResponse.json(
      { error: "periodStart and periodEnd are required" },
      { status: 400 },
    );
  }

  const results = await runContractorPayoutsForCompany({
    companyId: member.companyId,
    periodStart: new Date(periodStart),
    periodEnd: new Date(periodEnd),
  });

  return NextResponse.json({ results });
}
