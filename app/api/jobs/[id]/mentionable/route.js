// app/api/jobs/[id]/mentionable/route.js
//
// Who the @mention picker on this job's photos may offer.
//
// Same gate as reading the job's photos (jobs:view_only, scoped by
// assignedJobWhere) — if you cannot see the photos, you cannot see who else
// can see them either. The list itself is filtered by
// mentionableMembersForJob, which is the same predicate the comment route
// re-runs to VALIDATE a mention, not just to suggest one — so the picker and
// the enforcement can never disagree about who is offerable.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { assignedJobWhere } from "@/lib/permissions/enforce";
import { mentionableMembersForJob } from "@/lib/photoComments/mentionable";

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(
    member,
    "jobs",
    "view_only",
    "see jobs",
  );
  if (denied) return denied;

  const job = await db.job.findFirst({
    where: { id, companyId: member.companyId, ...assignedJobWhere(full) },
    select: { id: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const members = await mentionableMembersForJob(db, {
    companyId: member.companyId,
    jobId: id,
  });

  // The caller can't mention themselves usefully, and offering their own name
  // in an "@" list they'd have to scroll past is clutter, not a feature.
  const options = members.filter((m) => m.memberId !== member.id);

  return NextResponse.json({ members: options });
}
