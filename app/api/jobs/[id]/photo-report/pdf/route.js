// app/api/jobs/[id]/photo-report/pdf/route.js
//
// A job's photo record as a PDF — the artefact that actually settles a
// dispute, as opposed to the in-app timeline (app/components/jobs/
// JobPhotoTimeline.js), which is the same record but nothing you can hand
// anyone.
//
// ── Unlike the quote and invoice PDF routes, this carries no money ─────────
//
// Those two refuse outright below `requireMoney` — a priced document with the
// prices stripped out is a broken document, not a smaller one. A photo report
// has no prices in it at all, so the same refusal doesn't apply here; the gate
// is the ordinary "can this member see this job" check the GET photos route
// already uses, because that's exactly what downloading this is.
//
// ── Deliberately unfiltered ─────────────────────────────────────────────
//
// The public gallery (lib/site/jobPhotos.js) only ever shows FEATURED,
// non-"issue" photos — that is the access-control boundary for a stranger. A
// staff member looking at their own company's own job is not that stranger:
// they get every photo filed against it, issue shots included, because those
// are exactly the ones that settle a dispute about pre-existing damage. The
// company/job scoping below is the boundary that matters here, not a stage
// filter.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { assignedJobWhere } from "@/lib/permissions/enforce";
import { renderJobPhotoReportPdfBuffer } from "@/app/admin/lib/pdf/renderJobPhotoReportPdf";
import { resolveClientLanguage } from "@/lib/i18n/resolveLanguage";

export async function POST(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Same level as the GET route this report is built from — seeing the report
  // is seeing the job's photos, nothing more.
  const { full, response: denied } = await levelOrRefusal(
    member,
    "jobs",
    "view_only",
    "see jobs",
  );
  if (denied) return denied;

  // Scoped the same way the job page itself is — a name-and-address member
  // gets their OWN assigned job's photos and nobody else's; see the identical
  // comment in app/api/jobs/[id]/photos/route.js.
  const job = await db.job.findFirst({
    where: { id, companyId: member.companyId, ...assignedJobWhere(full) },
    include: { client: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const company = await db.company.findUnique({
    where: { id: member.companyId },
  });

  // Every photo on the job, in whatever order the DB returns them — ordering
  // for the document itself happens inside buildPhotoReportData via
  // stageTimeline, not here.
  const photos = await db.jobPhoto.findMany({
    where: { jobId: id, companyId: member.companyId },
    select: { id: true, url: true, stage: true, caption: true, createdAt: true },
  });

  const pdfBuffer = await renderJobPhotoReportPdfBuffer({
    job,
    client: job.client,
    company,
    photos,
    // No `language` is ever persisted on this report — nothing about it is
    // frozen at a signing moment the way a quote is, so it's fine to use
    // whatever the client's current preference is on every download.
    language: resolveClientLanguage(job.client, company),
  });

  const safeTitle = String(job.title || "job")
    .replace(/[^\w\- ]+/g, "")
    .trim()
    .slice(0, 80) || "job";

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeTitle}-photo-report.pdf"`,
    },
  });
}
