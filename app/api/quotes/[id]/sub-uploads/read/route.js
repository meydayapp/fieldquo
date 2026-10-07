// app/api/quotes/[id]/sub-uploads/read/route.js
//
// The simple read of an uploaded sub's quote — sub, trade, total, tax,
// valid-until — the receipt reader's way, charged to the company's AI credit
// (sub_quote_read). Answers the transcription to the GC's confirm form and
// STORES NOTHING: no row, no figure, until the GC confirms (POST
// …/sub-uploads).
//
//   400 + a plain sentence  the file itself is refused (not ours, not a PDF,
//                           too big, too many pages, a video…) — before the
//                           meter is asked, so nothing is charged
//   200 + readFailed        the file is fine but no read happened or it
//                           failed (no AI credit, the demo, a vendor fault):
//                           the GC types the figures; `charged` says whether
//                           the vendor was reached
//   200 + reading           the transcription, every figure a printed string
//
// Next 16: params is a Promise.
export const runtime = "nodejs";
// A multi-page PDF read at high detail can take the better part of a minute.
export const maxDuration = 90;

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { readSubQuote } from "@/lib/quotes/subQuoteRead";
import { READ_FEATURE, UPLOAD_FAILED_SENTENCE, meteredRead, ownQuote, uploadFilesOrRefusal, uploadGate } from "@/lib/quotes/subQuoteUploadServer";

/** A refusal about the FILE — said as a 400; nothing was charged. */
const FILE_REFUSALS = new Set(["missing", "notHttp", "video", "unknownKind", "mixed", "tooMany", "not_ours", "not_pdf", "too_large", "too_many_pages", "fetch_failed"]);

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: noLevel } = await levelOrRefusal(member, "quotes", "view_create_edit", "add a subcontractor's quote");
  if (noLevel) return noLevel;
  const { response: denied } = uploadGate(member, full, { write: true });
  if (denied) return denied;
  const quote = await ownQuote(member, id);
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json().catch(() => null)) || {};
  const files = uploadFilesOrRefusal(body.files);
  if (!files.ok) {
    return NextResponse.json({ error: UPLOAD_FAILED_SENTENCE[files.code] || UPLOAD_FAILED_SENTENCE.failed, code: files.code }, { status: 400 });
  }
  const read = await meteredRead({
    feature: READ_FEATURE,
    member,
    upload: { files: files.files },
    read: readSubQuote,
    // One charge per press: reading the same file again is a second read.
    ref: `${READ_FEATURE}:${id}:${Date.now()}`,
  });
  if (read.ok) return NextResponse.json({ reading: read.data });
  if (FILE_REFUSALS.has(read.code)) {
    return NextResponse.json({ error: UPLOAD_FAILED_SENTENCE[read.code] || UPLOAD_FAILED_SENTENCE.failed, code: read.code, charged: false }, { status: 400 });
  }
  return NextResponse.json({
    reading: null,
    readFailed: { code: read.code, message: UPLOAD_FAILED_SENTENCE[read.code] || UPLOAD_FAILED_SENTENCE.failed, charged: read.charged },
  });
}
