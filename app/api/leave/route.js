// app/api/leave/route.js
//
// GET  — my leave (balances + requests), or the whole team's with user:view
// POST — request time off
//
// ── Balance is checked on the SERVER ────────────────────────────────────────
//
// The browser shows a remaining figure so someone can see what they have, but
// the request is validated here against the stored balance plus anything already
// pending. Trusting the client's number would let two overlapping requests both
// look affordable.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { can } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { notifyEvent } from "@/lib/notifications/notify";
import {
  countWorkingDays,
  remainingBalance,
  canTakeLeave,
} from "@/lib/leave/accrual";
import { consumeBalance, refreshAccruals } from "@/lib/leave/balances";
import { ensureWorkerForMember } from "@/lib/team/ensureWorker";
import { annotateRouting } from "@/lib/org/leaveRouting";
import { judgeLeaveRequest, loadLeaveLimits, othersApprovedDuring } from "@/lib/leave/limits";
import { holidaysBetween } from "@/lib/leave/statutoryHolidays";
import { hoursPerWorkingDay } from "@/lib/leave/balances";

const YEAR = () => new Date().getUTCFullYear();

// The Worker row for this user — leave attaches to a worker, not a member,
// because contractors take unpaid time too.
//
// If it's missing, create it here rather than showing an empty page. Anyone who
// can sign in as a member of this company is on the team; not having a Worker
// row is a gap in how they were added, not a statement that they don't work
// here. See lib/team/ensureWorker.js.
async function myWorker(member) {
  const existing = await db.worker.findFirst({
    where: { companyId: member.companyId, userId: member.userId },
    select: { id: true, name: true, hourlyRate: true },
  });
  if (existing) return existing;

  const { worker } = await ensureWorkerForMember({
    companyId: member.companyId,
    userId: member.userId,
  }).catch((err) => {
    console.error("[leave] worker ensure failed:", err?.message);
    return { worker: null };
  });
  // A worker created for a user already linked at another company comes back
  // unlinked (Worker.userId is globally unique), so it isn't "theirs" and can't
  // be used for self-service leave.
  return worker?.userId === member.userId ? worker : null;
}

