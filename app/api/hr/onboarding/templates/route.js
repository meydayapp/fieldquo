// app/api/hr/onboarding/templates/route.js
//
// The company's checklists. GET creates the default lazily (the first read
// is the seed — see lib/onboarding/service.js). POST adds one; items are
// validated by lib/onboarding/template.js, and a policy item may only
// point at one of this company's policies.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hrManagerOrRefusal } from "@/lib/hr/gate";
import { ensureTemplates } from "@/lib/onboarding/service";
import { normaliseTemplateItems, normaliseTemplateName } from "@/lib/onboarding/template";
import { recordActivity } from "@/lib/activity/log";

async function policyIdsFor(companyId) {
  const rows = await db.companyPolicy.findMany({ where: { companyId, archivedAt: null }, select: { id: true, title: true } });
  return { ids: new Set(rows.map((r) => r.id)), policies: rows };
}

export async function GET(request) {
  const { member, response } = await hrManagerOrRefusal(request);
  if (response) return response;
  const templates = await ensureTemplates(db, member.companyId);
  const { policies } = await policyIdsFor(member.companyId);
  return NextResponse.json({ templates: templates.filter((t) => !t.archivedAt), policies });
}

export async function POST(request) {
  const { member, response } = await hrManagerOrRefusal(request);
  if (response) return response;
  const raw = await request.json().catch(() => ({}));
  const { ids } = await policyIdsFor(member.companyId);
  const parsed = normaliseTemplateItems(raw?.items, { policyIds: ids });
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const template = await db.onboardingTemplate.create({
    data: { companyId: member.companyId, name: normaliseTemplateName(raw?.name), items: parsed.items, isDefault: raw?.isDefault === true },
    select: { id: true, name: true, items: true, isDefault: true, createdAt: true, updatedAt: true },
  });
  if (template.isDefault) {
    await db.onboardingTemplate.updateMany({
      where: { companyId: member.companyId, id: { not: template.id }, isDefault: true },
      data: { isDefault: false },
    });
  }
  await recordActivity(member, { action: "hr.onboarding_template_created", entityType: "onboardingTemplate", entityId: template.id, summary: `Created checklist "${template.name}"` });
  return NextResponse.json({ template }, { status: 201 });
}
