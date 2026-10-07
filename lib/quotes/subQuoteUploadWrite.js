// lib/quotes/subQuoteUploadWrite.js
//
// The one write behind "Upload a sub's quote (PDF or photo)": the GC's
// Confirm. It creates the same source-less QuoteImport a confirmed
// no-account reply to a price request becomes (lib/subRequests/server.js
// confirmReply) — no source quote, the GC's roster row in subcontractorId —
// plus uploadedSource, the GC's confirmed record of what the sub sent. From
// then on it IS an import: the compare, markup, remove, "Use this one", the
// change order on an approved quote and the job's cost all run through
// lib/quotes/importQuote.js unchanged, and the compare tags it "Read from an
// uploaded quote" (lib/quotes/importOptions.js viaUpload).
//
// Every figure comes from the confirmation the GC posted, validated by
// readConfirmation (lib/quotes/subQuoteUpload.js). The client price is never
// posted: it is snapshot × (1 + markup), derived wherever it is shown or
// written (lib/quotes/importedStatus.js clientPrice).

import { ImportError, placeImportOption } from "@/lib/quotes/importQuote";
import { NO_LINE } from "@/lib/quotes/importOptions";
import { clientFacingLabel, readConfirmation, scrubSubName, uploadedSourceRecord } from "@/lib/quotes/subQuoteUpload";

/** Where an uploaded price can go: the statuses a price request accepts. */
const TAKES_PRICES = ["draft", "sent", "accepted"];
const OPEN = ["draft", "sent"];

/**
 * @param body   the GC's confirmation (readConfirmation's shape)
 * @param files  uploadFilesOrRefusal(...).files — already checked as ours
 * @returns { import, placement, targetTotal, swappedOut }
 */
export async function createUploadedImport({ db, member, quoteId, body, files, readBy = "typed", targetCompany }) {
  const read = readConfirmation(body);
  if (!read.ok) {
    const err = new ImportError("Check the highlighted figure.", 400);
    err.field = read.field;
    err.code = read.code;
    throw err;
  }
  const c = read.data;
  const quote = await db.quote.findFirst({
    where: { id: quoteId, companyId: member.companyId },
    select: { id: true, status: true },
  });
  if (!quote) throw new ImportError("That quote wasn't found.", 404);
  if (!TAKES_PRICES.includes(quote.status))
    throw new ImportError("That quote is already decided — its prices can't change.", 400);
  if (c.placement === "line" && !OPEN.includes(quote.status))
    throw new ImportError("That quote is approved — keep this price to compare, then offer it as extra work.", 400);

  // The sub's name never reaches the client: not in the label, not in a line.
  const lines = c.lines
    ? c.lines.map((l) => ({ description: scrubSubName(l.description, c.subName) || "Item", amount: l.amount }))
    : null;

  const imp = await db.$transaction(async (tx) => {
    let subcontractorId = c.subcontractorId;
    if (subcontractorId) {
      const sub = await tx.subcontractor.findFirst({
        where: { id: subcontractorId, companyId: member.companyId },
        select: { id: true },
      });
      if (!sub) throw new ImportError("That subcontractor isn't on your list.", 400);
    } else {
      const sub = await tx.subcontractor.create({
        data: { companyId: member.companyId, name: c.subName, trade: c.trade },
        select: { id: true },
      });
      subcontractorId = sub.id;
    }
    return tx.quoteImport.create({
      data: {
        sourceQuoteId: null,
        sourceCompanyId: null,
        subcontractorId,
        targetQuoteId: quote.id,
        targetCompanyId: member.companyId,
        targetLineId: NO_LINE,
        placement: "option",
        snapshotAmount: c.costAmount,
        markupPercent: c.markupPercent,
        display: c.display,
        label: clientFacingLabel(c.trade, c.subName),
        uploadedSource: uploadedSourceRecord({ ...c, lines }, files, { readBy, userId: member.userId ?? null }),
        createdById: member.userId ?? null,
      },
    });
  });

  if (c.placement !== "line") return { import: imp, placement: "option", targetTotal: null, swappedOut: [] };
  // On the open quote: exactly the path "Use this one" takes — the trade's
  // other line steps back, one price per trade reaches the client.
  const placed = await placeImportOption({ db, member, quoteId: quote.id, importId: imp.id, targetCompany });
  return { import: imp, placement: placed.placement, targetTotal: placed.targetTotal, swappedOut: placed.swappedOut };
}
