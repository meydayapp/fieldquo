// app/api/quotes/[id]/imports/route.js
//
// The SOURCE side of a cross-company import: "has another FieldQuo company
// pulled this quote of mine into their project, and where does it stand?"
//
// Returns sourceView projections only (lib/quotes/importedStatus.js) — the
// importer's markup and client price are never assembled here, so a sub cannot
// learn their customer's margin even by calling the API directly. Status is
// derived live from the importing quote's stage.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { deriveCommitStatus, sourceView, importerView } from "@/lib/quotes/importedStatus";

export async function GET(request, { params }) {
  const { id } = await params;

  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // The quote must be the viewer's own. A given quote can be either side of an
  // import: the SOURCE (someone imported it — the sub's view) or the TARGET
  // (it imported others — the GC's view). We return both, role-scoped, and each
  // consumer reads the slice it needs.
  const quote = await db.quote.findFirst({
    where: { id, companyId: member.companyId },
    select: {
      id: true,
      status: true,
      jobs: { select: { id: true }, take: 1 },
      invoices: { select: { id: true }, take: 1 },
    },
  });
  if (!quote)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [asSourceRows, asImporterRows] = await Promise.all([
    // This quote imported BY others → sub-side view (no price ever assembled).
    db.quoteImport.findMany({
      where: { sourceQuoteId: id, sourceCompanyId: member.companyId },
      orderBy: { createdAt: "desc" },
      include: {
        targetCompany: { select: { name: true } },
        targetQuote: {
          select: {
            status: true,
            jobs: { select: { id: true }, take: 1 },
            invoices: { select: { id: true }, take: 1 },
          },
        },
      },
    }),
    // This quote importing others → importer (GC) view: cost, markup, price.
    db.quoteImport.findMany({
      where: { targetQuoteId: id, targetCompanyId: member.companyId },
      orderBy: { createdAt: "desc" },
      include: { sourceCompany: { select: { name: true } } },
    }),
  ]);

  const asSource = asSourceRows.map((r) =>
    sourceView(r, {
      commitStatus: deriveCommitStatus({
        targetQuoteStatus: r.targetQuote?.status,
        hasJob: (r.targetQuote?.jobs?.length || 0) > 0,
        hasInvoice: (r.targetQuote?.invoices?.length || 0) > 0,
      }),
      targetCompanyName: r.targetCompany?.name,
    }),
  );

  // Importer rows all live on THIS quote, so they share one derived status.
  const importerStatus = deriveCommitStatus({
    targetQuoteStatus: quote.status,
    hasJob: quote.jobs.length > 0,
    hasInvoice: quote.invoices.length > 0,
  });
  const asImporter = asImporterRows.map((r) =>
    importerView(r, { commitStatus: importerStatus }),
  );

  return NextResponse.json({ asSource, asImporter });
}
