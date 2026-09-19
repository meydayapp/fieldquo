// app/api/settings/follow-up-rules/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { SUPPORTED_TRIGGERS } from "@/lib/followUps/triggers";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
import { ensureDefaultFollowUps, BUILT_IN_KEYS } from "@/lib/followUps/defaults";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // A company created before the defaults existed, or one whose signup
  // seeding hiccuped, gets them the first time anyone opens the page.
  // Idempotent (keyed on companyId + builtInKey), so this costs one read on
  // every load and a write only once per company. Best-effort: a seeding
  // failure must not take the page down.
  try {
    await ensureDefaultFollowUps(db, member.companyId);
  } catch (err) {
    console.error("[follow-up-rules] default seeding failed:", err?.message);
  }

  const rules = await db.followUpRule.findMany({
    where: { companyId: member.companyId },
    include: { template: { select: { id: true, name: true, type: true } } },
    orderBy: { createdAt: "asc" },
  });

  // Tombstoned defaults are reported separately, not hidden: the page offers
  // to restore them, and a list that silently dropped a row would have no
  // way to say "you deleted the day-7 one".
  const live = rules.filter((r) => !r.deletedAt);
  const deleted = rules
    .filter((r) => r.deletedAt && BUILT_IN_KEYS.includes(r.builtInKey))
    .map((r) => ({ id: r.id, builtInKey: r.builtInKey, name: r.name, deletedAt: r.deletedAt }));

  // Built-ins first, in FieldQuo's order, then the company's own rules by age.
  const order = (r) => (r.builtInKey ? BUILT_IN_KEYS.indexOf(r.builtInKey) : BUILT_IN_KEYS.length);
  live.sort((a, b) => order(a) - order(b) || new Date(a.createdAt) - new Date(b.createdAt));

  return NextResponse.json({ rules: live, deletedBuiltIns: deleted });
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
