// app/api/v1/me/route.js
//
// GET /api/v1/me — which company this agency key belongs to, the key's name
// and permissions, and what the company shares. Zapier's connection test
// (integrations/zapier, authentication.test) and its connection label.
// Docs: /developers/marketing-api.
export const runtime = "nodejs";

import { agencyResponse } from "@/lib/agency/route";
import { SCOPE_READ } from "@/lib/agency/keys";
import { getMe } from "@/lib/agency/api";

export async function GET(request) {
  return agencyResponse(request, SCOPE_READ, (ctx) => getMe(ctx));
}
