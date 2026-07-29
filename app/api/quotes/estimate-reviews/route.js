// app/api/quotes/estimate-reviews/route.js
//
// The review queue: draft quotes the public instant estimator produced that
// nobody has signed off yet. A homeowner saw a range; these are waiting for
// someone accountable to confirm the price before it can be sent.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { can } from "@/lib/permissions";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quotes = await db.quote.findMany({
    where: { companyId: member.companyId, autoEstimated: true, needsReview: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      quoteNumber: true,
      total: true,
      estimateSource: true,
      estimateData: true,
      createdAt: true,
      client: { select: { name: true, email: true, phone: true, address: true } },
    },
  });

  return NextResponse.json({
    quotes,
    // Whether THIS member may approve — drives the button state, but the
    // approve route enforces it again server-side. Hiding a button is not
    // access control.
    canApprove: can(member.role, "quote:approve-estimate"),
  });
}
