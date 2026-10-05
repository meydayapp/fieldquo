// app/api/invoices/[id]/void-payment/route.js
//
// POST { paymentId, reason } — void a payment that was recorded BY HAND and
// never happened (a test, a typo). See lib/payments/voidPayment.js for what a
// void is, what it removes, and why a card payment can never be voided.
//
// Who: owners and admins. Not the `payments` toggle that records a payment or
// issues a refund — those are everyday office work, while a void removes a
// money row from the books, and the person accountable for the books is the
// owner (or the admin they made). A Manager, Crew, Estimator or Dispatcher is
// refused whatever toggles they hold.
//
// Impersonation: refused here by name, before anything is read, as well as by
// getCurrentMember's read-only gate — support access never moves or removes a
// company's money (AGENTS.md non-negotiable #2; the refund route does the same).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { voidManualPayment } from "@/lib/payments/voidPayment";
import { syncCommissionsForInvoice } from "@/lib/commissions/hook";

const VOIDERS = new Set(["owner", "admin"]);

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.impersonation) {
    return NextResponse.json({ error: "Support access can't change a company's payments." }, { status: 403 });
  }
  if (!VOIDERS.has(member.role)) {
    return NextResponse.json(
      { error: "Only the owner or an admin can void a payment.", code: "owner_only" },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "We couldn't read that request." }, { status: 400 });

  // The actor's name is stored at write time, the way recordActivity does,
  // so the audit row still says who after a rename or a departure.
  const user = member.userId
    ? await db.user.findUnique({ where: { id: member.userId }, select: { name: true, email: true } })
    : null;

  const result = await voidManualPayment(
    {
      companyId: member.companyId,
      invoiceId: id,
      paymentId: body.paymentId,
      reason: body.reason,
      actor: { userId: member.userId || null, memberId: member.id || null, name: user?.name || user?.email || null, role: member.role },
    },
    { db },
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status || 400 });
  }

  // The commission earned on this money was earned on nothing — the sync
  // recomputes from the payments now on file (lib/commissions/sync.js). After
  // the transaction, as the payment and refund routes do. Never throws.
  await syncCommissionsForInvoice(db, result.invoiceId || id);

  return NextResponse.json({
    ok: true,
    voided: { paymentId: result.voided.paymentId, amount: result.voided.amount, method: result.voided.method },
    invoice: result.state
      ? {
          status: result.state.status,
          amountPaid: result.state.amountPaid,
          amountDue: result.state.amountDue,
          amountRefunded: result.state.amountRefunded,
        }
      : null,
  });
}
