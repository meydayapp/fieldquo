// app/api/v1/hooks/samples/[event]/route.js
//
// GET /api/v1/hooks/samples/{event}?limit=3 — Zapier's perform-list for each
// REST-hook trigger: recent real payloads of that event, built exactly as a
// delivery is (lib/agency/events.js payloadFor), under the company's sharing
// switches. Docs: /developers/marketing-api.
export const runtime = "nodejs";

import { agencyResponse } from "@/lib/agency/route";
import { SCOPE_READ } from "@/lib/agency/keys";
import { hookSamples } from "@/lib/agency/api";

export async function GET(request, { params }) {
  const { event } = await params;
  const query = new URL(request.url).searchParams;
  return agencyResponse(request, SCOPE_READ, (ctx) => hookSamples({ ...ctx, event, query }));
}
