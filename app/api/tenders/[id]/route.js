// app/api/tenders/[id]/route.js
//
// One tender. GET reads it with its documents and the buyer's quotes (the
// ones that can be linked as our bid); PATCH edits its fields. Status moves
// go through ./status, the bid quote through ./quote, the job through ./job —
// each of those has a rule this route must not be a way around.
//
// No DELETE: a tender that should not have been entered is marked cancelled
// or no-bid, which keeps the record of what the company looked at — the
// thing the next bid/no-bid decision is made from.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { assertOwnedIds } from "@/lib/tenant/ownedIds";
import { recordActivity } from "@/lib/activity/log";
import { requireTenderRead, requireTenderWrite, tenderCapabilities } from "@/lib/tenders/access";
import { parseTenderBody, finaliseTenderWrite } from "@/lib/tenders/payload";
import { TENDER_SELECT } from "@/lib/tenders/load";
import { detailPayload } from "@/lib/tenders/detail";
import { companyTimeZone } from "@/lib/tenders/time";
import { gateMember, findTender, companyZone } from "@/lib/tenders/server";

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const gate = await gateMember(db, member, requireTenderRead);
  if (gate.response) return gate.response;

  const found = await findTender(db, member.companyId, id);
  if (found.response) return found.response;
  return NextResponse.json(await detailPayload(db, member, gate.full, found.tender));
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const gate = await gateMember(db, member, requireTenderWrite);
  if (gate.response) return gate.response;
  const capabilities = tenderCapabilities(gate.full);

  const found = await findTender(db, member.companyId, id);
  if (found.response) return found.response;

  const body = await request.json().catch(() => null);
  const parsed = parseTenderBody(body, {
    creating: false,
    canSeeContacts: capabilities.canSeeContacts,
    canSeeMoney: capabilities.canSeeMoney,
  });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  if (parsed.data.clientId && parsed.data.clientId !== found.tender.clientId) {
    const owned = await assertOwnedIds(db, member.companyId, { clientId: parsed.data.clientId });
    if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status });
  }

  const final = finaliseTenderWrite(found.tender, parsed.data, {
    defaultTimeZone: companyTimeZone(await companyZone(db, member.companyId)),
  });
  if (!final.ok) return NextResponse.json({ error: final.error }, { status: final.status });

  const updated = await db.tender.update({
    where: { id: found.tender.id, companyId: member.companyId },
    data: final.data,
    select: TENDER_SELECT,
  });

  await recordActivity(member, {
    action: "tender.updated",
    entityType: "tender",
    entityId: updated.id,
    summary: `Edited tender ${updated.title}`,
    metadata: { tenderId: updated.id, fields: Object.keys(parsed.data) },
  });

  return NextResponse.json(await detailPayload(db, member, gate.full, updated));
}
