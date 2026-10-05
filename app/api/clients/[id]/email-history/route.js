// app/api/clients/[id]/email-history/route.js
//
// GET — the "History" tab on the client page: every document email sent to
// this client — quotes, follow-ups, invoices, deposit requests, reminders,
// receipts — newest first, each with its kept text (lib/email/
// sentEmailHistory.js), and the sends from before the text was kept, said
// honestly.
//
// Office only (a member scoped to their own jobs gets a 403 and the tab is
// not drawn), and per row: quotes / invoices / jobs ≥ view_only for the
// kind, showPricing for the subject (the body is a separate read), client
// contact data for the recipients. A support session reads.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, hasLevel, hasToggle, seesOnlyAssignedJobs } from "@/lib/permissions/enforce";
import { historyAccess, loadEmailHistory } from "@/lib/email/sentEmailHistory";

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
  if (!access.read) {
    return NextResponse.json({ error: "Sent email history is kept for the office.", reason: "no_history_access" }, { status: 403 });
  }
  const data = await loadEmailHistory(db, { companyId: member.companyId, clientId: String(id || ""), access });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...data, can: { readText: access.money } });
}
