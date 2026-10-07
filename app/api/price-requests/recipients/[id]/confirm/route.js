// app/api/price-requests/recipients/[id]/confirm/route.js
//
// "Add to compare" on a price a sub WITHOUT a FieldQuo account typed into the
// request's reply form. The GC confirms it; it becomes an OPTION beside the
// other prices for the trade (lib/subRequests/server.js confirmReply) — on
// no client document until the GC presses "Use this one" / "Offer as extra
// work" in the compare.
//
// Reads no request body: the figure is the stored reply, never one the
// browser sends (AGENTS.md #5). The same gates as choosing a price
// (quotes view_create_edit + showPricing).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, requireLevel, requireToggle, permissionErrorResponse } from "@/lib/permissions/enforce";
import { confirmReply, RequestError } from "@/lib/subRequests/server";
import { recordActivity } from "@/lib/activity/log";

export async function POST(request, { params }) {
  // Next 16: params is a Promise.
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!member.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "quotes", "view_create_edit", "add a subcontractor's price to the compare");
    requireToggle(full, "showPricing", "add a subcontractor's price to the compare");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }
  try {
    const result = await confirmReply(db, { member, recipientId: String(id || "") });
    await recordActivity(member, {
      action: "quote.price_reply_confirmed",
      entityType: "quote",
      entityId: result.import.targetQuoteId,
      summary: "Added a subcontractor's emailed price to the compare",
      metadata: { recipientId: id, importId: result.import.id },
    });
    return NextResponse.json({ ok: true, importId: result.import.id, placement: result.placement });
  } catch (err) {
    if (err instanceof RequestError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[price-requests confirm]", err);
    return NextResponse.json({ error: "Couldn't add that price. Please try again." }, { status: 500 });
  }
}
