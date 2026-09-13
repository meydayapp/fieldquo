// app/api/hr/policies/[id]/remind/route.js — nudge everyone in scope who
// has not signed the current version. One feed row + push each.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hrManagerOrRefusal } from "@/lib/hr/gate";
import { remindPending, POLICY_SELECT } from "@/lib/hr/policyService";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await hrManagerOrRefusal(request);
  if (response) return response;
  const policy = await db.companyPolicy.findFirst({ where: { id, companyId: member.companyId, archivedAt: null }, select: POLICY_SELECT });
  if (!policy) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const result = await remindPending(db, { companyId: member.companyId, policy, actorUserId: member.userId || null });
  return NextResponse.json(result);
}
