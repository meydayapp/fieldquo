// app/api/payroll/runs/route.js
//
// GET  — pay runs for the company (needs payroll view_all or run_payroll)
// POST — preview a period, or commit it as a draft run
//
// Gated on the `payroll` permission category, which defaults to their-own-only:
// listing everyone's runs needs view_all, and creating one needs run_payroll.
// A payslip carries someone's pay rate, so this is the one area where the
// default is closed and access is granted deliberately.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import {
  loadEnforceableMember,
  hasLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { buildPayRun } from "@/lib/payroll/buildPayRun";
import { recordActivity } from "@/lib/activity/log";

// Owners and admins always hold payroll; otherwise the granular grid decides.
async function payrollAccess(member) {
  if (member.role === "owner" || member.role === "admin") {
    return { canRun: true, canViewAll: true };
  }
  const full = await loadEnforceableMember(db, member.id);
  const canRun = hasLevel(full, "payroll", "run_payroll");
  const canViewAll = canRun || hasLevel(full, "payroll", "view_all");
  return { canRun, canViewAll };
}

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let access;
  try {
    access = await payrollAccess(member);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  if (!access.canViewAll) {
    return NextResponse.json(
      { error: "You can only see your own payslips. Ask an owner for payroll access." },
      { status: 403 },
    );
  }

  const runs = await db.payRun.findMany({
    where: { companyId: member.companyId },
    orderBy: { periodStart: "desc" },
    take: 50,
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      status: true,
      grossTotal: true,
      deductionTotal: true,
      netTotal: true,
      region: true,
      approvedAt: true,
      paidAt: true,
      _count: { select: { lines: true } },
    },
  });

  return NextResponse.json({ runs, canRun: access.canRun });
}

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let access;
  try {
    access = await payrollAccess(member);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }
  if (!access.canRun) {
    return NextResponse.json(
      { error: "You don't have permission to run payroll." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const { periodStart, periodEnd, region, frequency, otThresholdWeekly, adjustmentsByWorker, commit } = body || {};

  if (!periodStart || !periodEnd) {
    return NextResponse.json({ error: "Give a period start and end." }, { status: 400 });
  }
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return NextResponse.json({ error: "That period doesn't make sense — check the dates." }, { status: 400 });
  }

  const computed = await buildPayRun({
    companyId: member.companyId,
    periodStart: start,
    periodEnd: end,
    region: region || "CA",
    frequency: frequency || "biweekly",
    otThresholdWeekly,
    adjustmentsByWorker: adjustmentsByWorker || {},
  });

  // Preview: compute and return, save nothing. The company sees the numbers
  // before anything is committed.
  if (!commit) {
    return NextResponse.json({ preview: true, ...computed });
  }

  // Refuse to commit a run containing a line a human must look at first.
  if (computed.warnings.length) {
    return NextResponse.json(
      {
        error: "Some lines need attention before this run can be saved.",
        warnings: computed.warnings,
      },
      { status: 422 },
    );
  }

  const run = await db.payRun.create({
    data: {
      companyId: member.companyId,
      periodStart: start,
      periodEnd: end,
      status: "draft",
      region: computed.region,
      grossTotal: computed.grossTotal,
      deductionTotal: computed.deductionTotal,
      netTotal: computed.netTotal,
      createdById: member.userId,
      lines: {
        create: computed.lines
          .filter((l) => l.workerId)
          .map((l) => ({
            workerId: l.workerId,
            // Captured, not joined — a rate change later must not rewrite this.
            workerName: l.workerName,
            workerType: l.workerType,
            hourlyRate: l.hourlyRate,
            regularHours: l.regularHours,
            overtimeHours: l.overtimeHours,
            items: l.items,
            gross: l.gross,
            deductions: l.deductions,
            net: l.net,
          })),
      },
    },
    select: { id: true, periodStart: true, periodEnd: true, status: true },
  });

  await recordActivity(member, {
    action: "payroll.run_created",
    entityType: "payrun",
    entityId: run.id,
    summary: `Created a draft pay run for ${start.toLocaleDateString()}–${end.toLocaleDateString()} (${computed.lines.length} people, ${computed.netTotal} net)`,
    metadata: { grossTotal: computed.grossTotal, netTotal: computed.netTotal },
  });

  return NextResponse.json({ ...run, ...computed }, { status: 201 });
}
