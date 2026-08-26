// app/api/quotes/estimate-reviews/route.js
//
// The review queue: draft quotes the public instant estimator produced that
// nobody has signed off yet. A homeowner saw a range; these are waiting for
// someone accountable to confirm the price before it can be sent.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { can } from "@/lib/permissions";
import {
  loadEnforceableMember,
  redactClient,
} from "@/lib/permissions/enforce";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const quotes = await db.quote.findMany({
    where: { companyId: member.companyId, autoEstimated: true, needsReview: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      quoteNumber: true,
      total: true,
      estimateSource: true,
      estimateData: true,
      // What the caller asked for that this automatic price does not carry.
      // Internal — Quote.reviewNotes is never on a client-facing surface — and
      // the reviewer is exactly who it was written for, so a queue that showed
      // the figure but not the caveat would be the wrong half of the story.
      reviewNotes: true,
      createdAt: true,
      client: { select: { name: true, email: true, phone: true, address: true } },
    },
  });

  // ── The filter this route missed ─────────────────────────────────────────
  //
  // GET /api/quotes was redacted; this sibling was not, and QA found the
  // screen still printing a homeowner's email, phone and full street address
  // to an employee restricted to name_address_only. Same data, different
  // handler, no filter — which is exactly the shape of miss that a shared
  // helper is supposed to prevent and only prevents where it is called.
  const full = await loadEnforceableMember(db, member.id);
  const redacted = quotes.map((q) => ({
    ...q,
    client: redactClient(full, q.client),
  }));

  return NextResponse.json({
    quotes: redacted,
    // Whether THIS member may approve — drives the button state, but the
    // approve route enforces it again server-side. Hiding a button is not
    // access control.
    canApprove: can(member.role, "quote:approve-estimate"),
  });
}
