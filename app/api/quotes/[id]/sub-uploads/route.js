// app/api/quotes/[id]/sub-uploads/route.js
//
// "Upload a sub's quote (PDF or photo)" on the GC's own quote — the compare
// panel's way in for a subcontractor who is not on FieldQuo
// (lib/quotes/subQuoteUpload.js says what is read and why nothing read is
// stored unconfirmed).
//
//   GET   may this reader upload, what each read costs in AI credits (shown
//         on the buttons before they are pressed), the quote's status and the
//         GC's roster for "which of your subcontractors is this?".
//   POST  the GC's Confirm: { files, readBy, subName, trade, total, tax,
//         validUntil, lines?, display, markupPercent, placement,
//         subcontractorId | createSubcontractor } — creates the price as a
//         source-less import "Read from an uploaded quote"
//         (lib/quotes/subQuoteUploadWrite.js). The files are checked as ours
//         again here; the client price is derived, never posted.
//
// The reads are …/read and …/lines; they answer the screen and store nothing.
//
// Next 16: params is a Promise.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { db } from "@/lib/db";
import { ImportError } from "@/lib/quotes/importQuote";
import { createUploadedImport } from "@/lib/quotes/subQuoteUploadWrite";
import {
  UPLOAD_FAILED_SENTENCE,
  loadRoster,
  ownQuote,
  readEstimates,
  uploadFilesOrRefusal,
  uploadGate,
} from "@/lib/quotes/subQuoteUploadServer";
import { recordActivity } from "@/lib/activity/log";

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: noLevel } = await levelOrRefusal(member, "quotes", "view_only", "see quotes");
  if (noLevel) return noLevel;
  const { canEdit, response: denied } = uploadGate(member, full);
  if (denied) return denied;
  const quote = await ownQuote(member, id);
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    canEdit,
    quoteStatus: quote.status,
    roster: canEdit ? await loadRoster(member.companyId) : [],
    ...readEstimates(),
  });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: noLevel } = await levelOrRefusal(member, "quotes", "view_create_edit", "add a subcontractor's quote");
  if (noLevel) return noLevel;
  const { response: denied } = uploadGate(member, full, { write: true });
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) || {};
  const files = uploadFilesOrRefusal(body.files);
  if (!files.ok) {
    return NextResponse.json(
      { error: UPLOAD_FAILED_SENTENCE[files.code] || UPLOAD_FAILED_SENTENCE.failed, code: files.code },
      { status: 400 },
    );
  }
  const targetCompany = await db.company.findUnique({ where: { id: member.companyId }, select: { taxRate: true } });
  try {
    const result = await createUploadedImport({
      db,
      member,
      quoteId: id,
      body,
      files: files.files,
      readBy: body.readBy === "ai" ? "ai" : "typed",
      targetCompany,
    });
    await recordActivity(member, {
      action: "quote.sub_quote_uploaded",
      entityType: "quote",
      entityId: id,
      summary: "Added an uploaded subcontractor quote to compare",
      metadata: { importId: result.import.id, placement: result.placement },
    }).catch(() => {});
    return NextResponse.json({
      ok: true,
      importId: result.import.id,
      placement: result.placement,
      targetTotal: result.targetTotal,
      swappedOut: result.swappedOut || [],
    });
  } catch (err) {
    if (err instanceof ImportError) {
      return NextResponse.json(
        { error: err.message, ...(err.field ? { field: err.field, code: err.code } : {}) },
        { status: err.status },
      );
    }
    throw err;
  }
}
