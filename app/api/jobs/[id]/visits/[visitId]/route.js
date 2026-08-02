// app/api/jobs/[id]/visits/[visitId]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { sendSms } from "@/lib/sms/twilioClient";
import { renderMessage } from "@/lib/sms/renderTemplate";
import { ensureUpcomingVisit } from "@/lib/jobs/recurrence";

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
      // The company's own wording when they set it, the built-in otherwise.
      // renderMessage falls back safely if a stored template is invalid, so a
      // bad edit can never ship a raw "{token}" to a customer.
      body: renderMessage({
        type: "on_my_way",
        templates: visit.job.company.smsTemplates,
        values: {
          company: visit.job.company.name,
          worker: updated.assignedTo?.name || "Your technician",
          name: (visit.job.client.name || "").split(/\s+/)[0],
        },
      }),
    }).catch((err) => console.error("On-my-way SMS failed:", err.message));
  }

  // A completed visit on a recurring job spawns the next one immediately, so the
  // crew closing out today's clean sees next week's already on the calendar
  // instead of waiting for the nightly cron. ensureUpcomingVisit is idempotent
  // (it no-ops when a future visit already exists), so this and the cron can't
  // double-book. Never let it block the status update that just saved.
  if (status === "completed" && visit.job.recurring) {
    await ensureUpcomingVisit(db, _params.id).catch((err) =>
      console.error("[recurring next-visit] failed:", err.message),
    );
  }

  return NextResponse.json(updated);
}
