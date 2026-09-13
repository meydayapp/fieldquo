// app/api/invoices/[id]/refund/route.js
//
// POST — refund a client, in full or in part, from a payment on this invoice.
// See lib/invoices/refund.js for what a refund is and how it is recorded.
//
// Who: the same people who can record a payment (the `payments` toggle —
// app/api/payments/route.js), and who can edit invoices. Owners and admins
// pass both; a custom-access member needs the toggle. Impersonation is
// refused before this file by getCurrentMember's read-only gate — money
// leaving a balance is the case that gate exists for.
//
// The amount is typed by a member of the company in their own back office,
// like Record Payment; it is not a client surface.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  requireLevel,
  requireToggle,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { issueRefund } from "@/lib/invoices/refund";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.impersonation) {
    return NextResponse.json({ error: "Support access can't move a company's money." }, { status: 403 });
  }

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireToggle(full, "payments", "refund a payment");
    requireLevel(full, "invoices", "view_create_edit");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "We couldn't read that request." }, { status: 400 });
  const { paymentId, amount, reason, method, requestId } = body;
  if (!paymentId || !requestId || typeof requestId !== "string" || requestId.length > 80) {
    return NextResponse.json({ error: "paymentId and requestId are required" }, { status: 400 });
  }
  const amountCents = Math.round(Number(amount) * 100);

  try {
    const result = await issueRefund(
      {
        companyId: member.companyId,
        invoiceId: id,
        paymentId,
        amountCents,
        method,
        reason,
        requestId,
        memberUserId: member.userId,
      },
      { db, stripe },
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error, ...(result.limitCents != null ? { limitCents: result.limitCents } : {}) }, { status: result.status || 400 });
    }
    return NextResponse.json({
      ok: true,
      refund: { id: result.row.id, amount: result.row.amount, stripeRefundId: result.stripeRefundId },
      invoice: {
        amountPaid: result.state.amountPaid,
        amountDue: result.state.amountDue,
        amountRefunded: result.state.amountRefunded,
        status: result.state.status,
      },
    });
  } catch (err) {
    console.error("[invoices/refund]", err?.message);
    return NextResponse.json(
      { error: err?.raw?.message || err?.message || "The refund could not be issued." },
      { status: 502 },
    );
  }
}
