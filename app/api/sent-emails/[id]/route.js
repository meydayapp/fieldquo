// app/api/sent-emails/[id]/route.js
//
// GET — one kept document email, whole: subject, sender, recipients, time,
// attachments' names and the text as it was sent (lib/email/
// sentEmailHistory.js). What the History tab and the Conversation timeline's
// "View email" open.
//
// The History tab's rules: office only; the kind's own permission category
// (a member without invoices reads no invoice email — it answers 404, the
// row is not theirs to know about); and showPricing for the text, because
// every document email names a figure — below it, a 403 that says why.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, hasLevel, hasToggle, seesOnlyAssignedJobs } from "@/lib/permissions/enforce";
import { historyAccess, loadSentEmail } from "@/lib/email/sentEmailHistory";

async function graded(member) {
  const full = member.id ? await loadEnforceableMember(db, member.id) : null;
  return { ...member, permissions: full?.permissions ?? null };
}

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const full = await graded(member);
  const access = historyAccess({ member, full, hasLevel, hasToggle, seesOnlyAssignedJobs });
  const res = await loadSentEmail(db, { companyId: member.companyId, id: String(id || ""), access });
  if (res.email) return NextResponse.json({ email: res.email });
  if (res.reason === "money_hidden") {
    return NextResponse.json({ error: "Your role doesn't show prices, so the text of document emails is hidden.", reason: "money_hidden" }, { status: 403 });
  }
  if (res.reason === "no_access") {
    return NextResponse.json({ error: "Sent email history is kept for the office.", reason: "no_history_access" }, { status: 403 });
  }
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
