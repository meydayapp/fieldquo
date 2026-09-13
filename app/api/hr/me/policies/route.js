// app/api/hr/me/policies/route.js — the policies that apply to me, with
// whether I have signed the current version.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hrSelfOrRefusal } from "@/lib/hr/gate";
import { policiesForWorker } from "@/lib/hr/policyService";

export async function GET(request) {
  const { member, worker, response } = await hrSelfOrRefusal(request);
  if (response) return response;
  const policies = await policiesForWorker(db, { companyId: member.companyId, worker });
  return NextResponse.json({ worker: { id: worker.id, name: worker.name }, policies });
}
