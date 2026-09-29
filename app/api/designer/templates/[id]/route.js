// app/api/designer/templates/[id]/route.js
//
// DELETE — "Delete" on one of the company's own templates. It ARCHIVES:
// archivedAt is set and the row drops out of every gallery read, but nothing
// is destroyed. A FieldQuo catalogue template (companyId null) is not the
// company's to delete and answers 404, the same as another company's
// template — this route never says which rows exist elsewhere.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can manage marketing" },
      { status: err.status || 403 },
    );
  }

  // Scoped in the WHERE: another company's id, or a catalogue id, matches
  // nothing and so archives nothing.
  const archived = await db.designTemplate.updateMany({
    where: { id, companyId: member.companyId, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  if (!archived.count) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await recordActivity(member, {
    action: "marketing.template_archived",
    entityType: "settings",
    entityId: id,
    summary: "Removed a saved design template",
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
