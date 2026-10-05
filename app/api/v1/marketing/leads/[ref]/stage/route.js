// app/api/v1/marketing/leads/[ref]/stage/route.js
//
// POST /api/v1/marketing/leads/{ref}/stage  { stage, lostReason? }
//      (key permission marketing:write_leads)
//
// "Move lead to stage" — only the pipeline's own transitions
// (lib/leads/pipeline.js canSetLeadStatus): Won needs an accepted quote or
// work behind it, Lost needs a reason from the closed list. Logged in the
// company's activity log under the agency's name. Docs: /developers/marketing-api.
export const runtime = "nodejs";

import { agencyResponse, jsonObject, BAD_BODY } from "@/lib/agency/route";
import { SCOPE_WRITE_LEADS } from "@/lib/agency/keys";
import { moveLeadStage } from "@/lib/agency/api";

export async function POST(request, { params }) {
  const { ref } = await params;
  return agencyResponse(request, SCOPE_WRITE_LEADS, async (ctx) => {
    const body = await jsonObject(request);
    if (!body) return BAD_BODY;
    return moveLeadStage({ ...ctx, ref, body });
  });
}
