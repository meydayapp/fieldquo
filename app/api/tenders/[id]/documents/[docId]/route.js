// app/api/tenders/[id]/documents/[docId]/route.js
//
// DELETE — take a document off a tender (an addendum filed on the wrong one,
// a superseded draft). Removes the record only; the file itself stays in
// Cloudinary, exactly as removing a photo from a quote does.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { recordActivity } from "@/lib/activity/log";
import { requireTenderWrite } from "@/lib/tenders/access";
import { detailPayload } from "@/lib/tenders/detail";
import { gateMember, findTender } from "@/lib/tenders/server";

export async function DELETE(request, { params }) {
  const { id, docId } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const gate = await gateMember(db, member, requireTenderWrite);
  if (gate.response) return gate.response;

  const found = await findTender(db, member.companyId, id);
  if (found.response) return found.response;

  const removed = await db.tenderDocument.deleteMany({
    where: { id: typeof docId === "string" ? docId : "", tenderId: found.tender.id, companyId: member.companyId },
  });
  if (removed.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await recordActivity(member, {
    action: "tender.document_removed",
    entityType: "tender",
    entityId: found.tender.id,
    summary: `Removed a document from tender ${found.tender.title}`,
    metadata: { tenderId: found.tender.id, documentId: docId },
  });

  return NextResponse.json(await detailPayload(db, member, gate.full, found.tender));
}
