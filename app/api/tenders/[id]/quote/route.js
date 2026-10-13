// app/api/tenders/[id]/quote/route.js
//
// POST { quoteId }       link a quote as our bid on this tender
// POST { quoteId: null } unlink it
//
// Called by the tender page's "Link a quote" picker, and by the quote
// builder right after it creates a quote opened from "Create quote for this
// tender" (app/components/quotes/builder/QuoteBuilder.js reads ?tenderId=).
// The quote is written by the ordinary builder — there is no second one —
// and only the link is made here.
//
// The quote must be ours (assertOwnedIds) AND the buyer's: a bid priced on
// another client's quote would put that client's number on a government
// submission. Refused, not quietly linked.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { assertOwnedIds } from "@/lib/tenant/ownedIds";
import { recordActivity } from "@/lib/activity/log";
import { requireTenderWrite } from "@/lib/tenders/access";
import { TENDER_SELECT } from "@/lib/tenders/load";
import { detailPayload } from "@/lib/tenders/detail";
import { gateMember, findTender } from "@/lib/tenders/server";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const gate = await gateMember(db, member, requireTenderWrite);
  if (gate.response) return gate.response;

  const found = await findTender(db, member.companyId, id);
  if (found.response) return found.response;

  const body = (await request.json().catch(() => null)) || {};
  const quoteId = body.quoteId === null ? null : typeof body.quoteId === "string" && body.quoteId.trim() ? body.quoteId.trim() : undefined;
  if (quoteId === undefined) return NextResponse.json({ error: "Choose a quote, or send null to unlink." }, { status: 400 });

  if (quoteId) {
    const owned = await assertOwnedIds(db, member.companyId, { quoteId });
    if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status });
    const quote = await db.quote.findFirst({ where: { id: quoteId, companyId: member.companyId }, select: { clientId: true } });
    if (!quote || quote.clientId !== found.tender.clientId) {
      return NextResponse.json({ error: "That quote is for a different client than this tender's buyer." }, { status: 400 });
    }
  }

  const updated = await db.tender.update({
    where: { id: found.tender.id, companyId: member.companyId },
    data: { quoteId },
    select: TENDER_SELECT,
  });

  await recordActivity(member, {
    action: quoteId ? "tender.quote_linked" : "tender.quote_unlinked",
    entityType: "tender",
    entityId: updated.id,
    summary: quoteId ? `Linked a quote to tender ${updated.title}` : `Unlinked the quote from tender ${updated.title}`,
    metadata: { tenderId: updated.id, quoteId, previousQuoteId: found.tender.quoteId },
  });

  return NextResponse.json(await detailPayload(db, member, gate.full, updated));
}
