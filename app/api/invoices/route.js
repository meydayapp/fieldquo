// app/api/invoices/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { allocateInvoiceNumber } from "@/lib/invoices/invoiceNumber";
import { getCurrentMember } from "@/lib/currentMember";
import { requireWithinLimit } from "@/lib/platform/planLimits";
import { normaliseMediaList } from "@/lib/media/validate";
import {
  loadEnforceableMember,
  requireLevel,
  requireToggle,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { buildCostingRow, mayCost, isEmptyCosting } from "./costingWrite";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  return NextResponse.json(invoices);
}

// Creates a fresh invoice, typically from an accepted Quote — NOT how new versions of
// an existing invoice are created (that's PATCH .../route.js below, which snapshots
// a version before applying changes).
export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  return NextResponse.json(invoice, { status: 201 });
}
