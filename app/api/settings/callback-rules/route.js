// app/api/settings/callback-rules/route.js
//
// GET   — the company's rules, with the members they can be assigned to.
// PUT   — { id?, ...rule } create or update one rule (owner/admin).
// No DELETE: switching `enabled` off is how a rule stops; its lists stay.
//
// The assignee is a Member of this company. There is deliberately no AI
// assignee — see CallbackRule's comment in prisma/schema.prisma for why the
// front desk cannot take this list under today's consent rule.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { normaliseRule, AREA_KINDS } from "@/lib/callbacks/rules";

const ownerOrAdmin = (m) => m.role === "owner" || m.role === "admin";

async function payload(companyId) {
  const [rules, members, areas, company] = await Promise.all([
    db.callbackRule.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
      include: { assignee: { select: { id: true, user: { select: { name: true, email: true } } } } },
    }),
    db.member.findMany({
      where: { companyId, role: { not: "viewer" } },
      select: { id: true, role: true, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.workArea.findMany({ where: { companyId }, select: { id: true, name: true, polygon: true } }),
    db.company.findUnique({ where: { id: companyId }, select: { timezone: true, currency: true } }),
  ]);
  return {
    rules: rules.map((r) => ({
      ...r,
      minTicket: Number(r.minTicket),
      assigneeName: r.assignee?.user?.name || r.assignee?.user?.email || null,
    })),
    members: members.map((m) => ({ id: m.id, name: m.user?.name || m.user?.email || "", role: m.role })),
    workAreas: areas.map((a) => ({ id: a.id, name: a.name, hasPolygon: Array.isArray(a.polygon) && a.polygon.length >= 3 })),
    areaKinds: AREA_KINDS,
    timezone: company?.timezone || null,
    currency: company?.currency || null,
  };
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  // A read-only support session reads (non-negotiable #3); PUT below does
  // not carve it out.
  if (!member.impersonation && !ownerOrAdmin(member)) {
    return NextResponse.json({ error: "Only an owner or admin can see callback rules." }, { status: 403 });
  }
  return NextResponse.json(await payload(member.companyId));
}

export async function PUT(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!ownerOrAdmin(member)) return NextResponse.json({ error: "Only an owner or admin can change callback rules." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const rule = normaliseRule(body || {});

  if (rule.assigneeMemberId) {
    const assignee = await db.member.findFirst({ where: { id: rule.assigneeMemberId, companyId: member.companyId }, select: { id: true } });
    if (!assignee) return NextResponse.json({ error: "That person is not a member of this company." }, { status: 400 });
  }
  if (rule.areaKind === "work_area") {
    const area = await db.workArea.findFirst({ where: { id: rule.areaValue, companyId: member.companyId }, select: { polygon: true } });
    if (!area) return NextResponse.json({ error: "That work area does not exist." }, { status: 400 });
    if (!Array.isArray(area.polygon) || area.polygon.length < 3) {
      return NextResponse.json({ error: "That work area has no map polygon yet — draw one under Settings → Work Areas, or filter by postcode or city." }, { status: 422 });
    }
  }

  const data = { ...rule };
  const id = typeof body?.id === "string" ? body.id : null;
  if (id) {
    const existing = await db.callbackRule.findFirst({ where: { id, companyId: member.companyId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    await db.callbackRule.update({ where: { id }, data });
  } else {
    await db.callbackRule.create({ data: { companyId: member.companyId, ...data } });
  }
  return NextResponse.json(await payload(member.companyId));
}
