// app/api/payroll/runs/[id]/route.js
//
// GET   — one run with its payslip lines
// PATCH — approve it, or record that it was paid
//
// ── "Paid" means a human confirmed they paid it elsewhere ────────────────────
//
// FieldQuo does not move money for payroll. Marking a run paid records that the
// company paid it through its own bank or payroll provider, with the method
// they name. The wording in the UI matches, so nobody reads "Paid" as "FieldQuo
// sent it" — that would be the worst kind of control that appears to work.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import {
  loadEnforceableMember,
  hasLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { recordActivity } from "@/lib/activity/log";

async function payrollAccess(member) {
  if (member.role === "owner" || member.role === "admin") {
    return { canRun: true, canViewAll: true };
  }
  const full = await loadEnforceableMember(db, member.id);
  const canRun = hasLevel(full, "payroll", "run_payroll");
  return { canRun, canViewAll: canRun || hasLevel(full, "payroll", "view_all") };
}

export async function GET(request, { params }) {
  const { id } = await params;
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
    return NextResponse.json({ error: "You can only see your own payslips." }, { status: 403 });
  }

  const run = await db.payRun.findFirst({
    where: { id, companyId: member.companyId },
    include: { lines: { orderBy: { workerName: "asc" } } },
  });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ...run, canRun: access.canRun });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
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
      { error: "You don't have permission to approve or record payroll." },
      { status: 403 },
    );
  }

  const run = await db.payRun.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, status: true, periodStart: true, periodEnd: true, netTotal: true },
  });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const action = body?.action;

  if (action === "approve") {
    if (run.status !== "draft") {
      return NextResponse.json(
        { error: `This run is already ${run.status}.` },
        { status: 409 },
      );
    }
    await db.payRun.update({
      where: { id },
      data: { status: "approved", approvedById: member.userId, approvedAt: new Date() },
    });
    await recordActivity(member, {
      action: "payroll.run_approved",
      entityType: "payrun",
      entityId: id,
      summary: `Approved the pay run for ${new Date(run.periodStart).toLocaleDateString()}–${new Date(run.periodEnd).toLocaleDateString()}`,
      metadata: { netTotal: run.netTotal },
    });
    return NextResponse.json({ ok: true, status: "approved" });
  }

  if (action === "mark_paid") {
    if (run.status !== "approved") {
      return NextResponse.json(
        { error: "Approve the run before recording it as paid." },
        { status: 409 },
      );
    }
    const paidAt = new Date();
    // Stamp the lines too, so a payslip can say when that person was paid
    // rather than only when the batch was.
    await db.$transaction([
      db.payRun.update({ where: { id }, data: { status: "paid", paidAt } }),
      db.payRunLine.updateMany({ where: { payRunId: id }, data: { paidAt } }),
    ]);
    await recordActivity(member, {
      action: "payroll.run_marked_paid",
      entityType: "payrun",
      entityId: id,
      // Wording matters: FieldQuo didn't pay it, someone recorded that they did.
      summary: `Recorded the pay run for ${new Date(run.periodStart).toLocaleDateString()} as paid outside FieldQuo`,
      metadata: { netTotal: run.netTotal, method: body?.method || null },
    });
    return NextResponse.json({ ok: true, status: "paid" });
  }

  if (action === "cancel") {
    if (run.status === "paid") {
      return NextResponse.json(
        { error: "This run is already recorded as paid and can't be cancelled." },
        { status: 409 },
      );
    }
    await db.payRun.update({ where: { id }, data: { status: "cancelled" } });
    await recordActivity(member, {
      action: "payroll.run_cancelled",
      entityType: "payrun",
      entityId: id,
      summary: `Cancelled the pay run for ${new Date(run.periodStart).toLocaleDateString()}`,
    });
    return NextResponse.json({ ok: true, status: "cancelled" });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
