// app/api/leads/[id]/convert/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { convertLeadToQuote } from "@/lib/leads/convertLead";
import { recordActivity } from "@/lib/activity/log";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";

// Turn a lead into a draft quote. Gated on the SAME permission as creating a
// quote by hand — converting IS creating one.
export async function POST(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "quotes", "view_create_edit", "create quotes");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  // …and on the lead as well: this reads the request in full to build the
  // quote from it, so someone refused the board must not reach one through here.
  const { response: denied } = await levelOrRefusal(
    member,
    "requests",
    "view_only",
    "see requests",
  );
  if (denied) return denied;

  const { id } = await params;
  const lead = await db.leadRequest.findFirst({
    where: { id, companyId: member.companyId },
  });
  if (!lead)
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { id: true, defaultLanguage: true },
  });

  const { quote, created } = await convertLeadToQuote({ lead, member, company });

  if (created) {
    await recordActivity(member, {
      action: "lead.converted",
      entityType: "quote",
      entityId: quote.id,
      summary: `Converted lead "${lead.name}" into quote ${quote.quoteNumber}`,
      metadata: { leadId: lead.id, quoteId: quote.id },
    });
  }

  return NextResponse.json({
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber,
    created,
  });
}
