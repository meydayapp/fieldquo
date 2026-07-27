// app/api/settings/follow-up-rules/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { SUPPORTED_TRIGGERS } from "@/lib/followUps/triggers";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rules = await db.followUpRule.findMany({
    where: { companyId: member.companyId },
    include: { template: { select: { id: true, name: true, type: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(rules);
}

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can manage follow-up rules" },
      { status: 403 },
    );
  }

  const { name, triggerEvent, delayValue, delayUnit, templateId, active } =
    await request.json();

  if (!SUPPORTED_TRIGGERS.includes(triggerEvent)) {
    return NextResponse.json(
      { error: `Unknown triggerEvent — must be one of ${SUPPORTED_TRIGGERS.join(", ")}` },
      { status: 400 },
    );
  }
  if (!templateId) {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }

  const created = await db.followUpRule.create({
    data: {
      companyId: member.companyId,
      name: name?.trim() || "Untitled rule",
      triggerEvent,
      delayValue: Number(delayValue) || 3,
      delayUnit: delayUnit === "hours" ? "hours" : "days",
      templateId,
      active: active !== false,
    },
    include: { template: { select: { id: true, name: true, type: true } } },
  });

  return NextResponse.json(created, { status: 201 });
}
