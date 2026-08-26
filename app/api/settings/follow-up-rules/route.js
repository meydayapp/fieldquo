// app/api/settings/follow-up-rules/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { SUPPORTED_TRIGGERS } from "@/lib/followUps/triggers";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const rules = await db.followUpRule.findMany({
    where: { companyId: member.companyId },
    include: { template: { select: { id: true, name: true, type: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(rules);
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

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

  // templateId names a DocumentTemplate, which is company-owned. Unchecked, a
  // rule could fire another tenant's template at this company's clients — and
  // the `include` below reads its name straight back.
  const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, { templateId });
  if (notOurs) return notOurs;

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
