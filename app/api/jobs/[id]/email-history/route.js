// app/api/jobs/[id]/email-history/route.js
//
// GET — the "History" tab on the job page: the document emails about THIS
// job — its quote's, the invoices billing it, its follow-ups — with their kept
// text (lib/email/sentEmailHistory.js). The client page's tab, narrowed.
//
// Office only, exactly as the client page's: a member scoped to their own
// jobs (the crew) gets a 403 and the tab is not drawn — the job page is not a
// side door into what the client was billed. Then jobs ≥ view_only for the
// job itself, and the client page's per-row rules.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, hasLevel, hasToggle, seesOnlyAssignedJobs, assignedJobWhere } from "@/lib/permissions/enforce";
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
  if (!access.read || (!member.impersonation && !hasLevel(full, "jobs", "view_only"))) {
    return NextResponse.json({ error: "Sent email history is kept for the office.", reason: "no_history_access" }, { status: 403 });
  }
  // Scoped like every job read — the office gate above already refuses a
  // member who sees only their own jobs; this keeps the read honest if that
  // gate ever moves.
  const job = await db.job.findFirst({
    where: { id: String(id || ""), companyId: member.companyId, ...assignedJobWhere(full) },
    select: { id: true, clientId: true, quoteId: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const data = await loadEmailHistory(db, { companyId: member.companyId, clientId: job.clientId, job, access });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...data, can: { readText: access.money } });
}
