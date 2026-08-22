// app/api/workers/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  loadEnforceableMember,
  redactPayList,
  canSeeAllPay,
} from "@/lib/permissions/enforce";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  const workers = await db.worker.findMany({
    where: { companyId: member.companyId, ...(type && { type }) },
    include: { user: { select: { id: true, email: true } } },
    orderBy: { name: "asc" },
  });

  // Pay rates are payroll data wherever they are read from. This endpoint
  // handed out hourlyRate for every worker to anyone signed in — including a
  // Manager whose payroll level is view_own and who is refused by every
  // payroll PAGE. Your own rate still comes through.
  const full = await loadEnforceableMember(db, member.id);
  return NextResponse.json(
    redactPayList(full, workers, { ownUserId: member.userId }),
  );
}

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can add workers" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { name, email, type, hourlyRate, userId } = body;

  if (!name || !type) {
    return NextResponse.json(
      { error: "name and type are required" },
      { status: 400 },
    );
  }
  if (!["contractor", "employee"].includes(type)) {
    return NextResponse.json(
      { error: "type must be contractor or employee" },
      { status: 400 },
    );
  }

  const cleanEmail = email ? String(email).trim().toLowerCase() : null;

  // ── One person, one Worker row ────────────────────────────────────────────
  //
  // There was NO duplicate check here. A Worker is the HR record — it carries
  // hours, pay, payslips and leave balances — so a second row for the same
  // person means they appear twice in payroll, accrue two sets of holiday, and
  // get paid twice if nobody notices. lib/team/ensureWorker.js already links an
  // invited member to a hand-entered worker by email; this is the other
  // direction, and it was open.
  if (cleanEmail) {
    const existing = await db.worker.findFirst({
      where: {
        companyId: member.companyId,
        email: { equals: cleanEmail, mode: "insensitive" },
      },
      select: { id: true, name: true, active: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          error: `${existing.name} is already on your team with that email${existing.active ? "" : " (currently inactive)"}. Edit them under Workers instead of adding a second record.`,
          existingWorkerId: existing.id,
        },
        { status: 409 },
      );
    }
  }

  // ── A userId from the body is not to be trusted ───────────────────────────
  //
  // This was written straight through. Passing another company's userId would
  // have attached their user to this company's worker — a cross-tenant write via
  // a field nothing validated. It must be an active member of THIS company.
  let linkedUserId = null;
  if (userId) {
    const target = await db.member.findFirst({
      where: { companyId: member.companyId, userId, active: true },
      select: { userId: true },
    });
    if (!target) {
      return NextResponse.json(
        { error: "That person isn't an active member of your team." },
        { status: 400 },
      );
    }
    // Worker.userId is globally unique. Claiming one already linked elsewhere
    // would throw a raw constraint error, so say what happened instead.
    const taken = await db.worker.findUnique({
      where: { userId },
      select: { companyId: true },
    });
    if (taken) {
      return NextResponse.json(
        {
          error:
            taken.companyId === member.companyId
              ? "That person already has a worker record on your team."
              : "That login is already linked to a worker at another company.",
        },
        { status: 409 },
      );
    }
    linkedUserId = target.userId;
  }

  const worker = await db.worker.create({
    data: {
      companyId: member.companyId,
      userId: linkedUserId,
      name,
      email: cleanEmail,
      type,
      hourlyRate: hourlyRate ?? null,
    },
  });

  return NextResponse.json(worker, { status: 201 });
}
