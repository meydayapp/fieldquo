// app/api/settings/leave-policies/route.js
//
// The company's leave policies — what kinds of time off exist, how entitlement
// builds up, and how much rolls into next year.
//
// GET    — policies + regional templates to seed from + a year-end roll preview
// POST   — create one, or seed a region's set, or roll the year
// PATCH  — update one
// DELETE — deactivate one (never hard-delete: past requests point at it)
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { recordActivity } from "@/lib/activity/log";
import {
  LEAVE_TEMPLATES,
  LEAVE_REGIONS,
  LEAVE_KINDS,
  templatePoliciesFor,
} from "@/lib/leave/policyTemplates";
import { refreshAccruals, rollYear } from "@/lib/leave/balances";

function isLeaveAdmin(role) {
  return role === "owner" || role === "admin";
}

const METHODS = ["annual_allotment", "per_period", "percent_of_gross"];

// Null and 0 mean different things for carryover (unlimited vs use-it-or-lose-it),
// so an empty string has to resolve to null, not to zero.
function nullableNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function cleanPolicy(body = {}) {
  const method = METHODS.includes(body.accrualMethod)
    ? body.accrualMethod
    : "annual_allotment";
  return {
    name: String(body.name || "").trim(),
    kind: LEAVE_KINDS.includes(body.kind) ? body.kind : "vacation",
    paid: body.paid !== false,
    accrualMethod: method,
    // Only the field the chosen method actually uses is written. Keeping a
    // stale annualDays alongside a percent policy invites a later reader to use
    // the wrong one.
    annualDays: method === "percent_of_gross" ? null : nullableNumber(body.annualDays) ?? 0,
    percentOfGross:
      method === "percent_of_gross"
        ? Math.min(100, Math.max(0, Number(body.percentOfGross) || 0))
        : null,
    carryoverMaxDays: nullableNumber(body.carryoverMaxDays),
    requiresApproval: body.requiresApproval !== false,
    active: body.active !== false,
  };
}

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isLeaveAdmin(member.role)) {
    return NextResponse.json(
      { error: "Only an owner or admin can manage leave policies." },
      { status: 403 },
    );
  }

  const year = new Date().getUTCFullYear();
  const [policies, workerCount] = await Promise.all([
    db.leavePolicy.findMany({
      where: { companyId: member.companyId },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { _count: { select: { requests: true } } },
    }),
    db.worker.count({ where: { companyId: member.companyId, active: true } }),
  ]);

  return NextResponse.json({
    policies,
    workerCount,
    year,
    templates: LEAVE_REGIONS.map((key) => ({
      key,
      label: LEAVE_TEMPLATES[key].label,
      sourceYear: LEAVE_TEMPLATES[key].sourceYear,
      note: LEAVE_TEMPLATES[key].note,
      policies: LEAVE_TEMPLATES[key].policies,
    })),
  });
}

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isLeaveAdmin(member.role)) {
    return NextResponse.json(
      { error: "Only an owner or admin can manage leave policies." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));

  // Seed a region's starter set.
  if (body?.seedRegion) {
    const region = body.seedRegion;
    if (!LEAVE_TEMPLATES[region]) {
      return NextResponse.json({ error: "Unknown region." }, { status: 400 });
    }
    const rows = templatePoliciesFor(region, member.companyId);
    const existing = await db.leavePolicy.findMany({
      where: { companyId: member.companyId },
      select: { name: true },
    });
    const have = new Set(existing.map((e) => e.name));
    const toCreate = rows.filter((r) => !have.has(r.name));

    if (toCreate.length) {
      await db.leavePolicy.createMany({ data: toCreate });
    }
    // Seeding without accruing gives everyone a zero balance and a policy that
    // looks broken. Accrue immediately so the numbers are there on first load.
    await refreshAccruals({
      companyId: member.companyId,
      year: new Date().getUTCFullYear(),
      // Forced: an edit that left the balances alone would look like it did
      // nothing, which is the exact failure this codebase keeps finding.
      maxAgeMs: 0,
    });

    await recordActivity(member, {
      action: "leave.policies_seeded",
      entityType: "settings",
      summary: `Added ${toCreate.length} ${LEAVE_TEMPLATES[region].label} leave policies`,
      metadata: { region, created: toCreate.map((r) => r.name) },
    });
    return NextResponse.json({
      created: toCreate.length,
      skipped: rows.length - toCreate.length,
    });
  }

  // Year-end roll — an explicit action, never automatic. See rollYear.
  if (body?.rollFromYear) {
    const fromYear = Number(body.rollFromYear);
    if (!Number.isInteger(fromYear) || fromYear < 2000) {
      return NextResponse.json({ error: "Pick a year to roll from." }, { status: 400 });
    }
    const { rolled } = await rollYear({ companyId: member.companyId, fromYear });
    await recordActivity(member, {
      action: "leave.year_rolled",
      entityType: "settings",
      summary: `Carried unused leave from ${fromYear} into ${fromYear + 1} for ${rolled} balance(s)`,
      metadata: { fromYear, rolled },
    });
    return NextResponse.json({ rolled, intoYear: fromYear + 1 });
  }

  const data = cleanPolicy(body);
  if (!data.name) {
    return NextResponse.json({ error: "Give the policy a name." }, { status: 400 });
  }

  try {
    const created = await db.leavePolicy.create({
      data: { ...data, companyId: member.companyId },
    });
    await refreshAccruals({
      companyId: member.companyId,
      year: new Date().getUTCFullYear(),
      // Forced: an edit that left the balances alone would look like it did
      // nothing, which is the exact failure this codebase keeps finding.
      maxAgeMs: 0,
    });
    await recordActivity(member, {
      action: "leave.policy_created",
      entityType: "settings",
      entityId: created.id,
      summary: `Created leave policy "${created.name}"`,
      metadata: { accrualMethod: created.accrualMethod, paid: created.paid },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "A policy with that name already exists." },
        { status: 409 },
      );
    }
    throw err;
  }
}

