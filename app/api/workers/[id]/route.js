// app/api/workers/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { loadEnforceableMember, canSeeAllPay, redactPay } from "@/lib/permissions/enforce";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const worker = await db.worker.findFirst({
    where: { id: _params.id, companyId: member.companyId },
    include: {
      timeEntries: { orderBy: { clockIn: "desc" }, take: 20 },
      payouts: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!worker)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(worker);
}

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can edit workers" },
      { status: 403 },
    );
  }

  const existing = await db.worker.findFirst({
    where: { id: _params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { name, email, hourlyRate, active, hiredOn } = body;

  // Setting someone's pay is payroll. The Workers tab offered a "Pay rate
  // ($/hour)" field to a Manager and the write landed — QA moved a colleague
  // from $25 to $26 and confirmed it stuck. Refused rather than silently
  // dropped, so nobody types a number and believes it saved.
  const full = await loadEnforceableMember(db, member.id);
  if (hourlyRate !== undefined && !canSeeAllPay(full)) {
    return NextResponse.json(
      { error: "You don't have access to pay rates. Ask an owner or admin." },
      { status: 403 },
    );
  }

  // Empty string clears the hire date back to "unknown", which is a real state:
  // it makes leave accrual grant the full allotment instead of pro-rating. An
  // unparseable date is rejected rather than silently stored as the epoch.
  let hiredOnValue;
  if (hiredOn !== undefined) {
    if (hiredOn === null || hiredOn === "") {
      hiredOnValue = null;
    } else {
      const d = new Date(hiredOn);
      if (Number.isNaN(d.getTime()) || d.getUTCFullYear() < 1950) {
        return NextResponse.json(
          { error: "That start date isn't a valid date." },
          { status: 400 },
        );
      }
      hiredOnValue = d;
    }
  }

  // type is intentionally NOT editable here — flipping contractor<->employee has real
  // legal/tax implications and shouldn't be a casual field update. Treat it as
  // "deactivate this worker record, create a new one" if that's genuinely needed.
  const updated = await db.worker.update({
    where: { id: _params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(hourlyRate !== undefined && { hourlyRate }),
      ...(active !== undefined && { active }),
      ...(hiredOn !== undefined && { hiredOn: hiredOnValue }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can remove workers" },
      { status: 403 },
    );
  }

  const existing = await db.worker.findFirst({
    where: { id: _params.id, companyId: member.companyId },
    include: { payouts: true },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.payouts.length > 0) {
    // Same principle as everywhere else in this app: don't let a payment history
    // record disappear. Deactivate instead.
    await db.worker.update({
      where: { id: _params.id },
      data: { active: false },
    });
    return NextResponse.json({ success: true, deactivated: true });
  }

  await db.worker.delete({ where: { id: _params.id } });
  return NextResponse.json({ success: true, deleted: true });
}
