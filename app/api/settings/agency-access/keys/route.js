// app/api/settings/agency-access/keys/route.js
//
// POST { name, writeLeads? } — create a marketing agency key. The answer
// carries the secret ONCE; only its sha256 is stored. Owner/admin only, never
// a support session (lib/agency/settings.js createAgencyKey).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { createAgencyKey } from "@/lib/agency/settings";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const body = await request.json().catch(() => null);
  const r = await createAgencyKey(db, member, body);
  // no-store: the one response that ever holds the secret must not be cached.
  return NextResponse.json(r.body, { status: r.status, headers: { "cache-control": "no-store" } });
}
