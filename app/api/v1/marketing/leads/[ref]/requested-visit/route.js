// app/api/v1/marketing/leads/[ref]/requested-visit/route.js
//
// POST /api/v1/marketing/leads/{ref}/requested-visit  { from, to }
//      (key permission marketing:write_leads)
//
// "Update appointment request" — the time window the visit is asked for,
// shown on the lead. It never changes a booked visit, its time or its crew:
// once a visit is booked this answers 409. Docs: /developers/marketing-api.
export const runtime = "nodejs";

import { agencyResponse, jsonObject, BAD_BODY } from "@/lib/agency/route";
import { SCOPE_WRITE_LEADS } from "@/lib/agency/keys";
import { updateRequestedVisit } from "@/lib/agency/api";

export async function POST(request, { params }) {
  const { ref } = await params;
  return agencyResponse(request, SCOPE_WRITE_LEADS, async (ctx) => {
    const body = await jsonObject(request);
    if (!body) return BAD_BODY;
    return updateRequestedVisit({ ...ctx, ref, body });
  });
}
