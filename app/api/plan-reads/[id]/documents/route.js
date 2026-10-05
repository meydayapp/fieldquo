// app/api/plan-reads/[id]/documents/route.js
//
// POST — file one uploaded file on a drawing read and read it in code
// (lib/planRead/documents.js). The bytes went straight to Cloudinary through
// the shared uploader (uploadFile, purpose "plans"); this route receives the
// URL and, for a drawing PDF, the page images the browser rendered.
//
// Free: extracting a PDF's text and parsing a spreadsheet use no model.
export const runtime = "nodejs";
// One stored drawing file is fetched and its every page's text read here.
// That file is at most the company's Cloudinary plan's raw-file limit (10 MB
// on the Free plan — lib/media/directUpload.js effectiveCap), never the
// 100 MB PLAN_DOCUMENT_MAX_BYTES ceiling on its own: a bigger set is split
// into parts in the browser before upload (lib/planRead/pdfSplit.js) and
// each part arrives here as its own document.
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { hasToggle } from "@/lib/permissions/enforce";
import { loadPlanRead } from "@/lib/planRead/load";
import { addPlanReadDocument } from "@/lib/planRead/documents";
import { cloudinary } from "@/lib/cloudinary";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: denied } = await levelOrRefusal(member, "quotes", "view_create_edit", "add files to a drawing read");
  if (denied) return denied;

  const read = await loadPlanRead(id, member.companyId, { messages: false });
  if (!read) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const raw = await request.json().catch(() => ({}));
  const result = await addPlanReadDocument({
    prisma: db,
    read,
    companyId: member.companyId,
    userId: member.userId || null,
    raw,
    canSeeMoney: hasToggle(full, "showPricing"),
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    // The signed download path: this account refuses to deliver PDFs from
    // their public URL (401), so the server reads its own upload through the
    // API-signed endpoint (lib/planRead/ingest.js fetchPlanFile).
    sign:
      process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
        ? (publicId, format, options) => cloudinary.utils.private_download_url(publicId, format, options)
        : null,
  });
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status || 400 });
  return NextResponse.json({ document: result.document, ingest: result.ingest }, { status: 201 });
}
