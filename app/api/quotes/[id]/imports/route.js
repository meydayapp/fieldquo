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
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { deriveCommitStatus, sourceView, importerView } from "@/lib/quotes/importedStatus";
import { hasToggle } from "@/lib/permissions/enforce";

export async function GET(request, { params }) {
  const { id } = await params;

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Both halves of this response are quote data — the sub's price and the GC's
  // marked-up line — so it sits behind the same read gate as the quote itself.
  const { full, response: denied } = await levelOrRefusal(
    member,
    "quotes",
    "view_only",
    "see quotes",
  );
  if (denied) return denied;

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
  // ── The importer half is cost, markup and price ─────────────────────────
  //
  // The header above explains at length why the SOURCE view never assembles a
  // price: a sub must not learn their customer's margin. The importer view
  // assembles all three deliberately — and served them to any member of the
  // importing company, including one with showPricing off, which is the same
  // margin leaking through the other end of the same endpoint.
  //
  // The source half stays open: it carries no price by construction, and it is
  // how a subcontractor sees whether their own bid was taken up.
  const asImporter = hasToggle(full, "showPricing")
    ? asImporterRows.map((r) => importerView(r, { commitStatus: importerStatus }))
    : [];

  return NextResponse.json({
    asSource,
    asImporter,
    // Declared rather than silently empty: an empty list means "nobody's cost
    // is imported here", and the panel would say so in as many words.
    ...(hasToggle(full, "showPricing") ? {} : { importerPricingHidden: true }),
  });
}
