// app/api/tenders/[id]/documents/route.js
//
// POST { url, name, kind, mimeType?, sizeBytes? } — file a document on a
// tender. The bytes went browser → Cloudinary through uploadFile()
// (lib/media/uploadClient.js, purpose "plans"); this stores the record, and
// only after lib/tenders/documents.js has proved the URL is an upload in
// THIS company's folder.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { recordActivity } from "@/lib/activity/log";
import { requireTenderWrite } from "@/lib/tenders/access";
import { parseTenderDocument } from "@/lib/tenders/documents";
import { detailPayload } from "@/lib/tenders/detail";
import { gateMember, findTender } from "@/lib/tenders/server";

/** Enough for every addendum a long solicitation collects, and a ceiling. */
const MAX_DOCUMENTS = 100;

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const gate = await gateMember(db, member, requireTenderWrite);
  if (gate.response) return gate.response;

  const found = await findTender(db, member.companyId, id);
  if (found.response) return found.response;

  const body = await request.json().catch(() => null);
  const parsed = parseTenderDocument(body, { companyId: member.companyId });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const count = await db.tenderDocument.count({ where: { tenderId: found.tender.id, companyId: member.companyId } });
  if (count >= MAX_DOCUMENTS) {
    return NextResponse.json({ error: `A tender holds up to ${MAX_DOCUMENTS} documents.` }, { status: 400 });
  }

  const doc = await db.tenderDocument.create({
    data: { ...parsed.data, companyId: member.companyId, tenderId: found.tender.id, uploadedById: member.userId || null },
    select: { id: true, name: true },
  });

  await recordActivity(member, {
    action: "tender.document_added",
    entityType: "tender",
    entityId: found.tender.id,
    summary: `Added ${doc.name} to tender ${found.tender.title}`,
    metadata: { tenderId: found.tender.id, documentId: doc.id, kind: parsed.data.kind },
  });

  return NextResponse.json(await detailPayload(db, member, gate.full, found.tender), { status: 201 });
}
