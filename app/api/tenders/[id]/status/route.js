// app/api/tenders/[id]/status/route.js
//
// POST { status, reason?, submittedAt?, confirmationNumber?, contractNumber?,
//        awardedValue?, winningPrice?, winnerName?, debriefNotes? }
//
// Moves a tender along lib/tenders/status.js's table. Anything not in the
// table is a 409; a no-bid without a reason is a 400. The two money fields a
// move can carry (contract value on a win, the winning price on a loss) are
// refused to a member without showPricing — the same rule the edit route
// applies to the estimated value.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { recordActivity } from "@/lib/activity/log";
import { requireTenderWrite, canSeeTenderMoney } from "@/lib/tenders/access";
import { planTransition, TRANSITION_MONEY_FIELDS } from "@/lib/tenders/status";
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
  if (
    !canSeeTenderMoney(gate.full) &&
    TRANSITION_MONEY_FIELDS.some((f) => body[f] !== undefined && body[f] !== null && body[f] !== "")
  ) {
    return NextResponse.json({ error: "Your access level doesn't include prices." }, { status: 403 });
  }

  const plan = planTransition(found.tender, body.status, body, new Date());
  if (!plan.ok) return NextResponse.json({ error: plan.error }, { status: plan.status });

  // Conditional on the status we read: two people pressing different
  // buttons at once must not both win. The loser gets a 409 and reloads.
  const moved = await db.tender.updateMany({
    where: { id: found.tender.id, companyId: member.companyId, status: found.tender.status },
    data: plan.data,
  });
  if (moved.count === 0) {
    return NextResponse.json({ error: "Someone else changed this tender just now. Reload it and try again." }, { status: 409 });
  }

  await recordActivity(member, {
    action: "tender.status",
    entityType: "tender",
    entityId: found.tender.id,
    summary: `Tender ${found.tender.title}: ${found.tender.status} → ${plan.data.status}`,
    metadata: { tenderId: found.tender.id, from: found.tender.status, to: plan.data.status },
  });

  const fresh = await db.tender.findFirst({ where: { id: found.tender.id, companyId: member.companyId }, select: TENDER_SELECT });
  return NextResponse.json(await detailPayload(db, member, gate.full, fresh));
}
