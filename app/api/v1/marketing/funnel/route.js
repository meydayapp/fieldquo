// app/api/v1/marketing/funnel/route.js
//
// GET /api/v1/marketing/funnel — messages from ads → leads → qualified →
// appointments → quotes sent → closes for a period, with each stage's rate,
// closes without an in-person visit beside it, and the per-channel split.
// Same parameters as /metrics. Docs: /developers/marketing-api.
export const runtime = "nodejs";

import { agencyResponse } from "@/lib/agency/route";
import { SCOPE_READ } from "@/lib/agency/keys";
import { getFunnel } from "@/lib/agency/api";

export async function GET(request) {
  const query = new URL(request.url).searchParams;
  return agencyResponse(request, SCOPE_READ, (ctx) => getFunnel({ ...ctx, query }));
}
