// app/api/plan-reads/[id]/documents/route.js
//
// POST — file one uploaded file on a drawing read and read it in code
// (lib/planRead/documents.js). The bytes went straight to Cloudinary through
// the shared uploader (uploadFile, purpose "plans"); this route receives the
// URL and, for a drawing PDF, the page images the browser rendered.
//
// Free: extracting a PDF's text and parsing a spreadsheet use no model.
export const runtime = "nodejs";
// A 100 MB drawing set is fetched and its every page's text read here.
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { hasToggle } from "@/lib/permissions/enforce";
import { loadPlanRead } from "@/lib/planRead/load";
import { addPlanReadDocument } from "@/lib/planRead/documents";

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
  });
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status || 400 });
  return NextResponse.json({ document: result.document, ingest: result.ingest }, { status: 201 });
}
