// app/api/v1/hooks/subscribe/route.js
//
// POST /api/v1/hooks/subscribe  { event, targetUrl }  → { id, … }
//
// Zapier's REST-hook subscribe (integrations/zapier triggers' performSubscribe).
// Events and their payloads: lib/agency/events.js; delivery, retries and the
// 410 rule: lib/agency/delivery.js. Docs: /developers/marketing-api.
export const runtime = "nodejs";

import { agencyResponse, jsonObject, BAD_BODY } from "@/lib/agency/route";
import { SCOPE_READ } from "@/lib/agency/keys";
import { subscribeHook } from "@/lib/agency/api";

export async function POST(request) {
  return agencyResponse(request, SCOPE_READ, async (ctx) => {
    const body = await jsonObject(request);
    if (!body) return BAD_BODY;
    return subscribeHook({ ...ctx, body });
  });
}
