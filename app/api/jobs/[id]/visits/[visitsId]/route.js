// app/api/jobs/[id]/visits/[visitId]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { sendSms } from "@/lib/sms/twilioClient";
import { onMyWayText } from "@/lib/sms/templates";

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const visit = await db.jobVisit.findFirst({
    where: {
      id: _params.visitId,
      jobId: _params.id,
      job: { companyId: member.companyId },
    },
    include: { job: { include: { client: true, company: true } } },
  });
  if (!visit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { status, checklistItems, photos, notes, scheduledAt } = body;

  const updated = await db.jobVisit.update({
    where: { id: _params.visitId },
    data: {
      ...(status !== undefined && { status }),
      ...(checklistItems !== undefined && { checklistItems }),
      ...(photos !== undefined && { photos }),
      ...(notes !== undefined && { notes }),
      ...(scheduledAt !== undefined && { scheduledAt: new Date(scheduledAt) }),
    },
    include: { assignedTo: { select: { id: true, name: true } } },
  });

  // Fire an "on my way" text when status flips to that state — don't let an SMS
  // failure block the actual status update from saving.
  if (status === "on_the_way" && visit.job.client.phone) {
    sendSms({
      to: visit.job.client.phone,
      body: onMyWayText({
        companyName: visit.job.company.name,
        workerName: updated.assignedTo?.name || "Your technician",
      }),
    }).catch((err) => console.error("On-my-way SMS failed:", err.message));
  }

  return NextResponse.json(updated);
}
