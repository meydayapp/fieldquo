// app/api/jobs/[id]/suggested-tasks/route.js
//
// POST — read this job's notes and propose the office to-dos they imply.
//
// POST rather than GET because it spends tokens: opening a job must never cost
// anything, and the expensive path is the one with a click behind it. Same
// split as the quote review route, for the same reason.
//
// Nothing is written. The response is a list of candidates; a person ticks the
// ones they want and those go through POST /api/tasks as ordinary tasks they
// own. See lib/tasks/suggestFromJob.js for why this is not auto-applied.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { requirePermission } from "@/lib/permissions";
import { assignedJobWhere } from "@/lib/permissions/enforce";
import { suggestTasksForJob } from "@/lib/tasks/suggestFromJob";
import { checkAiQuota, recordAiUsage } from "@/lib/ai/usage";

export async function POST(request, { params }) {
  // Next 16: params is a Promise.
  const _params = await params;

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Gated on task:create, not on reading the job. Suggesting tasks to somebody
  // who cannot create one is a control that appears to work and doesn't.
  try {
    requirePermission(member.role, "task:create");
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  // …and gated on the job as well, because this reads the job's notes and
  // visits and spends the company's AI quota doing it.
  const { full, response: denied } = await levelOrRefusal(
    member,
    "jobs",
    "view_only",
    "see jobs",
  );
  if (denied) return denied;

  // Scoped read before spending anything: a job id from another tenant — or a
  // job in this company that this member is not on — must 404 without ever
  // reaching the model. The suggestions are built from the job's NOTES, which
  // include the client's private notes, so an unscoped read here would hand
  // over in prose what the job route hides in JSON.
  const job = await db.job.findFirst({
    where: {
      id: _params.id,
      companyId: member.companyId,
      ...assignedJobWhere(full),
    },
    select: { id: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const quota = await checkAiQuota(member.companyId);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: quota.reason, quotaExceeded: true },
      { status: 429 },
    );
  }

  try {
    const { suggestions, reason } = await suggestTasksForJob({
      jobId: job.id,
      companyId: member.companyId,
      onUsage: (u) =>
        recordAiUsage({
          companyId: member.companyId,
          feature: "task_suggestions",
          userId: member.userId,
          ...u,
        }),
    });

    return NextResponse.json({
      suggestions,
      // The caller needs to tell "nothing to suggest" apart from "the AI is
      // off" apart from "there are no notes to read" — they look identical as
      // an empty list and mean completely different things to the person
      // looking at the screen.
      reason,
    });
  } catch (err) {
    console.error("[jobs/suggested-tasks]", err);
    return NextResponse.json(
      { error: "Couldn't read this job's notes just now. Try again shortly." },
      { status: 500 },
    );
  }
}
