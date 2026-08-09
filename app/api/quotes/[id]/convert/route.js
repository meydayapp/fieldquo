// app/api/quotes/[id]/convert/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { ensureInvoiceForQuote } from "@/lib/invoices/createInvoiceFromQuote";

// The MANUAL "Convert to invoice" override. A client approving through the
// public link now creates the invoice automatically (see the approval route);
// this stays for the case where the office agrees to proceed off a phone call.
// Both paths share ensureInvoiceForQuote so they can't diverge.
export async function POST(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "quote:convert");
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  // Company-scope the quote before doing anything (tenant boundary).
  const quote = await db.quote.findFirst({
    where: { id: _params.id, companyId: member.companyId },
    select: { id: true, status: true },
  });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (quote.status !== "accepted") {
    return NextResponse.json(
      { error: "Only accepted quotes can be converted to an invoice" },
      { status: 400 },
    );
  }

  const { invoice, created } = await ensureInvoiceForQuote(quote.id, {
    createdById: member.userId,
  });
  if (!invoice)
    return NextResponse.json({ error: "Couldn't build the invoice" }, { status: 500 });

  // Already had one — surface it (the button should route to it) rather than
  // silently making a duplicate.
  if (!created) {
    return NextResponse.json(
      { error: "This quote already has an invoice", invoiceId: invoice.id },
      { status: 409 },
    );
  }

  return NextResponse.json(invoice, { status: 201 });
}
