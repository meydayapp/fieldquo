// app/api/quotes/[id]/sub-uploads/[uploadId]/select/route.js
//
// "Use this one" on a confirmed uploaded sub's quote held to compare: it
// becomes the trade's line on the GC's OPEN quote, and whatever price was the
// trade's line (a FieldQuo import or another upload) steps back to being an
// option — one price per trade reaches the client. The body names nothing:
// the price is the stored confirmed cost × the stored markup.
//
// An approved quote is refused with the reason. A FieldQuo import on an
// approved quote can become a change order (ChangeOrder.quoteImportId); an
// upload has no such link yet, so the button is not drawn there either.
//
// Next 16: params is a Promise.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { db } from "@/lib/db";
import { ImportError } from "@/lib/quotes/importQuote";
import { placeUploadLine } from "@/lib/quotes/subQuoteUploadWrite";
import { uploadGate } from "@/lib/quotes/subQuoteUploadServer";

export async function POST(request, { params }) {
  const { id, uploadId } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { response: denied } = await uploadGate(member, { write: true });
  if (denied) return denied;
  const targetCompany = await db.company.findUnique({ where: { id: member.companyId }, select: { taxRate: true } });
  try {
    const result = await placeUploadLine({ db, member, quoteId: id, uploadId, targetCompany });
    return NextResponse.json({ ok: true, placement: "line", ...result });
  } catch (err) {
    if (err instanceof ImportError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
