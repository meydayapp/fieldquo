// app/api/leave/[id]/route.js
//
// PATCH — approve, decline, or cancel one leave request.
//
// ── Who can do what ────────────────────────────────────────────────────────
//
// Approving and declining need `user:manage` (owner, admin, supervisor).
// Cancelling is allowed by the person who booked it, because withdrawing your
// own request isn't a privileged act — but only while it's pending or still in
// the future. Cancelling leave you already took would hand back days you spent.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { can } from "@/lib/permissions";
import { canApprove } from "@/lib/org/reportingLine";
import { recordActivity } from "@/lib/activity/log";
import { canTakeLeave } from "@/lib/leave/accrual";
import { consumeBalance, releaseBalance } from "@/lib/leave/balances";

const ACTIONS = new Set(["approve", "decline", "cancel"]);

export async function PATCH(request, { params }) {
  // Next 16: params is a Promise.
  const { id } = await params;

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!member.userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const action = body?.action;
  if (!ACTIONS.has(action)) {
    return NextResponse.json(
      { error: "Action must be approve, decline or cancel." },
      { status: 400 },
    );
  }

  const req = await db.leaveRequest.findFirst({
    where: { id, companyId: member.companyId },
    include: {
      policy: true,
      worker: { select: { id: true, name: true, userId: true } },
    },
  });
  if (!req) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwnRequest = req.worker.userId && req.worker.userId === member.userId;
  const canManage = can(member.role, "user:manage");

  // Who may act on this. Company-wide people permission still works — an owner
  // is never locked out — but a supervisor now needs to be somewhere ABOVE the
  // requester in the reporting line rather than merely holding the role. Before
  // this, any admin could approve holiday for a crew they had never met.
  //
  // The whole company's chain is loaded because approval walks upward: knowing
  // the requester's manager is not enough to tell whether the actor is three
  // steps above them.
  //
  // Note what is deliberately NOT here: availability. Escalation past a manager
  // who is away (lib/org/leaveRouting.js) decides who a request WAITS on, and
  // waiting is not permission. Checking `isAway` here would mean a manager back
  // from holiday couldn't approve a request that escalated past them while they
  // were out, and — worse — a database hiccup in the availability lookup would
  // start refusing approvals. Who may act is answered from the org chart and
  // the role alone, both of which are already loaded.
  const [actor, orgWorkers] = await Promise.all([
    db.worker.findFirst({
      where: { companyId: member.companyId, userId: member.userId },
      select: { id: true },
    }),
    db.worker.findMany({
      where: { companyId: member.companyId },
      select: { id: true, managerId: true },
    }),
  ]);
  const byId = new Map(orgWorkers.map((w) => [w.id, w]));
  const allowed = canApprove({
    actorWorkerId: actor?.id || null,
    workerId: req.worker.id,
    byId,
    hasManagePermission: canManage,
  });

  if (action !== "cancel" && !allowed) {
    return NextResponse.json(
      {
        error: isOwnRequest
          ? "You can't approve your own time off — it goes to your manager."
          : "Only this person's manager, or someone above them, can approve or decline their time off.",
      },
      { status: 403 },
    );
  }
  if (action === "cancel" && !isOwnRequest && !canManage) {
    return NextResponse.json(
      { error: "You can only cancel your own time off." },
      { status: 403 },
    );
  }

  const year = req.startDate.getUTCFullYear();

  if (action === "approve") {
    if (req.status === "approved") {
      return NextResponse.json({ ...req, alreadyApproved: true });
    }
    if (req.status !== "pending") {
      return NextResponse.json(
        { error: `That request is ${req.status} — it can't be approved.` },
        { status: 409 },
      );
    }

    // Re-check the balance HERE, not just at submit time. Between someone
    // requesting and a manager approving, other requests may have been
    // approved; approving on the strength of the older check is how a balance
    // goes negative.
    const [balance, pendingAgg] = await Promise.all([
      db.leaveBalance.findUnique({
        where: {
          policyId_workerId_year: {
            policyId: req.policyId,
            workerId: req.workerId,
            year,
          },
        },
      }),
      db.leaveRequest.aggregate({
        where: {
          workerId: req.workerId,
          policyId: req.policyId,
          status: "pending",
          id: { not: req.id },
        },
        _sum: { days: true },
      }),
    ]);

    const check = canTakeLeave({
      policy: req.policy,
      balance: balance || {},
      requestedDays: Number(req.days),
      // Other people's pending requests don't block this one, but this worker's
      // other pending days do — approving all of them must stay possible only
      // if the balance covers all of them.
      pendingDays: Number(pendingAgg._sum.days || 0),
    });
    if (!check.ok) {
      return NextResponse.json(
        {
          error: `${req.worker.name} doesn't have the balance for this. ${check.message}`,
          reason: check.reason,
        },
        { status: 422 },
      );
    }

    const updated = await db.leaveRequest.update({
      where: { id: req.id },
      data: {
        status: "approved",
        reviewedById: member.userId,
        reviewedAt: new Date(),
        reviewNote: body.note || null,
      },
    });
    await consumeBalance({
      policy: req.policy,
      workerId: req.workerId,
      year,
      days: Number(req.days),
    });

    await recordActivity(member, {
      action: "leave.approved",
      entityType: "leave",
      entityId: req.id,
      summary: `Approved ${req.days} day(s) of ${req.policy.name} for ${req.worker.name}`,
      metadata: { days: Number(req.days), policy: req.policy.name },
    });
    return NextResponse.json(updated);
  }

  if (action === "decline") {
    if (req.status !== "pending") {
      return NextResponse.json(
        { error: `That request is ${req.status} — it can't be declined.` },
        { status: 409 },
      );
    }
    const updated = await db.leaveRequest.update({
      where: { id: req.id },
      data: {
        status: "declined",
        reviewedById: member.userId,
        reviewedAt: new Date(),
        reviewNote: body.note || null,
      },
    });
    // Nothing to release: a pending request never consumed the balance, it was
    // only reserved at read time.
    await recordActivity(member, {
      action: "leave.declined",
      entityType: "leave",
      entityId: req.id,
      summary: `Declined ${req.days} day(s) of ${req.policy.name} for ${req.worker.name}`,
      metadata: { policy: req.policy.name, note: body.note || null },
    });
    return NextResponse.json(updated);
  }

  // cancel
  if (!["pending", "approved"].includes(req.status)) {
    return NextResponse.json(
      { error: `That request is already ${req.status}.` },
      { status: 409 },
    );
  }
  // Leave that has already started has been taken. A manager can still cancel
  // it (mistakes happen, and they carry the note explaining it); the employee
  // cannot unilaterally undo days they took.
  const startedAlready = req.startDate <= new Date();
  if (startedAlready && !canManage) {
    return NextResponse.json(
      {
        error:
          "That time off has already started — ask a manager to change it.",
      },
      { status: 409 },
    );
  }

  const updated = await db.leaveRequest.update({
    where: { id: req.id },
    data: {
      status: "cancelled",
      reviewedById: member.userId,
      reviewedAt: new Date(),
      reviewNote: body.note || null,
    },
  });
  if (req.status === "approved") {
    await releaseBalance({
      policy: req.policy,
      workerId: req.workerId,
      year,
      days: Number(req.days),
    });
  }

  await recordActivity(member, {
    action: "leave.cancelled",
    entityType: "leave",
    entityId: req.id,
    summary: `Cancelled ${req.days} day(s) of ${req.policy.name} for ${req.worker.name}`,
    metadata: {
      policy: req.policy.name,
      wasApproved: req.status === "approved",
    },
  });
  return NextResponse.json(updated);
}
