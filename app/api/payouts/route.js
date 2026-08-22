// app/api/payouts/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { runContractorPayoutsForCompany } from "@/lib/payroll/stripeConnectPayout";
import { isPayrollAdmin } from "@/lib/permissions/settingsAccess";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Every contractor payment — amount, worker, status — was returned to any
  // signed-in member. Same rule as the payroll pages.
  const full = await loadEnforceableMember(db, member.id);
  if (!hasLevel(full, "payroll", "view_all")) {
    return NextResponse.json(
      { error: "You can only see your own payslips. Ask an owner for payroll access." },
      { status: 403 },
    );
  }

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
    // The comment said "owner/admin-only, moves real money" and the code said
    // user:manage — which SUPERVISORS hold. A Manager, whose preset explicitly
    // promises payroll is excluded, could run contractor payouts through
    // Stripe Connect. The comment was right; the check wasn't.
    if (!isPayrollAdmin(member.role)) {
      return NextResponse.json(
        { error: "Only an owner or admin can run payouts." },
        { status: 403 },
      );
    }
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
