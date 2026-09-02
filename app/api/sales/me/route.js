// app/api/sales/me/route.js
//
// The signed-in rep's own identity.
//
// Needed for the same reason /api/platform/me is: the JWT lives in an httpOnly
// cookie, so a screen that wants to print "signed in as Dana" has to ask. And
// like that route, it re-reads the row rather than trusting the token — a
// deactivation should not have to wait twelve hours for a JWT to expire, which
// is exactly what requireSalesRep re-checks on every call.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireSalesRep } from "@/lib/sales/gate";

export async function GET(request) {
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) {
    return NextResponse.json(refusal.body, { status: refusal.status });
  }

  return NextResponse.json({
    id: rep.id,
    name: rep.name,
    email: rep.email,
    code: rep.code,
  });
}
