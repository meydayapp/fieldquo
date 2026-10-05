// app/api/settings/agency-access/route.js
//
// Settings › Marketing agency access.
//   GET    the keys (never a secret or a hash), the two sharing switches, and
//          the latest calls each key made — owner/admin, and a read-only
//          support session (the console views everything).
//   PATCH  { contactDetails?, jobValues? } — the two switches. Owner/admin
//          only, never a support session; every change is logged.
// The rules: lib/agency/settings.js.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { readAgencyAccess, setAgencySharing } from "@/lib/agency/settings";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const r = await readAgencyAccess(db, member);
  return NextResponse.json(r.body, { status: r.status });
}

export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const body = await request.json().catch(() => null);
  const r = await setAgencySharing(db, member, body);
  return NextResponse.json(r.body, { status: r.status });
}
