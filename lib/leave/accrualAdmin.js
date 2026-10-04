// lib/leave/accrualAdmin.js
//
// Who may write a person's opening balance or their own accrual rate, and the
// shared steps both writes take. Two routes (app/api/leave/opening,
// app/api/leave/accrual-override) need exactly the same gate, worker lookup
// and "who entered it" name, and a second copy of a permission check is the
// one that drifts.
//
// The gate is owner/admin — the same audience as Settings → Time off
// policies (app/api/settings/leave-policies "Only an owner or admin can
// manage leave policies"). These two writes change what somebody is OWED,
// which is a policy decision about one person, not the day-to-day approving
// that a supervisor does on the Team tab.
//
// A read-only support session is refused here as well as by
// lib/currentMember.js's method gate — deliberately twice, the same as
// impersonation everywhere else (AGENTS.md non-negotiable #2).

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export function isLeaveAdmin(role) {
  return role === "owner" || role === "admin";
}

/**
 * The refusal for a member who may not write leave balances, or null.
 */
export function leaveAdminRefusal(member) {
  // read_only only: a sales demo sandbox is also an impersonation, and it is
  // allowed to write to its own throwaway company.
  if (member?.impersonationMode === "read_only") {
    return NextResponse.json({ error: "A support session is read-only." }, { status: 403 });
  }
  if (!isLeaveAdmin(member?.role)) {
    return NextResponse.json(
      { error: "Only an owner or admin can change what somebody has earned." },
      { status: 403 },
    );
  }
  return null;
}

/** This company's worker, or null — never another tenant's. */
export async function companyWorker(companyId, workerId) {
  if (typeof workerId !== "string" || !workerId.trim()) return null;
  return db.worker.findFirst({
    where: { id: workerId.trim(), companyId },
    select: { id: true, name: true, hiredOn: true, active: true },
  });
}

/**
 * The name to stamp on the trail. Copied, not joined: the record must still
 * say who after that login is removed.
 */
export async function enteredByName(member) {
  if (!member?.userId) return null;
  const user = await db.user
    .findUnique({ where: { id: member.userId }, select: { name: true, email: true } })
    .catch(() => null);
  return (user?.name || user?.email || "").slice(0, 120) || null;
}
