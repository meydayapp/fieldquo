// app/api/v1/marketing/leads/route.js
//
// GET  /api/v1/marketing/leads?updatedSince&cursor&limit&order=newest
//      Privacy-safe lead rows (lib/agency/leadRow.js), paginated.
// POST /api/v1/marketing/leads   (key permission marketing:write_leads)
//      A lead from the agency's own funnel: source "agency_funnel", its
//      attribution, contact details and the service asked for — created
//      through createScoredLead like every other lead, deduplicated by email
//      and phone. Docs: /developers/marketing-api.
export const runtime = "nodejs";

import { agencyResponse, jsonObject, BAD_BODY } from "@/lib/agency/route";
import { SCOPE_READ, SCOPE_WRITE_LEADS } from "@/lib/agency/keys";
import { listLeads, createAgencyLead } from "@/lib/agency/api";

export async function GET(request) {
  const query = new URL(request.url).searchParams;
  return agencyResponse(request, SCOPE_READ, (ctx) => listLeads({ ...ctx, query }));
}

export async function POST(request) {
  return agencyResponse(request, SCOPE_WRITE_LEADS, async (ctx) => {
    const body = await jsonObject(request);
    if (!body) return BAD_BODY;
    return createAgencyLead({ ...ctx, body });
  });
}
