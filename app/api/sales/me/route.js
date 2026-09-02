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
import { getAppOrigin } from "@/lib/appUrl";
import { repSignupStats, signupLinkFor } from "@/lib/sales/repStats";

export async function GET(request) {
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) {
    return NextResponse.json(refusal.body, { status: refusal.status });
  }

  // The link and the counts come from here rather than from a separate call
  // because the portal shows them together, and two round trips to render one
  // card is how a screen ends up half-populated on a bad connection.
  const stats = await repSignupStats(rep.id);

  return NextResponse.json({
    id: rep.id,
    name: rep.name,
    email: rep.email,
    /// The mailbox they SEND from, which is not the address they sign in with
    /// and may not exist yet — a mailbox is bought after the rep is created.
    workEmail: rep.workEmail || null,
    code: rep.code,
    signupLink: signupLinkFor(getAppOrigin(request), rep.code),
    signups: {
      today: stats.today,
      thisWeek: stats.thisWeek,
      total: stats.total,
      // Named so the UI can say "today (UTC)" rather than implying local time.
      dayStartsAt: stats.dayStartsAt,
      weekStartsAt: stats.weekStartsAt,
    },
  });
}
