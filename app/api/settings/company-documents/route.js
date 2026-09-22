// app/api/settings/company-documents/route.js
//
// The company document library (CompanyDocument): insurance, licence,
// WSIB/CNESST, warranty, data sheets, waivers. GET lists everything not
// archived, with the expiry state measured (lib/company/documents.js);
// POST adds one. The file itself is uploaded through /api/upload first —
// the same signed Cloudinary path every upload in the app takes — and only
// the resulting URL lands here.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { isDocumentType, sanitiseWaiverBody } from "@/lib/company/documents";
import { DOCUMENT_SELECT, presentForStaff, listDocuments } from "@/lib/company/documentLibrary";

const HTTP_URL = /^https?:\/\//i;
const str = (v) => (typeof v === "string" ? v.trim() : "");

function parseExpiry(value) {
  if (value === null || value === "" || value === undefined) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  return NextResponse.json({ documents: await listDocuments(member.companyId) });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json({ error: "Only owners/admins can change company documents." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const type = isDocumentType(body?.type) ? body.type : "other";
  const title = str(body?.title).slice(0, 200);
  if (!title) return NextResponse.json({ error: "Give the document a title." }, { status: 400 });

  const fileUrl = str(body?.fileUrl).slice(0, 1000);
  if (type !== "waiver" && !HTTP_URL.test(fileUrl)) {
    return NextResponse.json({ error: "Upload the file first — a document needs a file." }, { status: 400 });
  }
  const expiresAt = parseExpiry(body?.expiresAt);
  if (expiresAt === undefined) return NextResponse.json({ error: "The expiry date isn't a date." }, { status: 400 });

  let waiverBody = null;
  if (type === "waiver") {
    waiverBody = sanitiseWaiverBody(body?.body);
    if (!waiverBody) return NextResponse.json({ error: "A waiver needs at least one section of text." }, { status: 400 });
  }

  const count = await db.companyDocument.count({ where: { companyId: member.companyId, archivedAt: null } });
  const created = await db.companyDocument.create({
    data: {
      companyId: member.companyId,
      type,
      title,
      summary: str(body?.summary).slice(0, 200) || null,
      fileUrl: type === "waiver" ? null : fileUrl,
      filePublicId: str(body?.filePublicId).slice(0, 300) || null,
      mimeType: str(body?.mimeType).slice(0, 100) || null,
      expiresAt,
      showOnQuotes: typeof body?.showOnQuotes === "boolean" ? body.showOnQuotes : type !== "waiver",
      sortOrder: count,
      body: waiverBody,
      attachToQuotes: type === "waiver" && body?.attachToQuotes === true,
      attachToJobs: type === "waiver" && body?.attachToJobs === true,
      attachToInvoices: type === "waiver" && body?.attachToInvoices === true,
    },
    select: DOCUMENT_SELECT,
  });

  await recordActivity(member, {
    action: "settings.company_document_added",
    entityType: "company",
    entityId: member.companyId,
    summary: `Added "${title}" (${type}) to the company documents`,
    metadata: { documentId: created.id, type },
  });

  return NextResponse.json({ document: presentForStaff(created) }, { status: 201 });
}
