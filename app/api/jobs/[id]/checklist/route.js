// app/api/jobs/[id]/checklist/route.js
//
// The job-level checklist — the per-trade form attached when the job was
// created (JobChecklistTemplate.autoAddFor) or added from the job page. Same
// item shape as a visit's (lib/jobs/checklistItems.js), same normaliser, so a
// typed answer means the same thing on both.
//
// Anyone who can SEE the job can fill it — that is the crew on site, whose
// job list is already narrowed to what they are assigned (assignedJobWhere),
// the same reasoning the visit route gives for letting the assignee tick
// their own visit. Not a price, not a client-facing surface.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { assignedJobWhere } from "@/lib/permissions/enforce";
import { normalizeChecklistItems } from "@/lib/jobs/checklistItems";

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(member, "jobs", "view_only", "see jobs");
  if (denied) return denied;

  const job = await db.job.findFirst({
    where: { id, companyId: member.companyId, ...assignedJobWhere(full) },
    select: { id: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.checklistItems)) {
    return NextResponse.json({ error: "checklistItems must be a list." }, { status: 400 });
  }

  // keepDone: this is somebody answering the form, so the answers ARE the
  // payload. Empty stores null — "no checklist" — never [].
  const items = normalizeChecklistItems(body.checklistItems, { keepDone: true });
  const updated = await db.job.update({
    where: { id },
    data: { checklistItems: items.length ? items : null },
    select: { id: true, checklistItems: true },
  });
  return NextResponse.json(updated);
}
