// app/api/chat/messages/[id]/save-to-job/route.js
//
// "Save to job photos": a photo from team chat becomes a photo on a job.
//
// POST { index, jobId? } → { ok, jobId, photoId, already? }
//   index  which photo in the message (0-based)
//   jobId  the job to file it on — optional in a JOB room, where it is that
//          room's job
//
// The same door as POST /api/jobs/[id]/photos (lib/company/chat/store.js
// saveToJob): jobs at view_only — the crew can, filing photos is their job —
// on a job they can see (assignedJobWhere). It is saved as a progress photo,
// never featured: putting a photo on the website stays a curation decision.
// The chat's private file is COPIED to a public job-photo asset; the chat
// copy stays private.
//
// Codes: no_message | read_only | not_photo | no_job | not_allowed |
//        file_unreadable | copy_failed | unavailable
//
// `params` is a Promise in Next 16.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { saveToJob } from "@/lib/company/chat/store";
import { cloudinaryReady, copyPhotoToJob } from "@/lib/company/chat/cloudinaryFiles";

export async function POST(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const done = await saveToJob(
    member,
    id,
    { index: Number(body?.index ?? 0), jobId: typeof body?.jobId === "string" ? body.jobId : null },
    { copy: cloudinaryReady() ? copyPhotoToJob : null },
  );
  if (!done.ok) return NextResponse.json({ error: done.error, code: done.code }, { status: done.status });
  return NextResponse.json({ ok: true, jobId: done.jobId, photoId: done.photoId, already: Boolean(done.already) });
}
