// lib/planRead/documents.js
//
// A file added to a drawing read: filed as a QuoteDocument (so it reaches the
// quote, and from there the job's Documents — lib/jobs/documentAutofile.js),
// then read in code straight away (lib/planRead/ingest.js), for free.
//
// The read's row is locked while a PDF's sheets are appended (SELECT … FOR
// UPDATE), so two drawing sets uploaded together cannot overwrite each
// other's sheets. Adding a file while a paid read is RUNNING is refused: the
// running read holds its own copy of the sheet list and would write over
// whatever arrived under it.

import { validateQuoteDocument, revisionTarget, QUOTE_DOCUMENT_SELECT } from "@/lib/quotes/quoteDocuments";
import { ingestKindFor, fetchOwnFile, pdfSheets, spreadsheetRows } from "./ingest";

function nextSheetIndex(sheets) {
  return (Array.isArray(sheets) ? sheets : []).reduce((n, s) => Math.max(n, Number(s.page) || 0), 0) + 1;
}

/**
 * @returns {{ ok: true, document, ingest } | { ok: false, status, error }}
 */
export async function addPlanReadDocument({ prisma, read, companyId, userId, raw, canSeeMoney, cloudName, fetchImpl }) {
  if (read.status === "reading") {
    return { ok: false, status: 409, error: "A read is running on these files. Add more when it finishes." };
  }
  const v = validateQuoteDocument(raw, { companyId, canSeeMoney, cloudName });
  if (!v.ok) return v;
  const rev = await revisionTarget(prisma, { companyId, supersedesId: raw?.supersedesId, where: { planReadId: read.id }, kind: v.data.kind });
  if (!rev.ok) return rev;

  const document = await prisma.quoteDocument.create({
    data: {
      companyId,
      planReadId: read.id,
      quoteId: read.quoteId || null,
      leadId: read.leadId || null,
      ...v.data,
      supersedesId: rev.id,
      uploadedById: userId || null,
    },
    select: QUOTE_DOCUMENT_SELECT,
  });

  const kind = ingestKindFor(document.mimeType);
  let ingest = { kind, ok: true };
  if (kind === "pdf" || kind === "xlsx" || kind === "csv") {
    const file = await fetchOwnFile(document.url, fetchImpl ? { fetchImpl } : {});
    let result = file.ok ? null : { ok: false, reason: file.reason };
    if (file.ok) result = kind === "pdf" ? await pdfSheets(file.buffer, { firstIndex: 1 }) : await spreadsheetRows(file.buffer, kind);
    ingest = { kind, ok: Boolean(result?.ok), reason: result?.ok ? null : result?.reason || "unreadable" };

    await prisma.$transaction(async (tx) => {
      if (typeof tx.$queryRaw === "function") await tx.$queryRaw`SELECT id FROM "PlanRead" WHERE id = ${read.id} FOR UPDATE`;
      const fresh = await tx.planRead.findFirst({ where: { id: read.id, companyId }, select: { sheets: true, excelRows: true } });
      const bag = fresh?.excelRows && typeof fresh.excelRows === "object" ? { ...fresh.excelRows } : {};
      bag.byDoc = { ...(bag.byDoc || {}) };
      // Which uploaded files could not be read, by document — kept beside
      // the parsed rows so the Files card can say so on the right tile.
      bag.failed = { ...(bag.failed || {}) };
      const data = {};
      if (!result?.ok) {
        bag.failed[document.id] = ingest.reason;
        data.excelRows = bag;
      } else if (kind === "pdf") {
        const sheets = Array.isArray(fresh?.sheets) ? fresh.sheets.slice() : [];
        let index = nextSheetIndex(sheets);
        for (const s of result.sheets) {
          // Renumbered across the whole read: p41 when the first set had 40,
          // so every dimension id in the read is unique.
          const key = `p${index}`;
          const dims = (s.dims || []).map((d) => ({ ...d, id: d.id.replace(/^p\d+\./, `${key}.`) }));
          const pairs = (s.pairs || []).map(([a, b]) => [a.replace(/^p\d+\./, `${key}.`), b.replace(/^p\d+\./, `${key}.`)]);
          sheets.push({ ...s, key, page: index, docId: document.id, dims, pairs, read: null, scanDims: [] });
          index += 1;
        }
        data.sheets = sheets;
        ingest.sheets = result.sheets.length;
        ingest.truncated = Boolean(result.truncated);
      } else {
        bag.byDoc[document.id] = result.parsed;
        data.excelRows = bag;
        ingest.rows = result.parsed.rowCount;
      }
      await tx.planRead.updateMany({ where: { id: read.id, companyId }, data });
    });
  }
  return { ok: true, document, ingest };
}
