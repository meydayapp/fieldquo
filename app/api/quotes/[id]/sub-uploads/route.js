// app/api/quotes/[id]/sub-uploads/route.js
//
// "Upload a sub's quote (PDF or photo)" on the GC's own quote — the compare
// screen's other way in, for a subcontractor who is not on FieldQuo
// (lib/quotes/subQuoteUpload.js says what is read and why nothing read is
// used unconfirmed).
//
//   GET   the quote's uploads, as the compare draws them, plus what each read
//         costs in AI credits (shown before the button) and the GC's roster
//         for "which of your subcontractors is this?".
//   POST  { files } — save the upload, then the simple read. A file that is
//         malformed, too big, not ours or not a PDF is refused with a plain
//         sentence before anything is charged; the row stays so the GC can
//         type the figures instead, or remove it.
//
// Next 16: params is a Promise.
export const runtime = "nodejs";
// A multi-page PDF read at high detail can take the better part of a minute.
export const maxDuration = 90;

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSubQuote } from "@/lib/quotes/subQuoteRead";
import {
  READ_FEATURE,
  SUB_SELECT,
  UPLOAD_FAILED_SENTENCE,
  loadRoster,
  meteredRead,
  ownQuote,
  presentUpload,
  readEstimates,
  uploadFilesOrRefusal,
  uploadMember,
} from "@/lib/quotes/subQuoteUploadServer";

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, canEdit, mayCost, response } = await uploadMember(request);
  if (response) return response;
  const quote = await ownQuote(member, id);
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [uploads, roster] = await Promise.all([
    db.subQuoteUpload.findMany({
      where: { quoteId: id, companyId: member.companyId },
      orderBy: { createdAt: "asc" },
      include: { subcontractor: { select: SUB_SELECT } },
    }),
    canEdit ? loadRoster(member.companyId) : [],
  ]);
  return NextResponse.json({
    uploads: uploads.map((u) => presentUpload(u, { roster, mayCost })),
    roster: roster.filter((s) => s.active !== false).map((s) => ({ id: s.id, name: s.name })),
    canEdit,
    quoteStatus: quote.status,
    ...readEstimates(),
  });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, mayCost, response } = await uploadMember(request, { write: true });
  if (response) return response;
  const quote = await ownQuote(member, id);
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const files = uploadFilesOrRefusal(body?.files);
  if (!files.ok) {
    return NextResponse.json(
      { error: UPLOAD_FAILED_SENTENCE[files.code] || UPLOAD_FAILED_SENTENCE.failed, code: files.code },
      { status: 400 },
    );
  }

  // Saved before it is read, the receipt book's order: the file is the GC's
  // record of what the sub sent, whether or not the read works.
  const created = await db.subQuoteUpload.create({
    data: { companyId: member.companyId, quoteId: id, files: files.files, status: "reading", createdById: member.userId },
  });

  const read = await meteredRead({
    feature: READ_FEATURE,
    member,
    upload: created,
    read: readSubQuote,
    ref: `${READ_FEATURE}:${created.id}`,
  });

  // A refusal before the vendor (a bad PDF, no credit, the demo) leaves a row
  // the GC can still confirm by hand: needs_review with the reason. A read
  // that reached the vendor and failed is "unreadable" — also confirmable by
  // hand; the status says which happened.
  const updated = await db.subQuoteUpload.update({
    where: { id: created.id },
    data: read.ok
      ? { status: "needs_review", reading: read.data, readError: null }
      : { status: read.charged ? "unreadable" : "needs_review", readError: read.code },
    include: { subcontractor: { select: SUB_SELECT } },
  });
  const roster = await loadRoster(member.companyId);
  const upload = presentUpload(updated, { roster, mayCost });
  if (!read.ok) {
    // The upload exists and is shown with the sentence; the response says
    // what happened and whether anything was charged.
    return NextResponse.json({
      upload,
      readFailed: {
        code: read.code,
        message: UPLOAD_FAILED_SENTENCE[read.code] || UPLOAD_FAILED_SENTENCE.failed,
        charged: read.charged,
      },
    });
  }
  return NextResponse.json({ upload });
}
