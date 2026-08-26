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
import { memberOrRefusal } from "@/lib/apiMember";
import {
  resolvePayCycle,
  currentPayPeriod,
  periodProgress,
  isoDay,
} from "@/lib/payroll/payCycle";

/** Prisma Decimal | null → a number the browser can add up. */
const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

/**
 * The period end is a DATE; time entries carry a time. Without this, anything
 * clocked after midnight on the last day of a period falls into neither this
 * period nor the next one and is simply never paid.
 */
const endOfDay = (d) => new Date(new Date(d).getTime() + 86400000 - 1);
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!member.userId)
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
      return NextResponse.json(
        { error: "Payslips aren't available." },
        { status: 403 },
      );
    }
  }

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { payCycle: true },
  });

  // The worker record for THIS user, in THIS company.
  const worker = await db.worker.findFirst({
    where: { companyId: member.companyId, userId: member.userId },
    select: { id: true, name: true, type: true, hourlyRate: true },
  });

  if (!worker) {
    // Not an error — plenty of members (an office admin) aren't paid through
    // payroll. Say so plainly instead of returning an empty list that reads as
    // "your payslips are missing".
    return NextResponse.json({
      worker: null,
      payslips: [],
      reason: "no_worker_record",
    });
  }

  const payslips = await db.payRunLine.findMany({
    where: {
      workerId: worker.id,
      // Drafts are deliberately invisible — see the header.
      payRun: {
        companyId: member.companyId,
        status: { in: ["approved", "paid"] },
      },
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
        select: {
          id: true,
          periodStart: true,
          periodEnd: true,
          status: true,
          region: true,
        },
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

  // ── What has been earned but not yet paid ────────────────────────────────
  //
  // Payslips only exist once a run has been approved, so until the office
  // pressed a button this endpoint had nothing to say and the page read as
  // "you have never been paid". The question a worker actually opens this
  // screen with — "how much have I got coming" — had no answer anywhere in the
  // product.
  //
  // APPROVED HOURS ONLY, deliberately. A figure built from everything clocked
  // can go DOWN when a manager trims an entry, and a number that goes down is
  // a conversation nobody wants to have twice. Approved time only ever
  // accumulates, so this number only ever rises within a period.
  //
  // Hours that are logged but not yet approved are reported SEPARATELY rather
  // than folded in or hidden: "waiting on your manager" is useful and true,
  // and leaving it out would make the page look wrong to somebody who knows
  // what they worked.
  const cycle = resolvePayCycle(company?.payCycle);
  const periods = currentPayPeriod(cycle, new Date());
  let accruing = null;
  if (periods) {
    const [approved, pending] = await Promise.all([
      db.timeEntry.aggregate({
        where: {
          workerId: worker.id,
          status: "approved",
          clockIn: {
            gte: periods.current.start,
            lte: endOfDay(periods.current.end),
          },
        },
        _sum: { hours: true },
      }),
      db.timeEntry.aggregate({
        where: {
          workerId: worker.id,
          status: "pending",
          clockIn: {
            gte: periods.current.start,
            lte: endOfDay(periods.current.end),
          },
        },
        _sum: { hours: true },
      }),
    ]);
    const approvedHours = round2(approved._sum.hours);
    const pendingHours = round2(pending._sum.hours);
    const rate = worker.hourlyRate == null ? null : Number(worker.hourlyRate);
    accruing = {
      periodStart: isoDay(periods.current.start),
      periodEnd: isoDay(periods.current.end),
      payDate: isoDay(periods.current.payDate),
      progress: Math.round(periodProgress(periods.current, new Date()) * 100),
      approvedHours,
      pendingHours,
      hourlyRate: rate,
      // Null, not zero, when nobody has set a rate. A salaried worker or one
      // whose rate has not been entered must not be told they have earned $0 —
      // that is a wrong number, where "we cannot work this out yet" is true.
      approvedPay: rate == null ? null : round2(approvedHours * rate),
      // Deliberately gross, and labelled as such by the page: deductions are
      // supplied per run by the company, not computed here, so a "net" figure
      // before the run exists would be an invention.
      basis: "gross",
    };
  }

  return NextResponse.json({
    worker,
    payslips,
    accruing,
    ytd: {
      year: ytdYear,
      gross: Math.round(ytd.gross * 100) / 100,
      deductions: Math.round(ytd.deductions * 100) / 100,
      net: Math.round(ytd.net * 100) / 100,
    },
  });
}
