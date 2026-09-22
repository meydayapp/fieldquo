// app/api/settings/company-documents/[id]/route.js
//
// One library document: PATCH edits the fields sent (title, summary, type,
// file, expiry, show-on-quotes, sort order, a waiver's body and defaults);
// DELETE archives — the row stays, with archivedAt set, so a signed waiver
// keeps pointing at the text it was signed over.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { isDocumentType, sanitiseWaiverBody } from "@/lib/company/documents";
import { DOCUMENT_SELECT, presentForStaff } from "@/lib/company/documentLibrary";

const HTTP_URL = /^https?:\/\//i;
const str = (v) => (typeof v === "string" ? v.trim() : "");

function refuse(member) {
  try {
    requirePermission(member.role, "user:manage");
    return null;
  } catch {
    return NextResponse.json({ error: "Only owners/admins can change company documents." }, { status: 403 });
  }
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const denied = refuse(member);
  if (denied) return denied;

  const existing = await db.companyDocument.findFirst({
    where: { id, companyId: member.companyId, archivedAt: null },
    select: { id: true, type: true },
  });
  if (!existing) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data = {};
  if ("title" in body) {
    const title = str(body.title).slice(0, 200);
    if (!title) return NextResponse.json({ error: "Give the document a title." }, { status: 400 });
    data.title = title;
  }
  if ("summary" in body) data.summary = str(body.summary).slice(0, 200) || null;
  if ("type" in body) {
    if (!isDocumentType(body.type)) return NextResponse.json({ error: "Unknown document type." }, { status: 400 });
    if ((body.type === "waiver") !== (existing.type === "waiver")) {
      return NextResponse.json({ error: "A waiver can't become a file, or a file a waiver — add a new document instead." }, { status: 400 });
    }
    data.type = body.type;
  }
  if ("fileUrl" in body) {
    const url = str(body.fileUrl).slice(0, 1000);
    if (!HTTP_URL.test(url)) return NextResponse.json({ error: "The file must be an upload." }, { status: 400 });
    data.fileUrl = url;
    data.filePublicId = str(body.filePublicId).slice(0, 300) || null;
    data.mimeType = str(body.mimeType).slice(0, 100) || null;
  }
  if ("expiresAt" in body) {
    if (body.expiresAt === null || body.expiresAt === "") data.expiresAt = null;
    else {
      const d = new Date(body.expiresAt);
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "The expiry date isn't a date." }, { status: 400 });
      data.expiresAt = d;
    }
  }
  if ("showOnQuotes" in body) {
    if (typeof body.showOnQuotes !== "boolean") return NextResponse.json({ error: "showOnQuotes must be true or false." }, { status: 400 });
    data.showOnQuotes = body.showOnQuotes;
  }
  if ("sortOrder" in body && Number.isInteger(body.sortOrder)) data.sortOrder = Math.max(0, body.sortOrder);
  if (existing.type === "waiver") {
    if ("body" in body) {
      const clean = sanitiseWaiverBody(body.body);
      if (!clean) return NextResponse.json({ error: "A waiver needs at least one section of text." }, { status: 400 });
      data.body = clean;
    }
    for (const flag of ["attachToQuotes", "attachToJobs", "attachToInvoices"]) {
      if (flag in body) {
        if (typeof body[flag] !== "boolean") return NextResponse.json({ error: `${flag} must be true or false.` }, { status: 400 });
        data[flag] = body[flag];
      }
    }
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const updated = await db.companyDocument.update({ where: { id }, data, select: DOCUMENT_SELECT });
  await recordActivity(member, {
    action: "settings.company_document_updated",
    entityType: "company",
    entityId: member.companyId,
    summary: `Updated company document "${updated.title}"`,
    metadata: { documentId: id, changed: Object.keys(data) },
  });
  return NextResponse.json({ document: presentForStaff(updated) });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const denied = refuse(member);
  if (denied) return denied;

  const existing = await db.companyDocument.findFirst({
    where: { id, companyId: member.companyId, archivedAt: null },
    select: { id: true, title: true },
  });
  if (!existing) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  await db.companyDocument.update({ where: { id }, data: { archivedAt: new Date() } });
  await recordActivity(member, {
    action: "settings.company_document_archived",
    entityType: "company",
    entityId: member.companyId,
    summary: `Removed company document "${existing.title}"`,
    metadata: { documentId: id },
  });
  return NextResponse.json({ ok: true });
}
