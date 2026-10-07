// app/api/quotes/[id]/sub-uploads/[uploadId]/route.js
//
// One uploaded sub's quote on the GC's own quote.
//
//   PATCH { confirm: true, subName, trade, total, tax, validUntil, lines?,
//           markupPercent, placement, display, subcontractorId? |
//           createSubcontractor? }
//         — the GC's Confirm: the ONLY way a figure from the upload reaches
//         a column anything reads (lib/quotes/subQuoteUploadWrite.js
//         confirmUpload). The client price is derived from what is stored.
//   PATCH { markupPercent } — the markup on a confirmed price.
//   DELETE — remove it (and its line on an open quote).
//
// Next 16: params is a Promise.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ImportError } from "@/lib/quotes/importQuote";
import { confirmUpload, removeUpload, updateUploadMarkup } from "@/lib/quotes/subQuoteUploadWrite";
import { SUB_SELECT, loadRoster, presentUpload, uploadMember } from "@/lib/quotes/subQuoteUploadServer";
import { recordActivity } from "@/lib/activity/log";

function refusal(err) {
  if (err instanceof ImportError) {
    return NextResponse.json(
      { error: err.message, ...(err.field ? { field: err.field, code: err.code } : {}) },
      { status: err.status },
    );
  }
  throw err;
}

async function targetCompanyOf(member) {
  return db.company.findUnique({ where: { id: member.companyId }, select: { taxRate: true } });
}

export async function PATCH(request, { params }) {
  const { id, uploadId } = await params;
  const { member, mayCost, response } = await uploadMember(request, { write: true });
  if (response) return response;
  const body = (await request.json().catch(() => null)) || {};
  const targetCompany = await targetCompanyOf(member);

  try {
    if (body.confirm === true) {
      const result = await confirmUpload({ db, member, quoteId: id, uploadId, body, targetCompany });
      await recordActivity(member, {
        action: "quote.sub_quote_confirmed",
        entityType: "quote",
        entityId: id,
        summary: "Confirmed the figures on an uploaded subcontractor quote",
        metadata: { uploadId, placement: result.upload.placement },
      }).catch(() => {});
      const fresh = await db.subQuoteUpload.findFirst({
        where: { id: uploadId, companyId: member.companyId },
        include: { subcontractor: { select: SUB_SELECT } },
      });
      return NextResponse.json({
        ok: true,
        upload: fresh ? presentUpload(fresh, { roster: await loadRoster(member.companyId), mayCost }) : null,
        targetTotal: result.targetTotal,
        swappedOut: result.swappedOut || [],
      });
    }
    if (body.markupPercent === undefined) {
      return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
    }
    const result = await updateUploadMarkup({
      db,
      member,
      quoteId: id,
      uploadId,
      markupPercent: body.markupPercent,
      targetCompany,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return refusal(err);
  }
}

export async function DELETE(request, { params }) {
  const { id, uploadId } = await params;
  const { member, response } = await uploadMember(request, { write: true });
  if (response) return response;
  try {
    const result = await removeUpload({ db, member, quoteId: id, uploadId, targetCompany: await targetCompanyOf(member) });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return refusal(err);
  }
}
