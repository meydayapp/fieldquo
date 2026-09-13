// app/api/settings/scheduling/route.js
//
// The two approval switches behind the employee home's requests:
//
//   shiftSwapsNeedApproval     a trade / cover / claim needs a manager's yes
//                              after the colleague's (default on)
//   availabilityNeedsApproval  a new availability needs a manager's yes
//                              before it changes the person's week (default on)
//
// Both are read by lib/shiftRequests/store.js and lib/availability/
// requests.js on every write — a switch that is saved here and consulted
// nowhere would be the "written and never read" failure this codebase is
// swept for. Owners and admins only: this is company policy, not a rota
// edit, and the Dispatcher preset (schedule edit_all) must not be able to
// switch its own approval off.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { recordActivity } from "@/lib/activity/log";

const SELECT = { shiftSwapsNeedApproval: true, availabilityNeedsApproval: true };

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const row = await db.company.findUnique({ where: { id: member.companyId }, select: SELECT });
  return NextResponse.json({
    shiftSwapsNeedApproval: row?.shiftSwapsNeedApproval !== false,
    availabilityNeedsApproval: row?.availabilityNeedsApproval !== false,
    canEdit: member.role === "owner" || member.role === "admin",
  });
}

export async function PUT(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.role !== "owner" && member.role !== "admin") {
    return NextResponse.json({ error: "Only an owner or administrator can change approval rules." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const data = {};
  if (typeof body.shiftSwapsNeedApproval === "boolean") data.shiftSwapsNeedApproval = body.shiftSwapsNeedApproval;
  if (typeof body.availabilityNeedsApproval === "boolean") data.availabilityNeedsApproval = body.availabilityNeedsApproval;
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  const row = await db.company.update({ where: { id: member.companyId }, data, select: SELECT });
  await recordActivity(member, {
    action: "settings.scheduling_approvals",
    entityType: "company",
    entityId: member.companyId,
    summary: `Scheduling approvals: swaps ${row.shiftSwapsNeedApproval ? "on" : "off"}, availability ${row.availabilityNeedsApproval ? "on" : "off"}`,
  });
  return NextResponse.json({ ...row, canEdit: true });
}
