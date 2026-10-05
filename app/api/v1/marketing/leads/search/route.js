// app/api/v1/marketing/leads/search/route.js
//
// GET /api/v1/marketing/leads/search?email=…|phone=…
//     (key permission marketing:write_leads)
//
// "Find lead by email or phone": matched on the full identifier the agency
// already holds — an exact email or phone, never a name — and answered with
// the same privacy-safe rows as every other path, so a search reveals no
// more than the company's sharing switches allow. Docs: /developers/marketing-api.
export const runtime = "nodejs";

import { agencyResponse } from "@/lib/agency/route";
import { SCOPE_WRITE_LEADS } from "@/lib/agency/keys";
import { findLeadsByContact } from "@/lib/agency/api";

export async function GET(request) {
  const query = new URL(request.url).searchParams;
  return agencyResponse(request, SCOPE_WRITE_LEADS, (ctx) => findLeadsByContact({ ...ctx, query }));
}
