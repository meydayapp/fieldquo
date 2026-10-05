// app/api/jobs/[id]/prep-guide/pdf/route.js
//
// A preview of the guide exactly as the client would receive it today —
// same builder, same renderer, same language rule — so the office can read
// it before the cron does. Nothing is sent, stamped or filed.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { assignedJobWhere } from "@/lib/permissions/enforce";
import { loadPrepGuideJob, buildPrepGuide } from "@/lib/prepGuide/build";
import { renderPrepGuidePdf } from "@/lib/prepGuide/renderPdf";
import { staffFileLink } from "@/lib/media/fileOpen";
import { getAppOrigin } from "@/lib/appUrl";

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: denied } = await levelOrRefusal(member, "jobs", "view_only", "see this job");
  if (denied) return denied;

  const scoped = await db.job.findFirst({ where: { id, companyId: member.companyId, ...assignedJobWhere(full) }, select: { id: true } });
  if (!scoped) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const loaded = await loadPrepGuideJob(db, { jobId: id, companyId: member.companyId });
  if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const built = buildPrepGuide(loaded, { cloudName: process.env.CLOUDINARY_CLOUD_NAME });
  // The preview's document links open for THIS reader through
  // /api/files/open — the stored Cloudinary PDF URL answers 401 from this
  // account (lib/media/fileOpen.js). The client's own copy links to the
  // portal file route instead (lib/prepGuide/send.js). A PDF needs an
  // absolute link; no link at all when one can't be made.
  const origin = getAppOrigin(request);
  const data = {
    ...built,
    documents: built.documents.map((doc) => {
      const path = staffFileLink(member, { kind: "service-document", id: doc.id });
      return { ...doc, url: path ? origin + path : null };
    }),
  };
  const pdf = await renderPrepGuidePdf(data);
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${data.copy.attachmentName}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
