// app/api/settings/pay-cycle/route.js
//
// When this company pays, and for what stretch of work.
//
// Read by everyone, written by owners and admins: an employee needs to know
// when payday is and which days are on this cheque — that is the point of
// having a cycle at all — but only the people who agreed it may change it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import {
  resolvePayCycle,
  currentPayPeriod,
  describePayCycle,
  reviewDays,
  isoDay,
  PAY_FREQUENCIES,
  utcDate,
} from "@/lib/payroll/payCycle";

/** The stored policy plus what it means right now, so no caller re-derives it. */
function shape(stored, today) {
  const cycle = resolvePayCycle(stored);
  const periods = currentPayPeriod(cycle, today);
  return {
    cycle,
    // Null before anyone has saved one. The DEFAULTS still apply — see the
    // schema note — but a screen should be able to say "you have not set this"
    // rather than presenting a default as a decision the company made.
    configured: Boolean(stored),
    describe: describePayCycle(cycle),
    reviewDays: reviewDays(cycle),
    frequencies: Object.entries(PAY_FREQUENCIES).map(([key, m]) => ({
      key,
      label: m.label,
      alignsToWeeks: m.alignsToWeeks,
    })),
    current: periods && {
      start: isoDay(periods.current.start),
      end: isoDay(periods.current.end),
      payDate: isoDay(periods.current.payDate),
      alignsToWeeks: periods.current.alignsToWeeks,
    },
    previous: periods && {
      start: isoDay(periods.previous.start),
      end: isoDay(periods.previous.end),
      payDate: isoDay(periods.previous.payDate),
    },
  };
}

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { payCycle: true },
  });

  return NextResponse.json({
    ...shape(company?.payCycle, new Date()),
    canEdit: ["owner", "admin"].includes(member.role),
  });
}

export async function PATCH(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!["owner", "admin"].includes(member.role)) {
    return NextResponse.json(
      { error: "Only an owner or admin can change when the company pays." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  // Resolved before storing, not after: an out-of-range weekday or an unknown
  // frequency is dropped here rather than sitting in the column waiting to be
  // defaulted on every read. What is stored is always a valid policy.
  const cycle = resolvePayCycle(body.cycle ?? body);

  // The anchor decides WHICH fortnight is on, so it has to be a real date on
  // the right weekday — otherwise every period is offset by a day or two and
  // nobody can see why.
  const anchor = utcDate(cycle.anchorDate);
  if (!anchor || anchor.getUTCDay() !== cycle.periodEndDayOfWeek) {
    // Snap it forward to the next matching weekday rather than refusing. A
    // company changing its period-end day should not have to also work out a
    // new anchor date by hand.
    const delta =
      (cycle.periodEndDayOfWeek - (anchor?.getUTCDay() ?? 0) + 7) % 7;
    const snapped = new Date(
      (anchor ? anchor.getTime() : Date.UTC(2026, 0, 4)) + delta * 86400000,
    );
    cycle.anchorDate = isoDay(snapped);
  }

  await db.company.update({
    where: { id: member.companyId },
    data: { payCycle: cycle },
  });

  return NextResponse.json({ ...shape(cycle, new Date()), canEdit: true });
}
