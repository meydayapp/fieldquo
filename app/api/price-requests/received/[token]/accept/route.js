// app/api/price-requests/received/[token]/accept/route.js
//
// "Price it in FieldQuo" — the SUB's own action. A signed-in member of the
// sub's company links a GC's price request to their account: the GC becomes
// a business client in the sub's FieldQuo (once — Client.linkedCompanyId),
// and the request lands as a lead (source "gc_request") carrying the scope,
// the job address and the photos — never the homeowner's name or contacts,
// which the request never held (lib/subRequests/server.js acceptRequest).
//
// The lead is how the sub prices it: convert, quote, send — and the sent
// quote finds its way into the GC's compare by itself (landRequestedQuote,
// from lib/quotes/quoteLifecycle.js onQuoteSent).
//
// Gate: adding a request is "requests" view_create_edit in the sub's company
// — the same level POST /api/leads asks. A read-only support session never
// writes (no userId; middleware refuses the POST before this anyway).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { acceptRequest, RequestError } from "@/lib/subRequests/server";
import { requestLabels } from "@/lib/subRequests/email";
import { createScoredLead } from "@/lib/leads/createLead";
import { buildLeadIntake } from "@/lib/leads/intakeShape";
import { linkLeadToClient } from "@/lib/leads/identityLinks";
import { recordActivity } from "@/lib/activity/log";

export async function POST(request, { params }) {
  // Next 16: params is a Promise.
  const { token } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!member.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { response: denied } = await levelOrRefusal(member, "requests", "view_create_edit", "add a request");
  if (denied) return denied;

  const company = await db.company.findUnique({ where: { id: member.companyId }, select: { defaultLanguage: true } });
  try {
    const result = await acceptRequest(db, {
      token: String(token || ""),
      member,
      // The job address goes in through the shared intake shape, like every
      // other lead path (scripts/check-lead-intake.mjs).
      createLead: ({ address, ...lead }) => createScoredLead({ ...lead, intake: buildLeadIntake({ address }) }),
      linkLeadToClient,
      leadLabels: requestLabels(company?.defaultLanguage || "en"),
    });
    if (!result.again) {
      await recordActivity(member, {
        action: "lead.price_request_accepted",
        entityType: "lead",
        entityId: result.leadId,
        summary: "Accepted a contractor's price request",
        metadata: { leadId: result.leadId },
      });
    }
    return NextResponse.json({ ok: true, leadId: result.leadId, leadUrl: `/app/leads?lead=${encodeURIComponent(result.leadId)}` });
  } catch (err) {
    if (err instanceof RequestError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    console.error("[price-requests accept]", err);
    return NextResponse.json({ error: "Couldn't add this request to your account. Please try again." }, { status: 500 });
  }
}
