// lib/agency/route.js
//
// The few lines every /api/v1 route file shares: authenticate the agency key
// (lib/agency/apiAuth.js), run the handler from lib/agency/api.js, answer as
// JSON. Never cached — every answer is one company's live data.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runAgencyCall } from "@/lib/agency/apiAuth";

export async function agencyResponse(request, scope, fn) {
  const r = await runAgencyCall(db, request, { scope }, (ctx) => fn({ ...ctx, db }));
  const headers = { "cache-control": "no-store" };
  if (r.status === 429 && r.body?.retryAfter) headers["retry-after"] = String(r.body.retryAfter);
  return NextResponse.json(r.body, { status: r.status, headers });
}

/** A JSON body, or null when there is none or it is not an object. */
export async function jsonObject(request) {
  const body = await request.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? body : null;
}

export const BAD_BODY = { status: 400, body: { error: "Send a JSON object as the request body.", code: "invalid_request" } };
