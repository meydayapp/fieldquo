// app/api/settings/follow-up-rules/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { SUPPORTED_TRIGGERS } from "@/lib/followUps/triggers";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";

async function loadOwned(id, companyId) {
  const rule = await db.followUpRule.findUnique({ where: { id } });
  if (!rule || rule.companyId !== companyId) return null;
  return rule;
}

export async function PATCH(request, { params }) {
  const { id } = await params;
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

  const existing = await loadOwned(id, member.companyId);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { name, triggerEvent, delayValue, delayUnit, templateId, active } = body;

  if (triggerEvent !== undefined && !SUPPORTED_TRIGGERS.includes(triggerEvent)) {
    return NextResponse.json(
      { error: `Unknown triggerEvent — must be one of ${SUPPORTED_TRIGGERS.join(", ")}` },
      { status: 400 },
    );
  }

  // Same check the create does: the rule was company-scoped by loadOwned, the
  // template it points at was not.
  const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, {
    ...(templateId !== undefined && { templateId }),
  });
  if (notOurs) return notOurs;

  const updated = await db.followUpRule.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(triggerEvent !== undefined && { triggerEvent }),
      ...(delayValue !== undefined && { delayValue: Number(delayValue) }),
      ...(delayUnit !== undefined && { delayUnit: delayUnit === "hours" ? "hours" : "days" }),
      ...(templateId !== undefined && { templateId }),
      ...(active !== undefined && { active }),
    },
    include: { template: { select: { id: true, name: true, type: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  const { id } = await params;
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

  const existing = await loadOwned(id, member.companyId);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.followUpRule.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
