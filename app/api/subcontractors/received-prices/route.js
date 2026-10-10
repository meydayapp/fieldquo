// app/api/subcontractors/received-prices/route.js
//
// "Quotes from my subs" (/app/subcontractors/quotes): every price the GC's
// subs have sent them, where each stands, and what this member may do with
// it. Read-only — every action on the page calls the route that already
// does it (the compare's select, the price request's confirm).
//
// Gates: the compare panel's own pair, quotes view_only + showPricing
// (lib/subcontractors/receivedPrices.js canSeeReceivedPrices). The cost,
// the replies and each action are decided per member by receivedPriceAccess.
// Every query is scoped to member.companyId — lib/subcontractors/
// receivedPricesServer.js lists them.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, requireLevel, requireToggle, permissionErrorResponse } from "@/lib/permissions/enforce";
import { receivedPriceAccess } from "@/lib/subcontractors/receivedPrices";
import { loadReceivedPrices } from "@/lib/subcontractors/receivedPricesServer";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  let full;
  try {
    full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "quotes", "view_only", "see the prices your subcontractors sent");
    requireToggle(full, "showPricing", "see the prices your subcontractors sent");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }
  // The session's userId, not the Member row's: a read-only support session
  // carries none, and must be offered no write (non-negotiable #2).
  const access = receivedPriceAccess({ ...full, userId: member.userId ?? null });
  try {
    const out = await loadReceivedPrices(db, { companyId: member.companyId, access });
    return NextResponse.json({
      rows: out.rows,
      requestTargets: out.requestTargets,
      truncated: out.truncated,
      // What the page may say about what it does NOT show — declared, so an
      // empty column reads as withheld rather than as zero.
      costHidden: !access.mayCost,
      repliesHidden: !access.mayReplies,
      canRequest: access.request,
    });
  } catch (err) {
    console.error("[subcontractors received-prices GET]", err);
    return NextResponse.json({ error: "Couldn't load your subcontractors' prices." }, { status: 500 });
  }
}
