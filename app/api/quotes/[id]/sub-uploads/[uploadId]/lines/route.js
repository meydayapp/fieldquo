// app/api/quotes/[id]/sub-uploads/[uploadId]/lines/route.js
//
// The paid deep read of an uploaded sub's quote: every priced line, on the
// best model, charged to the company's AI credit (sub_quote_lines). Offered
// only on the GC's press, with its price in credits shown on the button
// before it is pressed (GET .../sub-uploads readEstimates) — the plan read's
// rule. Writes `readLines` (printed strings) for the confirm form; the GC
// confirms each line before an itemised quote line is built from it.
//
// Next 16: params is a Promise.
export const runtime = "nodejs";
export const maxDuration = 90;

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { db } from "@/lib/db";
import { readSubQuoteLines } from "@/lib/quotes/subQuoteRead";
import {
  LINES_FEATURE,
  SUB_SELECT,
  UPLOAD_FAILED_SENTENCE,
  loadRoster,
  meteredRead,
  presentUpload,
  uploadGate,
} from "@/lib/quotes/subQuoteUploadServer";

export async function POST(request, { params }) {
  const { id, uploadId } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { mayCost, response: denied } = await uploadGate(member, { write: true });
  if (denied) return denied;
  const upload = await db.subQuoteUpload.findFirst({ where: { id: uploadId, quoteId: id, companyId: member.companyId } });
  if (!upload) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (upload.placement === "line") {
    return NextResponse.json({ error: "That price is on your quote — remove it from the quote to read its lines." }, { status: 409 });
  }

  const read = await meteredRead({
    feature: LINES_FEATURE,
    member,
    upload,
    read: readSubQuoteLines,
    // One charge per press: a second press is a second read and is charged
    // again, which the button says.
    ref: `${LINES_FEATURE}:${upload.id}:${Date.now()}`,
  });
  if (!read.ok) {
    return NextResponse.json(
      { error: UPLOAD_FAILED_SENTENCE[read.code] || UPLOAD_FAILED_SENTENCE.failed, code: read.code, charged: read.charged },
      { status: read.code === "no_credit" || read.code === "quota" ? 402 : 400 },
    );
  }
  const updated = await db.subQuoteUpload.update({
    where: { id: upload.id },
    data: { readLines: read.data.lines },
    include: { subcontractor: { select: SUB_SELECT } },
  });
  return NextResponse.json({
    upload: presentUpload(updated, { roster: await loadRoster(member.companyId), mayCost }),
    unreadable: read.data.unreadable,
  });
}
