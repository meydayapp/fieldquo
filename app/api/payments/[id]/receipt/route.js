// app/api/payments/[id]/receipt/route.js
//
// "Send receipt" / "Resend receipt" on a payment row of the invoice page —
// the button for a payment whose receipt never went (every payment recorded
// before receipts existed, Maureen's two e-transfers on INV-2026-0022
// among them), one that failed, or one the client lost.
//
// One email per press, for this payment only, through the one sender
// (lib/payments/sendReceipt.js) — its claim makes a double press send once,
// and a RESEND has to say so (`resend: true`, which the page sends only after
// the person confirms).
//
// Who: whoever may send invoices — the same gate as
// app/api/invoices/[id]/send (invoices at view_create_edit, and a plan; a
// receipt carries the company's name to a client exactly as an invoice does).
// A support session is refused by name: impersonation is read-only.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { planOrRefusal } from "@/lib/signup/planGate";
import { actorName } from "@/lib/email/sentEmailHistory";
import { sendPaymentReceipt } from "@/lib/payments/sendReceipt";

// What each refusal says, so the page can show it without inventing words.
const REFUSALS = {
  not_found: "That payment isn't on an invoice in this company.",
  refund: "A refund has no receipt.",
  historical: "This invoice was entered as a past job. Nothing is sent to the client for past jobs.",
  just_sent: "The receipt was sent a moment ago. Wait a minute before sending it again.",
  in_flight: "This receipt is being sent right now.",
  no_client_email: "This client has no email address on file. Add one on their client record, then send.",
  bad_request: "We couldn't read that request.",
};

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.impersonation) {
    return NextResponse.json({ error: "Support access can't email a company's clients." }, { status: 403 });
  }
  const { response: denied } = await levelOrRefusal(member, "invoices", "view_create_edit", "send receipts");
  if (denied) return denied;
  const { response: unpaid } = await planOrRefusal(member, "send this receipt");
  if (unpaid) return unpaid;

  const body = await request.json().catch(() => ({}));
  const result = await sendPaymentReceipt(db, {
    companyId: member.companyId,
    paymentId: id,
    trigger: "manual",
    resend: body?.resend === true,
    actor: { id: member.id, userId: member.userId, role: member.role, name: await actorName(db, member.userId) },
  });

  if (result.sent) {
    return NextResponse.json({
      sent: true,
      to: result.to,
      sentEmailId: result.sentEmailId,
      simulated: result.simulated === true,
      simulatedReason: result.simulatedReason || null,
      demoLive: result.demoLive === true,
    });
  }
  if (result.reason === "already_sent") {
    // Not an error: the second of two presses, or a stale page. Nothing went.
    return NextResponse.json({ sent: false, alreadySent: true, to: result.to || null, code: "already_sent" });
  }
  const error =
    REFUSALS[result.reason] ||
    (/not verified|testing emails|can only send/i.test(result.error || "")
      ? "Resend only delivers to your own account address until a sending domain is verified. Set one up under Settings → Email Domain."
      : result.error === "email_not_configured"
        ? "Email isn't configured on this deployment yet, so nothing was sent."
        : `The receipt couldn't be sent. ${String(result.error || "").replace(/^send_failed: /, "")}`.trim());
  return NextResponse.json({ error, code: result.reason }, { status: result.status || 502 });
}
