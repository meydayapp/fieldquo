// app/api/hr/onboarding/templates/[id]/route.js — rename, re-order, re-write
// or archive a checklist. A run in progress keeps the items it started
// with (lib/onboarding/run.js); this edit describes the next hire.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hrManagerOrRefusal } from "@/lib/hr/gate";
import { normaliseTemplateItems, normaliseTemplateName } from "@/lib/onboarding/template";
import { recordActivity } from "@/lib/activity/log";

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await hrManagerOrRefusal(request);
  if (response) return response;

  const existing = await db.onboardingTemplate.findFirst({ where: { id, companyId: member.companyId }, select: { id: true, name: true, archivedAt: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.archivedAt) return NextResponse.json({ error: "This checklist is archived." }, { status: 409 });

  const raw = await request.json().catch(() => ({}));
  const data = {};
  if (raw?.name !== undefined) data.name = normaliseTemplateName(raw.name, existing.name);
  if (raw?.items !== undefined) {
    const rows = await db.companyPolicy.findMany({ where: { companyId: member.companyId, archivedAt: null }, select: { id: true } });
    const parsed = normaliseTemplateItems(raw.items, { policyIds: new Set(rows.map((r) => r.id)) });
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
    data.items = parsed.items;
  }
  if (raw?.archived === true) data.archivedAt = new Date();
  if (raw?.isDefault === true) data.isDefault = true;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const template = await db.onboardingTemplate.update({
    where: { id: existing.id },
    data,
    select: { id: true, name: true, items: true, isDefault: true, archivedAt: true, createdAt: true, updatedAt: true },
  });
  if (data.isDefault) {
    await db.onboardingTemplate.updateMany({ where: { companyId: member.companyId, id: { not: template.id }, isDefault: true }, data: { isDefault: false } });
  }
  await recordActivity(member, {
    action: data.archivedAt ? "hr.onboarding_template_archived" : "hr.onboarding_template_updated",
    entityType: "onboardingTemplate",
    entityId: template.id,
    summary: `${data.archivedAt ? "Archived" : "Updated"} checklist "${template.name}"`,
  });
  return NextResponse.json({ template });
}
