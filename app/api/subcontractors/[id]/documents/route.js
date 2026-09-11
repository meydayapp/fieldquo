// app/api/subcontractors/[id]/documents/route.js
//
// A sub's paperwork: the certificate of insurance, the WSIB/WCB clearance,
// the signed agreement. Same shape as app/api/jobs/[id]/documents — read that
// header for the upload path — with one addition the schema asks for.
//
// ══ The upload path is the existing one ════════════════════════════════════
//
// The browser POSTs the file to /api/upload, gets back a Cloudinary URL, and
// POSTs THAT here. No file bytes reach this route. isUploadedUrl() refuses a
// URL that did not come from this deployment's own cloud, because a "COI" row
// linking to somebody else's host is a phishing link filed inside the
// contractor's own back office.
//
// ══ The paper updates the panel ════════════════════════════════════════════
//
// SubcontractorDocument.expiresAt's schema comment: "the sub's own
// insuranceExpiresAt / clearanceExpiresAt are updated from the newest
// document of that kind, so the panel and the paper agree." So a `coi` or
// `clearance` document WITH an expiry date writes that date onto the sub, in
// the same transaction as the document row. One without an expiry writes
// nothing — a certificate that does not state a date is not evidence that we
// no longer know one.
//
// "Newest" is by upload time: the row being created is the newest by
// definition, so the write is unconditional rather than a max() over history.
// Filing last year's COI after this year's would move the date backwards —
// and that is the correct reading of "the newest document of that kind is the
// one you just filed", not a bug; the person filing sees the panel change and
// can file the current one again. The alternative (max over all documents)
// would mean a mistaken future date could never be corrected by paper.
//
// ══ Nothing is deleted ═════════════════════════════════════════════════════
//
// No PATCH of a url and no DELETE. A replaced certificate is a new row above
// the old one; "which COI were we relying on in March" stays answerable.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, permissionErrorResponse } from "@/lib/permissions/enforce";
import {
  requireSubcontractorRead,
  requireSubcontractorWrite,
  canWriteSubcontractors,
} from "@/lib/subcontractors/access";
import { parseDocumentBody, EXPIRY_KIND_FIELD, DOCUMENT_SELECT } from "@/lib/subcontractors/payload";
import { isUploadedUrl, normaliseName } from "@/lib/jobs/documents";
import { recordActivity } from "@/lib/activity/log";

async function ownSub(id, companyId) {
  return db.subcontractor.findFirst({ where: { id, companyId }, select: { id: true, name: true } });
}

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireSubcontractorRead(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const sub = await ownSub(id, member.companyId);
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const documents = await db.subcontractorDocument.findMany({
    where: { subcontractorId: sub.id, companyId: member.companyId },
    select: DOCUMENT_SELECT,
    orderBy: { uploadedAt: "desc" },
  });

  return NextResponse.json({ documents, canUpload: canWriteSubcontractors(full) });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireSubcontractorWrite(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const sub = await ownSub(id, member.companyId);
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const raw = await request.json().catch(() => ({}));
  const parsed = parseDocumentBody(raw);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  if (!isUploadedUrl(parsed.data.url, { cloudName: process.env.CLOUDINARY_CLOUD_NAME })) {
    return NextResponse.json(
      {
        error:
          "That file hasn't been uploaded yet. Pick the file again — documents are stored through FieldQuo's own uploader, not linked from elsewhere.",
      },
      { status: 400 },
    );
  }

  const { kind, url, expiresAt, sizeBytes, mimeType } = parsed.data;
  const name = normaliseName(parsed.data.name, kind === "coi" ? "Certificate of insurance" : kind === "clearance" ? "Clearance certificate" : "Document");
  const expiryField = EXPIRY_KIND_FIELD[kind];

  // The document and the sub's expiry column move together or not at all.
  const document = await db.$transaction(async (tx) => {
    const created = await tx.subcontractorDocument.create({
      data: {
        companyId: member.companyId,
        subcontractorId: sub.id,
        name,
        kind,
        url,
        sizeBytes,
        mimeType,
        expiresAt,
        uploadedById: full?.userId || null,
      },
      select: DOCUMENT_SELECT,
    });
    if (expiryField && expiresAt) {
      await tx.subcontractor.update({
        where: { id: sub.id },
        data: { [expiryField]: expiresAt },
      });
    }
    return created;
  });

  await recordActivity(member, {
    action: "subcontractor.document_filed",
    entityType: "subcontractor",
    entityId: sub.id,
    summary: `Filed ${kind} document "${name}" for ${sub.name}${expiresAt ? ` (expires ${expiresAt.toISOString().slice(0, 10)})` : ""}`,
    metadata: { subcontractorId: sub.id, documentId: document.id, kind, expiresAt: expiresAt ?? null },
  });

  return NextResponse.json(
    { document, updatedExpiry: expiryField && expiresAt ? { field: expiryField, expiresAt } : null },
    { status: 201 },
  );
}
