// app/api/payroll/my-payslips/route.js
//
// A worker's OWN payslips. The whole point of the payroll module for the person
// being paid: what did I earn, what was taken off, what should land in my account.
//
// ── Scoped by identity, not by a filter the caller supplies ──────────────────
//
// The Worker row is resolved from the signed-in user, and lines are queried by
// that workerId. There is no request parameter that can widen it, because the
// obvious bug here — trusting a workerId from the client — would let anyone read
// a colleague's pay. Requires payroll access above "none".
//
// Only approved and paid runs are visible. A draft is a work-in-progress the
// company may still change; showing it would have people asking why their pay
// changed between Tuesday and Friday.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member?.userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Owners/admins hold everything; everyone else needs at least view_own.
  if (member.role !== "owner" && member.role !== "admin") {
    try {
      const full = await loadEnforceableMember(db, member.id);
      const allowed =
        hasLevel(full, "payroll", "view_own") ||
        hasLevel(full, "payroll", "view_all") ||
        hasLevel(full, "payroll", "run_payroll");
      if (!allowed) {
        return NextResponse.json(
          { error: "Payslips aren't shared with your account. Ask an owner." },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json({ error: "Payslips aren't available." }, { status: 403 });
    }
  }

  // The worker record for THIS user, in THIS company.
  const worker = await db.worker.findFirst({
    where: { companyId: member.companyId, userId: member.userId },
    select: { id: true, name: true, type: true, hourlyRate: true },
  });

  if (!worker) {
    // Not an error — plenty of members (an office admin) aren't paid through
    // payroll. Say so plainly instead of returning an empty list that reads as
    // "your payslips are missing".
    return NextResponse.json({ worker: null, payslips: [], reason: "no_worker_record" });
  }

  const payslips = await db.payRunLine.findMany({
    where: {
      workerId: worker.id,
      // Drafts are deliberately invisible — see the header.
      payRun: { companyId: member.companyId, status: { in: ["approved", "paid"] } },
    },
    orderBy: { createdAt: "desc" },
    take: 36,
    select: {
      id: true,
      workerName: true,
      hourlyRate: true,
      regularHours: true,
      overtimeHours: true,
      items: true,
      gross: true,
      deductions: true,
      net: true,
      paidAt: true,
      payRun: {
        select: { id: true, periodStart: true, periodEnd: true, status: true, region: true },
      },
    },
  });

  const ytdYear = new Date().getFullYear();
  const ytd = payslips
    .filter((p) => new Date(p.payRun.periodEnd).getFullYear() === ytdYear)
    .reduce(
      (acc, p) => ({
        gross: acc.gross + Number(p.gross),
        deductions: acc.deductions + Number(p.deductions),
        net: acc.net + Number(p.net),
      }),
      { gross: 0, deductions: 0, net: 0 },
    );

  return NextResponse.json({
    worker,
    payslips,
    ytd: {
      year: ytdYear,
      gross: Math.round(ytd.gross * 100) / 100,
      deductions: Math.round(ytd.deductions * 100) / 100,
      net: Math.round(ytd.net * 100) / 100,
    },
  });
}
