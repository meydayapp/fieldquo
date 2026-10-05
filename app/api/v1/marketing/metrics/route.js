// app/api/v1/marketing/metrics/route.js
//
// GET /api/v1/marketing/metrics?period=thisMonth|…|custom&from&to
//                              &compare=previous|none&source&campaign
//
// The agency dashboard's figures for a period beside the previous equal
// period — computed by lib/agency/metricsData.js, the same loader FieldQuo's
// own Marketing results page uses. Every figure carries its definition.
// Docs: /developers/marketing-api.
export const runtime = "nodejs";

import { agencyResponse } from "@/lib/agency/route";
import { SCOPE_READ } from "@/lib/agency/keys";
import { getMetrics } from "@/lib/agency/api";

export async function GET(request) {
  const query = new URL(request.url).searchParams;
  return agencyResponse(request, SCOPE_READ, (ctx) => getMetrics({ ...ctx, query }));
}
