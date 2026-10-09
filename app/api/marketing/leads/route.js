// app/api/marketing/leads/route.js
//
// GET /api/marketing/leads — Marketing › Leads (app/app/marketing/leads): the
// leads marketing brought in, as the marketing agency may see them.
//
// Built for the marketing-agency TEAM role (lib/permissions/marketingAgency.js)
// and answered from lib/agency/api.js memberLeadRows — the same buildLeadRow
// the agency's API key gets, behind the same two company switches. First
// name, source, stage, a partial postal code; contact details only while
// "Share contact details" is on; job values only while "Share job values" is.
// There is no second privacy rule here to drift from the first.
//
// The company's own marketing people (owner, admin, supervisor —
// user:manage) may open it too: it is exactly what their agency sees, which
// is the thing worth checking. They read the full records on the Leads board.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requireMarketingAccess } from "@/lib/permissions/marketingAgency";
import { memberLeadRows } from "@/lib/agency/api";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    requireMarketingAccess(member);
  } catch (err) {
    return NextResponse.json({ error: "Only owners, admins, supervisors or your marketing agency can see marketing leads." }, { status: err.status || 403 });
  }
  // A support session reads; it does not stamp a reference onto a customer's
  // lead by looking at it (non-negotiable #3).
  const result = await memberLeadRows({ db, companyId: member.companyId, assignRefs: !member.impersonation });
  return NextResponse.json({ ...result.body, generatedAt: new Date().toISOString() }, { status: result.status });
}
