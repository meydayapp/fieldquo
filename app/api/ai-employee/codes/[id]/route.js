// app/api/ai-employee/codes/[id]/route.js
//
// The owner's decision on one extracted error code:
//
//   { action: "review" }  "Looks right" — used normally from now on
//   { action: "reject" }  "Don't use" — kept (no deletion), never read by
//                         look_up_error_code (its WHERE has rejectedAt: null)
//   { action: "restore" } "Use again" — back to unreviewed
//   { meaning, safeSteps, stopSigns, urgency } — an edit; saving an edit
//                         also marks it reviewed, because the owner has now
//                         read it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { codeEdit } from "@/lib/aiEmployee/referenceRuns";

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.impersonation) return NextResponse.json({ error: "Support sessions are read-only." }, { status: 403 });
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json({ error: "Only an owner or admin can manage the AI employee's material." }, { status: 403 });
  }
  const { action, data } = codeEdit(await request.json().catch(() => ({})));
  const edited = Object.keys(data).length > 0;
  if (!action && !edited) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  const now = new Date();
  const decided =
    action === "reject"
      ? { rejectedAt: now }
      : action === "restore"
        ? { rejectedAt: null, reviewedAt: null, reviewedByUserId: null }
        : { rejectedAt: null, reviewedAt: now, reviewedByUserId: member.userId || null };
  // updateMany under the company: another tenant's id changes nothing.
  const { count } = await db.referenceCode.updateMany({ where: { id, companyId: member.companyId }, data: { ...data, ...decided } });
  if (!count) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
