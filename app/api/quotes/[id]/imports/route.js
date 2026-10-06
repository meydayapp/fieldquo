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
import { deriveImportCommitStatus, sourceView, importerOptionView } from "@/lib/quotes/importedStatus";
import { compareImportOptions, importPlacement } from "@/lib/quotes/importOptions";
import { changeOrderStatus } from "@/lib/jobs/changeOrderValue";
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

  // The change orders that may carry any of these imports — a price brought
  // in after the client signed rides on one (lib/quotes/importOptions.js).
  // Read for its STATUS only: it decides whether the sub reads "pending" or
  // "confirmed", and nothing of the change order itself is sent to the sub.
  const allImportIds = [...asSourceRows, ...asImporterRows].map((r) => r.id);
  const carrying = allImportIds.length
    ? await db.changeOrder.findMany({
        where: { quoteImportId: { in: allImportIds } },
        select: { id: true, seq: true, createdAt: true, status: true, quoteImportId: true },
      })
    : [];

  const asSource = asSourceRows.map((r) => {
    const where = importPlacement(r, carrying);
    return sourceView(r, {
      commitStatus: deriveImportCommitStatus({
        placement: where.kind,
        changeOrderStatus: where.changeOrder ? changeOrderStatus(where.changeOrder) : null,
        targetQuoteStatus: r.targetQuote?.status,
        hasJob: (r.targetQuote?.jobs?.length || 0) > 0,
        hasInvoice: (r.targetQuote?.invoices?.length || 0) > 0,
      }),
      targetCompanyName: r.targetCompany?.name,
    });
  });

  // ── The comparison: who, what it costs, and their paperwork ─────────────
  //
  // Several subs quoting the same trade sit side by side on the quote page.
  // Insurance and WSIB/WCB clearance come from the GC's OWN roster row
  // linked to the sub's company — never from the sub's tenant. A sub not on
  // the roster reads "not recorded", which is what it is.
  const sourceCompanyIds = [...new Set(asImporterRows.map((r) => r.sourceCompanyId))];
  const roster = sourceCompanyIds.length
    ? await db.subcontractor.findMany({
        where: { companyId: member.companyId, linkedCompanyId: { in: sourceCompanyIds } },
        select: { id: true, linkedCompanyId: true, insuranceExpiresAt: true, clearanceExpiresAt: true },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const subsByCompanyId = {};
  for (const s of roster) if (!subsByCompanyId[s.linkedCompanyId]) subsByCompanyId[s.linkedCompanyId] = s;
  const optionById = new Map();
  for (const group of compareImportOptions({ imports: asImporterRows, changeOrders: carrying, subsByCompanyId })) {
    for (const o of group.options) optionById.set(o.id, { option: o, key: group.key });
  }

  // Line imports on this quote share one derived status; held or carried
  // ones get their own (deriveImportCommitStatus).
  const importerStatusFor = (r) => {
    const found = optionById.get(r.id);
    const co = found?.option?.changeOrder;
    return deriveImportCommitStatus({
      placement: found?.option?.placement ?? "line",
      changeOrderStatus: co?.status ?? null,
      targetQuoteStatus: quote.status,
      hasJob: quote.jobs.length > 0,
      hasInvoice: quote.invoices.length > 0,
    });
  };
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
  //
  // ── …and the price is not the cost ───────────────────────────────────────
  //
  // showPricing lets a member see what the CLIENT is charged. What the sub
  // charges US and the markup on top are the cost and the margin — the
  // jobCosting dial's numbers, which the job page already hides behind it
  // (subcontractors, materials, costing). Here they went to every Estimator
  // and Dispatcher (the 2026-10-03 role-access audit). Below jobCosting the
  // row keeps its label, status and client price, and says the rest is
  // withheld (`costHidden`) rather than reading as a sub with no cost.
  const mayCost = hasToggle(full, "jobCosting");
  const asImporter = hasToggle(full, "showPricing")
    ? asImporterRows.map((r) => {
        const found = optionById.get(r.id);
        const row = importerOptionView(r, found?.option, {
          commitStatus: importerStatusFor(r),
          comparisonKey: found?.key ?? null,
        });
        if (mayCost) return row;
        const { costAmount: _c, markupPercent: _m, ...rest } = row;
        return { ...rest, costHidden: true };
      })
    : [];

  return NextResponse.json({
    asSource,
    asImporter,
    // What "Use this one" will do here: a line on an open quote, a change
    // order on an approved one with a job, nothing on anything else — so the
    // panel never renders a button the select route would refuse.
    quoteContext: { status: quote.status, hasJob: quote.jobs.length > 0 },
    // Declared rather than silently empty: an empty list means "nobody's cost
    // is imported here", and the panel would say so in as many words.
    ...(hasToggle(full, "showPricing") ? {} : { importerPricingHidden: true }),
  });
}
