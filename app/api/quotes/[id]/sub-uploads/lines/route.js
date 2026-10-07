// app/api/quotes/[id]/sub-uploads/lines/route.js
//
// The paid deep read of an uploaded sub's quote: every priced line, on the
// best model, charged to the company's AI credit (sub_quote_lines). Offered
// only on the GC's press, with its price in credits on the button before it
// is pressed (GET …/sub-uploads readEstimates) — the plan read's rule.
// Answers the lines (printed strings) to the confirm form and stores nothing;
// the GC confirms each line before an itemised quote line is built from it.
//
// Next 16: params is a Promise.
export const runtime = "nodejs";
export const maxDuration = 90;

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { readSubQuoteLines } from "@/lib/quotes/subQuoteRead";
import { LINES_FEATURE, UPLOAD_FAILED_SENTENCE, meteredRead, ownQuote, uploadFilesOrRefusal, uploadGate } from "@/lib/quotes/subQuoteUploadServer";

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
    feature: LINES_FEATURE,
    member,
    upload: { files: files.files },
    read: readSubQuoteLines,
    // One charge per press: a second press is a second read, which the
    // button's price says.
    ref: `${LINES_FEATURE}:${id}:${Date.now()}`,
  });
  if (!read.ok) {
    return NextResponse.json(
      { error: UPLOAD_FAILED_SENTENCE[read.code] || UPLOAD_FAILED_SENTENCE.failed, code: read.code, charged: read.charged },
      { status: read.code === "no_credit" || read.code === "quota" ? 402 : 400 },
    );
  }
  return NextResponse.json({ lines: read.data.lines, unreadable: read.data.unreadable });
}
