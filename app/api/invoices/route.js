// app/api/invoices/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { allocateInvoiceNumber } from "@/lib/invoices/invoiceNumber";
import { memberOrRefusal } from "@/lib/apiMember";
import { requireWithinLimit } from "@/lib/platform/planLimits";
import { normaliseMediaList } from "@/lib/media/validate";
import {
  loadEnforceableMember,
  requireLevel,
  requireToggle,
  permissionErrorResponse,
  redactInvoice,
  redactInvoices,
} from "@/lib/permissions/enforce";
import {
  buildCostingRow,
  mayCost,
  requireCost,
  isEmptyCosting,
} from "./costingWrite";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const clientId = searchParams.get("clientId");

  const invoices = await db.invoice.findMany({
    where: {
      companyId: member.companyId,
      parentInvoiceId: null, // only show latest/original — versions nest under their parent
      ...(status && { status }),
      ...(clientId && { clientId }),
    },
    include: {
      client: { select: { id: true, name: true, email: true } },
      payments: true,
      versions: {
        select: { id: true, version: true },
        orderBy: { version: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Shaped before it leaves, by the same entry point the detail route uses.
  // Two things travelled on this list that the grid has an opinion about and
  // nothing was checking: the nested client's email (hidden on GET /api/clients
  // since the first redaction sweep) and every money column — total, balance,
  // and the whole Payment rows, which reconstruct the balance on their own.
  //
  // `invoices: view_only` is a real grant, so this is a redaction rather than a
  // 403: a crew member may see that invoice 1042 for the Tremblay job is
  // overdue without seeing what it is for.
  const full = await loadEnforceableMember(db, member.id);
  return NextResponse.json(redactInvoices(full, invoices));
}

// Creates a fresh invoice, typically from an accepted Quote — NOT how new versions of
// an existing invoice are created (that's PATCH .../route.js below, which snapshots
// a version before applying changes).
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Invoices carry pricing, so two checks: the category level, and the
  // showPricing toggle. A member who can't see prices shouldn't be able to
  // create a document that consists mostly of them.
  // Hoisted out of the try because the costing block below needs it too, and
  // loading the same member twice to learn the same thing is waste.
  let full = null;
  try {
    full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "invoices", "view_create_edit", "create invoices");
    requireToggle(full, "showPricing", "create invoices");
  } catch (err) {
    const { body: errBody, status } = permissionErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }

  const body = await request.json();
  const {
    clientId,
    quoteId,
    lineItems,
    subtotal,
    discount,
    tax,
    total,
    dueDate,
    notes,
    language,
    clientPhotos,
    // Internal cost panel — crew, their actual hours, materials. Never part of
    // the document; see the InvoiceCosting model for why it is a separate row.
    costing,
  } = body;

  if (!clientId || total === undefined) {
    return NextResponse.json(
      { error: "clientId and total are required" },
      { status: 400 },
    );
  }

  // Neither id was proved to belong to this company before being written.
  //
  // `clientId` went straight onto the invoice, so posting another tenant's
  // client id raised an invoice in THIS company addressed to THEIR client,
  // whose details came back on every read of it.
  //
  // `quoteId` LOOKED checked — the lookup below is company-scoped — but that
  // lookup only reads a quote number, and a miss just leaves `sourceQuote`
  // null while `quoteId: quoteId || null` still stores the foreign id. A
  // scoped read next to an unscoped write is the easiest version of this to
  // miss in review, which is why both now go through one call.
  // See lib/tenant/ownedIds.js.
  const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, {
    clientId,
    quoteId,
  });
  if (notOurs) return notOurs;

  // An invoice raised against a quote takes that quote's number so the pair
  // reconciles at a glance; one raised on its own has nothing to borrow and
  // continues the sequence. lib/invoices/invoiceNumber.js has both rules and
  // the reason the old "last invoice by createdAt" lookup could repeat one.
  const sourceQuote = quoteId
    ? await db.quote.findFirst({
        where: { id: quoteId, companyId: member.companyId },
        select: { quoteNumber: true },
      })
    : null;
  const nextNumber = await allocateInvoiceNumber(db, {
    companyId: member.companyId,
    quoteNumber: sourceQuote?.quoteNumber || null,
  });

  try {
    // A costing block from someone without the toggle used to be dropped right
    // below and the save answered 200 — the panel's contents gone, nothing
    // said. See requireCost: silence stays silence, an actual block is
    // refused.
    if (costing !== undefined) requireCost(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  // Costed against subtotal MINUS discount — the pre-tax money the crew's time
  // and materials actually have to come out of. Tax is the government's, not
  // the company's, and a discount given away is not revenue either; counting
  // either as income flatters the margin.
  const costingRow =
    costing !== undefined && mayCost(full)
      ? await buildCostingRow({
          companyId: member.companyId,
          costing,
          price: (Number(subtotal) || 0) - (Number(discount) || 0),
        })
      : null;

  const invoice = await db.invoice.create({
    data: {
      companyId: member.companyId,
      invoiceNumber: nextNumber,
      clientId,
      quoteId: quoteId || null,
      createdById: member.userId,
      lineItems: lineItems || null,
      subtotal: subtotal || 0,
      discount: discount || 0,
      tax: tax || 0,
      total,
      // Seed the balance so list views and emails that read amountDue are
      // correct BEFORE any payment. It was defaulting to 0 (the column default),
      // which made a brand-new invoice read as fully paid.
      amountDue: total,
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes || null,
      language: language || "en",
      // An invoice raised without a quote behind it still needs the job
      // photos — same sanitising boundary as the quote routes.
      ...(clientPhotos !== undefined && {
        clientPhotos: normaliseMediaList(clientPhotos),
      }),
      // Nested create rather than a second round-trip: the cost panel is
      // filled in on the same screen as the line items, and an invoice that
      // saved while its crew and hours quietly didn't is the failure the whole
      // "never ship a control that appears to work" rule is about.
      //
      // Nothing typed, nothing written. A brand-new invoice from someone who
      // never opened the panel gets no costing row, rather than a row of
      // zeroes that then renders as "Job cost $0.00" on the invoice page.
      ...(costingRow && !isEmptyCosting(costingRow) && {
        costing: { create: costingRow },
      }),
    },
    include: { client: true },
  });

  // `costing` is deliberately NOT included in the response. Nothing on the
  // create path needs it back, and the fewer places a whole invoice row
  // carries cost data, the fewer places it can be forwarded to a client.
  //
  // The client IS included and is redacted: creating an invoice needs
  // invoices/view_create_edit, which says nothing about clientsProperties, so
  // the two dials are independent and someone at name_address_only can reach
  // here. Reading the record back out of your own save is the same shape as
  // the bug already fixed on PATCH /api/quotes/[id].
  return NextResponse.json(redactInvoice(full, invoice), { status: 201 });
}
