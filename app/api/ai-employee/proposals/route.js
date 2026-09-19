// app/api/ai-employee/proposals/route.js
//
// The proposals inbox — what the employee wanted to do and could not do
// alone under its mode. GET lists the pending ones for the caller's company.
// Owner/admin, and a read-only support session may look.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { listProposals } from "@/lib/aiEmployee/proposals";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!member.impersonation) {
    try {
      requirePermission(member.role, "user:manage");
    } catch {
      return NextResponse.json({ error: "Only an owner or admin can review the AI employee's proposals." }, { status: 403 });
    }
  }
  const proposals = await listProposals(member.companyId);
  return NextResponse.json({ proposals });
}
