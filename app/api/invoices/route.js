// app/api/invoices/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requireWithinLimit } from "@/lib/platform/planLimits";
import { normaliseMediaList } from "@/lib/media/validate";
import {
  loadEnforceableMember,
  requireLevel,
  requireToggle,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";

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
  try {
    const full = await loadEnforceableMember(db, member.id);
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
  } = body;

  if (!clientId || total === undefined) {
    return NextResponse.json(
      { error: "clientId and total are required" },
      { status: 400 },
    );
  }

  const lastInvoice = await db.invoice.findFirst({
    where: { companyId: member.companyId },
    orderBy: { createdAt: "desc" },
    select: { invoiceNumber: true },
  });
  const nextNumber = getNextInvoiceNumber(lastInvoice?.invoiceNumber);

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
    },
    include: { client: true },
  });

  return NextResponse.json(invoice, { status: 201 });
}

// Server is the source of truth for sequential numbers — never generate this client-side.
function getNextInvoiceNumber(lastNumber) {
  const year = new Date().getFullYear();
  if (!lastNumber) return `INV-${year}-0001`;

  const match = lastNumber.match(/(\d+)$/);
  const nextSeq = match
    ? String(Number(match[1]) + 1).padStart(4, "0")
    : "0001";
  return `INV-${year}-${nextSeq}`;
}