export async function PATCH(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isLeaveAdmin(member.role)) {
    return NextResponse.json(
      { error: "Only an owner or admin can manage leave policies." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  if (!body?.id)
    return NextResponse.json({ error: "Missing policy id." }, { status: 400 });

  const existing = await db.leavePolicy.findFirst({
    where: { id: body.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = cleanPolicy({ ...existing, ...body });
  if (!data.name) {
    return NextResponse.json({ error: "Give the policy a name." }, { status: 400 });
  }

  try {
    const updated = await db.leavePolicy.update({ where: { id: existing.id }, data });
    // Changing the entitlement has to change the balances, or the screen keeps
    // showing the old accrual and the edit looks like it did nothing.
    await refreshAccruals({
      companyId: member.companyId,
      year: new Date().getUTCFullYear(),
      // Forced: an edit that left the balances alone would look like it did
      // nothing, which is the exact failure this codebase keeps finding.
      maxAgeMs: 0,
    });
    await recordActivity(member, {
      action: "leave.policy_updated",
      entityType: "settings",
      entityId: updated.id,
      summary: `Updated leave policy "${updated.name}"`,
      metadata: { accrualMethod: updated.accrualMethod, annualDays: Number(updated.annualDays || 0) },
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "A policy with that name already exists." },
        { status: 409 },
      );
    }
    throw err;
  }
}

export async function DELETE(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isLeaveAdmin(member.role)) {
    return NextResponse.json(
      { error: "Only an owner or admin can manage leave policies." },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const existing = await db.leavePolicy.findFirst({
    where: { id, companyId: member.companyId },
    include: { _count: { select: { requests: true } } },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // A policy with history is deactivated, not deleted. Past requests reference
  // it, and a payslip that says "Vacation" must still be able to say what that
  // meant. Only a never-used policy is safe to remove outright.
  if (existing._count.requests > 0) {
    const updated = await db.leavePolicy.update({
      where: { id },
      data: { active: false },
    });
    await recordActivity(member, {
      action: "leave.policy_deactivated",
      entityType: "settings",
      entityId: id,
      summary: `Deactivated leave policy "${existing.name}" (${existing._count.requests} request(s) keep their history)`,
    });
    return NextResponse.json({ deactivated: true, policy: updated });
  }

  await db.leavePolicy.delete({ where: { id } });
  await recordActivity(member, {
    action: "leave.policy_deleted",
    entityType: "settings",
    entityId: id,
    summary: `Deleted unused leave policy "${existing.name}"`,
  });
  return NextResponse.json({ deleted: true });
}
