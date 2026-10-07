// app/api/price-requests/recipients/[id]/resend/route.js
//
// "Send again" for a sub whose request email the mail provider did not
// accept (the panel's "Not sent"). Only for one never sent — a sub who has
// the email gets at most the one automatic reminder, not a button that
// mails them on every press.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, requireLevel, permissionErrorResponse } from "@/lib/permissions/enforce";
import { requireSubcontractorWrite } from "@/lib/subcontractors/access";
import { sendPriceRequestEmail } from "@/lib/subRequests/send";
import { getAppOrigin } from "@/lib/appUrl";

export async function POST(request, { params }) {
  // Next 16: params is a Promise.
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!member.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "quotes", "view_create_edit", "ask subcontractors for prices");
    requireSubcontractorWrite(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }
  const row = await db.subPriceRequestRecipient.findFirst({
    where: { id: String(id || ""), companyId: member.companyId },
    select: { id: true, sentAt: true, declinedAt: true },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.sentAt) return NextResponse.json({ error: "That request was already delivered." }, { status: 409 });
  if (row.declinedAt) return NextResponse.json({ error: "They declined this request." }, { status: 409 });
  const out = await sendPriceRequestEmail({ recipientId: row.id, origin: getAppOrigin(request) }).catch((err) => ({
    ok: false,
    error: err?.message || "send failed",
  }));
  if (!out.ok) return NextResponse.json({ error: out.error || "Couldn't send it." }, { status: out.skipped ? 503 : 502 });
  return NextResponse.json({ ok: true });
}