// Which days this person works, for counting a request in working days.
async function workingDaysFor(userId) {
  const rows = await db.workingHours.findMany({
    where: { userId },
    select: { dayOfWeek: true },
  });
  return rows.map((r) => r.dayOfWeek);
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!member.userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope"); // "team" | undefined
  const year = Number(searchParams.get("year")) || YEAR();

  const policies = await db.leavePolicy.findMany({
    where: { companyId: member.companyId, active: true },
    orderBy: { name: "asc" },
  });

  // Bring accruals up to date before reading them. refreshAccruals SETS rather
  // than increments, so doing this on read is safe and means nobody has to
  // remember to run a nightly job for the numbers to be right.
  if (policies.length && year === YEAR()) {
    await refreshAccruals({ companyId: member.companyId, year }).catch((err) =>
      console.error("[leave] accrual refresh failed:", err?.message),
    );
  }

  // Team view — for approving and for planning cover.
  if (scope === "team") {
    if (!can(member.role, "user:view")) {
      return NextResponse.json(
        { error: "You can only see your own leave." },
        { status: 403 },
      );
    }
    const [requests, balances, viewer] = await Promise.all([
      db.leaveRequest.findMany({
        where: { companyId: member.companyId },
        orderBy: [{ status: "asc" }, { startDate: "desc" }],
        take: 200,
        include: {
          policy: { select: { name: true, kind: true, paid: true } },
          worker: { select: { id: true, name: true, title: true } },
        },
      }),
      db.leaveBalance.findMany({
        where: { year, policy: { companyId: member.companyId } },
        include: {
          policy: { select: { id: true, name: true, kind: true, accrualMethod: true } },
          worker: { select: { id: true, name: true, title: true } },
        },
      }),
      // Read, never create: someone browsing the team's leave who has no Worker
      // row of their own is a viewer, not a person to be enrolled as crew.
      db.worker.findFirst({
        where: { companyId: member.companyId, userId: member.userId },
        select: { id: true },
      }),
    ]);
    // ── The limits, the calendar, and who else is off ───────────────────
    //
    // The Team view bands statutory holidays and blackout ranges, the
    // Policies card shows the cap, and the details modal lists "other
    // employees off" for each request — which is the max-concurrent rule
    // showing its work. Hours per day come from each person's WorkingHours
    // (lib/leave/balances.js's hoursPerWorkingDay); null when nobody set
    // them, and the screen then shows days, never an invented 8.
    const { rules, region } = await loadLeaveLimits(member.companyId);
    const span = { from: new Date(Date.UTC(year, 0, 1)), to: new Date(Date.UTC(year + 1, 11, 31)) };
    const holidays = region ? holidaysBetween({ ...region, ...span }) : [];
    const workerUserIds = [...new Set(requests.map((r) => r.worker?.id).filter(Boolean))];
    const workerRows = workerUserIds.length
      ? await db.worker.findMany({ where: { id: { in: workerUserIds } }, select: { id: true, userId: true } })
      : [];
    const hoursRows = workerRows.filter((w) => w.userId).length
      ? await db.workingHours.findMany({
          where: { companyId: member.companyId, userId: { in: workerRows.map((w) => w.userId).filter(Boolean) } },
          select: { userId: true, startTime: true, endTime: true },
        })
      : [];
    const hoursByUser = {};
    for (const h of hoursRows) (hoursByUser[h.userId] ||= []).push(h);
    const hoursPerDayByWorker = {};
    for (const w of workerRows) hoursPerDayByWorker[w.id] = w.userId ? hoursPerWorkingDay(hoursByUser[w.userId] || []) : null;
    const approvedAll = await othersApprovedDuring({ companyId: member.companyId, workerId: null, startDate: span.from, endDate: span.to });
    // What the person would have left once THIS request is approved — the
    // details modal's "Post-balance". Days policies only; a vacation-pay
    // (% of gross) policy accrues money and a request in days cannot be
    // priced here without the rate, so it says "not computed" rather than
    // guessing. Unpaid policies have no balance and say so.
    const balanceAfterFor = (r) => {
      if (r.policy?.paid === false) return null;
      const y = new Date(r.startDate).getUTCFullYear();
      const b = balances.find((x) => x.policyId === r.policyId && x.workerId === r.workerId && x.year === y);
      if (!b || b.policy?.accrualMethod === "percent_of_gross") return undefined;
      const { remainingDays } = remainingBalance(b);
      const after = r.status === "pending" ? Number(remainingDays) - Number(r.days) : Number(remainingDays);
      return { isMoney: false, remaining: Math.round(after * 100) / 100 };
    };
    const othersOffFor = (r) =>
      approvedAll
        .filter((o) => o.workerId !== r.workerId && new Date(o.startDate) <= new Date(r.endDate) && new Date(o.endDate) >= new Date(r.startDate))
        .map((o) => ({ workerId: o.workerId, workerName: o.workerName, policyName: o.policyName, startDate: o.startDate, endDate: o.endDate }));

    return NextResponse.json({
      scope: "team",
      rules,
      holidayRegion: region,
      holidays,
      hoursPerDayByWorker,
      policies,
      // Each pending request carries who it is waiting on, escalated past
      // whoever is away today, and whether THIS viewer may act on it. The
      // second is not the first: a request waiting on a supervisor is still
      // approvable by the owner. See lib/org/leaveRouting.js.
      requests: (
        await annotateRouting({
          companyId: member.companyId,
          requests,
          actorWorkerId: viewer?.id || null,
          hasManagePermission: can(member.role, "user:manage"),
        })
      ).map((r) => ({ ...r, othersOff: othersOffFor(r), hoursPerDay: hoursPerDayByWorker[r.workerId] ?? null, balanceAfter: balanceAfterFor(r) })),
      balances: balances.map((b) => ({ ...b, ...remainingBalance(b) })),
      canApprove: can(member.role, "user:manage"),
      // The same people, as a picker for "Add time off" — active workers
      // whose leave a manager may enter on their behalf.
      workers: await db.worker.findMany({
        where: { companyId: member.companyId, active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, title: true, userId: true },
      }),
    });
  }

  // Own view.
  const worker = await myWorker(member);
  if (!worker) {
    return NextResponse.json({
      scope: "self",
      worker: null,
      policies,
      requests: [],
      balances: [],
      reason: "no_worker_record",
    });
  }

  const [requests, balances] = await Promise.all([
    db.leaveRequest.findMany({
      where: { workerId: worker.id },
      orderBy: { startDate: "desc" },
      take: 50,
      include: { policy: { select: { name: true, kind: true, paid: true } } },
    }),
    db.leaveBalance.findMany({
      where: { workerId: worker.id, year },
      include: { policy: { select: { id: true, name: true, kind: true, accrualMethod: true } } },
    }),
  ]);

  // Pending days per policy, so the UI shows what's already reserved.
  const pendingByPolicy = requests
    .filter((r) => r.status === "pending")
    .reduce((acc, r) => {
      acc[r.policyId] = (acc[r.policyId] || 0) + Number(r.days);
      return acc;
    }, {});

  const limits = await loadLeaveLimits(member.companyId);
  return NextResponse.json({
    scope: "self",
    worker,
    // The blackouts and the calendar, so the form can say "closed Dec 15 –
    // Jan 5" before the person asks rather than after.
    rules: limits.rules,
    holidays: limits.region
      ? holidaysBetween({ ...limits.region, from: new Date(Date.UTC(year, 0, 1)), to: new Date(Date.UTC(year + 1, 11, 31)) })
      : [],
    policies,
    // The person who asked for the time off is the one most in the dark about
    // where it went. `canAct` comes back false on their own request, which is
    // correct and is what the PATCH route enforces.
    requests: await annotateRouting({
      companyId: member.companyId,
      requests,
      actorWorkerId: worker.id,
      hasManagePermission: can(member.role, "user:manage"),
    }),
    balances: balances.map((b) => ({
      ...b,
      ...remainingBalance(b, { pendingDays: pendingByPolicy[b.policyId] || 0 }),
    })),
  });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!member.userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { policyId, startDate, endDate, reason, halfDay } = body || {};

  // ── A manager entering time off for somebody else ───────────────────────
  //
  // "Add time off" on the Team view: the same request row, created already
  // approved with the manager as reviewer — a phone call that said "Dana is
  // off Thursday" is a decision made, not a request to be routed back to the
  // manager who just made it. Gated on user:manage (the audience that can
  // approve); the worker must be this company's. Balance, blackout and cap
  // are all still judged: entering it by hand is not a way around them.
  const onBehalf = typeof body?.workerId === "string" && body.workerId.trim() ? body.workerId.trim() : null;
  if (onBehalf && !can(member.role, "user:manage")) {
    return NextResponse.json({ error: "Only a manager can add time off for somebody else." }, { status: 403 });
  }
  const worker = onBehalf
    ? await db.worker.findFirst({
        where: { id: onBehalf, companyId: member.companyId },
        select: { id: true, name: true, hourlyRate: true, userId: true },
      })
    : await myWorker(member);
  if (!worker) {
    return NextResponse.json(
      {
        error: onBehalf
          ? "That person isn't on this company's roster."
          : "Your account isn't set up as a team member who can book leave.",
      },
      { status: onBehalf ? 404 : 400 },
    );
  }

  const policy = await db.leavePolicy.findFirst({
    where: { id: policyId, companyId: member.companyId, active: true },
  });
  if (!policy) {
    return NextResponse.json({ error: "Pick a leave type." }, { status: 400 });
  }

  // ── The company's limits, before the balance ────────────────────────────
  //
  // A blackout is a refusal with the range named; the cap is a refusal
  // naming who is already off; a statutory holiday inside the range is not
  // a working day and is not charged (countWorkingDays already took a
  // holiday list — nothing passed one until now). lib/leave/limits.js.
  const judged = await judgeLeaveRequest({
    companyId: member.companyId,
    workerId: worker.id,
    startDate,
    endDate,
  });
  if (judged.refusal) {
    return NextResponse.json(
      { error: judged.refusal.message, reason: judged.refusal.reason, ...judged.refusal, othersOff: judged.othersOff },
      { status: 422 },
    );
  }

  const workingDays = await workingDaysFor(onBehalf ? worker.userId : member.userId);
  let days = countWorkingDays(startDate, endDate, { workingDays, holidays: judged.holidays });
  if (halfDay && days === 1) days = 0.5;

  if (!days) {
    return NextResponse.json(
      { error: "That range contains no working days — check the dates." },
      { status: 400 },
    );
  }

  const year = new Date(startDate).getUTCFullYear();
  const [balance, pendingAgg, overlap] = await Promise.all([
    db.leaveBalance.findUnique({
      where: { policyId_workerId_year: { policyId: policy.id, workerId: worker.id, year } },
    }),
    db.leaveRequest.aggregate({
      where: { workerId: worker.id, policyId: policy.id, status: "pending" },
      _sum: { days: true },
    }),
    // Two requests covering the same day is almost always a mistake, and it
    // would double-count against the balance.
    db.leaveRequest.findFirst({
      where: {
        workerId: worker.id,
        status: { in: ["pending", "approved"] },
        startDate: { lte: new Date(endDate) },
        endDate: { gte: new Date(startDate) },
      },
      select: { id: true, startDate: true, endDate: true },
    }),
  ]);

  if (overlap) {
    return NextResponse.json(
      { error: "You already have leave booked or requested that overlaps those dates." },
      { status: 409 },
    );
  }

  const check = canTakeLeave({
    policy,
    balance: balance || {},
    requestedDays: days,
    pendingDays: Number(pendingAgg._sum.days || 0),
  });
  if (!check.ok) {
    return NextResponse.json({ error: check.message, reason: check.reason }, { status: 422 });
  }

  const created = await db.leaveRequest.create({
    data: {
      companyId: member.companyId,
      policyId: policy.id,
      workerId: worker.id,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      days,
      halfDay: Boolean(halfDay) && days === 0.5,
      reason: reason || null,
      // Policies can auto-approve (sick days, commonly). Approving on creation
      // means the balance is consumed immediately, which is correct. A
      // manager's own entry is approved by that manager, by name.
      status: policy.requiresApproval && !onBehalf ? "pending" : "approved",
      ...(policy.requiresApproval && !onBehalf ? {} : { reviewedAt: new Date() }),
      ...(onBehalf ? { reviewedById: member.userId } : {}),
    },
    include: { policy: { select: { name: true } } },
  });

  if (!policy.requiresApproval || onBehalf) {
    await consumeBalance({ policy, workerId: worker.id, year, days });
  }

  await recordActivity(member, {
    action: "leave.requested",
    entityType: "leave",
    entityId: created.id,
    summary: onBehalf
      ? `Added ${days} day(s) of ${policy.name} for ${worker.name} (entered by a manager)`
      : `${worker.name} requested ${days} day(s) of ${policy.name}${policy.requiresApproval ? "" : " (auto-approved)"}`,
    metadata: { days, policy: policy.name, startDate, endDate, onBehalf: Boolean(onBehalf) },
  });

  // ── "Somebody calling in sick" — the owner's own words, and until now it
  //    reached nobody ─────────────────────────────────────────────────────
  //
  // LeaveRequest, LeavePolicy, balances, the reporting line, a screen at
  // /app/time-off and an activity row on all four transitions all existed. The
  // one missing piece was telling a human.
  //
  // The audience is `user:manage` (owner, admin, supervisor), NOT the computed
  // approver, and that is deliberate — see the comment on "leave.requested" in
  // lib/notifications/catalog.js. Two reasons in short: a sick day is usually on
  // an auto-approving policy so there is nothing to approve, only somebody's
  // day to re-plan; and lib/org/leaveRouting.js recomputes routing on every READ
  // precisely so it is never frozen, which a delivery row naming one approver
  // would undo. The row links to the screen that computes the live answer.
  //
  // `member` is the requester, so notifyEvent's own actor filter drops them
  // from their own feed — a manager booking their own leave is not news to them.
  notifyEvent({
    companyId: member.companyId,
    type: "leave.requested",
    entityId: created.id,
    params: {
      workerName: worker.name || "",
      policyName: policy.name || "",
      days,
      // Whether anybody has to act, or this is purely "Dana is out on Tuesday".
      autoApproved: !policy.requiresApproval || Boolean(onBehalf),
    },
    actorUserId: member.userId || null,
  }).catch(() => {});

  // Tell them where it went. "Submitted" and "submitted to Dana, because Sam is
  // away this week" are different amounts of reassurance, and the second one is
  // the answer to the question everybody actually asks next.
  const [routed] = await annotateRouting({
    companyId: member.companyId,
    requests: [created],
    actorWorkerId: worker.id,
    hasManagePermission: can(member.role, "user:manage"),
  });

  return NextResponse.json(routed || created, { status: 201 });
}
