// app/api/settings/follow-up-rules/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { SUPPORTED_TRIGGERS } from "@/lib/followUps/triggers";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
import { resetBuiltInRule } from "@/lib/followUps/defaults";

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
  const { name, triggerEvent, delayValue, delayUnit, templateId, active, reset } = body;

  // "Reset to default" and "Restore": FieldQuo's delay, name, wording and
  // switch position, and back from a delete. Only a built-in has a default to
  // go back to; a hand-made rule asking for one is a client bug, refused
  // rather than guessed at.
  if (reset === true) {
    if (!existing.builtInKey) {
      return NextResponse.json({ error: "Only a FieldQuo default can be reset." }, { status: 400 });
    }
    const restored = await resetBuiltInRule(db, existing);
    return NextResponse.json(restored);
  }

  // A deleted default is edited by restoring it first, not by editing the
  // tombstone. Everything below would otherwise write to a row nothing reads.
  if (existing.deletedAt) {
    return NextResponse.json({ error: "This rule was deleted — restore it first." }, { status: 409 });
  }

  // A delay of zero or less would chase a quote the moment it was sent.
  if (delayValue !== undefined && !(Number(delayValue) >= 1)) {
    return NextResponse.json({ error: "The delay must be at least 1." }, { status: 400 });
  }

  if (triggerEvent !== undefined && !SUPPORTED_TRIGGERS.includes(triggerEvent)) {
    return NextResponse.json(
      { error: `Unknown triggerEvent — must be one of ${SUPPORTED_TRIGGERS.join(", ")}` },
      { status: 400 },
    );
  }

  // Same check the create does: the rule was company-scoped by loadOwned, the
  // template it points at was not. `null` is a legal value for a built-in —
  // it means "FieldQuo's own wording" — and only for a built-in: a hand-made
  // rule with no template has nothing to send.
  if (templateId === null && !existing.builtInKey) {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }
  const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, {
    ...(templateId !== undefined && templateId !== null && { templateId }),
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

  // A FieldQuo default is tombstoned, never removed: the unique
  // (companyId, builtInKey) row is what stops ensureDefaultFollowUps putting
  // it back on the next page load, and "Restore" is a plain update. The
  // company's own rules hard-delete as they always did.
  if (existing.builtInKey) {
    await db.followUpRule.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    return NextResponse.json({ ok: true, tombstoned: true });
  }

  await db.followUpRule.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
