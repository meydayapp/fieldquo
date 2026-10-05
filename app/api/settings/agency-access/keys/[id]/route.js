// app/api/settings/agency-access/keys/[id]/route.js
//
// DELETE — revoke a marketing agency key. It stops authenticating at once,
// its hook subscriptions end, and the row stays (who had access, and when, is
// the record). Owner/admin only, never a support session.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { revokeAgencyKey } from "@/lib/agency/settings";

export async function DELETE(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { id } = await params;
  const r = await revokeAgencyKey(db, member, id);
  return NextResponse.json(r.body, { status: r.status });
}
