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
import {
  cycleMatch,
  overlappingRuns,
  describeRunGuards,
} from "@/lib/payroll/runGuards";
import { memberOrRefusal } from "@/lib/apiMember";
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
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  let access;
  try {
    access = await payrollAccess(member);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  if (!access.canViewAll) {
    return NextResponse.json(
      {
        error:
          "You can only see your own payslips. Ask an owner for payroll access.",
      },
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
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

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
  const {
    periodStart,
    periodEnd,
    region,
    frequency,
    otThresholdWeekly,
    adjustmentsByWorker,
    commit,
  } = body || {};

  if (!periodStart || !periodEnd) {
    return NextResponse.json(
      { error: "Give a period start and end." },
      { status: 400 },
    );
  }
  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  // ── Two questions this route never asked ─────────────────────────────────
  //
  // Does the period match what the company actually agreed, and has anyone
  // already been paid for these days? The screen used to offer "the last
  // fourteen days ending today" and nothing checked either — so periods drifted
  // silently, and a second run over the same fortnight would pay everybody
  // twice without a word.
  //
  // Reported here, refused only at approval. Correction runs are real, and a
  // payroll tool that refuses them is a payroll tool with a spreadsheet next
  // to it. See lib/payroll/runGuards.js.
  const [companyRow, existingRuns] = await Promise.all([
    db.company.findUnique({
      where: { id: member.companyId },
      select: { payCycle: true },
    }),
    db.payRun.findMany({
      where: { companyId: member.companyId },
      select: { id: true, periodStart: true, periodEnd: true, status: true },
    }),
  ]);
  const guards = {
    cycle: cycleMatch(start, end, companyRow?.payCycle),
    overlaps: overlappingRuns(existingRuns, start, end),
  };
  guards.messages = describeRunGuards(guards);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  ) {
    return NextResponse.json(
      { error: "That period doesn't make sense — check the dates." },
      { status: 400 },
    );
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
    return NextResponse.json({ preview: true, ...computed, guards });
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

  // Hours the worker approved for themselves, carried into the audit trail.
  //
  // The marker existed only on the Timesheets screen and in the timeEntry
  // activity row; the run that turns those hours into money never mentioned
  // it. PayRun has no meta column to hold it on the record itself, and adding
  // one is a schema decision rather than a bug fix — so it goes where the rest
  // of "who did what to payroll" already lives, and the preview says it on
  // screen before the run is committed.
  const selfApproved = computed.meta?.selfApprovedTime || [];
  await recordActivity(member, {
    action: "payroll.run_created",
    entityType: "payrun",
    entityId: run.id,
    summary:
      `Created a draft pay run for ${start.toLocaleDateString()}–${end.toLocaleDateString()} (${computed.lines.length} people, ${computed.netTotal} net)` +
      (selfApproved.length
        ? ` — includes self-approved hours: ${selfApproved
            .map((s) => `${s.name} (${s.hours}h)`)
            .join(", ")}`
        : ""),
    metadata: {
      grossTotal: computed.grossTotal,
      netTotal: computed.netTotal,
      selfApprovedTime: selfApproved,
    },
  });

  return NextResponse.json({ ...run, ...computed, guards }, { status: 201 });
}
