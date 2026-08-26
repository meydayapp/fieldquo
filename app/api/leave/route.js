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
import {
  countWorkingDays,
  remainingBalance,
  canTakeLeave,
} from "@/lib/leave/accrual";
import { consumeBalance, refreshAccruals } from "@/lib/leave/balances";
import { ensureWorkerForMember } from "@/lib/team/ensureWorker";
import { annotateRouting } from "@/lib/org/leaveRouting";

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
          worker: { select: { id: true, name: true } },
        },
      }),
      db.leaveBalance.findMany({
        where: { year, policy: { companyId: member.companyId } },
        include: {
          policy: { select: { id: true, name: true, kind: true, accrualMethod: true } },
          worker: { select: { id: true, name: true } },
        },
      }),
      // Read, never create: someone browsing the team's leave who has no Worker
      // row of their own is a viewer, not a person to be enrolled as crew.
      db.worker.findFirst({
        where: { companyId: member.companyId, userId: member.userId },
        select: { id: true },
      }),
    ]);
    return NextResponse.json({
      scope: "team",
      policies,
      // Each pending request carries who it is waiting on, escalated past
      // whoever is away today, and whether THIS viewer may act on it. The
      // second is not the first: a request waiting on a supervisor is still
      // approvable by the owner. See lib/org/leaveRouting.js.
      requests: await annotateRouting({
        companyId: member.companyId,
        requests,
        actorWorkerId: viewer?.id || null,
        hasManagePermission: can(member.role, "user:manage"),
      }),
      balances: balances.map((b) => ({ ...b, ...remainingBalance(b) })),
      canApprove: can(member.role, "user:manage"),
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

  return NextResponse.json({
    scope: "self",
    worker,
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

  const worker = await myWorker(member);
  if (!worker) {
    return NextResponse.json(
      { error: "Your account isn't set up as a team member who can book leave." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const { policyId, startDate, endDate, reason, halfDay } = body || {};

  const policy = await db.leavePolicy.findFirst({
    where: { id: policyId, companyId: member.companyId, active: true },
  });
  if (!policy) {
    return NextResponse.json({ error: "Pick a leave type." }, { status: 400 });
  }

  const workingDays = await workingDaysFor(member.userId);
  let days = countWorkingDays(startDate, endDate, { workingDays });
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
      // means the balance is consumed immediately, which is correct.
      status: policy.requiresApproval ? "pending" : "approved",
      ...(policy.requiresApproval ? {} : { reviewedAt: new Date() }),
    },
    include: { policy: { select: { name: true } } },
  });

  if (!policy.requiresApproval) {
    await consumeBalance({ policy, workerId: worker.id, year, days });
  }

  await recordActivity(member, {
    action: "leave.requested",
    entityType: "leave",
    entityId: created.id,
    summary: `${worker.name} requested ${days} day(s) of ${policy.name}${policy.requiresApproval ? "" : " (auto-approved)"}`,
    metadata: { days, policy: policy.name, startDate, endDate },
  });

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
