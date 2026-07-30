// app/api/settings/payroll-components/route.js
//
// The company's payroll deduction/earning library — what turns a gross pay run
// into net pay. Owner/admin only: these numbers decide what lands in someone's
// bank account.
//
// GET    — components + the regional templates available to seed from
// POST   — create one, or seed a whole region's statutory set
// PATCH  — update one
// DELETE — remove one
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { recordActivity } from "@/lib/activity/log";
import {
  STATUTORY_TEMPLATES,
  STATUTORY_REGIONS,
  templateComponentsFor,
} from "@/lib/payroll/statutoryTemplates";

function isPayrollAdmin(role) {
  return role === "owner" || role === "admin";
}

const CALCULATIONS = ["fixed", "percent", "slabs"];
const KINDS = ["earning", "deduction"];

// Slabs arrive from a browser, so they're validated rather than trusted: the
// engine caps percentages, but a malformed shape would produce a silently wrong
// payslip, which is worse than a rejected save.
function cleanSlabs(input) {
  if (!Array.isArray(input)) return null;
  const rows = input
    .map((s) => ({
      upTo: s?.upTo === null || s?.upTo === "" || s?.upTo === undefined ? null : Number(s.upTo),
      percent: Number(s?.percent),
    }))
    .filter((s) => Number.isFinite(s.percent) && (s.upTo === null || Number.isFinite(s.upTo)));
  if (!rows.length) return null;
  // Ascending, with the open-ended band last.
  rows.sort((a, b) => (a.upTo === null ? 1 : b.upTo === null ? -1 : a.upTo - b.upTo));
  return rows;
}

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isPayrollAdmin(member.role)) {
    return NextResponse.json(
      { error: "Only an owner or admin can see payroll settings." },
      { status: 403 },
    );
  }

  const components = await db.salaryComponent.findMany({
    where: { companyId: member.companyId },
    orderBy: [{ statutory: "desc" }, { name: "asc" }],
  });

  return NextResponse.json({
    components,
    // Offered as a starting point, with the year they came from so an
    // out-of-date set is visible rather than quietly wrong.
    templates: STATUTORY_REGIONS.map((key) => ({
      key,
      label: STATUTORY_TEMPLATES[key].label,
      sourceYear: STATUTORY_TEMPLATES[key].sourceYear,
      note: STATUTORY_TEMPLATES[key].note,
      count: STATUTORY_TEMPLATES[key].components.length,
    })),
  });
}

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isPayrollAdmin(member.role)) {
    return NextResponse.json(
      { error: "Only an owner or admin can change payroll settings." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));

  // Seed a region's statutory set.
  if (body?.seedRegion) {
    const rows = templateComponentsFor(body.seedRegion, member.companyId);
    if (!rows.length) {
      return NextResponse.json({ error: "Unknown region." }, { status: 400 });
    }
    // upsert by name so seeding twice doesn't duplicate, and never overwrites a
    // rate the company has already adjusted.
    let created = 0;
    for (const row of rows) {
      const existing = await db.salaryComponent.findUnique({
        where: { companyId_name: { companyId: member.companyId, name: row.name } },
        select: { id: true },
      });
      if (existing) continue;
      await db.salaryComponent.create({ data: row });
      created += 1;
    }
    await recordActivity(member, {
      action: "settings.payroll_components_seeded",
      entityType: "settings",
      summary: `Seeded ${created} ${body.seedRegion} statutory payroll components`,
      metadata: { region: body.seedRegion, created },
    });
    return NextResponse.json({ ok: true, created, skipped: rows.length - created });
  }

  const name = String(body?.name || "").trim();
  if (!name) return NextResponse.json({ error: "Give it a name." }, { status: 400 });
  const kind = KINDS.includes(body?.kind) ? body.kind : "deduction";
  const calculation = CALCULATIONS.includes(body?.calculation) ? body.calculation : "fixed";

  const slabs = calculation === "slabs" ? cleanSlabs(body?.slabs) : null;
  if (calculation === "slabs" && !slabs) {
    return NextResponse.json(
      { error: "Add at least one tax band, with a percentage." },
      { status: 400 },
    );
  }
  if (calculation === "percent" && !(Number(body?.percent) > 0)) {
    return NextResponse.json({ error: "Give a percentage above 0." }, { status: 400 });
  }
  if (calculation === "fixed" && !(Number(body?.amount) > 0)) {
    return NextResponse.json({ error: "Give an amount above 0." }, { status: 400 });
  }

  try {
    const created = await db.salaryComponent.create({
      data: {
        companyId: member.companyId,
        name,
        kind,
        calculation,
        amount: calculation === "fixed" ? Number(body.amount) : null,
        percent: calculation === "percent" ? Number(body.percent) : null,
        slabs,
        statutory: Boolean(body?.statutory),
        region: body?.region || null,
        appliesToAll: body?.appliesToAll !== false,
      },
    });
    await recordActivity(member, {
      action: "settings.payroll_component_created",
      entityType: "settings",
      entityId: created.id,
      summary: `Added payroll component "${name}"`,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: `You already have a component called "${name}".` },
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
  if (!isPayrollAdmin(member.role)) {
    return NextResponse.json({ error: "Only an owner or admin can change payroll settings." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const id = body?.id;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const existing = await db.salaryComponent.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, name: true, calculation: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const calculation = CALCULATIONS.includes(body?.calculation) ? body.calculation : existing.calculation;
  const slabs = calculation === "slabs" ? cleanSlabs(body?.slabs) : null;

  const updated = await db.salaryComponent.update({
    where: { id },
    data: {
      ...(body.name ? { name: String(body.name).trim() } : {}),
      ...(KINDS.includes(body?.kind) ? { kind: body.kind } : {}),
      calculation,
      amount: calculation === "fixed" ? Number(body.amount) || 0 : null,
      percent: calculation === "percent" ? Number(body.percent) || 0 : null,
      slabs,
      ...(typeof body.active === "boolean" ? { active: body.active } : {}),
      ...(typeof body.appliesToAll === "boolean" ? { appliesToAll: body.appliesToAll } : {}),
    },
  });

  await recordActivity(member, {
    action: "settings.payroll_component_updated",
    entityType: "settings",
    entityId: id,
    summary: `Updated payroll component "${updated.name}"`,
  });

  return NextResponse.json(updated);
}

export async function DELETE(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isPayrollAdmin(member.role)) {
    return NextResponse.json({ error: "Only an owner or admin can change payroll settings." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const existing = await db.salaryComponent.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, name: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Past pay runs keep their own copy of what was deducted (PayRunLine.items),
  // so removing a component never rewrites history.
  await db.salaryComponent.delete({ where: { id } });
  await recordActivity(member, {
    action: "settings.payroll_component_deleted",
    entityType: "settings",
    summary: `Removed payroll component "${existing.name}"`,
  });

  return NextResponse.json({ ok: true });
}
